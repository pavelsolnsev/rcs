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
  delete: [id: number]
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
const showBracketTools = computed(() => props.teams.length > 8)
const selectedTeamRaw = ref('')
const selectedTeamId = computed<number | null>(() => {
  const n = Number(selectedTeamRaw.value)
  return Number.isInteger(n) && n > 0 ? n : null
})
const teamOptions = computed(() =>
  props.teams
    .map((t) => ({ id: t.id, name: t.name }))
    .sort((a, b) => a.name.localeCompare(b.name, 'ru')),
)
const matchById = computed(() => new Map(props.matches.map((m) => [m.id, m] as const)))
const highlightedMatchIds = computed(() => {
  const teamId = selectedTeamId.value
  if (!teamId) return new Set<number>()
  const out = new Set<number>()
  const visited = new Set<number>()
  const walk = (id: number) => {
    if (visited.has(id)) return
    visited.add(id)
    const m = matchById.value.get(id)
    if (!m) return
    out.add(id)
    if (!m.nextMatchId) return
    // Если матч завершён и выбранная команда проиграла — дальше не подсвечиваем.
    if (m.status === 'finished' && m.winnerTeamId && m.winnerTeamId !== teamId) return
    walk(m.nextMatchId)
  }
  for (const m of props.matches) {
    if (m.teamAId === teamId || m.teamBId === teamId) walk(m.id)
  }
  return out
})
const focusMatchId = computed<number | null>(() => {
  const teamId = selectedTeamId.value
  if (!teamId) return null
  const path = [...highlightedMatchIds.value]
    .map((id) => matchById.value.get(id))
    .filter((m): m is Match => Boolean(m))
    .sort((a, b) => a.round - b.round || a.position - b.position)
  const next = path.find((m) => m.status !== 'finished')
  if (next) return next.id
  return path[path.length - 1]?.id ?? null
})

const scroller = ref<HTMLElement | null>(null)
const canScrollLeft = ref(false)
const canScrollRight = ref(false)
const activeColumnIdx = ref(0)

function updateScrollUi() {
  const el = scroller.value
  if (!el) return
  const maxLeft = Math.max(0, el.scrollWidth - el.clientWidth)
  canScrollLeft.value = el.scrollLeft > 8
  canScrollRight.value = el.scrollLeft < maxLeft - 8

  const colEls = Array.from(el.querySelectorAll<HTMLElement>('[data-col-idx]'))
  if (!colEls.length) return
  const centerX = el.scrollLeft + el.clientWidth / 2
  let bestIdx = 0
  let bestDist = Number.POSITIVE_INFINITY
  for (const node of colEls) {
    const idx = Number(node.dataset.colIdx)
    const nodeCenter = node.offsetLeft + node.offsetWidth / 2
    const dist = Math.abs(nodeCenter - centerX)
    if (dist < bestDist) {
      bestDist = dist
      bestIdx = idx
    }
  }
  activeColumnIdx.value = Math.max(0, Math.min(columns.value.length - 1, bestIdx))
}

function scrollToColumn(index: number) {
  const el = scroller.value
  if (!el) return
  const target = el.querySelector<HTMLElement>(`[data-col-idx="${index}"]`)
  if (!target) return
  const left = Math.max(0, target.offsetLeft - 12)
  el.scrollTo({ left, behavior: 'smooth' })
}
function scrollToMatch(matchId: number) {
  const el = scroller.value
  if (!el) return
  const matchEl = el.querySelector<HTMLElement>(`[data-match-id="${matchId}"]`)
  if (!matchEl) return
  const left = Math.max(0, matchEl.offsetLeft - 12)
  el.scrollTo({ left, behavior: 'smooth' })
}

function scrollByViewport(direction: -1 | 1) {
  const el = scroller.value
  if (!el) return
  el.scrollBy({ left: direction * Math.max(220, Math.round(el.clientWidth * 0.85)), behavior: 'smooth' })
}
function onScrollerWheel(e: WheelEvent) {
  const el = scroller.value
  if (!el) return
  const horizontalIntent = Math.abs(e.deltaX) > Math.abs(e.deltaY) || e.shiftKey
  if (horizontalIntent) {
    const delta = Math.abs(e.deltaX) > 0 ? e.deltaX : e.deltaY
    if (Math.abs(delta) < 0.5) return
    e.preventDefault()
    el.scrollLeft += delta
    updateScrollUi()
    return
  }
  // Вертикальное колесо над сеткой — прокручиваем страницу, не "запираем" курсор в сетке.
  const pageScroller = el.closest('.app-scroll') as HTMLElement | null
  if (!pageScroller) return
  e.preventDefault()
  pageScroller.scrollBy({ top: e.deltaY, behavior: 'auto' })
}

