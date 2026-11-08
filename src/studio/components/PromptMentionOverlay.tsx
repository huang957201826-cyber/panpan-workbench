import type { ReactNode } from 'react'

const MENTION = /@图\d+/g

export function renderPromptMentions(prompt: string): ReactNode[] {
  const parts: ReactNode[] = []
  let last = 0
  for (const match of prompt.matchAll(MENTION)) {
    const index = match.index ?? 0
    if (index > last) parts.push(prompt.slice(last, index))
    parts.push(
      <span key={`${index}-${match[0]}`} className="rounded-sm text-blue-600 underline decoration-blue-400/70 underline-offset-2 dark:text-blue-400">
        {match[0]}
      </span>,
    )
    last = index + match[0].length
  }
  if (last < prompt.length) parts.push(prompt.slice(last))
  if (!parts.length) parts.push('')
  return parts
}

/** 覆盖在透明 textarea 后面的蓝色 mention 层；不接收指针事件 */
export function PromptMentionOverlay({ prompt, className, scrollTop = 0 }: { prompt: string; className: string; scrollTop?: number }) {
  return (
    <div aria-hidden className={`pointer-events-none absolute inset-0 overflow-hidden ${className}`}>
      <div style={{ transform: `translateY(-${scrollTop}px)` }} className="whitespace-pre-wrap break-words">
        {renderPromptMentions(prompt)}
      </div>
    </div>
  )
}
