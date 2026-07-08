import type { Ref } from 'vue'

interface LinkedMatch {
  id: number
  nextMatchId?: number | null
}

/**
 * Рисует линии-коннекторы между матчами внутри одной сетки.
 * Измеряет позиции элементов [data-match-id] относительно контента
 * и строит «уголковые» SVG-пути от матча к его следующему матчу.
 */
export function useBracketConnectors(
  contentRef: Ref<HTMLElement | null>,
  matchesRef: Ref<LinkedMatch[]>,
) {
  const paths = ref<string[]>([])
  const size = reactive({ w: 0, h: 0 })
  let ro: ResizeObserver | null = null

  function recompute() {
    const content = contentRef.value
    if (!content) return
    const base = content.getBoundingClientRect()
    size.w = content.scrollWidth
    size.h = content.scrollHeight

    const rectById = new Map<number, { left: number; top: number; w: number; h: number }>()
    content.querySelectorAll<HTMLElement>('[data-match-id]').forEach((el) => {
      const r = el.getBoundingClientRect()
      rectById.set(Number(el.dataset.matchId), {
        left: r.left - base.left,
        top: r.top - base.top,
        w: r.width,
        h: r.height,
      })
    })

    const out: string[] = []
    for (const m of matchesRef.value) {
      if (!m.nextMatchId) continue
      const s = rectById.get(m.id)
      const d = rectById.get(m.nextMatchId)
      if (!s || !d) continue
      const sx = s.left + s.w
      const sy = s.top + s.h / 2
      const dx = d.left
      const dy = d.top + d.h / 2
      const mx = sx + Math.max(12, (dx - sx) / 2)
      out.push(`M${sx},${sy} L${mx},${sy} L${mx},${dy} L${dx},${dy}`)
    }
    paths.value = out
  }

  onMounted(async () => {
    await nextTick()
    recompute()
    ro = new ResizeObserver(() => recompute())
    if (contentRef.value) ro.observe(contentRef.value)
    window.addEventListener('resize', recompute)
  })

  onBeforeUnmount(() => {
    ro?.disconnect()
    window.removeEventListener('resize', recompute)
  })

  watch(matchesRef, () => nextTick(recompute), { deep: true })

  return { paths, size, recompute }
}
