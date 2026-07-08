<script setup lang="ts">
interface Team { id: number; name: string; logoUrl?: string | null }
interface Match {
  id: number; bracket: string; round: number; position: number
  teamAId: number | null; teamBId: number | null
  scoreA: number; scoreB: number; status: string
  winnerTeamId: number | null; nextMatchId: number | null; label?: string | null
}

const props = defineProps<{ matches: Match[]; teams: Team[]; editable?: boolean }>()
const emit = defineEmits<{
  save: [
    p: { id: number; scoreA: number; scoreB: number; status: string; bestOf?: number; maps?: unknown },
  ]
}>()

const teamMap = computed<Record<number, Team>>(() => {
  const m: Record<number, Team> = {}
  for (const t of props.teams) m[t.id] = t
  return m
})

// Колонки: сортируем по (ранг ветки, раунд). Гранд-финал всегда последним.
const columns = computed(() => {
  const map = new Map<string, { order: number; title: string; matches: Match[] }>()
  for (const m of props.matches) {
    const isReset = m.bracket === 'grand_final_reset'
    const isGf = m.bracket === 'grand_final'
    const key = isReset ? 'gfr' : isGf ? 'gf' : `${m.bracket}:${m.round}`
    const order = isReset ? 100001 : isGf ? 100000 : m.round
    if (!map.has(key)) {
      map.set(key, { order, title: m.label || `Раунд ${m.round}`, matches: [] })
    }
    map.get(key)!.matches.push(m)
  }
  return [...map.values()]
    .sort((a, b) => a.order - b.order)
    .map((c) => ({ ...c, matches: c.matches.sort((a, b) => a.position - b.position) }))
})

const content = ref<HTMLElement | null>(null)
const matchesRef = computed(() => props.matches)
const { paths, size } = useBracketConnectors(content, matchesRef)

// Уникальный id маркера-стрелки на инстанс компонента
const arrowId = `arrow-${Math.random().toString(36).slice(2, 8)}`

</script>

<template>
  <div class="bracket-scroll -mx-3 overflow-x-auto px-3 pb-4 sm:mx-0 sm:px-0">
    <div ref="content" class="relative flex min-w-max gap-5 sm:gap-8 md:gap-12">
      <!-- Слой линий-коннекторов -->
      <svg
        class="pointer-events-none absolute inset-0"
        :width="size.w"
        :height="size.h"
        fill="none"
      >
        <defs>
          <marker
            :id="arrowId"
            markerWidth="8"
            markerHeight="8"
            refX="6.5"
            refY="3"
            orient="auto"
          >
            <path d="M0,0 L6,3 L0,6" fill="none" stroke="var(--color-brand)" stroke-width="1.5" />
          </marker>
        </defs>
        <path
          v-for="(d, i) in paths"
          :key="i"
          :d="d"
          stroke="var(--color-border)"
          stroke-width="2"
          :marker-end="`url(#${arrowId})`"
        />
      </svg>

      <div
        v-for="(col, ci) in columns"
        :key="ci"
        class="relative z-10 flex flex-col justify-around gap-4 sm:gap-6"
      >
        <div class="text-center text-[11px] font-semibold uppercase tracking-wider text-slate-500 sm:text-xs">
          {{ col.title }}
        </div>
        <div v-for="m in col.matches" :key="m.id" :data-match-id="m.id" class="w-48 shrink-0 sm:w-56">
          <MatchCard :match="m" :team-map="teamMap" :editable="editable" @save="emit('save', $event)" />
        </div>
      </div>
    </div>
  </div>
</template>
