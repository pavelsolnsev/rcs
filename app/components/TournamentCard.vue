<script setup lang="ts">
import { mapBackgroundPath, mapLabel } from '~/utils/maps'

const props = defineProps<{
  tournament: {
    id: number
    name: string
    format: string
    teamSize: string
    status: string
    createdAt?: string
    liveMatches?: {
      id: number
      label: string | null
      meta?: string
      teamAName: string
      teamBName: string
      scoreA: number
      scoreB: number
      bestOf?: number
      maps?: { map: string; scoreA: number; scoreB: number }[]
      liveStartedAt?: string
    }[]
  }
}>()

const { success, info, error } = useToast()

function formatLiveStartedAt(v?: string) {
  if (!v) return 'Начали в --:--'
  const d = new Date(v)
  if (Number.isNaN(d.getTime())) return 'Начали в --:--'
  return `Начали в ${d.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })}`
}

function liveMapBackgrounds(maps?: { map: string; scoreA: number; scoreB: number }[]) {
  if (!maps?.length) return []
  const unique = new Set<string>()
  for (const row of maps) {
    const bg = mapBackgroundPath(row.map)
    if (bg) unique.add(bg)
  }
  return Array.from(unique).slice(0, 4)
}

function liveBgGridClass(count: number) {
  if (count <= 1) return 'grid-cols-1'
  if (count === 2) return 'grid-cols-2'
  if (count === 3) return 'grid-cols-3'
  return 'grid-cols-2 grid-rows-2'
}

function mapScoreLabel(m: { scoreA: number; scoreB: number }) {
  const played = (Number(m.scoreA) || 0) > 0 || (Number(m.scoreB) || 0) > 0
  return played ? `${m.scoreA}:${m.scoreB}` : ''
}

function tournamentUrl(id: number) {
  if (typeof window === 'undefined') return `/tournaments/${id}`
  return `${window.location.origin}/tournaments/${id}`
}

async function shareByUrl(url: string, title: string, text: string) {
  try {
    if (typeof navigator !== 'undefined' && navigator.share) {
      await navigator.share({ title, text, url })
      success('Ссылка отправлена')
      return
    }
    if (typeof navigator !== 'undefined' && navigator.clipboard) {
      await navigator.clipboard.writeText(url)
      info('Ссылка скопирована')
      return
    }
    throw new Error('clipboard-unavailable')
  } catch (e: any) {
    if (e?.name === 'AbortError') return
    error('Не удалось поделиться ссылкой')
  }
}

function shareTournament() {
  const url = tournamentUrl(props.tournament.id)
  shareByUrl(url, props.tournament.name, 'Смотри турнир и live-матчи на RCS')
}

function shareMatch(m: {
  id: number
  teamAName: string
  teamBName: string
  meta?: string
}) {
  const url = tournamentUrl(props.tournament.id)
  const text = `${m.teamAName} vs ${m.teamBName} · ${m.meta || 'Матч в игре'}`
  shareByUrl(url, props.tournament.name, text)
}
</script>

