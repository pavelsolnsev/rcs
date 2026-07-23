/** Добавляет матч за 3-е место (проигравшие полуфиналов). Только админ. */
export default defineEventHandler(async (event) => {
  await requireAdmin(event)
  const id = Number(getRouterParam(event, 'id'))
  if (!Number.isInteger(id)) {
    throw createError({ statusCode: 400, statusMessage: 'Некорректный id' })
  }

  const repo = await useRepo()
  return repo.addThirdPlaceMatch(id)
})
