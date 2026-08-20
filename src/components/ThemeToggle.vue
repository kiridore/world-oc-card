<template>
  <button
    class="theme-toggle"
    :title="isDark ? '切换到亮色主题' : '切换到暗色主题'"
    @click="toggle"
  >
    <Sun
      v-if="isDark"
      :size="16"
      :stroke-width="2"
    />
    <Moon
      v-else
      :size="16"
      :stroke-width="2"
    />
  </button>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { Sun, Moon } from 'lucide-vue-next'
import { useThemeStore } from '@/stores/theme'

const theme = useThemeStore()
const isDark = computed(() => theme.isDark)
const toggle = () => theme.toggle()
</script>

<style scoped>
.theme-toggle {
  border: 1px solid var(--border);
  background: var(--surface-2);
  color: var(--text-2);
  border-radius: var(--radius-m);
  width: 32px; height: 32px;
  display: grid; place-items: center;
  cursor: pointer;
  transition: color 0.15s ease-out, border-color 0.15s ease-out, transform 0.12s ease-out;
}
.theme-toggle:hover { color: var(--accent-text); border-color: var(--accent); }
.theme-toggle:active { transform: scale(0.92); }
.theme-toggle svg { transition: transform 0.25s ease-out; }
.theme-toggle:hover svg { transform: rotate(-18deg); }
</style>
