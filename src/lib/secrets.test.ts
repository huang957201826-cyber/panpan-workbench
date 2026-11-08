import { beforeEach, describe, expect, it, vi } from 'vitest'

const invoke = vi.hoisted(() => vi.fn())

vi.mock('@tauri-apps/api/core', () => ({ invoke }))

import { decryptPersistedSettings, encryptPersistedSettings, migratePersistedSettingsSecrets, transformPersistedApiKeys } from './secrets'

describe('persisted api key transform', () => {
  beforeEach(() => {
    invoke.mockReset().mockImplementation(async (cmd: string, args: { value: string }) => (
      cmd === 'secret_encrypt' ? `dpapi:v1:enc(${args.value})` : args.value.replace(/^dpapi:v1:enc\((.*)\)$/, '$1')
    ))
  })

  it('transforms every nested apiKey only', async () => {
    const input = {
      state: {
        settings: {
          apiKey: 'top',
          profiles: [{ id: 'a', apiKey: 'one' }, { id: 'b', apiKey: '' }],
        },
        other: { apiKey: 'nested', value: 1 },
      },
    }
    const output = await transformPersistedApiKeys(input, async (value) => `enc(${value})`)
    expect(output).toEqual({
      state: {
        settings: {
          apiKey: 'enc(top)',
          profiles: [{ id: 'a', apiKey: 'enc(one)' }, { id: 'b', apiKey: '' }],
        },
        other: { apiKey: 'enc(nested)', value: 1 },
      },
    })
  })

  it('migrates plaintext to DPAPI and leaves existing ciphertext unchanged', async () => {
    const plain = JSON.stringify({ state: { settings: { profiles: [{ apiKey: 'sk-old' }] } } })
    const migrated = await migratePersistedSettingsSecrets(plain)
    expect(migrated).toContain('dpapi:v1:enc(sk-old)')
    expect(migrated).not.toContain('"sk-old"')

    const encrypted = JSON.stringify({ state: { settings: { profiles: [{ apiKey: 'dpapi:v1:enc(sk-old)' }] } } })
    expect(await migratePersistedSettingsSecrets(encrypted)).toBeNull()
  })

  it('encrypts on write and decrypts on load', async () => {
    const plain = JSON.stringify({ state: { settings: { profiles: [{ apiKey: 'sk-new' }] } } })
    const encrypted = await encryptPersistedSettings(plain)
    expect(encrypted).toContain('dpapi:v1:enc(sk-new)')
    expect(await decryptPersistedSettings(encrypted)).toBe(plain)
  })
})
