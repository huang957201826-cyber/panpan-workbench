import { invoke } from '@tauri-apps/api/core'

export const ENCRYPTED_SECRET_PREFIX = 'dpapi:v1:'

export function isEncryptedSecret(value: string) {
  return value.startsWith(ENCRYPTED_SECRET_PREFIX)
}

async function encryptSecret(value: string) {
  return await invoke<string>('secret_encrypt', { value })
}

async function decryptSecret(value: string) {
  return await invoke<string>('secret_decrypt', { value })
}

/** 遍历持久化 JSON 中的 apiKey 字段；用于落盘前加密、启动时解密和旧明文迁移。 */
export async function transformPersistedApiKeys(
  value: unknown,
  transform: (secret: string) => string | Promise<string>,
): Promise<unknown> {
  if (Array.isArray(value)) {
    return await Promise.all(value.map((item) => transformPersistedApiKeys(item, transform)))
  }
  if (!value || typeof value !== 'object') return value
  const result: Record<string, unknown> = {}
  for (const [key, item] of Object.entries(value as Record<string, unknown>)) {
    if (key === 'apiKey' && typeof item === 'string' && item) {
      result[key] = await transform(item)
    } else {
      result[key] = await transformPersistedApiKeys(item, transform)
    }
  }
  return result
}

export async function encryptPersistedSettings(json: string) {
  const parsed = JSON.parse(json) as unknown
  const transformed = await transformPersistedApiKeys(parsed, async (value) => (
    isEncryptedSecret(value) ? value : await encryptSecret(value)
  ))
  return JSON.stringify(transformed)
}

export async function decryptPersistedSettings(json: string) {
  const parsed = JSON.parse(json) as unknown
  const transformed = await transformPersistedApiKeys(parsed, async (value) => {
    if (!isEncryptedSecret(value)) return value
    try {
      return await decryptSecret(value)
    } catch (err) {
      console.error('解密 API Key 失败，保留密文：', err)
      return value
    }
  })
  return JSON.stringify(transformed)
}

export async function migratePersistedSettingsSecrets(json: string) {
  const parsed = JSON.parse(json) as unknown
  let changed = false
  const transformed = await transformPersistedApiKeys(parsed, async (value) => {
    if (isEncryptedSecret(value)) return value
    changed = true
    return await encryptSecret(value)
  })
  return changed ? JSON.stringify(transformed) : null
}
