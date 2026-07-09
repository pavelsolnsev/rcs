<script setup lang="ts">
const { loggedIn, fetch: refreshSession } = useUserSession()
const config = useRuntimeConfig()

const siteUrl = computed(() => String(config.public.siteUrl || 'http://localhost:3000').replace(/\/$/, ''))
const canonicalUrl = computed(() => `${siteUrl.value}/admin/login`)

useSeoMeta({
  title: 'RCS — LAN-турниры CS2',
  robots: 'noindex, nofollow, noarchive, nosnippet',
  googlebot: 'noindex, nofollow',
})

useHead(() => ({
  link: [{ rel: 'canonical', href: canonicalUrl.value }],
}))

// Уже вошли — перенаправляем в админку
watchEffect(() => {
  if (loggedIn.value) navigateTo('/admin')
})

const username = ref('')
const password = ref('')
const error = ref('')
const loading = ref(false)

async function submit() {
  error.value = ''
  loading.value = true
  try {
    const normalizedUsername = username.value.trim()
    await $fetch('/api/auth/login', {
      method: 'POST',
      body: { username: normalizedUsername, password: password.value },
    })
    await refreshSession()
    if (!loggedIn.value) {
      throw createError({
        statusCode: 500,
        statusMessage: 'Сессия не сохранилась. Проверьте вход по HTTPS или настройки cookie.',
      })
    }
    await navigateTo('/admin')
  } catch (e: any) {
    error.value = e?.data?.statusMessage || e?.statusMessage || 'Ошибка входа'
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <div class="mx-auto max-w-sm">
    <div class="card p-6">
      <div class="mb-3 flex justify-end">
        <NuxtLink
          to="/"
          aria-label="Закрыть вход"
          class="inline-flex h-8 w-8 items-center justify-center rounded-md border border-border text-slate-400 transition-colors hover:border-brand hover:text-white"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
            <path d="M6 6l12 12M18 6L6 18" />
          </svg>
        </NuxtLink>
      </div>
      <div class="mb-6 flex flex-col items-center gap-2 text-center">
        <AppLogo :size="48" />
        <h1 class="text-xl font-bold">Вход для администратора</h1>
        <p class="text-sm text-slate-400">Управление турнирами и результатами</p>
      </div>

      <form class="space-y-4" @submit.prevent="submit">
        <div>
          <label class="mb-1 block text-sm text-slate-400">Логин</label>
          <input
            v-model="username"
            type="text"
            autocomplete="username"
            autocapitalize="none"
            autocorrect="off"
            spellcheck="false"
            inputmode="text"
            class="w-full rounded-lg border border-border bg-bg px-3 py-2 outline-none focus:border-brand"
          />
        </div>
        <div>
          <label class="mb-1 block text-sm text-slate-400">Пароль</label>
          <input
            v-model="password"
            type="password"
            autocomplete="current-password"
            autocapitalize="none"
            autocorrect="off"
            spellcheck="false"
            inputmode="text"
            class="w-full rounded-lg border border-border bg-bg px-3 py-2 outline-none focus:border-brand"
          />
        </div>

        <p v-if="error" class="text-sm text-red-400">{{ error }}</p>

        <button
          type="submit"
          :disabled="loading"
          class="w-full rounded-lg bg-brand px-4 py-2 font-semibold text-white hover:opacity-90 disabled:opacity-50"
        >
          {{ loading ? 'Вход…' : 'Войти' }}
        </button>
      </form>

    </div>
  </div>
</template>
