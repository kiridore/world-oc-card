import { defineStore } from 'pinia'
import { ref, computed } from 'vue'

export type ThemeName = 'dark' | 'light'
const KEY = 'woc-theme'

function initial(): ThemeName {
  const el = document.documentElement.getAttribute('data-theme')
  if (el === 'dark' || el === 'light') return el
  return 'light'
}

export const useThemeStore = defineStore('theme', () => {
  const theme = ref<ThemeName>(initial())
  const isDark = computed(() => theme.value === 'dark')

  function apply() {
    document.documentElement.setAttribute('data-theme', theme.value)
  }

  function set(t: ThemeName) {
    theme.value = t
    try { localStorage.setItem(KEY, t) } catch { /* 隐私模式忽略 */ }
    apply()
  }

  function toggle() {
    set(theme.value === 'dark' ? 'light' : 'dark')
  }

  return { theme, isDark, set, toggle }
})
