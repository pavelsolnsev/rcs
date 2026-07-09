<script setup lang="ts">
interface Team { id: number; name: string; logoUrl?: string | null }
interface Match {
  id: number; bracket: string; round: number; position: number
  groupLabel: string | null
  teamAId: number | null; teamBId: number | null
  scoreA: number; scoreB: number; status: string
  winnerTeamId: number | null; nextMatchId: number | null; label?: string | null
}

const props = defineProps<{
  format: string
  matches: Match[]
  teams: Team[]
  groupQualifiers?: number
  editable?: boolean
}>()
const emit = defineEmits<{
  save: [
    p: { id: number; scoreA: number; scoreB: number; status: string; bestOf?: number; maps?: unknown },
  ]
  seedPlayoff: []
  swapTeams: [p: { teamA: number; teamB: number }]
  addMatch: [
    p: {
      bracket: string
      round: number
      label: string | null
      bestOf: number
      teamAId: number | null
      teamBId: number | null
    },
  ]
  deleteMatch: [id: number]
  reorderMatches: [p: { matchId: number; order: number }]
}>()

const addingMatch = ref(false)
function onAddMatch(p: {
  bracket: string
  round: number
  label: string | null
  bestOf: number
  teamAId: number | null
  teamBId: number | null
}) {
  emit('addMatch', p)
  addingMatch.value = false
}

// Для double elimination: WB + гранд-финал в одной секции, LB отдельно.
// Матч-ресет показываем только когда он активирован (в нём есть команды).
const winnersSection = computed(() => {
  const base = props.matches.filter((m) => m.bracket === 'winners' || m.bracket === 'grand_final')
  const reset = props.matches.find((m) => m.bracket === 'grand_final_reset')
  if (reset && (reset.teamAId || reset.teamBId)) base.push(reset)
  return base
})
const losersSection = computed(() => props.matches.filter((m) => m.bracket === 'losers'))

const hasMatches = computed(() => props.matches.length > 0)

// Общий id матча в правке: одновременно открыт только один редактор на всю сетку,
// а остальные карточки той же группы скрываются (см. GroupCard).
const openMatchId = ref<number | null>(null)
provide('openMatchId', openMatchId)
</script>

<template>
  <div class="space-y-4">
    <!-- Ручное дозаполнение сетки (для прошедших/незавершённых турниров) -->
    <div v-if="editable" class="flex justify-end">
      <button
        v-if="!addingMatch"
        type="button"
        class="shrink-0 cursor-pointer rounded-lg border border-border bg-surface-2 px-4 py-1.5 text-sm font-semibold text-slate-200 transition hover:border-brand hover:text-white"
        @click="addingMatch = true"
      >
        + Добавить матч
      </button>
    </div>
    <AddMatchForm
      v-if="addingMatch"
      :teams="teams"
      :matches="matches"
      @submit="onAddMatch"
      @cancel="addingMatch = false"
    />

    <div v-if="!hasMatches" class="card p-8 text-center text-slate-500">
      Сетка ещё не сформирована.
    </div>

    <!-- Группы → плей-офф -->
    <GroupsView
      v-else-if="format === 'groups_playoff'"
      :matches="matches"
      :teams="teams"
      :qualifiers="props.groupQualifiers ?? 2"
      :editable="editable"
      @save="emit('save', $event)"
      @seed-playoff="emit('seedPlayoff')"
      @swap-teams="emit('swapTeams', $event)"
      @delete="emit('deleteMatch', $event)"
      @reorder="emit('reorderMatches', $event)"
    />

    <!-- Double Elimination -->
    <div v-else-if="format === 'double_elimination'" class="space-y-8">
      <section>
        <h3 class="mb-3 text-sm font-bold uppercase tracking-wider text-slate-400">
          Сетка победителей
        </h3>
        <EliminationBracket
          :matches="winnersSection"
          :teams="teams"
          :editable="editable"
          @save="emit('save', $event)"
          @delete="emit('deleteMatch', $event)"
        />
      </section>
      <section>
        <h3 class="mb-3 text-sm font-bold uppercase tracking-wider text-slate-400">
          Сетка проигравших
        </h3>
        <EliminationBracket
          :matches="losersSection"
          :teams="teams"
          :editable="editable"
          @save="emit('save', $event)"
          @delete="emit('deleteMatch', $event)"
        />
      </section>
    </div>

    <!-- Single Elimination -->
    <EliminationBracket
      v-else
      :matches="matches.filter((m) => m.bracket === 'winners')"
      :teams="teams"
      :editable="editable"
      @save="emit('save', $event)"
      @delete="emit('deleteMatch', $event)"
    />
  </div>
</template>
