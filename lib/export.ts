// Client-side export helpers

export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

export function toPlainText(markdown: string): string {
  return (
    markdown
      // Strip heading markers
      .replace(/^#{1,6}\s+/gm, '')
      // Bold and italic
      .replace(/\*\*\*(.+?)\*\*\*/g, '$1')
      .replace(/\*\*(.+?)\*\*/g, '$1')
      .replace(/\*(.+?)\*/g, '$1')
      // Inline code
      .replace(/`(.+?)`/g, '$1')
      // Code fences
      .replace(/^```[^\n]*\n([\s\S]*?)```\s*$/gm, '$1')
      // Blockquotes
      .replace(/^>\s+/gm, '')
      .trim()
  )
}

export function slugify(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 80) || 'scan'
}
