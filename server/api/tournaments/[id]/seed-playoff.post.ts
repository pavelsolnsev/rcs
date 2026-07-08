/** Формирует плей-офф по итогам групп (кросс-посев). Только админ. */
export default defineEventHandler(async (event) => {
  await requireAdmin(event)
  const id = Number(getRouterParam(event, 'id'))
  if (!Number.isInteger(id)) {
    throw createError({ statusCode: 400, statusMessage: 'Некорректный id' })
  }
  const body = await readBody<{ qualifiers?: number }>(event)
  const qualifiers = Number(body?.qualifiers) || 2

  const repo = await useRepo()
  return repo.seedPlayoff(id, qualifiers)
})
