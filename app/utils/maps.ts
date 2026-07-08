/** Пулы карт CS2 по формату команд. */
export const MAP_POOLS: Record<string, string[]> = {
  '5x5': [
    'de_mirage',
    'de_dust2',
    'de_inferno',
    'de_nuke',
    'de_ancient',
    'de_anubis',
    'de_overpass',
    'de_train',
    'de_cache',
  ],
  // Пул для 2x2 (wingman)
  '2x2': [
    'de_nuke',
    'de_inferno',
    'de_dust2_wingman',
    'de_mirage_wingman',
    'de_train_wingman',
    'de_anubis_wingman',
    'gd_rialto',
    'de_overpass',
    'de_vertigo',
    'de_lake',
  ],
  '1x1': [],
}

/** Карты, для которых в проекте есть фоновые webp-изображения. */
const MAP_BG_AVAILABLE = new Set([
  'de_ancient',
  'de_anubis',
  'de_cache',
  'de_dust2',
  'de_inferno',
  'de_lake',
  'de_mirage',
  'de_nuke',
  'de_overpass',
  'de_train',
  'de_vertigo',
])

/** Алиасы, если имя карты в матче отличается от имени файла ассета. */
const MAP_BG_ALIASES: Record<string, string> = {
  de_dust2_wingman: 'de_dust2',
  de_mirage_wingman: 'de_mirage',
  de_train_wingman: 'de_train',
  de_anubis_wingman: 'de_anubis',
  gd_rialto: 'de_overpass',
}

/** Список карт для формата (fallback — 5x5). */
export function mapsFor(teamSize?: string | null): string[] {
  const pool = MAP_POOLS[teamSize ?? '5x5']
  return pool && pool.length ? pool : (MAP_POOLS['5x5'] ?? [])
}

/** Красивое имя карты: de_mirage → Mirage, de_dust2_wingman → Dust2 Wingman, gd_rialto → Rialto. */
export function mapLabel(map?: string | null): string {
  if (!map) return 'Карта'
  return map
    .replace(/^[a-z]{2,3}_/, '') // убираем префикс игры: de_, gd_, cs_ и т.п.
    .split('_')
    .map((w) => (w ? w[0]!.toUpperCase() + w.slice(1) : w))
    .join(' ')
}

/** Опции для дропдауна выбора карты. */
export function mapOptions(teamSize?: string | null) {
  return mapsFor(teamSize).map((m) => ({ value: m, label: mapLabel(m) }))
}

/** Ключ фоновой картинки карты (с учётом алиасов и wingman-вариантов). */
export function mapBackgroundKey(map?: string | null): string | null {
  if (!map) return null
  const direct = MAP_BG_ALIASES[map] ?? map
  if (MAP_BG_AVAILABLE.has(direct)) return direct

  const base = direct.replace(/_wingman$/, '')
  if (MAP_BG_AVAILABLE.has(base)) return base

  return null
}

/** Путь к фоновой картинке карты в public. */
export function mapBackgroundPath(map?: string | null): string | null {
  const key = mapBackgroundKey(map)
  return key ? `/maps/${key}.webp` : null
}
