import { normalizeSiteUrl } from '../utils/seo'

export default defineEventHandler((event) => {
  const config = useRuntimeConfig()
  const siteUrl = normalizeSiteUrl(config.public.siteUrl)

  setHeader(event, 'Content-Type', 'text/plain; charset=utf-8')
  return [
    'User-agent: *',
    'Allow: /',
    'Disallow: /admin',
    'Disallow: /admin/',
    'Disallow: /api/',
    '',
    `Sitemap: ${siteUrl}/sitemap.xml`,
  ].join('\n')
})
