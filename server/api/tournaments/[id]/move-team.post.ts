/** Переносит команду в другую группу (перетаскиванием). Только админ. */
export default defineEventHandler(async (event) => {
  await requireAdmin(event)
  const id = Number(getRouterParam(event, 'id'))
  if (!Number.isInteger(id)) {
    throw createError({ statusCode: 400, statusMessage: 'Некорректный id' })
  }
  const body = await readBody<{ teamId?: number; targetLabel?: string }>(event)
  const teamId = Number(body?.teamId)
  const targetLabel = String(body?.targetLabel ?? '').trim()
  if (!Number.isInteger(teamId) || !targetLabel) {
    throw createError({ statusCode: 400, statusMessage: 'Нужны команда и группа назначения' })
  }

  const repo = await useRepo()
  await repo.moveTeamToGroup(id, teamId, targetLabel)
  return { ok: true }
})
