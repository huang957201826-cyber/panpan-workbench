import type { StateStorage } from 'zustand/middleware'
import { encryptPersistedSettings } from './secrets'
import { tauriStorage } from './tauriStorage'

export { ENCRYPTED_SECRET_PREFIX, decryptPersistedSettings, encryptPersistedSettings, isEncryptedSecret, migratePersistedSettingsSecrets, transformPersistedApiKeys } from './secrets'

export const SETTINGS_STORAGE_KEY = 'gpt-image-playground'

/** Tauri 设置存储：内存里保持明文，写入 kv 前统一加密 apiKey。 */
export const encryptedTauriStorage: StateStorage = {
  getItem: (name) => tauriStorage.getItem(name),
  setItem: async (name, value) => {
    tauriStorage.setItem(name, name === SETTINGS_STORAGE_KEY ? await encryptPersistedSettings(value) : value)
  },
  removeItem: (name) => tauriStorage.removeItem(name),
}
