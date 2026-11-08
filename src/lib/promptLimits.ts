/** 单次提交提示词上限；超出部分不进入输入框，避免接口拒绝或界面卡顿 */
export const MAX_PROMPT_LENGTH = 8000

export function clampPrompt(value: string) {
  return value.length > MAX_PROMPT_LENGTH ? value.slice(0, MAX_PROMPT_LENGTH) : value
}
