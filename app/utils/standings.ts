// Единый источник правды — общий модуль в shared/, чтобы таблица на клиенте
// и посев плей-офф на сервере считались одинаково.
export { computeStandings } from '#shared/utils/standings'
export type { Standing } from '#shared/utils/standings'
