<template>
  <div
    v-if="!store.current"
    class="page"
  >
    <n-empty description="尚未打开项目">
      <template #extra>
        <n-button
          type="primary"
          @click="router.push('/')"
        >
          去首页选择项目
        </n-button>
      </template>
    </n-empty>
  </div>
  <slot v-else />
</template>

<script setup lang="ts">
import { NEmpty, NButton } from 'naive-ui'
import { useRouter } from 'vue-router'
import { useProjectStore } from '@/stores/project'

const store = useProjectStore()
const router = useRouter()
</script>