const content = ref<HTMLElement | null>(null)
const matchesRef = computed(() => props.matches)
const { paths, size } = useBracketConnectors(content, matchesRef)

// Уникальный id маркера-стрелки на инстанс компонента
const arrowId = `arrow-${Math.random().toString(36).slice(2, 8)}`

watch(columns, () => nextTick(updateScrollUi), { deep: true })
watch(
  focusMatchId,
  (id) => {
    if (!id) return
    nextTick(() => scrollToMatch(id))
  },
)

onMounted(() => {
  nextTick(updateScrollUi)
})

</script>

<template>
  <div class="space-y-3">
    <div v-if="showBracketTools" class="flex flex-wrap items-center justify-between gap-2">
      <div class="flex min-w-0 flex-wrap items-center gap-1.5">
        <button
          v-for="(col, ci) in columns"
          :key="`jump-${ci}`"
          type="button"
          class="cursor-pointer rounded-md border px-2 py-1 text-[11px] font-semibold transition-colors sm:text-xs"
          :class="
            activeColumnIdx === ci
              ? 'border-brand bg-brand/15 text-white'
              : 'border-border bg-surface-2 text-slate-300 hover:border-brand/60 hover:text-white'
          "
          @click="scrollToColumn(ci)"
        >
          {{ col.title }}
        </button>
      </div>
      <div class="flex items-center gap-1.5">
        <select
          v-model="selectedTeamRaw"
          class="max-w-[12rem] rounded-md border border-border bg-surface-2 px-2 py-1 text-xs text-slate-200 outline-none focus:border-brand sm:max-w-[16rem]"
        >
          <option value="">Фокус: все команды</option>
          <option v-for="t in teamOptions" :key="t.id" :value="String(t.id)">
            {{ t.name }}
          </option>
        </select>
        <button
          type="button"
          class="cursor-pointer rounded-md border border-border bg-surface-2 px-2 py-1 text-xs text-slate-300 transition-colors hover:border-brand/60 hover:text-white disabled:cursor-not-allowed disabled:opacity-40"
          :disabled="!focusMatchId"
          @click="focusMatchId && scrollToMatch(focusMatchId)"
        >
          Следующий матч
        </button>
        <button
          type="button"
          class="cursor-pointer rounded-md border border-border bg-surface-2 px-2 py-1 text-xs text-slate-300 transition-colors hover:border-brand/60 hover:text-white disabled:cursor-not-allowed disabled:opacity-40"
          :disabled="!canScrollLeft"
          @click="scrollByViewport(-1)"
        >
          ←
        </button>
        <button
          type="button"
          class="cursor-pointer rounded-md border border-border bg-surface-2 px-2 py-1 text-xs text-slate-300 transition-colors hover:border-brand/60 hover:text-white disabled:cursor-not-allowed disabled:opacity-40"
          :disabled="!canScrollRight"
          @click="scrollByViewport(1)"
        >
          →
        </button>
      </div>
    </div>

    <div class="relative">
      <div
        ref="scroller"
        class="bracket-scroll -mx-3 overflow-x-auto overflow-y-hidden px-3 pb-4 sm:mx-0 sm:px-0"
        @scroll="updateScrollUi"
        @wheel="onScrollerWheel"
      >
        <div ref="content" class="relative flex min-w-max gap-5 snap-x snap-mandatory sm:gap-8 md:gap-12">
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
            :data-col-idx="ci"
            class="relative z-10 flex snap-start flex-col justify-around gap-4 sm:gap-6"
          >
            <div class="text-center text-[11px] font-semibold uppercase tracking-wider text-slate-500 sm:text-xs">
              {{ col.title }}
            </div>
            <div v-for="m in col.matches" :key="m.id" :data-match-id="m.id" class="w-48 shrink-0 sm:w-56">
              <MatchCard
                :match="m"
                :team-map="teamMap"
                :editable="editable"
                :highlighted="highlightedMatchIds.has(m.id)"
                @save="emit('save', $event)"
                @delete="emit('delete', $event)"
              />
            </div>
          </div>
        </div>
      </div>

      <div
        v-if="canScrollLeft"
        class="pointer-events-none absolute left-0 top-0 z-20 h-full w-8 bg-gradient-to-r from-bg to-transparent"
      />
      <div
        v-if="canScrollRight"
        class="pointer-events-none absolute right-0 top-0 z-20 h-full w-8 bg-gradient-to-l from-bg to-transparent"
      />
    </div>
  </div>
</template>
