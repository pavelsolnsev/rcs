/** Меняет две команды местами в группах (обмен группами). Только админ. */
export default defineEventHandler(async (event) => {
  await requireAdmin(event)
  const id = Number(getRouterParam(event, 'id'))
  if (!Number.isInteger(id)) {
    throw createError({ statusCode: 400, statusMessage: 'Некорректный id' })
  }
  const body = await readBody<{ teamA?: number; teamB?: number }>(event)
  const teamA = Number(body?.teamA)
  const teamB = Number(body?.teamB)
  if (!Number.isInteger(teamA) || !Number.isInteger(teamB) || teamA === teamB) {
    throw createError({ statusCode: 400, statusMessage: 'Нужно выбрать две разные команды' })
  }

  const repo = await useRepo()
  await repo.swapGroupTeams(id, teamA, teamB)
  return { ok: true }
})
