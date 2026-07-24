<script setup lang="ts">
// Карточка-подсказка для памятки настроек: иконка, заголовок, примечание и список пунктов.
defineProps<{
  card: { icon: string; title: string; note?: string; items: string[] }
}>()
</script>

<template>
  <div class="card p-4">
    <div class="mb-2 flex items-center gap-2">
      <span class="text-xl">{{ card.icon }}</span>
      <h3 class="font-bold text-white">{{ card.title }}</h3>
    </div>
    <p v-if="card.note" class="mb-3 text-xs text-slate-500">{{ card.note }}</p>
    <ul class="space-y-1.5">
      <li v-for="(item, i) in card.items" :key="i" class="flex gap-2 text-sm text-slate-300">
        <span class="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-brand/70" />
        <span>{{ item }}</span>
      </li>
    </ul>
  </div>
</template>
