<script setup lang="ts">
const { data: tournaments, pending } = await useFetch('/api/tournaments')
const config = useRuntimeConfig()

const siteUrl = computed(() => String(config.public.siteUrl || 'http://localhost:3000').replace(/\/$/, ''))
const canonicalUrl = computed(() => `${siteUrl.value}/`)
const ogImage = computed(() => `${siteUrl.value}/og-empty.svg`)

useSeoMeta({
  title: 'RCS — LAN-турниры CS2',
  description: 'Актуальные LAN-турниры по CS2: live-матчи, сетка и результаты в реальном времени.',
  ogType: 'website',
  ogSiteName: String(config.public.siteName || 'RCS'),
  ogTitle: 'RCS — LAN-турниры CS2',
  ogDescription: 'Следи за активными турнирами, live-матчами и прогрессом команд.',
  ogUrl: canonicalUrl,
  ogImage,
  twitterCard: 'summary_large_image',
  twitterTitle: 'RCS — LAN-турниры CS2',
  twitterDescription: 'Живые турниры, сетка и результаты по CS2.',
  twitterImage: ogImage,
})

useHead(() => ({
  link: [{ rel: 'canonical', href: canonicalUrl.value }],
  script: [
    {
      key: 'ld-website',
      type: 'application/ld+json',
      children: JSON.stringify({
        '@context': 'https://schema.org',
        '@type': 'WebSite',
        name: String(config.public.siteName || 'RCS'),
        url: siteUrl.value,
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

const active = computed(() =>
  ((tournaments.value ?? []) as TournamentListItem[]).filter((t) => t.status !== 'finished'),
)
</script>

<template>
  <div class="space-y-8">
    <!-- Hero -->
    <section class="card relative overflow-hidden p-5 sm:p-6 md:p-10">
      <div
        class="pointer-events-none absolute -right-16 -top-16 h-56 w-56 rounded-full bg-brand/20 blur-3xl"
      />
      <div class="relative max-w-2xl">
        <h1 class="text-xl font-extrabold leading-tight sm:text-2xl md:text-4xl">
          Живые LAN-турниры по CS2 в Раменском
        </h1>
        <p class="mt-2 text-sm text-slate-400 sm:mt-3 md:text-base">
          RCS — это офлайн-турниры вживую: один зал, команды за соседними столами и настоящая
          ламповая атмосфера LAN. Мы организуем и проводим соревнования по CS2, а здесь ты в
          реальном времени следишь за сеткой, счётом и продвижением команд.
        </p>

        <div class="mt-4 grid grid-cols-2 gap-3 sm:mt-5 sm:max-w-md">
          <a
            href="https://t.me/rcs2ram"
            target="_blank"
            rel="noopener"
            class="inline-flex items-center justify-center gap-2 rounded-lg border border-border bg-surface-2 px-4 py-2.5 text-sm font-semibold text-white transition hover:border-brand"
          >
            <svg viewBox="0 0 24 24" class="h-4 w-4 text-[#29a9ea]" fill="currentColor" aria-hidden="true">
              <path d="M9.78 18.65l.28-4.23 7.68-6.92c.34-.31-.07-.46-.52-.19L7.74 13.3 3.64 12c-.88-.25-.89-.86.2-1.3l15.97-6.16c.73-.33 1.43.18 1.15 1.3l-2.72 12.81c-.19.91-.74 1.13-1.5.71L12.6 16.3l-1.99 1.93c-.23.23-.42.42-.83.42z" />
            </svg>
            Telegram
          </a>
          <a
            href="https://vk.com/rcsram"
            target="_blank"
            rel="noopener"
            class="inline-flex items-center justify-center gap-2 rounded-lg border border-border bg-surface-2 px-4 py-2.5 text-sm font-semibold text-white transition hover:border-brand"
          >
            <svg viewBox="0 0 24 24" class="h-4 w-4 text-[#0077ff]" fill="currentColor" aria-hidden="true">
              <path d="M13.16 19c-5.34 0-8.39-3.66-8.51-9.75h2.67c.09 4.47 2.06 6.36 3.62 6.75V9.25h2.52v3.86c1.54-.17 3.16-1.92 3.7-3.86h2.52c-.42 2.4-2.17 4.15-3.42 4.87 1.25.59 3.24 2.12 4 4.88h-2.77c-.6-1.85-2.08-3.28-4.03-3.47V19z" />
            </svg>
            ВКонтакте
          </a>
        </div>
        <div class="mt-3 sm:max-w-md">
          <NuxtLink
            to="/archive"
            class="inline-flex w-full items-center justify-center rounded-lg border border-border bg-surface-2 px-4 py-2.5 text-sm font-semibold text-slate-200 transition-colors hover:border-brand hover:text-white"
          >
            Смотреть завершённые турниры
          </NuxtLink>
        </div>
      </div>
    </section>

    <!-- Активные турниры -->
    <section>
      <div class="mb-3">
        <h2 class="text-xl font-bold">Активные турниры</h2>
      </div>

      <div v-if="pending" class="text-slate-500">Загрузка…</div>
      <div
        v-else-if="active.length"
        class="grid gap-4 sm:grid-cols-2 lg:grid-cols-3"
      >
        <TournamentCard v-for="t in active" :key="t.id" :tournament="t" />
      </div>
      <div v-else class="card px-4 py-3 text-center text-sm text-slate-500">
        Пока нет активных турниров.
      </div>
    </section>
  </div>
</template>
