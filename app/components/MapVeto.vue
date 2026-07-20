<script setup lang="ts">
import type { VetoTeam } from '~/utils/veto'

const props = defineProps<{
  bestOf: number
  pool: string[]
  teamAName?: string
  teamBName?: string
}>()

const emit = defineEmits<{ close: []; apply: [maps: string[]] }>()

const firstTeam = ref<VetoTeam>('a')
const veto = useMapVeto(
  () => props.bestOf,
  () => props.pool,
  firstTeam,
)

const started = computed(() => veto.log.value.length > 0)
const teamName = (t: VetoTeam) =>
  t === 'a' ? props.teamAName || 'Команда A' : props.teamBName || 'Команда B'

function setFirst(t: VetoTeam) {
  if (started.value) return
  firstTeam.value = t
}

type MapView =
  | { kind: 'available' }
  | { kind: 'ban'; team: VetoTeam }
  | { kind: 'pick'; team: VetoTeam; order: number }
  | { kind: 'decider'; order: number }

function viewOf(map: string): MapView {
  const rec = veto.recordOf(map)
  const order = veto.resultMaps.value.indexOf(map) + 1
  if (rec) {
    return rec.step.action === 'ban'
      ? { kind: 'ban', team: rec.step.team }
      : { kind: 'pick', team: rec.step.team, order }
  }
  if (veto.isDecider(map)) return { kind: 'decider', order }
  return { kind: 'available' }
}

const cards = computed(() => props.pool.map((map) => ({ map, view: viewOf(map) })))

// Классы цвета команды (A — зелёный бренд, B — голубой) для наглядности на телефоне.
const teamAccent = (t: VetoTeam) => (t === 'a' ? 'text-brand' : 'text-cyan-300')
</script>

