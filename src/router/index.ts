import { createRouter, createWebHashHistory } from 'vue-router'

declare module 'vue-router' {
  interface RouteMeta { title?: string; icon?: string }
}

// hash 路由：任意静态服务器（含子路径部署）刷新非首页均不 404（M7-E1）
export const router = createRouter({
  history: createWebHashHistory(),
  routes: [
    { path: '/', name: 'home', component: () => import('@/views/HomeView.vue'), meta: { title: '项目', icon: 'FolderOpen' } },
    { path: '/characters', name: 'characters', component: () => import('@/views/CharactersView.vue'), meta: { title: '角色', icon: 'Users' } },
    { path: '/codex', name: 'codex', component: () => import('@/views/CodexView.vue'), meta: { title: '百科', icon: 'BookOpen' } },
    { path: '/timeline', name: 'timeline', component: () => import('@/views/TimelineView.vue'), meta: { title: '时间轴', icon: 'GitBranch' } },
    { path: '/timeline/canvas', name: 'canvas', component: () => import('@/views/CanvasView.vue'), meta: { title: '画布', icon: 'Network' } },
    { path: '/graph', name: 'graph', component: () => import('@/views/GraphView.vue'), meta: { title: '图谱', icon: 'Share2' } },
    { path: '/export', name: 'export', component: () => import('@/views/ExportView.vue'), meta: { title: '导出', icon: 'Download' } },
  ],
})
