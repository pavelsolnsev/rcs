<script setup lang="ts">
definePageMeta({ middleware: 'admin' })
const config = useRuntimeConfig()

const siteUrl = computed(() => String(config.public.siteUrl || 'http://localhost:3000').replace(/\/$/, ''))
const canonicalUrl = computed(() => `${siteUrl.value}/admin`)

useSeoMeta({
  title: 'RCS — LAN-турниры CS2',
  robots: 'noindex, nofollow, noarchive, nosnippet',
  googlebot: 'noindex, nofollow',
})

useHead(() => ({
  link: [{ rel: 'canonical', href: canonicalUrl.value }],
}))

const { data: tournaments, refresh } = await useFetch('/api/tournaments')
const { confirm } = useConfirm()
const { error } = useToast()

// ---- Форма создания ----
const form = reactive({
  name: '',
  format: 'single_elimination',
  teamSize: '5x5',
  teamsText: '',
  groupSize: 4,
  groupCount: 1,
  qualifiers: 2,
  boGroups: 1,
  boMain: 1,
  boFinal: 3,
})

const boOptions = [
  { value: 1, label: 'BO1' },
  { value: 3, label: 'BO3' },
  { value: 5, label: 'BO5' },
]
const creating = ref(false)
const formError = ref('')

const formats = [
  { value: 'single_elimination', label: 'Single Elimination' },
  { value: 'double_elimination', label: 'Double Elimination' },
  { value: 'groups_playoff', label: 'Группы → Плей-офф' },
]
const teamSizes = ['1x1', '2x2', '5x5']

const parsedTeams = computed(() =>
  form.teamsText
    .split('\n')
    .map((s) => s.trim())
    .filter(Boolean),
)
const effectiveGroupSize = computed(() => {
  return form.groupSize
})
const showGroupCountSection = computed(
  () => form.format === 'groups_playoff' && Number(form.groupSize) >= 6,
)
const teamsForGrouping = computed(() =>
  Math.max(parsedTeams.value.length, Math.max(0, Number(form.groupSize) || 0)),
)
const maxAllowedGroupCount = computed(() => {
  if (!showGroupCountSection.value) return 1
  const total = teamsForGrouping.value
  if (total < 6) return 1
  // Логика: в группе должно быть минимум 3 команды.
  return Math.max(2, Math.floor(total / 3))
})
const effectiveGroupCount = computed(() => {
  if (form.format !== 'groups_playoff') return undefined
  if (!showGroupCountSection.value) return 1
  const raw = Number(form.groupCount)
  if (!Number.isFinite(raw)) return 1
  return Math.min(maxAllowedGroupCount.value, Math.max(1, Math.floor(raw)))
})
const minTeamsPerGroup = computed(() => {
  if (form.format !== 'groups_playoff') return 2
  const total = teamsForGrouping.value
  if (total < 2) return Math.max(2, Number(effectiveGroupSize.value) || 4)
  const size = Math.max(2, Number(effectiveGroupSize.value) || 4)
  const count = Number(effectiveGroupCount.value) || 0
  if (count > 0) return Math.max(2, Math.floor(total / count))
  const rem = total % size
  return Math.max(2, rem === 0 ? size : rem)
})
const effectiveGroupCountValue = computed(() => {
  if (form.format !== 'groups_playoff') return 0
  const total = parsedTeams.value.length
  const size = Math.max(2, Number(effectiveGroupSize.value) || 4)
  const explicit = Number(effectiveGroupCount.value) || 0
  if (explicit > 0) return explicit
  return Math.max(1, Math.ceil(total / size))
})
const totalPlayoffTeams = computed(() => {
  if (form.format !== 'groups_playoff') return 0
  return effectiveGroupCountValue.value * Math.max(0, Number(form.qualifiers) || 0)
})
const rosterSize = computed(() => (form.teamSize === '1x1' ? 1 : form.teamSize === '2x2' ? 2 : 5))
const rosterDraft = ref<string[][]>([])
const teamRostersPayload = computed(() => {
  const payload = parsedTeams.value.map((_, teamIdx) =>
    (rosterDraft.value[teamIdx] ?? []).map((nickname, playerIdx) => ({
      nickname: nickname.trim(),
      role: playerIdx === 0 ? 'captain' : 'player',
    })),
  )
  const hasAnyNickname = payload.some((team) => team.some((player) => player.nickname))
  return hasAnyNickname ? payload : undefined
})

function clampQualifiersInput() {
  if (form.format !== 'groups_playoff') return
  const maxAllowed = Math.max(1, minTeamsPerGroup.value)
  const raw = Number(form.qualifiers)
  if (!Number.isFinite(raw)) {
    form.qualifiers = 1
    return
  }
  form.qualifiers = Math.min(maxAllowed, Math.max(1, Math.floor(raw)))
}

function clampGroupCountInput() {
  if (form.format !== 'groups_playoff' || !showGroupCountSection.value) {
    form.groupCount = 1
    return
  }
  const raw = Number(form.groupCount)
  if (!Number.isFinite(raw)) {
    form.groupCount = 1
    return
  }
  form.groupCount = Math.min(maxAllowedGroupCount.value, Math.max(1, Math.floor(raw)))
}

