/** Удалить матч из сетки (например, несыгранный финал). Только админ. */
export default defineEventHandler(async (event) => {
  await requireAdmin(event)
  const id = Number(getRouterParam(event, 'id'))
  if (!Number.isInteger(id)) {
    throw createError({ statusCode: 400, statusMessage: 'Некорректный id' })
  }
  const repo = await useRepo()
  await repo.deleteMatch(id)
  return { ok: true }
})
