<script setup lang="ts">
type Option = { value: string | number; label: string }

const props = withDefaults(
  defineProps<{
    options: Array<Option | string>
    placeholder?: string
  }>(),
  { placeholder: 'Выберите…' },
)

const model = defineModel<string | number | null>()

const normalized = computed<Option[]>(() =>
  props.options.map((o) => (typeof o === 'string' ? { value: o, label: o } : o)),
)
const selectedLabel = computed(
  () => normalized.value.find((o) => o.value === model.value)?.label ?? '',
)

const open = ref(false)
const root = ref<HTMLElement | null>(null)
const trigger = ref<HTMLElement | null>(null)
const menu = ref<HTMLElement | null>(null)

// Список телепортируется в body и позиционируется fixed по координатам кнопки —
// так его не обрезают родители с overflow (карточка матча, скролл сетки и т.п.).
const pos = reactive({ top: 0, left: 0, width: 0 })
const MENU_MAX_H = 256 // max-h-64
const GAP = 6

function updatePosition() {
  const el = trigger.value
  if (!el) return
  const r = el.getBoundingClientRect()
  const measured = menu.value?.offsetHeight
  const estH = measured || Math.min(MENU_MAX_H, normalized.value.length * 40 + 12)
  const spaceBelow = window.innerHeight - r.bottom - GAP
  // Если снизу не помещается, а сверху места больше — открываем вверх.
  const openUp = spaceBelow < estH && r.top - GAP > spaceBelow
  pos.width = r.width
  pos.left = r.left
  pos.top = openUp ? Math.max(GAP, r.top - GAP - estH) : r.bottom + GAP
}

async function toggle() {
  open.value = !open.value
  if (!open.value) return
  updatePosition()
  await nextTick()
  updatePosition() // уточняем по реальной высоте после рендера
}
function choose(value: string | number) {
  model.value = value
  open.value = false
}

function onDocClick(e: MouseEvent) {
  const t = e.target as Node
  if (root.value?.contains(t) || menu.value?.contains(t)) return
  open.value = false
}
function onKey(e: KeyboardEvent) {
  if (e.key === 'Escape') open.value = false
}
function onReflow() {
  if (open.value) updatePosition()
}

onMounted(() => {
  document.addEventListener('click', onDocClick)
  document.addEventListener('keydown', onKey)
  window.addEventListener('resize', onReflow)
  // capture — ловим скролл любого прокручиваемого родителя, не только окна
  window.addEventListener('scroll', onReflow, true)
})
onBeforeUnmount(() => {
  document.removeEventListener('click', onDocClick)
  document.removeEventListener('keydown', onKey)
  window.removeEventListener('resize', onReflow)
  window.removeEventListener('scroll', onReflow, true)
})
</script>

<template>
  <div ref="root" class="relative">
    <!-- Кнопка -->
    <button
      ref="trigger"
      type="button"
      :aria-expanded="open"
      class="flex w-full items-center justify-between gap-2 rounded-lg border bg-bg px-3 py-2.5 text-left outline-none transition-colors"
      :class="open ? 'border-brand' : 'border-border hover:border-slate-500'"
      @click="toggle"
    >
      <span class="truncate" :class="selectedLabel ? 'text-white' : 'text-slate-500'">
        {{ selectedLabel || placeholder }}
      </span>
      <svg
        width="18"
        height="18"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        stroke-width="2"
        stroke-linecap="round"
        stroke-linejoin="round"
        class="shrink-0 text-slate-400 transition-transform duration-200"
        :class="open ? 'rotate-180' : ''"
      >
        <path d="M6 9l6 6 6-6" />
      </svg>
    </button>

    <!-- Список: в body, поверх всего, не обрезается родителями -->
    <Teleport to="body">
      <Transition
        enter-active-class="transition duration-150 ease-out"
        enter-from-class="opacity-0"
        leave-active-class="transition duration-100 ease-in"
        leave-to-class="opacity-0"
      >
        <ul
          v-if="open"
          ref="menu"
          role="listbox"
          class="bracket-scroll fixed z-[100] max-h-64 overflow-auto rounded-xl border border-border bg-surface-2 p-1.5 shadow-2xl shadow-black/60"
          :style="{ top: pos.top + 'px', left: pos.left + 'px', width: pos.width + 'px' }"
        >
          <li
            v-for="opt in normalized"
            :key="opt.value"
            role="option"
            :aria-selected="opt.value === model"
            class="flex cursor-pointer items-center justify-between gap-2 rounded-lg px-3 py-2.5 text-sm transition-colors"
            :class="
              opt.value === model
                ? 'bg-brand/15 text-brand'
                : 'text-slate-300 hover:bg-white/5 hover:text-white'
            "
            @click="choose(opt.value)"
          >
            <span class="truncate">{{ opt.label }}</span>
            <svg
              v-if="opt.value === model"
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2.5"
              stroke-linecap="round"
              stroke-linejoin="round"
              class="shrink-0"
            >
              <path d="M20 6L9 17l-5-5" />
            </svg>
          </li>
        </ul>
      </Transition>
    </Teleport>
  </div>
</template>
