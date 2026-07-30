export const TRANSCRIPTION_PROMPT = `You are transcribing a photograph of a handwritten page.

Output the text content of the page as Markdown. Follow these rules exactly:

- Output ONLY the transcription. No preamble, no commentary, no code fences,
  no "Here is the transcription".
- Preserve the structure you see: headings become Markdown headings, bulleted
  lists become "- " items, numbered lists become "1. " items, indented
  sub-points become nested list items.
- Preserve paragraph breaks. Do not merge separate paragraphs.
- Preserve the writer's own words, spelling, and punctuation. Do not correct
  grammar, do not rephrase, do not summarize.
- If a word is genuinely illegible, write [?] in its place. Do not guess.
- If a word is legible but uncertain, write your best reading followed by [?],
  e.g. "meeting[?]".
- Ignore page furniture: page numbers, margin rules, hole punches, the edge of
  the desk.
- Transcribe boxed or circled text as normal text. If something is clearly
  struck through, omit it.
- If the page contains a diagram or drawing you cannot render as text, insert
  a line: [diagram: brief description]
- If the page is blank or contains no legible writing, output nothing at all.`

export function buildPrompt(previousPageTail?: string): string {
  if (!previousPageTail) return TRANSCRIPTION_PROMPT

  const continuation = `This page continues from a previous page. The previous page ended with:\n"...${previousPageTail}"\nIf the first line here continues that sentence or list, transcribe it as a continuation — do not add a heading or restate context.\n\n`
  return continuation + TRANSCRIPTION_PROMPT
}
