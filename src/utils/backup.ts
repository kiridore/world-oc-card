// v2.4-F2 备份提醒：纯函数判断 + localStorage 戳（UI 态，不入 dexie/zip——提醒不是项目数据）
const DAY_MS = 86_400_000
const STAMP_PREFIX = 'woc-backup-stamp:'
const THRESHOLD_KEY = 'woc-backup-threshold-days'

export const DEFAULT_BACKUP_DAYS = 7

export function backupDue(lastExportIso: string | null, nowIso: string, thresholdDays: number): boolean {
  if (!lastExportIso || thresholdDays <= 0) return true
  const elapsed = Date.parse(nowIso) - Date.parse(lastExportIso)
  if (!Number.isFinite(elapsed)) return true // 戳损坏，宁误报
  return elapsed >= thresholdDays * DAY_MS
}

export function loadStamp(projectId: string): string | null {
  try { return localStorage.getItem(STAMP_PREFIX + projectId) } catch { return null }
}
export function saveStamp(projectId: string, iso = new Date().toISOString()): void {
  try { localStorage.setItem(STAMP_PREFIX + projectId, iso) } catch { /* 隐私模式忽略 */ }
}
export function loadThresholdDays(): number {
  try {
    const n = Number(localStorage.getItem(THRESHOLD_KEY))
    return Number.isInteger(n) && n >= 1 && n <= 365 ? n : DEFAULT_BACKUP_DAYS
  } catch { return DEFAULT_BACKUP_DAYS }
}
export function saveThresholdDays(n: number): void {
  try { localStorage.setItem(THRESHOLD_KEY, String(Math.min(365, Math.max(1, Math.round(n))))) } catch { /* ignore */ }
}
