<script setup lang="ts">
interface MapRow {
  map: string | null
  scoreA: number
  scoreB: number
}

const props = defineProps<{
  bestOf: number
  maps?: MapRow[] | null
  teamSize?: string | null
  teamAName?: string
  teamBName?: string
  /** Текущий статус матча — от него зависит набор кнопок */
  status?: string
}>()

const emit = defineEmits<{
  save: [
    p: {
      maps: MapRow[]
      scoreA: number
      scoreB: number
      status: string
      bestOf: number
    },
  ]
  cancel: []
  delete: []
}>()

const bo = ref(props.bestOf || 1)
const rows = ref<MapRow[]>([])
const options = computed(() => mapOptions(props.teamSize))
const activeMapIdx = ref(0)
const isSeries = computed(() => bo.value > 1)

// Пик/бан карт: пул по формату команд, применение — заполняет слоты карт.
const showVeto = ref(false)
const vetoPool = computed(() => mapsFor(props.teamSize))
function applyVeto(maps: string[]) {
  rows.value = maps.map((m) => ({ map: m, scoreA: 0, scoreB: 0 }))
  activeMapIdx.value = 0
  showVeto.value = false
}

function resize(n: number) {
  const next: MapRow[] = []
  for (let i = 0; i < n; i++) {
    next.push(rows.value[i] ?? { map: null, scoreA: 0, scoreB: 0 })
  }
  rows.value = next
}

// Инициализация из существующих результатов
resize(bo.value)
if (props.maps?.length) {
  props.maps.forEach((m, i) => {
    if (rows.value[i]) rows.value[i] = { map: m.map, scoreA: m.scoreA, scoreB: m.scoreB }
  })
}
watch(bo, (n) => {
  resize(n)
  activeMapIdx.value = 0
})

// Итоговый счёт матча: BO1 — счёт раундов карты, BOn — выигранные карты
const score = computed(() => {
  if (bo.value === 1) {
    const m = rows.value[0]
    return { a: Number(m?.scoreA) || 0, b: Number(m?.scoreB) || 0 }
  }
  let a = 0
  let b = 0
  for (const m of rows.value) {
    const sa = Number(m.scoreA) || 0
    const sb = Number(m.scoreB) || 0
    if (sa > sb) a++
    else if (sb > sa) b++
  }
  return { a, b }
})

const finished = computed(() => props.status === 'finished')
const isLive = computed(() => props.status === 'live')
const isPending = computed(() => !finished.value && !isLive.value)
const canFixCurrentMap = computed(() => {
  const row = rows.value[activeMapIdx.value]
  if (!row) return false
  const hasMap = Boolean(row.map)
  const hasScore = (Number(row.scoreA) || 0) > 0 || (Number(row.scoreB) || 0) > 0
  return hasMap && hasScore
})
// Есть ли что завершать (иначе «Завершить» недоступна)
const hasResult = computed(() => score.value.a > 0 || score.value.b > 0)

function emitSave(status: string) {
  const s = score.value
  emit('save', {
    maps: rows.value.map((r) => ({
      map: r.map,
      scoreA: Number(r.scoreA) || 0,
      scoreB: Number(r.scoreB) || 0,
    })),
    scoreA: s.a,
    scoreB: s.b,
    status,
    bestOf: bo.value,
  })
}

// Статус «в процессе»: live при введённом счёте/карте, иначе pending
function progressStatus() {
  // Если матч уже был запущен, не откатываем обратно в ожидание
  if (isLive.value) return 'live'
  const active = hasResult.value || rows.value.some((r) => r.map)
  return active ? 'live' : 'pending'
}

// «Завершить» — фиксируем результат (равный счёт → ничья, победителя определит сервер)
function finish() {
  if (!hasResult.value) return
  emitSave('finished')
}
// «Сохранить» — не меняем завершённость: завершённый остаётся завершённым
function save() {
  emitSave(finished.value ? 'finished' : progressStatus())
}
function startMatch() {
  emitSave('live')
}
function fixCurrentMap() {
  if (!canFixCurrentMap.value) return
  emitSave('live')
  if (activeMapIdx.value < rows.value.length - 1) activeMapIdx.value += 1
}
function restoreToPending() {
  rows.value = rows.value.map(() => ({ map: null, scoreA: 0, scoreB: 0 }))
  activeMapIdx.value = 0
  emitSave('pending')
}
</script>

