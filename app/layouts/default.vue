<script setup lang="ts">
const { loggedIn, user, clear } = useUserSession()
const route = useRoute()

const mobileOpen = ref(false)
// Закрываем мобильное меню при смене страницы
watch(() => route.path, () => (mobileOpen.value = false))

async function logout() {
  mobileOpen.value = false
  await $fetch('/api/auth/logout', { method: 'POST' })
  await clear()
  await navigateTo('/')
}

const nav = [
  { to: '/', label: 'Активные турниры' },
  { to: '/archive', label: 'Завершённые турниры' },
]
</script>

<template>
  <!-- App-shell: экран на всю высоту, скролл только внутри .app-scroll -->
  <div class="flex h-[100dvh] flex-col overflow-hidden overscroll-none">
    <!-- Шапка (фиксирована сверху) -->
    <header
      class="shrink-0 border-b border-border bg-bg/85 backdrop-blur [padding-top:env(safe-area-inset-top)]"
    >
      <div class="mx-auto flex max-w-6xl items-center gap-2 px-3 py-2.5 sm:gap-4 sm:px-4 sm:py-3">
        <NuxtLink to="/" class="flex shrink-0 items-center gap-2">
          <AppLogo :size="30" />
          <span class="text-lg font-extrabold tracking-tight">
            R<span class="text-brand">CS</span>
          </span>
        </NuxtLink>

        <!-- Десктопная навигация -->
        <nav class="ml-2 hidden items-center gap-1 sm:flex">
          <NuxtLink
            v-for="item in nav"
            :key="item.to"
            :to="item.to"
            class="rounded-lg px-3 py-1.5 text-sm font-medium transition-colors"
            :class="
              route.path === item.to
                ? 'bg-surface-2 text-white'
                : 'text-slate-400 hover:text-white hover:bg-surface'
            "
          >
            {{ item.label }}
          </NuxtLink>
        </nav>

        <div class="ml-auto hidden items-center gap-2 sm:flex">
          <template v-if="loggedIn">
            <NuxtLink
              to="/admin"
              class="rounded-lg bg-brand px-3 py-1.5 text-sm font-semibold text-white hover:opacity-90"
            >
              Создать
            </NuxtLink>
            <button
              class="rounded-lg px-3 py-1.5 text-sm text-slate-400 hover:text-white"
              @click="logout"
            >
              Выйти<span class="hidden md:inline"> ({{ user?.username }})</span>
            </button>
          </template>
          <NuxtLink
            v-else
            to="/admin/login"
            class="rounded-lg border border-border px-3 py-1.5 text-sm font-medium text-slate-300 hover:border-brand hover:text-white"
          >
            Вход в админку
          </NuxtLink>
        </div>

        <!-- Гамбургер (мобильные) -->
        <button
          class="ml-auto flex h-9 w-9 items-center justify-center rounded-lg border border-border text-slate-300 hover:text-white sm:hidden"
          :aria-expanded="mobileOpen"
          aria-label="Меню"
          @click="mobileOpen = !mobileOpen"
        >
          <svg v-if="!mobileOpen" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round">
            <path d="M4 6h16M4 12h16M4 18h16" />
          </svg>
          <svg v-else width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round">
            <path d="M6 6l12 12M18 6L6 18" />
          </svg>
        </button>
      </div>

      <!-- Выпадающее мобильное меню -->
      <Transition
        enter-active-class="transition duration-150 ease-out"
        enter-from-class="opacity-0 -translate-y-2"
        leave-active-class="transition duration-100 ease-in"
        leave-to-class="opacity-0 -translate-y-2"
      >
        <nav
          v-if="mobileOpen"
          class="border-t border-border bg-bg px-3 py-3 sm:hidden"
        >
          <NuxtLink
            v-for="item in nav"
            :key="item.to"
            :to="item.to"
            class="block rounded-lg px-3 py-2.5 text-base font-medium transition-colors"
            :class="
              route.path === item.to
                ? 'bg-surface-2 text-white'
                : 'text-slate-300 hover:bg-surface hover:text-white'
            "
          >
            {{ item.label }}
          </NuxtLink>

          <div class="my-2 border-t border-border" />

          <template v-if="loggedIn">
            <NuxtLink
              to="/admin"
              class="block rounded-lg bg-brand px-3 py-2.5 text-center text-base font-semibold text-white"
            >
              Создать
            </NuxtLink>
            <button
              class="mt-2 block w-full rounded-lg px-3 py-2.5 text-left text-base text-slate-300 hover:text-white"
              @click="logout"
            >
              Выйти <span class="text-slate-500">({{ user?.username }})</span>
            </button>
          </template>
          <NuxtLink
            v-else
            to="/admin/login"
            class="block rounded-lg border border-border px-3 py-2.5 text-center text-base font-medium text-slate-200 hover:border-brand hover:text-white"
          >
            Вход в админку
          </NuxtLink>
        </nav>
      </Transition>
    </header>

    <!-- Область прокрутки (единственная, что скроллится; без отскока) -->
    <div class="app-scroll flex-1 overflow-y-auto overflow-x-hidden overscroll-y-none">
      <!-- Контент -->
      <main class="mx-auto w-full max-w-6xl px-3 py-5 sm:px-4 sm:py-6">
        <slot />
      </main>

      <!-- Подвал -->
      <footer
        class="border-t border-border py-8 text-center [padding-bottom:calc(2rem+env(safe-area-inset-bottom))]"
      >
        <div class="mx-auto flex max-w-6xl flex-col items-center gap-2 px-4">
          <AppLogo :size="28" />
          <p class="text-xs uppercase tracking-[0.2em] text-slate-500">
            Играем вживую · настоящая атмосфера
          </p>

          <div class="mt-2 flex items-center gap-3">
            <a
              href="https://t.me/rcs2ram"
              target="_blank"
              rel="noopener"
              aria-label="Telegram"
              class="flex h-9 w-9 items-center justify-center rounded-full border border-border text-[#29a9ea] transition hover:border-brand"
            >
              <svg viewBox="0 0 24 24" class="h-4 w-4" fill="currentColor" aria-hidden="true">
                <path d="M9.78 18.65l.28-4.23 7.68-6.92c.34-.31-.07-.46-.52-.19L7.74 13.3 3.64 12c-.88-.25-.89-.86.2-1.3l15.97-6.16c.73-.33 1.43.18 1.15 1.3l-2.72 12.81c-.19.91-.74 1.13-1.5.71L12.6 16.3l-1.99 1.93c-.23.23-.42.42-.83.42z" />
              </svg>
            </a>
            <a
              href="https://vk.com/rcsram"
              target="_blank"
              rel="noopener"
              aria-label="ВКонтакте"
              class="flex h-9 w-9 items-center justify-center rounded-full border border-border text-[#0077ff] transition hover:border-brand"
            >
              <svg viewBox="0 0 24 24" class="h-4 w-4" fill="currentColor" aria-hidden="true">
                <path d="M13.16 19c-5.34 0-8.39-3.66-8.51-9.75h2.67c.09 4.47 2.06 6.36 3.62 6.75V9.25h2.52v3.86c1.54-.17 3.16-1.92 3.7-3.86h2.52c-.42 2.4-2.17 4.15-3.42 4.87 1.25.59 3.24 2.12 4 4.88h-2.77c-.6-1.85-2.08-3.28-4.03-3.47V19z" />
              </svg>
            </a>
          </div>
        </div>
      </footer>
    </div>

    <!-- Глобальные оверлеи: подтверждения и уведомления -->
    <ConfirmDialog />
    <ToastHost />
  </div>
</template>
