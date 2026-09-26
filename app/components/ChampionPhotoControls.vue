<script setup lang="ts">
// Админ-управление фото чемпиона: загрузка с устройства / по ссылке, замена, удаление
const props = defineProps<{ tournamentId: number; hasPhoto: boolean }>()
const emit = defineEmits<{ changed: [] }>()

const { error } = useToast()
const { confirm } = useConfirm()
const adding = ref(false)
const busy = ref(false)
const base = computed(() => `/api/tournaments/${props.tournamentId}/champion-photo`)

async function run(action: () => Promise<unknown>, fail: string) {
  busy.value = true
  try {
    await action()
    adding.value = false
    emit('changed')
  } catch (e: any) {
    error(e?.data?.statusMessage || fail)
  } finally {
    busy.value = false
  }
}

function onLink(p: { url: string; caption: string }) {
  run(() => $fetch(base.value, { method: 'POST', body: { url: p.url, caption: p.caption } }), 'Не удалось добавить фото')
}
function onUpload(p: { file: File; caption: string }) {
  const fd = new FormData()
  fd.append('file', p.file, p.file.name)
  if (p.caption) fd.append('caption', p.caption)
  run(() => $fetch(`${base.value}/upload`, { method: 'POST', body: fd }), 'Не удалось загрузить фото')
}
async function onRemove() {
  const ok = await confirm({
    title: 'Удалить фото чемпиона?',
    message: 'Фото пропадёт с карточки чемпиона.',
    confirmText: 'Удалить',
    tone: 'danger',
  })
  if (ok) run(() => $fetch(base.value, { method: 'DELETE' }), 'Не удалось удалить фото')
}
</script>

<template>
  <div class="space-y-3">
    <MediaAddForm
      v-if="adding"
      photo-only
      :title="hasPhoto ? 'Заменить фото чемпиона' : 'Фото чемпиона'"
      :busy="busy"
      @submit="onLink"
      @upload="onUpload"
      @cancel="adding = false"
    />
    <div v-else class="flex flex-wrap gap-2">
      <button
        type="button"
        class="cursor-pointer rounded-lg border border-amber-400/40 bg-amber-400/10 px-3 py-1.5 text-sm font-semibold text-amber-200 transition hover:bg-amber-400/20"
        @click="adding = true"
      >
        📷 {{ hasPhoto ? 'Заменить фото' : 'Добавить фото чемпиона' }}
      </button>
      <button
        v-if="hasPhoto"
        type="button"
        :disabled="busy"
        class="cursor-pointer rounded-lg border border-red-500/30 px-3 py-1.5 text-sm font-semibold text-red-400 transition hover:bg-red-500/10 disabled:opacity-40"
        @click="onRemove"
      >
        Удалить фото
      </button>
    </div>
  </div>
</template>
