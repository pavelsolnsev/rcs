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
const rosterSize = computed(() => (form.teamSize === '1x1' ? 1 : form.teamSize === '2x2' ? 2 : 5))
const rosterDraft = ref<string[][]>([])

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
  for (const [teamIdx, teamName] of parsedTeams.value.entries()) {
    const players = rosterDraft.value[teamIdx] ?? []
    if (players.length !== rosterSize.value || players.some((p) => !p?.trim())) {
      formError.value = `Заполни состав команды «${teamName}»`
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
        teamRosters: parsedTeams.value.map((_, teamIdx) =>
          (rosterDraft.value[teamIdx] ?? []).map((nickname, playerIdx) => ({
            nickname: nickname.trim(),
            role: playerIdx === 0 ? 'captain' : 'player',
          })),
        ),
        groupSize: form.groupSize,
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
              <label class="mb-1 block text-sm text-slate-400">Размер группы</label>
              <input
                v-model.number="form.groupSize"
                type="number"
                min="2"
                class="w-full rounded-lg border border-border bg-bg px-3 py-2 outline-none focus:border-brand"
              />
            </div>
            <div>
              <label class="mb-1 block text-sm text-slate-400">Выходят из группы</label>
              <input
                v-model.number="form.qualifiers"
                type="number"
                min="1"
                class="w-full rounded-lg border border-border bg-bg px-3 py-2 outline-none focus:border-brand"
              />
            </div>
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
              <span class="text-slate-600">(по {{ rosterSize }} игрок{{ rosterSize === 1 ? 'у' : 'ов' }})</span>
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
