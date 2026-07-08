<script setup lang="ts">
/**
 * Логотип сайта. Пытается загрузить /logo.webp (положи свой файл в public/).
 * Пока файла нет — показывает встроенный SVG-плейсхолдер.
 */
withDefaults(defineProps<{ size?: number }>(), { size: 36 })
const failed = ref(false)
// Бинд через :src, чтобы Vite не переписывал путь к public-ассету.
const logoSrc = '/logo.webp'
</script>

<template>
  <span class="inline-flex items-center gap-2">
    <img
      v-if="!failed"
      :src="logoSrc"
      alt="Логотип"
      :width="size"
      :height="size"
      class="rounded-full object-cover"
      :style="{ width: size + 'px', height: size + 'px' }"
      @error="failed = true"
    />
    <svg
      v-else
      :width="size"
      :height="size"
      viewBox="0 0 48 48"
      fill="none"
      class="rounded-full"
    >
      <rect width="48" height="48" rx="12" fill="#12141c" />
      <path
        d="M24 8l14 8v16l-14 8-14-8V16l14-8z"
        stroke="#ff5a1f"
        stroke-width="2.5"
        fill="#191c27"
      />
      <circle cx="24" cy="24" r="4.5" fill="#ff5a1f" />
      <path d="M24 24l9-5M24 24l-9-5M24 24v10" stroke="#ffb020" stroke-width="2" />
    </svg>
  </span>
</template>
