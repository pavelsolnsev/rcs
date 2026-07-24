<script setup lang="ts">
// Блок с текстом (конфиг и т.п.): копирование в буфер и скачивание файлом.
const props = defineProps<{ text: string; filename?: string; title?: string }>()

const copied = ref(false)
let timer: ReturnType<typeof setTimeout> | undefined

async function copy() {
  try {
    await navigator.clipboard.writeText(props.text)
  } catch {
    // Фолбэк для старых/небезопасных контекстов
    const ta = document.createElement('textarea')
    ta.value = props.text
    ta.style.position = 'fixed'
    ta.style.opacity = '0'
    document.body.appendChild(ta)
    ta.select()
    document.execCommand('copy')
    ta.remove()
  }
  copied.value = true
  clearTimeout(timer)
  timer = setTimeout(() => (copied.value = false), 1800)
}

function download() {
  const blob = new Blob([props.text], { type: 'text/plain;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = props.filename || 'config.cfg'
  a.click()
  URL.revokeObjectURL(url)
}

onBeforeUnmount(() => clearTimeout(timer))
</script>

<template>
  <div class="overflow-hidden rounded-xl border border-border bg-bg">
    <div class="flex items-center justify-between gap-2 border-b border-border bg-surface-2 px-3 py-2">
      <span class="min-w-0 truncate font-mono text-xs text-slate-400">
        {{ title || filename || 'config.cfg' }}
      </span>
      <div class="flex shrink-0 items-center gap-1.5">
        <button
          type="button"
          class="cursor-pointer rounded-md border border-border px-2.5 py-1 text-xs font-semibold text-slate-300 transition hover:border-brand hover:text-white"
          @click="download"
        >
          ↓ Скачать
        </button>
        <button
          type="button"
          class="cursor-pointer rounded-md px-2.5 py-1 text-xs font-semibold transition"
          :class="copied ? 'bg-brand/20 text-brand' : 'border border-brand/50 bg-brand/10 text-brand hover:bg-brand/20'"
          @click="copy"
        >
          {{ copied ? '✓ Скопировано' : '⧉ Копировать' }}
        </button>
      </div>
    </div>
    <pre class="max-h-[28rem] overflow-auto px-3 py-3 text-xs leading-relaxed text-slate-200"><code>{{ text }}</code></pre>
  </div>
</template>
