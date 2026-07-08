/** Список всех турниров. Доступно всем. */
export default defineEventHandler(async () => {
  const repo = await useRepo()
  return repo.listTournaments()
})
