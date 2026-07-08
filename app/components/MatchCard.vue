<script setup lang="ts">
import type { Ref } from 'vue'

interface Team {
  id: number
  name: string
  logoUrl?: string | null
}
interface MapRow {
  map: string | null
  scoreA: number
  scoreB: number
}
interface Match {
  id: number
  round: number
  position: number
  bracket?: string
  teamAId: number | null
  teamBId: number | null
  scoreA: number
  scoreB: number
  status: string
  winnerTeamId: number | null
  label?: string | null
  bestOf?: number
  maps?: MapRow[] | null
}

const props = defineProps<{
  match: Match
  teamMap: Record<number, Team>
  editable?: boolean
}>()

const emit = defineEmits<{
  save: [
    payload: {
      id: number
      scoreA: number
      scoreB: number
      status: string
      bestOf: number
      maps: MapRow[]
    },
  ]
}>()

// Формат команд турнира (для пула карт) — прокидывается со страницы турнира
const teamSize = inject<Ref<string> | string>('teamSize', '5x5')
const teamSizeVal = computed(() => (typeof teamSize === 'string' ? teamSize : teamSize.value))

const teamA = computed(() => (props.match.teamAId ? props.teamMap[props.match.teamAId] : null))
const teamB = computed(() => (props.match.teamBId ? props.teamMap[props.match.teamBId] : null))

// Общий на всю сетку id матча в правке (через provide в BracketView).
// Одновременно открыт только один редактор; остальные карточки группы скрываются.
const openMatchId = inject<Ref<number | null>>('openMatchId', ref(null))
const editing = computed(() => openMatchId.value === props.match.id)
const canEdit = computed(() => props.editable && teamA.value && teamB.value)

// Карты с выбранным названием (для показа под составами)
const playedMaps = computed(() => (props.match.maps ?? []).filter((m) => m.map))
const selectedMapBackgrounds = computed(() => {
  const unique = new Set<string>()
  for (const m of playedMaps.value) {
    const bg = mapBackgroundPath(m.map)
    if (bg) unique.add(bg)
  }
  return Array.from(unique).slice(0, 4)
})
const mapBackgroundGridClass = computed(() => {
  const count = selectedMapBackgrounds.value.length
  if (count <= 1) return 'grid-cols-1'
  if (count === 2) return 'grid-cols-2'
  if (count === 3) return 'grid-cols-3'
  return 'grid-cols-2 grid-rows-2'
})

// Победитель карты по счёту: 'a' | 'b' | null (ничья / ещё не сыграна)
const mapWinner = (m: MapRow) => (m.scoreA > m.scoreB ? 'a' : m.scoreB > m.scoreA ? 'b' : null)

// Матч завершён и у слота есть победитель/проигравший
const isWinner = (teamId: number | null) =>
  props.match.winnerTeamId != null && props.match.winnerTeamId === teamId
const hasWinner = computed(() => props.match.winnerTeamId != null)

function openEdit() {
  if (!canEdit.value || editing.value) return
  openMatchId.value = props.match.id
}
function closeEdit() {
  if (editing.value) openMatchId.value = null
}

const touchStart = ref<{ x: number; y: number } | null>(null)

function onCardTouchStart(e: TouchEvent) {
  const t = e.changedTouches[0]
  if (!t) return
  touchStart.value = { x: t.clientX, y: t.clientY }
}

function onCardTouchEnd(e: TouchEvent) {
  const t = e.changedTouches[0]
  const start = touchStart.value
  touchStart.value = null
  if (!t || !start) {
    openEdit()
    return
  }
  const moved = Math.abs(t.clientX - start.x) + Math.abs(t.clientY - start.y)
  if (moved <= 12) openEdit()
}

function onEditorSave(p: {
  maps: MapRow[]
  scoreA: number
  scoreB: number
  status: string
  bestOf: number
}) {
  emit('save', { id: props.match.id, ...p })
  closeEdit()
}
</script>