watch([parsedTeams, rosterSize], ([names, size]) => {
  const prev = rosterDraft.value
  rosterDraft.value = names.map((name, teamIdx) =>
    Array.from({ length: size }, (_, playerIdx) => {
      const prevValue = prev[teamIdx]?.[playerIdx]
      if (prevValue) return prevValue
      if (size === 1) return name
      return ''
    }),
  )
}, { immediate: true })
watch(
  () => [form.format, form.groupSize, parsedTeams.value.length],
  () => {
    clampGroupCountInput()
  },
  { immediate: true },
)

async function createTournament() {
  formError.value = ''
  if (!form.name.trim()) {
    formError.value = 'Укажите название'
    return
  }
  if (parsedTeams.value.length < 2) {
    formError.value = 'Нужно минимум 2 команды (по одной в строке)'
    return
  }
  if (form.format === 'groups_playoff') {
    clampGroupCountInput()
    const minGroup = minTeamsPerGroup.value
    if (minGroup < 2) {
      formError.value = 'В каждой группе должно быть минимум 2 команды'
      return
    }
    const qualifiers = Number(form.qualifiers)
    if (
      !Number.isInteger(qualifiers) ||
      qualifiers < 1 ||
      qualifiers > minGroup
    ) {
      formError.value = `Количество выходящих из группы должно быть от 1 до ${minGroup}`
      return
    }
  }
  creating.value = true
  try {
    const res = await $fetch<{ id: number }>('/api/tournaments', {
      method: 'POST',
      body: {
        name: form.name,
        format: form.format,
        teamSize: form.teamSize,
        teamNames: parsedTeams.value,
        teamRosters: teamRostersPayload.value,
        groupSize: form.format === 'groups_playoff' ? effectiveGroupSize.value : undefined,
        groupCount: form.format === 'groups_playoff' ? effectiveGroupCount.value : undefined,
        qualifiers: form.qualifiers,
        boGroups: form.boGroups,
        boMain: form.boMain,
        boFinal: form.boFinal,
      },
    })
    await navigateTo(`/tournaments/${res.id}`)
  } catch (e: any) {
    formError.value = e?.data?.statusMessage || 'Ошибка создания'
  } finally {
    creating.value = false
  }
}

async function removeTournament(id: number, name: string) {
  const ok = await confirm({
    title: `Удалить турнир «${name}»?`,
    message: 'Действие необратимо — турнир, команды и все матчи будут удалены.',
    confirmText: 'Удалить',
    tone: 'danger',
  })
  if (!ok) return
  try {
    await $fetch(`/api/tournaments/${id}`, { method: 'DELETE' })
    await refresh()
  } catch (e: any) {
    error(e?.data?.statusMessage || 'Не удалось удалить турнир')
  }
}
</script>

