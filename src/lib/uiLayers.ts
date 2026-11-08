/** 弹窗打开时禁止画布响应 Delete/Ctrl+A 等全局快捷键。 */
export function isUiModalOpen() {
  if (typeof document === 'undefined') return false
  return document.documentElement.dataset.uiModalOpen === '1' || document.body.style.overflow === 'hidden'
}
