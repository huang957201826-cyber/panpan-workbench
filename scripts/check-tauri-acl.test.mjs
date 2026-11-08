import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { checkTauriAcl, collectHandlerCommands, collectPermissionFiles } from './check-tauri-acl.mjs'

describe('Tauri ACL', () => {
  it('all invoke_handler commands have a permission and every permission set is in default capability', () => {
    const root = process.cwd()
    const result = checkTauriAcl({
      libSource: readFileSync(join(root, 'src-tauri/src/lib.rs'), 'utf8'),
      permissionFiles: collectPermissionFiles(join(root, 'src-tauri/permissions')),
      capability: JSON.parse(readFileSync(join(root, 'src-tauri/capabilities/default.json'), 'utf8')),
    })
    expect(result.handlerCommands).toContain('secret_encrypt')
    expect(result.handlerCommands).toContain('storage_secure_cleanup')
    expect(result.handlerCommands).toContain('backup_read')
    expect(result.missing).toEqual([])
    expect(result.capabilityMissing).toEqual([])
  })

  it('detects a registered command without permission', () => {
    const result = checkTauriAcl({
      libSource: 'invoke_handler(generate_handler![demo::new_command, secret::secret_encrypt])',
      permissionFiles: [{ name: 'secret.toml', identifier: 'secret', commands: ['secret_encrypt'] }],
      capability: { permissions: ['secret'] },
    })
    expect(result.missing).toEqual(['new_command'])
  })

  it('parses handler command names', () => {
    expect(collectHandlerCommands('generate_handler![a::b::one, c::two]')).toEqual(['one', 'two'])
  })
})
