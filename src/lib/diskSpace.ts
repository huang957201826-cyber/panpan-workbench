import { invoke } from '@tauri-apps/api/core'
import { formatBytes } from './formatBytes'
import { isTauri } from './platform'

/** 生成、导出、写图前保留的最小可用空间 */
export const MIN_FREE_BYTES = 512 * 1024 * 1024

export function assertEnoughDiskSpace(free: number, required = MIN_FREE_BYTES) {
  if (free >= required) return
  throw new Error(`磁盘剩余空间不足：可用 ${formatBytes(free)}，至少需要 ${formatBytes(required)}。请清理磁盘后重试。`)
}

/** 客户端写文件前检查数据目录所在磁盘；不足时先清理 tmp/ 再复查。网页版不检查。 */
export async function ensureDiskSpace(label: string, required = MIN_FREE_BYTES) {
  if (!isTauri) return
  try {
    let free = await invoke<number>('disk_free_space')
    // 测试或旧版宿主没有该命令时不要误判为 0 空间
    if (!Number.isFinite(free)) {
      console.warn(`磁盘检查不可用（${label}），跳过预检`)
      return
    }
    if (free >= required) return
    const freed = await Promise.resolve(invoke<number>('disk_cleanup_temp')).catch(() => 0)
    free = await invoke<number>('disk_free_space')
    if (!Number.isFinite(free) || free >= required) return
    throw new Error(`磁盘剩余空间不足（${label}）：可用 ${formatBytes(free)}，至少需要 ${formatBytes(required)}。已清理临时文件 ${formatBytes(Number.isFinite(freed) ? freed : 0)}，请继续清理磁盘后重试。`)
  } catch (err) {
    if (err instanceof Error && err.message.includes('磁盘剩余空间不足')) throw err
    console.warn(`磁盘检查失败（${label}）：`, err)
  }
}
