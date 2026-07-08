interface AddMatchBody {
  bracket?: string
  round?: number
  label?: string | null
  bestOf?: number
  teamAId?: number | null
  teamBId?: number | null
}

/**
 * Добавить произвольный матч в сетку турнира — для ручного дозаполнения
 * (например, задним числом внести уже прошедший турнир). Только админ.
 */
export default defineEventHandler(async (event) => {
  await requireAdmin(event)
  const id = Number(getRouterParam(event, 'id'))
  if (!Number.isInteger(id)) {
    throw createError({ statusCode: 400, statusMessage: 'Некорректный id' })
  }

  const body = await readBody<AddMatchBody>(event)
  const repo = await useRepo()
  return repo.addMatch(id, {
    bracket: typeof body?.bracket === 'string' ? body.bracket : undefined,
    round: Number(body?.round) || undefined,
    label: typeof body?.label === 'string' ? body.label.trim() || null : null,
    bestOf: Number(body?.bestOf) || undefined,
    teamAId: Number(body?.teamAId) || null,
    teamBId: Number(body?.teamBId) || null,
  })
})
