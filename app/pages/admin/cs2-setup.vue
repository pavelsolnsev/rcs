<script setup lang="ts">
// Личная памятка админа: настройка CS2 перед LAN. Только для авторизованных.
import cfgText from '~/assets/cs2/spas.cfg?raw'

definePageMeta({ middleware: 'admin' })
useSeoMeta({
  title: 'Настройка CS2 — памятка',
  robots: 'noindex, nofollow, noarchive, nosnippet',
  googlebot: 'noindex, nofollow',
})

interface Card { icon: string; title: string; note?: string; items: string[] }

// Мышь / DPI
const mouse: Card[] = [
  {
    icon: '🖱️',
    title: 'DPI и опрос мыши',
    note: 'Профессиональный стандарт: 400 или 800 DPI.',
    items: [
      'Выстави DPI в софте мыши (или кнопкой на ней): 400 либо 800.',
      'Polling rate (частота опроса) — 1000 Гц.',
      'eDPI = DPI × sensitivity. Ориентир: 800 × 1.1 = 880.',
    ],
  },
  {
    icon: '⚙️',
    title: 'Windows: указатель',
    note: 'Параметры → Bluetooth и устройства → Мышь → Дополнительные параметры мыши.',
    items: [
      'Вкладка «Параметры указателя»: скорость строго по центру (6/11).',
      'СНЯТЬ галку «Повысить точность установки указателя» — это акселерация.',
      'В игре: sensitivity 1.1, m_yaw / m_pitch 0.022 (уже в конфиге).',
    ],
  },
]

// Графика (система + драйвер + игра)
const graphics: Card[] = [
  {
    icon: '🪟',
    title: 'Windows',
    note: 'Параметры → Система → Дисплей.',
    items: [
      'Дисплей → Графика → добавить cs2.exe → «Высокая производительность».',
      'Расширенные параметры дисплея → выбрать максимальную частоту (Гц).',
      'Режим игры (Game Mode) — включён.',
    ],
  },
  {
    icon: '🟩',
    title: 'Панель NVIDIA',
    note: 'Управление параметрами 3D → Программные настройки → cs2.',
    items: [
      'Режим низкой задержки — «Вкл» или «Ультра».',
      'Вертикальная синхронизация — «Выкл».',
      'Предпочтительная частота обновления — «Максимальная».',
      'Ноутбук/гибрид: назначить cs2 на дискретную видеокарту.',
    ],
  },
  {
    icon: '🟥',
    title: 'Панель AMD',
    note: 'Radeon Software → Игры → CS2.',
    items: [
      'Radeon Anti-Lag — «Вкл».',
      'Radeon Chill — «Выкл».',
      'Wait for Vertical Refresh — «Off, unless application specifies».',
    ],
  },
  {
    icon: '🎮',
    title: 'В самой игре',
    note: 'Настройки → Видео.',
    items: [
      'Режим отображения — «Полноэкранный» (Fullscreen).',
      'Разрешение — родное для монитора, частота — максимальная.',
      'NVIDIA Reflex Low Latency — «Включено» или «Включено + Boost».',
    ],
  },
]
</script>

<template>
  <div class="space-y-8">
    <div>
      <NuxtLink to="/admin" class="text-sm text-slate-400 hover:text-white">← В админку</NuxtLink>
      <h1 class="mt-2 text-2xl font-extrabold">Настройка CS2 — памятка</h1>
      <p class="mt-1 text-sm text-slate-400">
        Личная шпаргалка для LAN: мышь, графика и мой конфиг. Видно только в админке.
      </p>
    </div>

    <!-- Мышь / DPI -->
    <section class="space-y-3">
      <h2 class="text-lg font-bold">🖱️ Мышь и чувствительность</h2>
      <div class="grid gap-4 md:grid-cols-2">
        <AdminTipCard v-for="c in mouse" :key="c.title" :card="c" />
      </div>
    </section>

    <!-- Графика -->
    <section class="space-y-3">
      <h2 class="text-lg font-bold">🎨 Графика: система и драйвер</h2>
      <div class="grid gap-4 md:grid-cols-2">
        <AdminTipCard v-for="c in graphics" :key="c.title" :card="c" />
      </div>
    </section>

    <!-- Конфиг -->
    <section class="space-y-3">
      <h2 class="text-lg font-bold">📄 Мой конфиг</h2>
      <div class="rounded-lg border border-border bg-surface-2/50 p-3 text-sm text-slate-300">
        Скопируй текст в файл
        <code class="rounded bg-bg px-1.5 py-0.5 text-xs text-brand">spas.cfg</code>
        и положи в
        <code class="rounded bg-bg px-1.5 py-0.5 text-xs">…\game\csgo\cfg\</code>.
        В игре открой консоль (<code class="rounded bg-bg px-1.5 py-0.5 text-xs">~</code>) и введи
        <code class="rounded bg-bg px-1.5 py-0.5 text-xs text-brand">exec spas</code>.
      </div>
      <CopyBlock :text="cfgText" filename="spas.cfg" title="spas.cfg" />
    </section>
  </div>
</template>
