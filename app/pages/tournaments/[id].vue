<script setup lang="ts">
const route = useRoute()
const id = route.params.id as string
const { loggedIn } = useUserSession()
const { confirm } = useConfirm()
const { error } = useToast()
const config = useRuntimeConfig()

// URL динамический, поэтому тип ответа не выводится автоматически — задаём явно.
interface TournamentData {
  tournament: {
    id: number
    name: string
    status: string
    format: string
    teamSize: string
    championTeamId: number | null
    groupQualifiers?: number | null
  }
  teams: {
    id: number
    name: string
    logoUrl?: string | null
    roster?: { nickname: string; role?: 'captain' | 'player'; steamId?: string | null }[]
  }[]
  matches: any[]
  media?: {
    id: number
    type: 'photo' | 'video'
    url: string
    thumbUrl?: string | null
    caption?: string | null
  }[]
  mediaUsage?: {
    usedBytes: number
    capBytes: number
    leftBytes: number
    usedPercent: number
  }
}

const { data, pending, refresh } = await useFetch<TournamentData>(`/api/tournaments/${id}`)
const siteUrl = computed(() => String(config.public.siteUrl || 'http://localhost:3000').replace(/\/$/, ''))
const emptyOgImage = computed(() => `${siteUrl.value}/og-empty.svg`)

