<template>
  <div class="asset-image">
    <img
      v-if="url"
      :src="url"
      :alt="meta?.name ?? '图片'"
    >
    <div
      v-else
      class="placeholder"
    >
      <ImageOff :size="18" />{{ meta ? '图片加载失败' : '失效引用' }}
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, watch, onUnmounted } from 'vue'
import { ImageOff } from 'lucide-vue-next'
import { useProjectStore } from '@/stores/project'
import type { AssetMeta } from '@/types'

const props = defineProps<{ assetId: string }>()
const store = useProjectStore()
const url = ref<string | null>(null)
const meta = ref<AssetMeta | null>(null)

watch(() => props.assetId, async (id) => {
  meta.value = store.assets.find((a) => a.id === id) ?? null
  url.value = await store.assetUrl(id)
}, { immediate: true })

onUnmounted(() => { url.value = null })
</script>

<style scoped>
.asset-image img { max-width: 100%; border-radius: var(--radius-m); display: block; }
.placeholder {
  display: flex; align-items: center; gap: 8px;
  padding: var(--space-2); border: 1px dashed var(--border);
  border-radius: var(--radius-m); color: var(--text-3); font-size: 13px;
}
</style>
