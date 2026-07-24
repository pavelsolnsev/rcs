<script setup lang="ts">
// Компактное поле с коротким значением (код прицела, параметры запуска) и кнопкой копирования.
const props = defineProps<{ text: string }>()
const { copied, copy } = useCopy()
</script>

<template>
  <div class="flex items-center gap-2 rounded-lg border border-border bg-bg px-3 py-2">
    <code class="min-w-0 flex-1 truncate font-mono text-sm text-slate-200">{{ props.text }}</code>
    <button
      type="button"
      class="shrink-0 cursor-pointer rounded-md px-2.5 py-1 text-xs font-semibold transition"
      :class="copied ? 'bg-brand/20 text-brand' : 'border border-brand/50 bg-brand/10 text-brand hover:bg-brand/20'"
      @click="copy(props.text)"
    >
      {{ copied ? '✓ Скопировано' : '⧉ Копировать' }}
    </button>
  </div>
</template>
