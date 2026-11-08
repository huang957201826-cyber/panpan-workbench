import { checkResult, type UpdateInfo } from './appUpdate'

export type UpdateInvoke = (command: string, args?: Record<string, unknown>) => Promise<unknown>

/** 统一检查入口，便于测试时替换 invoke */
export async function performUpdateCheck(invoke: UpdateInvoke) {
  const result = (await invoke('update_check')) as UpdateInfo | null
  return checkResult(result)
}

export async function performUpdateDownload(invoke: UpdateInvoke, version: string, onProgress: unknown) {
  await invoke('update_download', { version, onProgress })
}

export async function performUpdateInstall(invoke: UpdateInvoke) {
  await invoke('update_install')
}
