<template>
  <n-config-provider
    :theme="isDark ? darkTheme : undefined"
    :locale="zhCN"
    :date-locale="dateZhCN"
    style="height: 100%"
  >
    <n-dialog-provider>
      <n-message-provider>
        <MarbleBackground />
        <div class="shell">
          <aside class="side panel">
            <div class="brand">
              <span class="brand-mark">石</span>
              <span class="brand-name">石纪 · 世界观创作台</span>
            </div>
            <nav>
              <RouterLink
                v-for="r in navRoutes"
                :key="r.name"
                :to="r.path"
                class="nav-item"
                active-class="active"
              >
                <component
                  :is="iconComp(r.meta?.icon)"
                  :size="17"
                  :stroke-width="2"
                />
                <span>{{ r.meta?.title }}</span>
              </RouterLink>
            </nav>
            <div class="side-foot">
              <button
                class="foot-btn"
                title="完整性巡检（失效引用 / 孤儿资产）"
                @click="showIntegrity = true"
              >
                <ShieldCheck :size="14" /> 巡检
              </button>
              <button
                class="foot-btn"
                title="快捷键帮助（?）"
                @click="showHelp = true"
              >
                <Keyboard :size="14" /> 快捷键
              </button>
              <ThemeToggle />
            </div>
          </aside>
          <main class="main">
            <RouterView />
          </main>
        </div>
        <IntegrityDrawer v-model:show="showIntegrity" />
        <n-modal
          v-model:show="showHelp"
          preset="dialog"
          title="快捷键"
        >
          <div class="help-list">
            <div
              v-for="s in SHORTCUT_HELP"
              :key="s.keys"
              class="help-row"
            >
              <code>{{ s.keys }}</code><span>{{ s.desc }}</span>
            </div>
          </div>
        </n-modal>
      </n-message-provider>
    </n-dialog-provider>
  </n-config-provider>
</template>

<script setup lang="ts">
import { computed, ref, onMounted, type Component } from 'vue'
import { RouterLink, RouterView, useRouter } from 'vue-router'
import { darkTheme, zhCN, dateZhCN, NModal, NConfigProvider, NDialogProvider, NMessageProvider } from 'naive-ui'
import { ShieldCheck, Keyboard } from 'lucide-vue-next'
import * as icons from 'lucide-vue-next'
import { useThemeStore } from '@/stores/theme'
import { reopenLastProject } from '@/stores/project'
import ThemeToggle from '@/components/ThemeToggle.vue'
import MarbleBackground from '@/components/MarbleBackground.vue'
import IntegrityDrawer from '@/components/IntegrityDrawer.vue'
import { useShortcuts, SHORTCUT_HELP } from '@/composables/useShortcuts'

const theme = useThemeStore()
const isDark = computed(() => theme.isDark)
const showIntegrity = ref(false)
const showHelp = ref(false)
useShortcuts(() => { showHelp.value = true })
// G4：启动时自动重开上次项目，刷新后各页面直接可用
onMounted(() => { void reopenLastProject() })
const router = useRouter()
const navRoutes = router.getRoutes()
  .filter((r) => r.meta?.title && r.path !== '/')
  .sort((a, b) => (a.meta?.order ?? 99) - (b.meta?.order ?? 99))
const home = router.getRoutes().find((r) => r.path === '/')
if (home) navRoutes.unshift(home)

function iconComp(name?: string): Component {
  return (icons as unknown as Record<string, Component>)[name ?? ''] ?? icons.Circle
}
</script>

<style scoped>
.shell { position: relative; z-index: 1; display: flex; height: 100%; }
.side {
  width: 208px;
  flex-shrink: 0;
  margin: var(--space-2);
  padding: var(--space-2) var(--space-1);
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
}
.brand { display: flex; align-items: center; gap: 10px; padding: 4px 10px 12px; }
.brand-mark {
  width: 30px; height: 30px; border-radius: var(--radius-m);
  background: var(--accent-weak); color: var(--accent-text);
  display: grid; place-items: center; font-family: var(--font-serif); font-size: 17px;
}
.brand-name { font-size: 14px; font-weight: 600; color: var(--text-2); }
nav { display: flex; flex-direction: column; gap: 2px; flex: 1; }
.nav-item {
  display: flex; align-items: center; gap: 10px;
  padding: 9px 12px; border-radius: var(--radius-m);
  color: var(--text-2); text-decoration: none; font-size: 14px;
  transition: background 0.15s ease-out, color 0.15s ease-out;
}
.nav-item:hover { background: var(--surface-2); color: var(--text-1); }
.nav-item.active { background: var(--accent-weak); color: var(--accent-text); }
.side-foot { padding: 8px 10px; display: flex; justify-content: flex-end; align-items: center; gap: 6px; }
.foot-btn {
  display: inline-flex; align-items: center; gap: 5px;
  border: 1px solid var(--border); background: var(--surface-2); color: var(--text-3);
  border-radius: var(--radius-m); padding: 5px 9px; font-size: 12px; cursor: pointer;
  transition: color 0.15s ease-out;
}
.foot-btn:hover { color: var(--accent-text); border-color: var(--accent); }
.help-list { display: flex; flex-direction: column; gap: 8px; }
.help-row { display: flex; gap: 12px; align-items: center; font-size: 13px; }
.help-row code { background: var(--surface-2); border-radius: 5px; padding: 2px 8px; font-size: 12px; }
.help-row span { color: var(--text-2); }
.main { flex: 1; min-width: 0; padding: var(--space-2) var(--space-2) var(--space-2) 0; }
</style>
