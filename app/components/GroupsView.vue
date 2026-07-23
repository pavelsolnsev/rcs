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
  moveTeam: [p: { teamId: number; targetLabel: string }]
  delete: [id: number]
  reorder: [p: { matchId: number; order: number }]
}>()

const teamMap = computed<Record<number, Team>>(() => {
  const m: Record<number, Team> = {}
  for (const t of props.teams) m[t.id] = t
  return m
})

const groupMatches = computed(() => props.matches.filter((m) => m.bracket === 'group'))
const playoffMatches = computed(() =>
  props.matches.filter((m) => m.bracket === 'playoff' || m.bracket === 'third_place'),
)

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

// Перетаскивание команды между группами
const draggingTeamId = ref<number | null>(null)
function onDropTeam(targetLabel: string) {
  const teamId = draggingTeamId.value
  draggingTeamId.value = null
  if (teamId != null) emit('moveTeam', { teamId, targetLabel })
}

// На телефоне группы прячем в селект: видна одна выбранная (в режиме обмена — все).
const selectedGroup = ref('')
watch(
  groupLabels,
  (labels) => {
    if (!labels.includes(selectedGroup.value)) selectedGroup.value = labels[0] ?? ''
  },
  { immediate: true },
)
const showGroupSelect = computed(() => groupLabels.value.length > 1)

function teamWord(n: number) {
  const d = n % 10
  const h = n % 100
  if (d === 1 && h !== 11) return 'команда'
  if (d >= 2 && d <= 4 && (h < 10 || h >= 20)) return 'команды'
  return 'команд'
}
const groupOptions = computed(() =>
  groupLabels.value.map((l) => {
    const n = (standings.value[l] ?? []).length
    return { value: l, label: `Группа ${l} · ${n} ${teamWord(n)}` }
  }),
)
// Скрыта ли группа на телефоне (на sm+ показываем всегда).
const hiddenOnMobile = (label: string) =>
  !swapMode.value && showGroupSelect.value && selectedGroup.value !== label
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
          <span v-else class="hidden text-xs text-slate-500 sm:inline">
            Перетащи команду в другую группу
          </span>
        </div>
      </div>

      <!-- Телефон: переключатель групп (десктоп показывает все) -->
      <div v-if="showGroupSelect && !swapMode" class="mb-4 flex items-center gap-2.5 sm:hidden">
        <span
          class="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-brand/15 text-lg font-extrabold text-brand ring-1 ring-brand/30"
        >
          {{ selectedGroup }}
        </span>
        <div class="min-w-0 flex-1">
          <AppSelect v-model="selectedGroup" :options="groupOptions" />
        </div>
      </div>

      <div class="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <GroupCard
          v-for="label in groupLabels"
          :key="label"
          :class="{ 'hidden sm:block': hiddenOnMobile(label) }"
          :label="label"
          :rows="rowsOfGroup(label)"
          :matches="matchesOfGroup(label)"
          :team-map="teamMap"
          :qualifiers="props.qualifiers"
          :editable="editable"
          :swap-mode="swapMode"
          :swap-pick="swapPick"
          :dragging-team-id="draggingTeamId"
          @save="emit('save', $event)"
          @pick="onPickSwapTeam"
          @delete="emit('delete', $event)"
          @reorder="emit('reorder', $event)"
          @dragteam="draggingTeamId = $event"
          @dragend="draggingTeamId = null"
          @dropteam="onDropTeam"
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