function absoluteUrl(v?: string | null) {
  if (!v) return null
  if (/^https?:\/\//i.test(v)) return v
  return `${siteUrl.value}${v}`
}

const shareTitle = computed(() => (data.value ? `${data.value.tournament.name} · RCS` : 'RCS'))
const shareDescription = computed(() => {
  if (!data.value) return 'Активные и завершённые турниры по CS2: сетка, результаты и live-матчи.'
  return `${formatLabel(data.value.tournament.format)} · ${data.value.tournament.teamSize} · Команд: ${data.value.teams.length}`
})
const shareImage = computed(() => {
  const mediaItem = data.value?.media?.find((m) => m.type === 'photo' && (m.thumbUrl || m.url))
  return mediaItem ? absoluteUrl(mediaItem.thumbUrl || mediaItem.url) : null
})
const sharePageUrl = computed(() => absoluteUrl(`/tournaments/${id}`))

useSeoMeta({
  title: 'RCS — LAN-турниры CS2',
  description: () => shareDescription.value,
  ogTitle: () => shareTitle.value,
  ogDescription: () => shareDescription.value,
  ogImage: () => emptyOgImage.value,
  ogUrl: () => sharePageUrl.value || undefined,
  twitterCard: 'summary_large_image',
  twitterTitle: () => shareTitle.value,
  twitterDescription: () => shareDescription.value,
  twitterImage: () => emptyOgImage.value,
})

useHead(() => ({
  link: [{ rel: 'canonical', href: sharePageUrl.value || undefined }],
  script: [
    {
      key: `ld-tournament-${id}`,
      type: 'application/ld+json',
      children: JSON.stringify({
        '@context': 'https://schema.org',
        '@type': 'SportsEvent',
        name: data.value?.tournament?.name || `Турнир #${id}`,
        eventStatus:
          data.value?.tournament?.status === 'finished'
            ? 'https://schema.org/EventCompleted'
            : 'https://schema.org/EventScheduled',
        sport: 'Counter-Strike 2',
        url: sharePageUrl.value,
        image: shareImage.value || undefined,
        description: shareDescription.value,
        inLanguage: 'ru-RU',
      }),
    },
  ],
}))

const teamMap = computed<Record<number, { id: number; name: string; logoUrl?: string | null }>>(() => {
  const m: Record<number, any> = {}
  for (const t of data.value?.teams ?? []) m[t.id] = t
  return m
})

const champion = computed(() => {
  const cid = data.value?.tournament?.championTeamId
  return cid ? teamMap.value[cid] : null
})
const effectiveGroupQualifiers = computed(() => {
  const raw = Number(data.value?.tournament?.groupQualifiers)
  const groupLabels = new Set(
    (data.value?.matches ?? [])
      .filter((m: any) => m?.bracket === 'group' && typeof m?.groupLabel === 'string' && m.groupLabel)
      .map((m: any) => m.groupLabel),
  )
  const teamsCount = data.value?.teams?.length ?? 0
  // Для турнира 1x6, где в форме выбрали 4, но в БД из-за старого бага осталось 2.
  if (
    data.value?.tournament?.format === 'groups_playoff' &&
    groupLabels.size === 1 &&
    teamsCount === 6 &&
    raw === 2
  ) return 4
  if (Number.isInteger(raw) && raw >= 1) return raw
  return 2
})

// Формат команд турнира — для пула карт в редакторе матча
provide(
  'teamSize',
  computed(() => data.value?.tournament?.teamSize ?? '5x5'),
)

const isFinished = computed(() => data.value?.tournament?.status === 'finished')
// В архиве правка включается кнопкой «Редактировать»; активные — редактируемы сразу.
const editMode = ref(false)
const dirty = ref(false) // были ли изменения в режиме правки архива
const editable = computed(() => loggedIn.value && (!isFinished.value || editMode.value))
// Управлять медиа можно на завершённом турнире (независимо от режима правки счёта)
const canManageMedia = computed(() => loggedIn.value && isFinished.value)
const activeBlock = computed(() => {
  const b = route.query.block
  if (b === 'rosters') return 'rosters'
  if (b === 'media' && isFinished.value) return 'media'
  return 'bracket'
})

function startEdit() {
  editMode.value = true
  dirty.value = false
}
function cancelEdit() {
  editMode.value = false
  dirty.value = false
}

function switchBlock(block: 'bracket' | 'rosters' | 'media') {
  const query = { ...route.query }
  if (block === 'bracket') delete query.block
  else query.block = block
  navigateTo({ query }, { replace: true })
}

async function saveMatch(payload: {
  id: number
  scoreA: number
  scoreB: number
  status: string
  bestOf?: number
  maps?: unknown
}) {
  await $fetch(`/api/matches/${payload.id}`, {
    method: 'PATCH',
    body: {
      scoreA: payload.scoreA,
      scoreB: payload.scoreB,
      status: payload.status,
      bestOf: payload.bestOf,
      maps: payload.maps,
    },
  })
  if (editMode.value) dirty.value = true // отмечаем, что появились правки
  await refresh()
}

async function finishTournament() {
  const ok = await confirm({
    title: 'Завершить турнир?',
    message: 'Он переместится в архив.',
    confirmText: 'Завершить',
  })
  if (!ok) return
  await $fetch(`/api/tournaments/${id}/finish`, { method: 'POST' })
  await refresh()
}

async function saveEdits() {
  editMode.value = false
  dirty.value = false
  await refresh()
}

async function seedPlayoff() {
  try {
    await $fetch(`/api/tournaments/${id}/seed-playoff`, {
      method: 'POST',
      body: { qualifiers: effectiveGroupQualifiers.value },
    })
    await refresh()
  } catch (e: any) {
    error(e?.data?.statusMessage || 'Не удалось сформировать плей-офф')
  }
}

async function swapGroupTeams(payload: { teamA: number; teamB: number }) {
  try {
    await $fetch(`/api/tournaments/${id}/swap-teams`, {
      method: 'POST',
      body: payload,
    })
    if (editMode.value) dirty.value = true
    await refresh()
  } catch (e: any) {
    error(e?.data?.statusMessage || 'Не удалось обменять команды')
  }
}

async function moveTeamToGroup(payload: { teamId: number; targetLabel: string }) {
  try {
    await $fetch(`/api/tournaments/${id}/move-team`, {
      method: 'POST',
      body: payload,
    })
    if (editMode.value) dirty.value = true
    await refresh()
  } catch (e: any) {
    error(e?.data?.statusMessage || 'Не удалось перенести команду')
  }
}

// Команды добавлены/удалены/изменены — сетка могла перестроиться, обновляем данные.
async function onTeamsChanged() {
  if (editMode.value) dirty.value = true
  await refresh()
}

async function addMatch(payload: {
  bracket: string
  round: number
  label: string | null
  bestOf: number
  teamAId: number | null
  teamBId: number | null
}) {
  try {
    await $fetch(`/api/tournaments/${id}/matches`, { method: 'POST', body: payload })
    if (editMode.value) dirty.value = true
    await refresh()
  } catch (e: any) {
    error(e?.data?.statusMessage || 'Не удалось добавить матч')
  }
}

async function addThirdPlace() {
  try {
    await $fetch(`/api/tournaments/${id}/third-place`, { method: 'POST' })
    if (editMode.value) dirty.value = true
    await refresh()
  } catch (e: any) {
    error(e?.data?.statusMessage || 'Не удалось добавить матч за 3-е место')
  }
}

async function reorderMatches(payload: { matchId: number; order: number }) {
  try {
    await $fetch('/api/matches/reorder', { method: 'POST', body: payload })
    if (editMode.value) dirty.value = true
    await refresh()
  } catch (e: any) {
    error(e?.data?.statusMessage || 'Не удалось изменить порядок матчей')
  }
}

async function deleteMatch(matchId: number) {
  const ok = await confirm({
    title: 'Удалить матч?',
    message: 'Действие необратимо — результат матча будет потерян.',
    confirmText: 'Удалить',
    tone: 'danger',
  })
  if (!ok) return
  try {
    await $fetch(`/api/matches/${matchId}`, { method: 'DELETE' })
    if (editMode.value) dirty.value = true
    await refresh()
  } catch (e: any) {
    error(e?.data?.statusMessage || 'Не удалось удалить матч')
  }
}
</script>

<template>
  <!-- Пока данные есть — показываем контент даже во время фонового обновления,
       чтобы сетка не «прыгала» при сохранении счёта. -->
  <div v-if="!data && pending" class="text-slate-500">Загрузка…</div>
  <div v-else-if="!data" class="card p-8 text-center text-red-400">
    Турнир не найден.
    <NuxtLink to="/" class="mt-3 block text-sm text-slate-400 hover:text-white">← На главную</NuxtLink>
  </div>

  <div v-else class="space-y-6">
    <!-- Хлебные крошки -->
    <NuxtLink to="/" class="inline-block text-sm text-slate-400 hover:text-white">← Все турниры</NuxtLink>

    <!-- Заголовок -->
    <div class="card flex flex-col gap-4 p-5 md:flex-row md:items-center md:justify-between">
      <div class="space-y-2">
        <div class="flex flex-wrap items-center gap-2">
          <h1 class="text-2xl font-extrabold">{{ data.tournament.name }}</h1>
          <StatusBadge :status="data.tournament.status" />
        </div>
        <div class="flex flex-wrap items-center gap-2 text-xs text-slate-400">
          <span class="rounded-md bg-surface-2 px-2 py-1">
            {{ formatLabel(data.tournament.format) }}
          </span>
          <span class="rounded-md bg-surface-2 px-2 py-1">{{ data.tournament.teamSize }}</span>
          <span class="rounded-md bg-surface-2 px-2 py-1">Команд: {{ data.teams.length }}</span>
        </div>
      </div>

      <div v-if="loggedIn" class="shrink-0">
        <!-- Активный турнир -->
        <button
          v-if="!isFinished"
          class="rounded-lg bg-teal-600 px-4 py-2 text-sm font-semibold text-white hover:bg-teal-500"
          @click="finishTournament"
        >
          Завершить турнир
        </button>

        <!-- Архив: Редактировать → (Отмена | Сохранить после правок) -->
        <button
          v-else-if="!editMode"
          class="inline-flex cursor-pointer items-center gap-1.5 rounded-lg border border-border bg-surface-2 px-4 py-2 text-sm font-semibold text-slate-200 transition hover:border-brand hover:text-white"
          @click="startEdit"
        >
          ✎ Редактировать
        </button>
        <button
          v-else-if="dirty"
          class="rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-white hover:opacity-90"
          @click="saveEdits"
        >
          Сохранить
        </button>
        <button
          v-else
          class="rounded-lg border border-border px-4 py-2 text-sm font-medium text-slate-400 transition hover:text-white"
          @click="cancelEdit"
        >
          Отмена
        </button>
      </div>
    </div>

    <!-- Чемпион -->
    <div v-if="champion" class="card relative overflow-hidden p-4 sm:p-5">
      <div
        class="pointer-events-none absolute -right-10 -top-10 h-32 w-32 rounded-full bg-brand/20 blur-3xl"
      />
      <div class="relative flex items-center gap-4">
        <div
          class="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-brand/15 text-2xl ring-1 ring-brand/30"
        >
          🏆
        </div>
        <div>
          <div class="text-xs font-semibold uppercase tracking-widest text-brand">
            Чемпион турнира
          </div>
          <div class="text-xl font-extrabold text-white">{{ champion.name }}</div>
        </div>
      </div>
    </div>

    <!-- Навигация по разделам -->
    <section class="card p-3">
      <h2 class="mb-2 text-sm font-semibold text-slate-400">Раздел турнира</h2>
      <div class="grid grid-cols-1 gap-2" :class="isFinished ? 'sm:grid-cols-3' : 'sm:grid-cols-2'">
        <button
          class="rounded-lg border px-3 py-2 text-left text-sm font-semibold transition"
          :class="
            activeBlock === 'bracket'
              ? 'border-brand bg-brand/15 text-white'
              : 'border-border bg-surface-2 text-slate-300 hover:border-brand/50 hover:text-white'
          "
          @click="switchBlock('bracket')"
        >
          Сетка
        </button>
        <button
          class="rounded-lg border px-3 py-2 text-left text-sm font-semibold transition"
          :class="
            activeBlock === 'rosters'
              ? 'border-brand bg-brand/15 text-white'
              : 'border-border bg-surface-2 text-slate-300 hover:border-brand/50 hover:text-white'
          "
          @click="switchBlock('rosters')"
        >
          Команды
        </button>
        <button
          v-if="isFinished"
          class="rounded-lg border px-3 py-2 text-left text-sm font-semibold transition"
          :class="
            activeBlock === 'media'
              ? 'border-brand bg-brand/15 text-white'
              : 'border-border bg-surface-2 text-slate-300 hover:border-brand/50 hover:text-white'
          "
          @click="switchBlock('media')"
        >
          Фото и видео
        </button>
      </div>
    </section>

    <!-- Сетка -->
    <section v-if="activeBlock === 'bracket'">
      <BracketView
        :format="data.tournament.format"
        :matches="data.matches"
        :teams="data.teams"
        :group-qualifiers="effectiveGroupQualifiers"
        :editable="editable"
        @save="saveMatch"
        @seed-playoff="seedPlayoff"
        @swap-teams="swapGroupTeams"
        @move-team="moveTeamToGroup"
        @add-match="addMatch"
        @add-third-place="addThirdPlace"
        @delete-match="deleteMatch"
        @reorder-matches="reorderMatches"
      />
    </section>

    <!-- Составы -->
    <RostersSection
      v-else-if="activeBlock === 'rosters'"
      :tournament-id="data.tournament.id"
      :teams="data.teams"
      :team-size="data.tournament.teamSize"
      :editable="editable"
      @changed="onTeamsChanged"
    />

    <!-- Фото и видео (завершённые турниры) -->
    <MediaGallery
      v-else
      :tournament-id="data.tournament.id"
      :items="data.media ?? []"
      :usage="data.mediaUsage"
      :editable="canManageMedia"
      @changed="refresh"
    />
  </div>
</template>
