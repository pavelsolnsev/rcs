<script setup lang="ts">
// Название турнира с возможностью переименовать (для админа)
const props = defineProps<{
  tournamentId: number
  name: string
  editable?: boolean
}>()

const emit = defineEmits<{ renamed: [] }>()
const { error } = useToast()

const editing = ref(false)
const draft = ref('')
const saving = ref(false)
const input = ref<HTMLInputElement | null>(null)

async function start() {
  draft.value = props.name
  editing.value = true
  await nextTick()
  input.value?.select()
}

async function save() {
  const name = draft.value.trim()
  if (!name || name === props.name) {
    editing.value = false
    return
  }
  saving.value = true
  try {
    await $fetch(`/api/tournaments/${props.tournamentId}`, { method: 'PATCH', body: { name } })
    editing.value = false
    emit('renamed')
  } catch (e: any) {
    error(e?.data?.statusMessage || 'Не удалось переименовать турнир')
  } finally {
    saving.value = false
  }
}
</script>

<template>
  <form v-if="editing" class="flex w-full flex-wrap items-center gap-2" @submit.prevent="save">
    <input
      ref="input"
      v-model="draft"
      maxlength="200"
      aria-label="Название турнира"
      class="min-w-0 flex-1 rounded-lg border border-border bg-bg px-3 py-1.5 text-xl font-extrabold outline-none focus:border-brand"
      @keydown.esc.prevent="editing = false"
    />
    <button
      type="submit"
      :disabled="saving || !draft.trim()"
      class="cursor-pointer rounded-lg bg-brand px-3 py-2 text-sm font-semibold text-white hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
    >
      Сохранить
    </button>
    <button
      type="button"
      class="cursor-pointer rounded-lg border border-border px-3 py-2 text-sm text-slate-400 hover:text-white"
      @click="editing = false"
    >
      Отмена
    </button>
  </form>

  <div v-else class="flex min-w-0 items-center gap-1.5">
    <h1 class="text-2xl font-extrabold">{{ name }}</h1>
    <button
      v-if="editable"
      type="button"
      class="flex h-8 w-8 shrink-0 cursor-pointer items-center justify-center rounded-lg text-slate-400 transition hover:bg-surface-2 hover:text-white"
      aria-label="Переименовать турнир"
      title="Переименовать"
      @click="start"
    >
      ✎
    </button>
  </div>
</template>
