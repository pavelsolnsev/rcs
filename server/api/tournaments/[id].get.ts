/** Полные данные турнира: сам турнир, команды и все матчи. Доступно всем. */
export default defineEventHandler(async (event) => {
  const id = Number(getRouterParam(event, 'id'))
  if (!Number.isInteger(id)) {
    throw createError({ statusCode: 400, statusMessage: 'Некорректный id' })
  }

  const repo = await useRepo()
  const data = await repo.getTournament(id)
  if (!data) throw createError({ statusCode: 404, statusMessage: 'Турнир не найден' })
  return data
})
