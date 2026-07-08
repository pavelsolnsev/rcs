export function normalizeSiteUrl(input: string | undefined | null): string {
  const raw = (input || '').trim()
  if (!raw) return 'http://localhost:3000'
  return raw.endsWith('/') ? raw.slice(0, -1) : raw
}

export function escapeXml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&apos;')
}
