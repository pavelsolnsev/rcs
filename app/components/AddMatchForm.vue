<script setup lang="ts">
interface Team {
  id: number
  name: string
}
interface MatchLite {
  bracket: string
  round: number
}

const props = defineProps<{
  teams: Team[]
  matches: MatchLite[]
  busy?: boolean
}>()

const emit = defineEmits<{
  submit: [
    p: {
      bracket: string
      round: number
      label: string | null
      bestOf: number
      teamAId: number | null
      teamBId: number | null
    },
  ]
  cancel: []
}>()

const BRACKET_LABELS: Record<string, string> = {
  winners: 'Основная сетка',
  losers: 'Сетка проигравших',
  grand_final: 'Гранд-финал',
  group: 'Группы',
  playoff: 'Плей-офф',
}
function bracketLabel(v: string) {
  return BRACKET_LABELS[v] ?? v
}

// Раздел сетки — только те, что уже есть у турнира (сброс-матч не предлагаем).
const bracketOptions = computed(() => {
  const set = new Set(props.matches.map((m) => m.bracket).filter((b) => b !== 'grand_final_reset'))
  if (!set.size) set.add('winners')
  return [...set].map((value) => ({ value, label: bracketLabel(value) }))
})
const bracket = ref(bracketOptions.value[bracketOptions.value.length - 1]?.value ?? 'winners')

// По умолчанию матч продолжает сетку (следующий раунд выбранного раздела).
const roundDefault = computed(() => {
  const rounds = props.matches.filter((m) => m.bracket === bracket.value).map((m) => m.round)
  return (rounds.length ? Math.max(...rounds) : 0) + 1
})
const round = ref(roundDefault.value)
watch(bracket, () => {
  round.value = roundDefault.value
})

const label = ref('')
const bestOf = ref(1)
const boOptions = [
  { value: 1, label: 'BO1' },
  { value: 3, label: 'BO3' },
  { value: 5, label: 'BO5' },
]
const teamAId = ref<number | null>(null)
const teamBId = ref<number | null>(null)
const teamOptions = computed(() => props.teams.map((t) => ({ value: t.id, label: t.name })))

function submit() {
  emit('submit', {
    bracket: bracket.value,
    round: Number(round.value) || 1,
    label: label.value.trim() || null,
    bestOf: bestOf.value,
    teamAId: teamAId.value,
    teamBId: teamBId.value,
  })
}
</script>

<template>
  <div class="card space-y-3 border-brand/40 p-4">
    <h3 class="text-base font-bold text-white">Новый матч</h3>

    <div class="grid gap-3 sm:grid-cols-2">
      <label class="block space-y-1">
        <span class="text-xs font-medium text-slate-400">Команда A</span>
        <AppSelect v-model="teamAId" :options="teamOptions" placeholder="Не выбрано" />
      </label>
      <label class="block space-y-1">
        <span class="text-xs font-medium text-slate-400">Команда B</span>
        <AppSelect v-model="teamBId" :options="teamOptions" placeholder="Не выбрано" />
      </label>
    </div>

    <div class="grid gap-3 sm:grid-cols-3">
      <label class="block space-y-1">
        <span class="text-xs font-medium text-slate-400">Секция сетки</span>
        <AppSelect v-model="bracket" :options="bracketOptions" />
      </label>
      <label class="block space-y-1">
        <span class="text-xs font-medium text-slate-400">Раунд</span>
        <input
          v-model.number="round"
          type="number"
          min="1"
          class="w-full rounded-lg border border-border bg-bg px-3 py-2 text-sm outline-none transition-colors focus:border-brand"
        />
      </label>
      <label class="block space-y-1">
        <span class="text-xs font-medium text-slate-400">Формат</span>
        <AppSelect v-model="bestOf" :options="boOptions" />
      </label>
    </div>

    <label class="block space-y-1">
      <span class="text-xs font-medium text-slate-400">Название матча (необязательно)</span>
      <input
        v-model="label"
        type="text"
        placeholder="Например, Финал"
        class="w-full rounded-lg border border-border bg-bg px-3 py-2 text-sm outline-none transition-colors focus:border-brand"
        @keydown.enter="submit"
      />
    </label>

    <div class="flex gap-2 pt-1">
      <button
        type="button"
        :disabled="busy"
        class="flex-1 cursor-pointer rounded-lg bg-brand px-3 py-2 text-sm font-semibold text-white transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
        @click="submit"
      >
        Добавить
      </button>
      <button
        type="button"
        class="cursor-pointer rounded-lg border border-border px-3 py-2 text-sm text-slate-400 transition-colors hover:border-slate-500 hover:text-white"
        @click="emit('cancel')"
      >
        Отмена
      </button>
    </div>
  </div>
</template>