<template>
  <Teleport to="body">
    <div class="fixed inset-0 z-[230] flex flex-col bg-slate-950/97 backdrop-blur-sm">
      <!-- Шапка -->
      <header class="shrink-0 border-b border-border px-4 py-3 [padding-top:calc(0.75rem+env(safe-area-inset-top))]">
        <div class="mx-auto flex max-w-2xl items-center justify-between gap-3">
          <div class="min-w-0">
            <div class="flex items-center gap-2 text-base font-extrabold sm:text-lg">
              <span class="truncate text-brand">{{ teamName('a') }}</span>
              <span class="shrink-0 text-slate-500">vs</span>
              <span class="truncate text-cyan-300">{{ teamName('b') }}</span>
            </div>
            <p class="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
              Пик / бан карт · BO{{ bestOf }}
            </p>
          </div>
          <button
            type="button"
            class="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white/10 text-white ring-1 ring-white/15 transition hover:bg-white/20"
            aria-label="Закрыть"
            @click="emit('close')"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true">
              <path d="M18 6 6 18M6 6l12 12" />
            </svg>
          </button>
        </div>
      </header>

      <!-- Статус хода / выбор первого -->
      <div class="shrink-0 px-4 py-3">
        <div class="mx-auto max-w-2xl">
          <!-- До старта: кто банит первым -->
          <div v-if="!started" class="flex flex-wrap items-center justify-center gap-2 text-sm">
            <span class="text-slate-400">Первым банит:</span>
            <button
              v-for="t in (['a', 'b'] as const)"
              :key="t"
              type="button"
              class="rounded-lg border px-3 py-1.5 text-sm font-semibold transition"
              :class="
                firstTeam === t
                  ? 'border-brand bg-brand/15 text-white'
                  : 'border-border text-slate-400 hover:border-slate-500 hover:text-white'
              "
              @click="setFirst(t)"
            >
              {{ teamName(t) }}
            </button>
          </div>

          <!-- Ход команды -->
          <div
            v-else-if="veto.currentStep.value"
            class="rounded-xl border px-4 py-3 text-center"
            :class="
              veto.currentStep.value.action === 'ban'
                ? 'border-red-500/40 bg-red-500/10'
                : 'border-brand/40 bg-brand/10'
            "
          >
            <p class="text-lg font-extrabold sm:text-xl">
              <span :class="teamAccent(veto.currentStep.value.team)">
                {{ teamName(veto.currentStep.value.team) }}
              </span>
            </p>
            <p class="text-sm font-semibold" :class="veto.currentStep.value.action === 'ban' ? 'text-red-300' : 'text-brand'">
              {{ veto.currentStep.value.action === 'ban' ? '✕ забанить карту' : '✓ выбрать карту' }}
              <span class="ml-1 text-slate-500">
                · шаг {{ veto.log.value.length + 1 }} из {{ veto.sequence.value.length }}
              </span>
            </p>
          </div>

          <!-- Завершено -->
          <div v-else class="rounded-xl border border-amber-400/40 bg-amber-400/10 px-4 py-3 text-center">
            <p class="text-base font-extrabold text-amber-300">Пик / бан завершён ✅</p>
            <p class="mt-0.5 text-xs text-slate-400">Проверьте порядок карт и примените к матчу</p>
          </div>
        </div>
      </div>

      <!-- Сетка карт -->
      <div class="min-h-0 flex-1 overflow-y-auto px-4 pb-4">
        <div class="mx-auto grid max-w-2xl grid-cols-2 gap-2.5 sm:grid-cols-3">
          <button
            v-for="{ map, view } in cards"
            :key="map"
            type="button"
            :disabled="view.kind !== 'available' || veto.finished.value"
            class="group relative aspect-[16/10] overflow-hidden rounded-xl ring-1 transition"
            :class="[
              view.kind === 'available' && !veto.finished.value
                ? 'cursor-pointer ring-border hover:ring-white/60'
                : 'ring-border',
              view.kind === 'pick' && view.team === 'a' ? 'ring-2 ring-brand' : '',
              view.kind === 'pick' && view.team === 'b' ? 'ring-2 ring-cyan-400' : '',
              view.kind === 'decider' ? 'ring-2 ring-amber-400' : '',
            ]"
            @click="veto.act(map)"
          >
            <!-- Фон карты -->
            <img
              v-if="mapBackgroundPath(map)"
              :src="mapBackgroundPath(map)!"
              alt=""
              loading="lazy"
              class="absolute inset-0 h-full w-full object-cover transition"
              :class="view.kind === 'ban' ? 'grayscale' : view.kind === 'available' ? 'group-hover:scale-105' : ''"
            />
            <div v-else class="absolute inset-0 bg-gradient-to-br from-surface-2 to-bg" />

            <!-- Затемнение по состоянию -->
            <div
              class="absolute inset-0"
              :class="[
                view.kind === 'ban' ? 'bg-slate-950/75' : 'bg-slate-950/35',
                view.kind === 'available' ? 'group-hover:bg-slate-950/20' : '',
              ]"
            />

            <!-- Название карты -->
            <span
              class="absolute inset-x-0 bottom-0 truncate px-2 py-1.5 text-left text-sm font-bold text-white"
              :class="view.kind === 'ban' ? 'line-through opacity-60' : ''"
            >
              {{ mapLabel(map) }}
            </span>

            <!-- Метка бана -->
            <span
              v-if="view.kind === 'ban'"
              class="absolute left-1.5 top-1.5 inline-flex items-center gap-1 rounded-md bg-red-600/85 px-1.5 py-0.5 text-[10px] font-bold text-white"
            >
              ✕ {{ teamName(view.team) }}
            </span>

            <!-- Метка пика -->
            <template v-else-if="view.kind === 'pick'">
              <span
                class="absolute left-1.5 top-1.5 inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[10px] font-bold text-white"
                :class="view.team === 'a' ? 'bg-brand/90' : 'bg-cyan-500/90'"
              >
                ✓ {{ teamName(view.team) }}
              </span>
              <span class="absolute right-1.5 top-1.5 flex h-6 w-6 items-center justify-center rounded-full bg-slate-950/70 text-xs font-extrabold text-white ring-1 ring-white/25">
                {{ view.order }}
              </span>
            </template>

            <!-- Решающая -->
            <template v-else-if="view.kind === 'decider'">
              <span class="absolute left-1.5 top-1.5 inline-flex items-center gap-1 rounded-md bg-amber-500/90 px-1.5 py-0.5 text-[10px] font-bold text-slate-950">
                ★ Решающая
              </span>
              <span class="absolute right-1.5 top-1.5 flex h-6 w-6 items-center justify-center rounded-full bg-slate-950/70 text-xs font-extrabold text-white ring-1 ring-white/25">
                {{ view.order }}
              </span>
            </template>
          </button>
        </div>
      </div>

      <!-- Низ: управление -->
      <footer class="shrink-0 border-t border-border px-4 py-3 [padding-bottom:calc(0.75rem+env(safe-area-inset-bottom))]">
        <div class="mx-auto max-w-2xl space-y-2.5">
          <!-- Итоговый порядок -->
          <div v-if="veto.finished.value" class="flex flex-wrap items-center justify-center gap-1.5 text-xs">
            <span class="text-slate-500">Порядок карт:</span>
            <span
              v-for="(m, i) in veto.resultMaps.value"
              :key="m"
              class="inline-flex items-center gap-1 rounded-md bg-surface-2 px-2 py-1 font-semibold text-slate-200"
            >
              <span class="text-slate-500">{{ i + 1 }}.</span> {{ mapLabel(m) }}
            </span>
          </div>

          <div class="flex items-center gap-2">
            <button
              type="button"
              :disabled="!started"
              class="flex-1 cursor-pointer rounded-lg border border-border px-3 py-2.5 text-sm font-semibold text-slate-200 transition hover:border-slate-500 hover:text-white disabled:cursor-not-allowed disabled:opacity-40"
              @click="veto.undo()"
            >
              ↶ Отменить
            </button>
            <button
              type="button"
              :disabled="!started"
              class="flex-1 cursor-pointer rounded-lg border border-border px-3 py-2.5 text-sm font-semibold text-slate-200 transition hover:border-slate-500 hover:text-white disabled:cursor-not-allowed disabled:opacity-40"
              @click="veto.reset()"
            >
              ⟲ Заново
            </button>
          </div>

          <button
            v-if="veto.finished.value"
            type="button"
            class="w-full cursor-pointer rounded-lg bg-brand px-3 py-3 text-sm font-bold text-white transition hover:opacity-90"
            @click="emit('apply', veto.resultMaps.value)"
          >
            Применить карты к матчу
          </button>
        </div>
      </footer>
    </div>
  </Teleport>
</template>
