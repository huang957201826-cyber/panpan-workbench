#!/usr/bin/env node
import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'

/** 从 lib.rs 的 generate_handler! 提取实际注册的命令名。 */
export function collectHandlerCommands(libSource) {
  const match = libSource.match(/generate_handler!\s*\[([\s\S]*?)\]/)
  if (!match) return []
  return match[1]
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean)
    .map((item) => item.split('::').at(-1))
}

/** 从 permissions/*.toml 提取 identifier 与 commands.allow。 */
export function collectPermissionFiles(dir) {
  return readdirSync(dir)
    .filter((name) => name.endsWith('.toml'))
    .map((name) => {
      const text = readFileSync(join(dir, name), 'utf8')
      const identifier = text.match(/identifier\s*=\s*"([^"]+)"/)?.[1] ?? ''
      const allowBlock = text.match(/commands\.allow\s*=\s*\[([\s\S]*?)\]/)?.[1] ?? ''
      const commands = [...allowBlock.matchAll(/"([^"]+)"/g)].map((item) => item[1])
      return { name, identifier, commands }
    })
}

export function checkTauriAcl({ libSource, permissionFiles, capability }) {
  const handlerCommands = collectHandlerCommands(libSource)
  const allowed = new Set(permissionFiles.flatMap((file) => file.commands))
  const missing = handlerCommands.filter((command) => !allowed.has(command))
  const identifiers = permissionFiles.map((file) => file.identifier).filter(Boolean)
  const capabilityPermissions = new Set(
    (capability.permissions ?? []).filter((item) => typeof item === 'string'),
  )
  const capabilityMissing = identifiers.filter((identifier) => !capabilityPermissions.has(identifier))
  return { handlerCommands, missing, identifiers, capabilityMissing }
}

if (process.argv[1]?.replace(/\\/g, '/').endsWith('/check-tauri-acl.mjs')) {
  const root = process.cwd()
  const result = checkTauriAcl({
    libSource: readFileSync(join(root, 'src-tauri/src/lib.rs'), 'utf8'),
    permissionFiles: collectPermissionFiles(join(root, 'src-tauri/permissions')),
    capability: JSON.parse(readFileSync(join(root, 'src-tauri/capabilities/default.json'), 'utf8')),
  })
  const errors = [
    ...result.missing.map((command) => `命令缺少权限：${command}`),
    ...result.capabilityMissing.map((identifier) => `capability 缺少权限集：${identifier}`),
  ]
  if (errors.length) {
    console.error(errors.join('\n'))
    process.exit(1)
  }
  console.log(`Tauri ACL 检查通过：${result.handlerCommands.length} 个命令，${result.identifiers.length} 个权限集`)
}
