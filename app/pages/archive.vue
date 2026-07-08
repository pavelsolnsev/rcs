<script setup lang="ts">
const { data: tournaments, pending } = await useFetch('/api/tournaments')
const config = useRuntimeConfig()

const siteUrl = computed(() => String(config.public.siteUrl || 'http://localhost:3000').replace(/\/$/, ''))
const canonicalUrl = computed(() => `${siteUrl.value}/archive`)
const ogImage = computed(() => `${siteUrl.value}/logo.webp`)

useSeoMeta({
  title: 'RCS — LAN-турниры CS2',
  description: 'Архив завершённых турниров RCS по CS2: результаты, чемпионы, сетка и медиа.',
  ogType: 'website',
  ogSiteName: String(config.public.siteName || 'RCS'),
  ogTitle: 'Архив турниров RCS',
  ogDescription: 'Смотри завершённые турниры, результаты и чемпионов.',
  ogUrl: canonicalUrl,
  ogImage,
  twitterCard: 'summary_large_image',
  twitterTitle: 'Архив турниров RCS',
  twitterDescription: 'Завершённые LAN-турниры по CS2.',
  twitterImage: ogImage,
})

useHead(() => ({
  link: [{ rel: 'canonical', href: canonicalUrl.value }],
  script: [
    {
      key: 'ld-archive',
      type: 'application/ld+json',
      children: JSON.stringify({
        '@context': 'https://schema.org',
        '@type': 'CollectionPage',
        name: 'Архив турниров',
        url: canonicalUrl.value,
        inLanguage: 'ru-RU',
      }),
    },
  ],
}))

interface TournamentListItem {
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

const filters = ref({
  search: '',
})

const list = computed(() =>
  ((tournaments.value ?? []) as TournamentListItem[]).filter((t) => t.status === 'finished'),
)

const filtered = computed(() => {
  const q = filters.value.search.trim().toLowerCase()
  return list.value.filter((t) => !q || t.name.toLowerCase().includes(q))
})
</script>

<template>
  <div class="space-y-6">
    <div>
      <h1 class="text-2xl font-extrabold">Архив турниров</h1>
      <p class="mt-1 text-slate-400">Завершённые соревнования и их результаты.</p>
    </div>

    <TournamentFilters
      v-model="filters"
    />

    <div v-if="pending" class="text-slate-500">Загрузка…</div>
    <div v-else-if="filtered.length" class="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      <TournamentCard v-for="t in filtered" :key="t.id" :tournament="t" />
    </div>
    <div v-else class="card p-8 text-center text-slate-500">
      По фильтрам ничего не найдено.
    </div>
  </div>
</template>
