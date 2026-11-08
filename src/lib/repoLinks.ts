/**
 * 公开仓地址的前端唯一真源。
 * 仓库已公开并可匿名访问，所以 REPO_READY 保持 true：检查更新、反馈、使用说明、
 * 开源许可等入口不再用「仓库上线后可用」占位文案禁用。
 *
 * 改地址时仍需同步：src-tauri/tauri.conf.json 的 updater.endpoints、
 * scripts/make-update-manifest.mjs 的下载 URL、README.md / SECURITY.md 中的链接。
 */
export const REPO_URL = 'https://github.com/huang957201826-cyber/panpan-workbench'
export const REPO_ISSUES_URL = `${REPO_URL}/issues/new`
export const REPO_SECURITY_URL = `${REPO_URL}/security/advisories/new`
export const REPO_README_URL = `${REPO_URL}#readme`
export const REPO_LICENSE_URL = `${REPO_URL}/blob/main/LICENSE`
export const REPO_READY = true
