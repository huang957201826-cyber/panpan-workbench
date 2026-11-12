import { ArrowLeft, Github } from 'lucide-react'

interface WorkflowViewProps {
  onBack: () => void
}

const GITHUB_ISSUES = 'https://github.com/huang957201826-cyber/panpan-workbench/issues/new'

/** 工作流旧版占位页：左侧说明栏 + 居中卡片，不展示未实现的节点能力 */
export function WorkflowView({ onBack }: WorkflowViewProps) {
  return (
    <div className="flex h-full min-h-0 w-full bg-[#f3f4f8] text-slate-800 dark:bg-[#0c0e14] dark:text-slate-100">
      <aside className="flex w-[256px] shrink-0 flex-col justify-between border-r border-black/[0.04] bg-[#fbfcfd] p-4 dark:border-white/[0.05] dark:bg-[#12141c]">
        <div>
          <h2 className="text-[15px] font-bold tracking-tight text-slate-900 dark:text-white">工作流</h2>
          <p className="mt-1 text-[11px] leading-relaxed text-slate-400 dark:text-slate-500">
            该模块仍在规划中，项目已开源
          </p>
          <a
            href={GITHUB_ISSUES}
            target="_blank"
            rel="noreferrer"
            className="mt-4 inline-flex h-8 items-center gap-1.5 rounded-full bg-black/[0.04] px-3 text-[11.5px] font-medium text-slate-600 transition hover:bg-black/[0.07] hover:text-slate-900 dark:bg-white/[0.06] dark:text-slate-300 dark:hover:bg-white/[0.1] dark:hover:text-white"
          >
            <Github className="h-3.5 w-3.5" />
            到 GitHub 提建议
          </a>
        </div>
        <p className="font-mono text-[10px] text-slate-300 dark:text-slate-600">v{__APP_VERSION__}</p>
      </aside>

      <div className="relative flex min-w-0 flex-1 items-center justify-center overflow-hidden">
        <div className="pointer-events-none absolute inset-0 stitch-dot-canvas opacity-35 dark:opacity-25" />
        <div className="relative z-10 w-[420px] max-w-[calc(100%-48px)] rounded-[20px] border border-black/[0.06] bg-white px-8 py-8 text-center shadow-[0_16px_40px_-6px_rgba(15,23,42,0.08)] dark:border-white/[0.08] dark:bg-[#141620]">
          <h3 className="text-[15px] font-bold tracking-tight text-slate-900 dark:text-white">工作流</h3>
          <p className="mt-1.5 text-[11.5px] leading-relaxed text-slate-400 dark:text-slate-500">
            该模块仍在规划中，项目已开源
          </p>
          <div className="mt-6 flex items-center justify-center gap-2">
            <button
              type="button"
              onClick={onBack}
              className="flex h-9 items-center gap-1.5 rounded-full bg-black px-4 text-[11.5px] font-medium text-white transition hover:opacity-90 dark:bg-white dark:text-black"
            >
              <ArrowLeft className="h-3.5 w-3.5" />
              返回项目
            </button>
            <a
              href={GITHUB_ISSUES}
              target="_blank"
              rel="noreferrer"
              className="flex h-9 items-center gap-1.5 rounded-full border border-black/[0.1] px-4 text-[11.5px] font-medium text-slate-600 transition hover:bg-black/[0.04] hover:text-slate-900 dark:border-white/[0.12] dark:text-slate-300 dark:hover:bg-white/[0.06] dark:hover:text-white"
            >
              <Github className="h-3.5 w-3.5" />
              到 GitHub 提建议
            </a>
          </div>
        </div>
      </div>
    </div>
  )
}
