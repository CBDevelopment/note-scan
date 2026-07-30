import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { auth } from '@/lib/auth'
import {
  Document,
  Packer,
  Paragraph,
  TextRun,
  HeadingLevel,
  AlignmentType,
} from 'docx'
import { parseMarkdown } from '@/lib/google/docs'

const schema = z.object({
  title: z.string().min(1).max(500),
  content: z.string().max(200_000),
})

const HEADING_LEVELS: Record<number, (typeof HeadingLevel)[keyof typeof HeadingLevel]> = {
  1: HeadingLevel.HEADING_1,
  2: HeadingLevel.HEADING_2,
  3: HeadingLevel.HEADING_3,
}

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const parsed = schema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid request' }, { status: 422 })
  }

  const { title, content } = parsed.data

  const elements = parseMarkdown(content)

  const paragraphs: Paragraph[] = [
    // Document title as TITLE style
    new Paragraph({
      text: title,
      heading: HeadingLevel.TITLE,
    }),
    // Spacer
    new Paragraph({ text: '' }),
  ]

  for (const el of elements) {
    const runs = el.runs.map(
      (r) =>
        new TextRun({
          text: r.text,
          bold: r.bold ?? false,
          italics: r.italic ?? false,
        })
    )

    if (el.type === 'heading') {
      paragraphs.push(
        new Paragraph({
          children: runs,
          heading: HEADING_LEVELS[el.level ?? 1] ?? HeadingLevel.HEADING_1,
        })
      )
      continue
    }

    if (el.type === 'bullet') {
      paragraphs.push(
        new Paragraph({
          children: runs,
          bullet: { level: el.indent },
        })
      )
      continue
    }

    if (el.type === 'numbered') {
      paragraphs.push(
        new Paragraph({
          children: runs,
          numbering: { reference: 'default-numbering', level: el.indent },
        })
      )
      continue
    }

    // paragraph
    paragraphs.push(
      new Paragraph({
        children: runs,
        alignment: AlignmentType.LEFT,
      })
    )
  }

  const doc = new Document({
    numbering: {
      config: [
        {
          reference: 'default-numbering',
          levels: Array.from({ length: 9 }, (_, i) => ({
            level: i,
            format: 'decimal' as const,
            text: `%${i + 1}.`,
            alignment: AlignmentType.LEFT,
            style: {
              paragraph: {
                indent: { left: 720 * (i + 1), hanging: 360 },
              },
            },
          })),
        },
      ],
    },
    sections: [
      {
        children: paragraphs,
      },
    ],
  })

  const buffer = await Packer.toBuffer(doc)

  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'Content-Disposition': `attachment; filename="document.docx"`,
    },
  })
}