<template>
  <NuxtLink
    :to="`/tournaments/${tournament.id}`"
    class="card group flex flex-col gap-3 p-4 transition-colors hover:border-brand/60"
  >
    <div class="flex items-start justify-between gap-3">
      <h3 class="text-base font-bold leading-snug text-white group-hover:text-brand">
        {{ tournament.name }}
      </h3>
      <div class="flex items-center gap-1.5">
        <button
          type="button"
          class="z-20 inline-flex h-7 w-7 cursor-pointer items-center justify-center rounded-md border border-border bg-surface-2/90 text-slate-300 transition-colors hover:border-brand hover:text-white"
          aria-label="Поделиться турниром"
          @click.prevent.stop="shareTournament"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
            <path d="M12 3v12M7 8l5-5 5 5" />
            <path d="M5 14v4a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-4" />
          </svg>
        </button>
        <StatusBadge :status="tournament.status" />
      </div>
    </div>
    <div class="flex flex-wrap items-center gap-2 text-xs text-slate-400">
      <span class="rounded-md bg-surface-2 px-2 py-1 font-medium">
        {{ formatLabel(tournament.format) }}
      </span>
      <span class="rounded-md bg-surface-2 px-2 py-1 font-medium">
        {{ tournament.teamSize }}
      </span>
    </div>

    <div v-if="tournament.liveMatches?.length" class="space-y-1.5">
      <div class="inline-flex items-center rounded-md bg-red-500/15 px-2 py-1 text-[11px] font-semibold text-red-300">
        В игре: {{ tournament.liveMatches.length }}
      </div>
      <div
        v-for="m in tournament.liveMatches.slice(0, 2)"
        :key="m.id"
        class="relative overflow-hidden rounded-lg border border-border/80 bg-surface-2/60 p-2 text-xs"
      >
        <div v-if="liveMapBackgrounds(m.maps).length" class="pointer-events-none absolute inset-0 z-0 overflow-hidden">
          <div class="grid h-full w-full" :class="liveBgGridClass(liveMapBackgrounds(m.maps).length)">
            <div v-for="bg in liveMapBackgrounds(m.maps)" :key="bg" class="relative">
              <img :src="bg" alt="" class="h-full w-full object-cover brightness-75 saturate-75" loading="lazy" />
              <div class="absolute inset-0 bg-slate-950/55" />
            </div>
          </div>
          <div class="absolute inset-0 bg-gradient-to-b from-slate-950/35 via-slate-950/55 to-slate-950/70" />
        </div>

        <div class="relative z-10 space-y-2">
          <div class="flex items-center justify-between gap-2 text-[10px]">
            <span class="inline-flex items-center gap-1 rounded bg-red-500/15 px-1.5 py-0.5 font-semibold text-red-300">
              <span class="h-1.5 w-1.5 rounded-full bg-red-400" />
              LIVE
            </span>
            <div class="flex min-w-0 items-center gap-1.5">
              <span class="truncate text-slate-400">
                {{ m.meta || m.label || `Матч #${m.id}` }}
              </span>
              <button
                type="button"
                class="z-20 inline-flex h-5 w-5 cursor-pointer items-center justify-center rounded border border-border/80 bg-slate-900/60 text-slate-300 transition-colors hover:border-brand hover:text-white"
                aria-label="Поделиться матчем"
                @click.prevent.stop="shareMatch(m)"
              >
                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                  <path d="M12 3v12M8 7l4-4 4 4" />
                  <path d="M6 14v4h12v-4" />
                </svg>
              </button>
            </div>
          </div>

          <div class="grid grid-cols-[1fr_auto_1fr] items-center gap-2 text-[11px]">
            <span class="truncate text-right font-medium text-slate-100">{{ m.teamAName }}</span>
            <span class="rounded bg-slate-900/85 px-2 py-0.5 text-[11px] font-bold text-white">
              vs
            </span>
            <span class="truncate font-medium text-slate-100">{{ m.teamBName }}</span>
          </div>

          <div class="flex items-end justify-between gap-2">
            <div class="flex flex-1 flex-wrap items-center gap-1">
              <span
                v-if="m.maps?.length"
                v-for="(mapItem, idx) in m.maps"
                :key="`${m.id}-${mapItem.map}-${idx}`"
                class="inline-flex items-center gap-1 rounded bg-slate-800/80 px-1.5 py-0.5 text-[10px] text-slate-200"
              >
                <span>{{ mapLabel(mapItem.map) }}</span>
                <span
                  v-if="(m.bestOf ?? 1) > 1 && mapScoreLabel(mapItem)"
                  class="font-semibold text-white"
                >
                  {{ mapScoreLabel(mapItem) }}
                </span>
              </span>
              <span v-if="!m.maps?.length" class="text-[10px] text-slate-500">Карта уточняется</span>
            </div>

            <div class="shrink-0 text-right text-[10px] text-slate-400">
              {{ formatLiveStartedAt(m.liveStartedAt) }}
            </div>
          </div>
        </div>
      </div>
      <div v-if="tournament.liveMatches.length > 2" class="text-[11px] text-slate-500">
        + ещё {{ tournament.liveMatches.length - 2 }} матч(а)
      </div>
    </div>
  </NuxtLink>
</template>
