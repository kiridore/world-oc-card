// 全局快捷键（M7-F3）：Ctrl+S 保存、Ctrl+Shift+T 切换时间轴↔画布、Ctrl+Alt+C 新建角色、Ctrl+Alt+E 新建事件、? 帮助
import { onMounted, onUnmounted } from 'vue'
import { useRouter } from 'vue-router'
import { useProjectStore } from '@/stores/project'

export function useShortcuts(openHelp: () => void): void {
  const router = useRouter()
  const store = useProjectStore()

  function onKey(ev: KeyboardEvent): void {
    const mod = ev.ctrlKey || ev.metaKey
    if (mod && ev.key.toLowerCase() === 's') {
      ev.preventDefault()
      if (store.current) {
        void store.flush()
        window.dispatchEvent(new CustomEvent('woc:saved'))
      }
      return
    }
    if (mod && ev.shiftKey && ev.key.toLowerCase() === 't') {
      ev.preventDefault()
      router.push('/timeline')
      return
    }
    if (mod && ev.altKey && ev.key.toLowerCase() === 'c') {
      ev.preventDefault()
      router.push('/characters')
      window.dispatchEvent(new CustomEvent('woc:new-character'))
      return
    }
    if (mod && ev.altKey && ev.key.toLowerCase() === 'e') {
      ev.preventDefault()
      router.push('/timeline')
      window.dispatchEvent(new CustomEvent('woc:new-event'))
      return
    }
    if (ev.key === '?' && !mod && document.activeElement?.tagName !== 'INPUT' && document.activeElement?.tagName !== 'TEXTAREA') {
      openHelp()
    }
  }

  onMounted(() => window.addEventListener('keydown', onKey))
  onUnmounted(() => window.removeEventListener('keydown', onKey))
}

export const SHORTCUT_HELP: { keys: string; desc: string }[] = [
  { keys: 'Ctrl + S', desc: '立即保存（手动 flush 防抖队列）' },
  { keys: 'Ctrl + Shift + T', desc: '前往时间轴' },
  { keys: 'Ctrl + Alt + C', desc: '新建角色' },
  { keys: 'Ctrl + Alt + E', desc: '新建事件' },
  { keys: '?', desc: '显示本帮助' },
]