<template>
  <!-- Клик по всей карточке открывает редактор. Обработчик на самом контейнере
       (а не на прозрачном оверлее) — так тап надёжно срабатывает в Safari на iOS. -->
  <div
    class="card relative w-full overflow-hidden transition-colors focus:outline-none"
    :class="
      canEdit && !editing
        ? 'cursor-pointer touch-manipulation hover:border-brand/60 focus-visible:border-brand'
        : ''
    "
    :role="canEdit && !editing ? 'button' : undefined"
    :tabindex="canEdit && !editing ? 0 : undefined"
    :aria-label="
      canEdit && !editing ? `Редактировать ${match.label || `матч ${match.position + 1}`}` : undefined
    "
    @click="openEdit"
    @touchstart.passive="onCardTouchStart"
    @touchend="onCardTouchEnd"
    @keydown.enter.prevent="openEdit"
    @keydown.space.prevent="openEdit"
  >
    <!-- Ненавязчивый фон по выбранным картам -->
    <div v-if="selectedMapBackgrounds.length" class="pointer-events-none absolute inset-0 z-0 overflow-hidden">
      <div class="grid h-full w-full" :class="mapBackgroundGridClass">
        <div v-for="bg in selectedMapBackgrounds" :key="bg" class="relative">
          <img :src="bg" alt="" class="h-full w-full object-cover brightness-75 saturate-75" loading="lazy" />
          <div class="absolute inset-0 bg-slate-950/50" />
        </div>
      </div>
      <div class="absolute inset-0 bg-gradient-to-b from-slate-950/30 via-slate-950/55 to-slate-950/75" />
    </div>

    <div class="relative z-10">
    <!-- Шапка: название матча, формат, статус -->
    <div class="flex items-center justify-between gap-2 px-3 pt-2 pb-1.5">
      <span class="flex min-w-0 items-center gap-1.5">
        <span class="truncate text-[11px] font-semibold uppercase tracking-wide text-slate-400">
          {{ match.label || `Матч ${match.position + 1}` }}
        </span>
        <span
          class="shrink-0 rounded bg-surface-2 px-1.5 py-px text-[10px] font-bold tracking-wide text-slate-400"
        >
          BO{{ match.bestOf ?? 1 }}
        </span>
      </span>
      <StatusBadge :status="match.status" size="sm" class="shrink-0" />
    </div>

    <!-- Команды -->
    <div>
      <div
        v-for="(slot, i) in [
          { team: teamA, score: match.scoreA, id: match.teamAId },
          { team: teamB, score: match.scoreB, id: match.teamBId },
        ]"
        :key="i"
        class="flex h-10 items-center gap-2 px-3"
        :class="[
          i === 0 ? 'border-b border-border' : '',
          isWinner(slot.id) ? 'bg-win/10 shadow-[inset_2px_0_0_var(--color-win)]' : '',
        ]"
      >
        <img
          v-if="slot.team?.logoUrl"
          :src="slot.team.logoUrl"
          class="h-6 w-6 shrink-0 rounded object-contain"
          alt=""
        />
        <span
          class="min-w-0 flex-1 truncate text-sm"
          :class="
            slot.team
              ? isWinner(slot.id)
                ? 'font-semibold text-white'
                : hasWinner
                  ? 'text-slate-300'
                  : 'text-slate-100'
              : 'italic text-slate-600'
          "
        >
          {{ slot.team?.name ?? 'Ожидается' }}
        </span>
        <span
          class="min-w-7 shrink-0 text-right text-base font-bold tabular-nums"
          :class="isWinner(slot.id) ? 'text-win' : slot.team ? 'text-slate-300' : 'text-slate-600'"
        >
          {{ slot.team ? slot.score : '·' }}
        </span>
      </div>
    </div>

    <!-- Сыгранные карты -->
    <div
      v-if="playedMaps.length"
      class="flex flex-wrap items-center gap-1.5 border-t border-border px-3 py-2.5"
    >
      <span
        v-for="(m, i) in playedMaps"
        :key="i"
        class="inline-flex items-stretch overflow-hidden rounded-md border border-border font-semibold leading-none"
      >
        <span class="flex items-center bg-surface-2 px-2 py-1.5 text-xs text-slate-100">
          {{ mapLabel(m.map) }}
        </span>
        <span
          v-if="(match.bestOf ?? 1) > 1"
          class="flex items-center gap-1.5 bg-bg px-2 py-1"
        >
          <span
            class="flex items-center gap-1 tabular-nums"
            :class="mapWinner(m) === 'a' ? 'font-bold text-win' : 'text-slate-500'"
          >
            <span class="max-w-[4.5rem] truncate text-xs">{{ teamA?.name }}</span>
            <span class="text-sm">{{ m.scoreA }}</span>
          </span>
          <span class="text-sm text-slate-600">:</span>
          <span
            class="flex items-center gap-1 tabular-nums"
            :class="mapWinner(m) === 'b' ? 'font-bold text-win' : 'text-slate-500'"
          >
            <span class="text-sm">{{ m.scoreB }}</span>
            <span class="max-w-[4.5rem] truncate text-xs">{{ teamB?.name }}</span>
          </span>
        </span>
      </span>
    </div>

    <!-- Редактор для админа -->
    <MatchEditor
      v-if="editing"
      :best-of="match.bestOf ?? 1"
      :maps="match.maps"
      :team-size="teamSizeVal"
      :status="match.status"
      @save="onEditorSave"
      @cancel="closeEdit"
    />
    </div>
  </div>
</template>