<template>
  <div class="space-y-2.5 border-t border-border bg-surface-2 p-3" @click.stop>
    <!-- Формат матча -->
    <div class="flex items-center gap-1.5">
      <button
        v-for="opt in [1, 3, 5]"
        :key="opt"
        type="button"
        class="flex-1 cursor-pointer rounded-lg border px-1 py-1.5 text-xs font-semibold transition-colors"
        :class="
          bo === opt
            ? 'border-brand bg-brand/15 text-brand'
            : 'border-border text-slate-400 hover:border-slate-500 hover:text-white'
        "
        @click="bo = opt"
      >
        BO{{ opt }}
      </button>
    </div>

    <!-- Пик/бан карт -->
    <button
      v-if="vetoPool.length"
      type="button"
      class="flex w-full cursor-pointer items-center justify-center gap-1.5 rounded-lg border border-brand/40 bg-brand/10 px-3 py-2 text-sm font-semibold text-brand transition-colors hover:bg-brand/20"
      @click="showVeto = true"
    >
      🎯 Пик / бан карт
    </button>
    <MapVeto
      v-if="showVeto"
      :best-of="bo"
      :pool="vetoPool"
      :team-a-name="teamAName"
      :team-b-name="teamBName"
      @close="showVeto = false"
      @apply="applyVeto"
    />

    <!-- Слоты карт -->
    <div class="space-y-2">
      <div v-if="isSeries" class="pb-1">
        <div class="flex flex-wrap items-center gap-1.5">
        <button
          v-for="(_, i) in rows"
          :key="`map-step-${i}`"
          type="button"
          class="min-w-[4.75rem] cursor-pointer rounded-lg border px-2 py-1.5 text-xs font-semibold transition-colors"
          :class="
            i === activeMapIdx
              ? 'border-brand bg-brand/15 text-brand'
              : rows[i]?.map
                ? 'border-slate-600 bg-slate-800/50 text-slate-200'
                : 'border-border text-slate-400 hover:border-slate-500 hover:text-white'
          "
          @click="activeMapIdx = i"
        >
          Карта {{ i + 1 }}
        </button>
        </div>
      </div>
      <div v-if="isSeries" class="text-center text-[11px] text-slate-500">
        Текущая карта: {{ activeMapIdx + 1 }} / {{ rows.length }}
      </div>

      <div
        v-for="(row, i) in rows"
        v-show="!isSeries || i === activeMapIdx"
        :key="i"
        class="space-y-1.5 rounded-lg bg-bg/60 p-2"
      >
        <AppSelect v-model="row.map" :options="options" :placeholder="`Карта ${i + 1}`" />
        <div class="flex items-center gap-2">
          <input
            v-model.number="row.scoreA"
            type="number"
            min="0"
            inputmode="numeric"
            aria-label="Счёт первой команды"
            class="w-full min-w-0 rounded-lg border border-border bg-bg px-2 py-1.5 text-center text-base tabular-nums outline-none transition-colors focus:border-brand"
          />
          <span class="shrink-0 font-bold text-slate-500">:</span>
          <input
            v-model.number="row.scoreB"
            type="number"
            min="0"
            inputmode="numeric"
            aria-label="Счёт второй команды"
            class="w-full min-w-0 rounded-lg border border-border bg-bg px-2 py-1.5 text-center text-base tabular-nums outline-none transition-colors focus:border-brand"
          />
        </div>
      </div>
    </div>

    <!-- Итог -->
    <div v-if="bo > 1" class="text-center text-xs text-slate-400">
      По картам: <span class="font-bold text-white">{{ score.a }} : {{ score.b }}</span>
    </div>

    <div class="space-y-2">
      <!-- Матч не завершён: главное действие — завершить -->
      <template v-if="!finished">
        <button
          type="button"
          :disabled="!hasResult"
          class="w-full cursor-pointer rounded-lg bg-brand px-3 py-2 text-sm font-semibold text-white transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
          @click="finish"
        >
          Завершить матч
        </button>
        <button
          v-if="isSeries && isPending"
          type="button"
          class="w-full cursor-pointer rounded-lg border border-border px-3 py-2 text-sm font-semibold text-slate-200 transition-colors hover:border-slate-500 hover:text-white"
          @click="startMatch"
        >
          Включить Live
        </button>
        <div class="space-y-2">
          <button
            type="button"
            class="w-full cursor-pointer rounded-lg border border-border px-3 py-2 text-sm font-semibold text-slate-200 transition-colors hover:border-slate-500 hover:text-white"
            :disabled="isSeries && (!isLive || !canFixCurrentMap)"
            :class="isSeries && (!isLive || !canFixCurrentMap) ? 'cursor-not-allowed opacity-50' : ''"
            @click="isSeries ? fixCurrentMap() : isLive ? restoreToPending() : startMatch()"
          >
            {{ isSeries ? 'Зафиксировать счёт на карте' : isPending ? 'Включить Live' : 'В ожидание' }}
          </button>
          <div class="space-y-2">
            <button
              v-if="isSeries && isLive"
              type="button"
              class="w-full cursor-pointer rounded-lg border border-border px-3 py-2 text-sm text-slate-300 transition-colors hover:border-slate-500 hover:text-white"
              @click="restoreToPending"
            >
              В ожидание
            </button>
            <button
              type="button"
              class="w-full rounded-lg border border-border px-3 py-2 text-sm text-slate-400 transition-colors hover:border-slate-500 hover:text-white"
              @click="emit('cancel')"
            >
              Отмена
            </button>
          </div>
        </div>
      </template>

      <!-- Матч завершён: сохранить правку (остаётся завершённым) или возобновить -->
      <template v-else>
        <button
          type="button"
          class="w-full cursor-pointer rounded-lg bg-brand px-3 py-2 text-sm font-semibold text-white transition-opacity hover:opacity-90"
          @click="save"
        >
          Сохранить
        </button>
        <button
          type="button"
          class="w-full cursor-pointer rounded-lg border border-border px-3 py-2 text-sm text-slate-400 transition-colors hover:border-slate-500 hover:text-white"
          @click="emit('cancel')"
        >
          Отмена
        </button>
      </template>

      <button
        type="button"
        class="w-full cursor-pointer rounded-lg border border-red-500/30 px-3 py-2 text-sm font-semibold text-red-400 transition-colors hover:bg-red-500/10"
        @click="emit('delete')"
      >
        Удалить матч
      </button>
    </div>
  </div>
</template>
