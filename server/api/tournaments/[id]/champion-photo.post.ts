/** Фото чемпиона по ссылке. Только админ. */
export default defineEventHandler(async (event) => {
  await requireAdmin(event)
  const id = Number(getRouterParam(event, 'id'))
  if (!Number.isInteger(id)) {
    throw createError({ statusCode: 400, statusMessage: 'Некорректный id' })
  }
  const body = await readBody<{ url?: string; caption?: string | null }>(event)
  const url = String(body?.url ?? '').trim()
  if (!/^https?:\/\//i.test(url)) {
    throw createError({ statusCode: 400, statusMessage: 'Укажите корректную ссылку (http/https)' })
  }
  const repo = await useRepo()
  if (!(await repo.getTournament(id))) {
    throw createError({ statusCode: 404, statusMessage: 'Турнир не найден' })
  }
  return replaceChampionPhoto(id, { url, thumbUrl: null, caption: normalizeCaption(body?.caption) })
})
