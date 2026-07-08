/** Чистые вспомогательные функции для построения сеток. */

/** Ближайшая сверху степень двойки (2, 4, 8, 16, ...). */
export function nextPowerOfTwo(n: number): number {
  let p = 1
  while (p < n) p *= 2
  return Math.max(p, 2)
}

/**
 * Порядок посева для сетки размера size (1-индексированный).
 * Пример для 4: [1, 4, 2, 3] — чтобы сеяные не встретились рано.
 */
export function seedOrder(size: number): number[] {
  let rounds = [1, 2]
  while (rounds.length < size) {
    const next: number[] = []
    const total = rounds.length * 2 + 1
    for (const r of rounds) {
      next.push(r)
      next.push(total - r)
    }
    rounds = next
  }
  return rounds
}
