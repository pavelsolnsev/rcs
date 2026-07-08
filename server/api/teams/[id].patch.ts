interface RosterPlayer {
  nickname?: string
  role?: 'captain' | 'player'
  steamId?: string | null
}

/** Обновляет команду: название, лого, состав. Сетку не трогает. Только админ. */
export default defineEventHandler(async (event) => {
  await requireAdmin(event)
  const id = Number(getRouterParam(event, 'id'))
  if (!Number.isInteger(id)) {
    throw createError({ statusCode: 400, statusMessage: 'Некорректный id' })
  }
  const body = await readBody<{ name?: string; logoUrl?: string | null; roster?: RosterPlayer[] }>(event)

  const patch: { name?: string; logoUrl?: string | null; roster?: RosterPlayer[] } = {}
  if (typeof body?.name === 'string') {
    const name = body.name.trim()
    if (!name) throw createError({ statusCode: 400, statusMessage: 'Название команды не может быть пустым' })
    patch.name = name
  }
  if (body?.logoUrl !== undefined) {
    patch.logoUrl = typeof body.logoUrl === 'string' ? body.logoUrl.trim() || null : null
  }
  if (Array.isArray(body?.roster)) patch.roster = body.roster

  const repo = await useRepo()
  return repo.updateTeam(id, patch)
})