<template>
  <div class="space-y-8">
    <h1 class="text-2xl font-extrabold">Панель администратора</h1>

    <div class="grid gap-6 lg:grid-cols-5">
      <!-- Создание турнира -->
      <section class="card p-5 lg:col-span-3">
        <h2 class="mb-4 text-lg font-bold">Создать турнир</h2>
        <div class="space-y-4">
          <div>
            <label class="mb-1 block text-sm text-slate-400">Название</label>
            <input
              v-model="form.name"
              type="text"
              placeholder="CS2 Weekly Cup #15"
              class="w-full rounded-lg border border-border bg-bg px-3 py-2 outline-none focus:border-brand"
            />
          </div>

          <div class="grid gap-4 sm:grid-cols-2">
            <div>
              <label class="mb-1 block text-sm text-slate-400">Формат сетки</label>
              <AppSelect v-model="form.format" :options="formats" />
            </div>
            <div>
              <label class="mb-1 block text-sm text-slate-400">Формат команд</label>
              <AppSelect v-model="form.teamSize" :options="teamSizes" />
            </div>
          </div>

          <div v-if="form.format === 'groups_playoff'" class="grid gap-4 sm:grid-cols-2">
            <div>
              <label class="mb-1 block text-sm text-slate-400">Количество команд</label>
              <input
                v-model.number="form.groupSize"
                type="number"
                min="2"
                class="w-full rounded-lg border border-border bg-bg px-3 py-2 outline-none focus:border-brand"
              />
            </div>
            <div v-if="showGroupCountSection">
              <label class="mb-1 block text-sm text-slate-400">Количество групп</label>
              <input
                v-model.number="form.groupCount"
                type="number"
                min="1"
                :max="maxAllowedGroupCount"
                class="w-full rounded-lg border border-border bg-bg px-3 py-2 outline-none focus:border-brand"
                @input="clampGroupCountInput"
              />
              <p class="mt-1 text-xs text-slate-500">
                Допустимо: 1–{{ maxAllowedGroupCount }} (минимум 3 команды в группе)
              </p>
            </div>
            <div>
              <label class="mb-1 block text-sm text-slate-400">Выходят из группы</label>
              <input
                v-model.number="form.qualifiers"
                type="number"
                min="1"
                :max="Math.max(1, minTeamsPerGroup)"
                class="w-full rounded-lg border border-border bg-bg px-3 py-2 outline-none focus:border-brand"
                @input="clampQualifiersInput"
              />
              <p class="mt-1 text-xs text-slate-500">
                Допустимо: 1–{{ Math.max(1, minTeamsPerGroup) }} на группу
              </p>
            </div>
          </div>
          <div
            v-if="form.format === 'groups_playoff'"
            class="rounded-lg border border-border bg-surface-2/50 p-3 text-xs text-slate-300"
          >
            <p>
              Итог: групп — <span class="font-semibold text-white">{{ effectiveGroupCountValue }}</span>,
              выходит из каждой — <span class="font-semibold text-white">{{ form.qualifiers }}</span>,
              в плей-офф попадут —
              <span class="font-semibold text-brand">{{ totalPlayoffTeams }}</span> команд.
            </p>
          </div>

          <!-- Формат матчей (best-of) по стадиям -->
          <div>
            <label class="mb-1 block text-sm text-slate-400">Формат матчей (best of)</label>
            <div class="grid gap-4 sm:grid-cols-3">
              <div v-if="form.format === 'groups_playoff'">
                <span class="mb-1 block text-xs text-slate-500">Группы</span>
                <AppSelect v-model="form.boGroups" :options="boOptions" />
              </div>
              <div>
                <span class="mb-1 block text-xs text-slate-500">
                  {{ form.format === 'groups_playoff' ? 'Плей-офф' : 'Основная сетка' }}
                </span>
                <AppSelect v-model="form.boMain" :options="boOptions" />
              </div>
              <div>
                <span class="mb-1 block text-xs text-slate-500">Финал</span>
                <AppSelect v-model="form.boFinal" :options="boOptions" />
              </div>
            </div>
          </div>

          <div>
            <label class="mb-1 block text-sm text-slate-400">
              Команды <span class="text-slate-600">(по одной в строке, {{ parsedTeams.length }} шт.)</span>
            </label>
            <textarea
              v-model="form.teamsText"
              rows="6"
              placeholder="Navi&#10;Vitality&#10;FaZe&#10;G2"
              class="w-full resize-y rounded-lg border border-border bg-bg px-3 py-2 font-mono text-sm outline-none focus:border-brand"
            />
          </div>

          <div v-if="parsedTeams.length" class="space-y-2">
            <label class="block text-sm text-slate-400">
              Составы команд
              <span class="text-slate-600">
                (по {{ rosterSize }} игрок{{ rosterSize === 1 ? 'у' : 'ов' }}, необязательно)
              </span>
            </label>
            <div class="grid gap-3 sm:grid-cols-2">
              <div
                v-for="(teamName, teamIdx) in parsedTeams"
                :key="`${teamName}-${teamIdx}`"
                class="rounded-lg border border-border bg-bg/70 p-3"
              >
                <div class="mb-2 truncate text-sm font-semibold text-white">{{ teamName }}</div>
                <div class="space-y-1.5">
                  <div v-for="playerIdx in rosterSize" :key="playerIdx" class="flex items-center gap-2">
                    <span class="w-16 shrink-0 text-[11px] text-slate-500">
                      {{ playerIdx === 1 ? 'Капитан' : `Игрок ${playerIdx}` }}
                    </span>
                    <input
                      v-model="rosterDraft[teamIdx][playerIdx - 1]"
                      type="text"
                      :placeholder="`Ник #${playerIdx}`"
                      class="w-full rounded-md border border-border bg-surface-2 px-2 py-1.5 text-sm outline-none focus:border-brand"
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>

          <p v-if="formError" class="text-sm text-red-400">{{ formError }}</p>

          <button
            :disabled="creating"
            class="rounded-lg bg-brand px-5 py-2 font-semibold text-white hover:opacity-90 disabled:opacity-50"
            @click="createTournament"
          >
            {{ creating ? 'Создание…' : 'Создать и открыть сетку' }}
          </button>
        </div>
      </section>

      <!-- Список турниров -->
      <section class="card p-5 lg:col-span-2">
        <h2 class="mb-4 text-lg font-bold">Все турниры</h2>
        <div v-if="tournaments?.length" class="space-y-2">
          <div
            v-for="t in tournaments"
            :key="t.id"
            class="flex items-center gap-2 rounded-lg border border-border bg-bg p-2.5"
          >
            <NuxtLink :to="`/tournaments/${t.id}`" class="min-w-0 flex-1">
              <div class="truncate text-sm font-medium text-white">{{ t.name }}</div>
              <div class="mt-0.5"><StatusBadge :status="t.status" /></div>
            </NuxtLink>
            <button
              class="rounded-md px-2 py-1 text-xs text-red-400 hover:bg-red-500/10"
              @click="removeTournament(t.id, t.name)"
            >
              Удалить
            </button>
          </div>
        </div>
        <p v-else class="text-sm text-slate-500">Турниров пока нет.</p>
      </section>
    </div>
  </div>
</template>
