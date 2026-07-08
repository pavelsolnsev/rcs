<script setup lang="ts">
import type { Ref } from 'vue'

interface Team { id: number; name: string; logoUrl?: string | null }
interface Standing {
  teamId: number
  played: number
  wins: number
  draws: number
  losses: number
  diff: number
  points: number
}
interface Match {
  id: number; bracket: string; round: number; position: number
  groupLabel: string | null
  teamAId: number | null; teamBId: number | null
  scoreA: number; scoreB: number; status: string
  winnerTeamId: number | null; nextMatchId: number | null; label?: string | null
}

const props = defineProps<{
  label: string
  rows: Standing[]
  matches: Match[]
  teamMap: Record<number, Team>
  editable?: boolean
  /** Режим обмена команд между группами */
  swapMode?: boolean
  /** Выбранная для обмена команда (подсвечивается) */
  swapPick?: number | null
}>()

const emit = defineEmits<{
  save: [
    p: { id: number; scoreA: number; scoreB: number; status: string; bestOf?: number; maps?: unknown },
  ]
  pick: [teamId: number]
}>()

// Пока в этой группе редактируется матч — показываем только его, остальные прячем,
// чтобы не было открыто несколько игр сразу.
const openMatchId = inject<Ref<number | null>>('openMatchId', ref(null))
const visibleMatches = computed(() => {
  const openId = openMatchId.value
  if (openId != null && props.matches.some((m) => m.id === openId)) {
    return props.matches.filter((m) => m.id === openId)
  }
  return props.matches
})
</script>

<template>
  <div class="card p-4">
    <div class="mb-3 flex items-center gap-2">
      <span class="rounded-md bg-brand/15 px-2 py-0.5 text-sm font-bold text-brand">
        Группа {{ label }}
      </span>
    </div>

    <!-- Таблица -->
    <table class="w-full table-fixed text-sm">
      <thead>
        <tr class="text-left text-xs uppercase text-slate-500">
          <th class="pb-2 font-medium">Команда</th>
          <th class="w-7 pb-2 text-center font-medium">И</th>
          <th class="w-7 pb-2 text-center font-medium">В</th>
          <th class="w-7 pb-2 text-center font-medium">Н</th>
          <th class="w-7 pb-2 text-center font-medium">П</th>
          <th class="w-10 pb-2 text-center font-medium">±</th>
          <th class="w-7 pb-2 text-center font-medium">О</th>
        </tr>
      </thead>
      <tbody>
        <tr
          v-for="(s, i) in rows"
          :key="s.teamId"
          class="border-t border-border"
          :class="i < 2 ? 'text-white' : 'text-slate-400'"
        >
          <td class="py-1.5 font-medium">
            <!-- В режиме обмена — кликабельная команда -->
            <button
              v-if="swapMode"
              type="button"
              class="-mx-1 flex w-full items-center gap-1.5 rounded px-1 py-0.5 text-left transition-colors"
              :class="
                swapPick === s.teamId
                  ? 'bg-brand/20 text-brand ring-1 ring-brand/40'
                  : 'hover:bg-white/5'
              "
              @click="emit('pick', s.teamId)"
            >
              <span class="shrink-0 text-xs">⇄</span>
              <span class="truncate">{{ teamMap[s.teamId]?.name ?? '—' }}</span>
            </button>
            <span v-else class="flex items-center gap-1.5">
              <span
                class="inline-block h-1.5 w-1.5 shrink-0 rounded-full"
                :class="i < 2 ? 'bg-teal-400' : 'bg-transparent'"
              />
              <span class="truncate">{{ teamMap[s.teamId]?.name ?? '—' }}</span>
            </span>
          </td>
          <td class="text-center tabular-nums">{{ s.played }}</td>
          <td class="text-center tabular-nums">{{ s.wins }}</td>
          <td class="text-center tabular-nums">{{ s.draws }}</td>
          <td class="text-center tabular-nums">{{ s.losses }}</td>
          <td class="text-center tabular-nums">{{ s.diff > 0 ? '+' + s.diff : s.diff }}</td>
          <td class="text-center font-bold tabular-nums">{{ s.points }}</td>
        </tr>
      </tbody>
    </table>

    <!-- Матчи группы (в правке остаётся только редактируемый матч) -->
    <div class="mt-4 grid grid-cols-1 gap-2 sm:grid-cols-2">
      <MatchCard
        v-for="m in visibleMatches"
        :key="m.id"
        :match="m"
        :team-map="teamMap"
        :editable="editable"
        @save="emit('save', $event)"
      />
    </div>
  </div>
</template>
