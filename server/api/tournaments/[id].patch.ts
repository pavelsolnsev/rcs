/** Переименовать турнир (в т.ч. завершённый). Только админ. */
export default defineEventHandler(async (event) => {
  await requireAdmin(event)
  const id = Number(getRouterParam(event, 'id'))
  if (!Number.isInteger(id)) {
    throw createError({ statusCode: 400, statusMessage: 'Некорректный id' })
  }
  const body = await readBody<{ name?: string }>(event)
  const name = typeof body?.name === 'string' ? body.name.trim() : ''
  if (!name) throw createError({ statusCode: 400, statusMessage: 'Укажите название турнира' })
  if (name.length > 200) {
    throw createError({ statusCode: 400, statusMessage: 'Название слишком длинное (до 200 символов)' })
  }

  const repo = await useRepo()
  await repo.renameTournament(id, name)
  return { id, name }
})
