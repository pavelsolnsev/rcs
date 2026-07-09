<script setup lang="ts">
interface Team { id: number; name: string; logoUrl?: string | null }
interface Match {
  id: number; bracket: string; round: number; position: number
  groupLabel: string | null
  teamAId: number | null; teamBId: number | null
  scoreA: number; scoreB: number; status: string
  winnerTeamId: number | null; nextMatchId: number | null; label?: string | null
}

const props = defineProps<{ matches: Match[]; teams: Team[]; qualifiers?: number; editable?: boolean }>()
const emit = defineEmits<{
  save: [
    p: { id: number; scoreA: number; scoreB: number; status: string; bestOf?: number; maps?: unknown },
  ]
  seedPlayoff: []
  swapTeams: [p: { teamA: number; teamB: number }]
  delete: [id: number]
  reorder: [p: { matchId: number; order: number }]
}>()

const teamMap = computed<Record<number, Team>>(() => {
  const m: Record<number, Team> = {}
  for (const t of props.teams) m[t.id] = t
  return m
})

const groupMatches = computed(() => props.matches.filter((m) => m.bracket === 'group'))
const playoffMatches = computed(() => props.matches.filter((m) => m.bracket === 'playoff'))

const standings = computed(() => computeStandings(props.matches))
const groupLabels = computed(() => Object.keys(standings.value).sort())

function matchesOfGroup(label: string) {
  return groupMatches.value
    .filter((m) => m.groupLabel === label)
    .sort((a, b) => a.position - b.position)
}

function rowsOfGroup(label: string) {
  return standings.value[label] ?? []
}

const allGroupsFinished = computed(
  () => groupMatches.value.length > 0 && groupMatches.value.every((m) => m.status === 'finished'),
)
const playoffSeeded = computed(() =>
  playoffMatches.value.some((m) => m.round === 1 && (m.teamAId || m.teamBId)),
)

const swapMode = ref(false)
const swapPick = ref<number | null>(null)

function toggleSwapMode() {
  swapMode.value = !swapMode.value
  swapPick.value = null
}

function onPickSwapTeam(teamId: number) {
  if (!swapMode.value) return
  if (!swapPick.value) {
    swapPick.value = teamId
    return
  }
  if (swapPick.value === teamId) {
    swapPick.value = null
    return
  }
  emit('swapTeams', { teamA: swapPick.value, teamB: teamId })
  swapPick.value = null
}
</script>

<template>
  <div class="space-y-8">
    <!-- Группы -->
    <section>
      <div class="mb-4 flex flex-wrap items-center justify-between gap-3">
        <h3 class="text-lg font-bold">Групповой этап</h3>
        <div v-if="editable" class="flex items-center gap-2">
          <button
            class="rounded-lg border px-3 py-1.5 text-xs font-semibold transition"
            :class="
              swapMode
                ? 'border-brand bg-brand/15 text-brand hover:bg-brand/20'
                : 'border-border text-slate-300 hover:border-brand/50 hover:text-white'
            "
            @click="toggleSwapMode"
          >
            {{ swapMode ? 'Выход из обмена' : 'Обменять команды' }}
          </button>
          <span v-if="swapMode" class="text-xs text-slate-400">
            Выбери 2 команды в любых группах
          </span>
        </div>
      </div>
      <div class="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <GroupCard
          v-for="label in groupLabels"
          :key="label"
          :label="label"
          :rows="rowsOfGroup(label)"
          :matches="matchesOfGroup(label)"
          :team-map="teamMap"
          :qualifiers="props.qualifiers"
          :editable="editable"
          :swap-mode="swapMode"
          :swap-pick="swapPick"
          @save="emit('save', $event)"
          @pick="onPickSwapTeam"
          @delete="emit('delete', $event)"
          @reorder="emit('reorder', $event)"
        />
      </div>
    </section>

    <!-- Плей-офф -->
    <section>
      <div class="mb-4 flex items-center justify-between gap-3">
        <h3 class="text-lg font-bold">Плей-офф</h3>
        <button
          v-if="editable && allGroupsFinished && !playoffSeeded"
          class="rounded-lg bg-brand px-4 py-1.5 text-sm font-semibold text-white hover:opacity-90"
          @click="emit('seedPlayoff')"
        >
          Сформировать плей-офф
        </button>
      </div>

      <EliminationBracket
        v-if="playoffSeeded"
        :matches="playoffMatches"
        :teams="teams"
        :editable="editable"
        @save="emit('save', $event)"
        @delete="emit('delete', $event)"
      />
      <div v-else class="card p-6 text-center text-sm text-slate-500">
        {{
          allGroupsFinished
            ? 'Группы сыграны. Нажми «Сформировать плей-офф».'
            : 'Плей-офф появится после завершения всех групповых матчей.'
        }}
      </div>
    </section>
  </div>
</template>
