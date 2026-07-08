import { escapeXml, normalizeSiteUrl } from '../utils/seo'

interface SitemapUrl {
  loc: string
  lastmod?: string
  changefreq?: 'always' | 'hourly' | 'daily' | 'weekly' | 'monthly' | 'yearly' | 'never'
  priority?: string
}

function toAbsolute(siteUrl: string, path: string) {
  if (path.startsWith('http://') || path.startsWith('https://')) return path
  return `${siteUrl}${path.startsWith('/') ? path : `/${path}`}`
}

export default defineEventHandler(async (event) => {
  const config = useRuntimeConfig()
  const siteUrl = normalizeSiteUrl(config.public.siteUrl)
  const repo = await useRepo()
  const tournaments = await repo.listTournaments()

  const urls: SitemapUrl[] = [
    { loc: toAbsolute(siteUrl, '/'), changefreq: 'hourly', priority: '1.0' },
    { loc: toAbsolute(siteUrl, '/archive'), changefreq: 'daily', priority: '0.8' },
  ]

  for (const t of tournaments ?? []) {
    const ts = t.finishedAt || t.createdAt
    const lastmod = ts ? new Date(ts).toISOString() : undefined
    urls.push({
      loc: toAbsolute(siteUrl, `/tournaments/${t.id}`),
      lastmod,
      changefreq: t.status === 'finished' ? 'weekly' : 'hourly',
      priority: t.status === 'finished' ? '0.7' : '0.9',
    })
  }

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls
  .map((u) => {
    const chunks = [
      `<loc>${escapeXml(u.loc)}</loc>`,
      u.lastmod ? `<lastmod>${escapeXml(u.lastmod)}</lastmod>` : '',
      u.changefreq ? `<changefreq>${u.changefreq}</changefreq>` : '',
      u.priority ? `<priority>${u.priority}</priority>` : '',
    ].filter(Boolean)
    return `  <url>\n    ${chunks.join('\n    ')}\n  </url>`
  })
  .join('\n')}
</urlset>`

  setHeader(event, 'Content-Type', 'application/xml; charset=utf-8')
  setHeader(event, 'Cache-Control', 'public, max-age=600')
  return xml
})
