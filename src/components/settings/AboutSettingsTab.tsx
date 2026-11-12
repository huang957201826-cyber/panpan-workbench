import { useState, type ReactNode } from 'react'
import { invoke } from '@tauri-apps/api/core'
import { BookOpen, Check, ExternalLink, FileText, History, MessageSquare, RefreshCw, Scale, Type } from 'lucide-react'
import changelogRaw from '../../../RELEASE.md?raw'
import { isTauri } from '../../lib/platform'
import { useAppUpdateStore } from '../../lib/appUpdateStore'
import { performUpdateCheck } from '../../lib/updateService'
import {
  REPO_ISSUES_URL, REPO_LICENSE_URL, REPO_README_URL, REPO_READY, REPO_SECURITY_URL,
} from '../../lib/repoLinks'
import { IconButton, Modal, Tooltip } from '../../ui'

interface RowProps {
  icon: ReactNode
  title: string
  subtitle?: string
  right?: ReactNode
  onClick?: () => void
  disabled?: boolean
}

function Row({ icon, title, subtitle, right, onClick, disabled = false }: RowProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="flex min-h-[52px] w-full items-center gap-3 px-4 py-2.5 text-left transition-colors duration-fast hover:bg-surface-3 disabled:cursor-not-allowed disabled:opacity-45 disabled:hover:bg-transparent"
    >
      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-control bg-surface-2 text-ink-2">{icon}</span>
      <span className="min-w-0 flex-1">
        <span className="block text-body text-ink-1">{title}</span>
        {subtitle && <span className="mt-0.5 block text-body-sm text-ink-3">{subtitle}</span>}
      </span>
      {right}
    </button>
  )
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="space-y-1.5">
      <h4 className="px-1 text-caption font-semibold text-ink-3">{title}</h4>
      <div className="divide-y divide-line overflow-hidden rounded-card border border-line bg-surface">{children}</div>
    </section>
  )
}

/** 把 RELEASE.md 的极简结构（## 版本 / ### 分类 / - 条目）渲染成可读内容 */
function ChangelogBody({ raw }: { raw: string }) {
  const lines = raw.split('\n')
  return (
    <div className="space-y-2">
      {lines.map((line, index) => {
        const text = line.trimEnd()
        if (!text) return null
        if (text.startsWith('## ')) return <h3 key={index} className="text-title text-ink-1">{text.slice(3)}</h3>
        if (text.startsWith('### ')) return <p key={index} className="pt-1 text-body-sm font-semibold text-ink-2">{text.slice(4)}</p>
        if (text.startsWith('  - ')) {
          return (
            <p key={index} className="flex gap-2 pl-5 text-body-sm leading-relaxed text-ink-2">
              <span className="mt-[7px] h-1 w-1 shrink-0 rounded-full bg-ink-3" />
              <span>{text.slice(4)}</span>
            </p>
          )
        }
        if (text.startsWith('- ')) {
          return (
            <p key={index} className="flex gap-2 text-body leading-relaxed text-ink-2">
              <span className="mt-[7px] h-1 w-1 shrink-0 rounded-full bg-ink-3" />
              <span>{text.slice(2)}</span>
            </p>
          )
        }
        return <p key={index} className="text-body text-ink-2">{text}</p>
      })}
    </div>
  )
}

export default function AboutSettingsTab({ onOpenFontLicenses }: { onOpenFontLicenses: () => void }) {
  const update = useAppUpdateStore()
  const dispatch = update.dispatch
  const [changelogOpen, setChangelogOpen] = useState(false)
  const [checking, setChecking] = useState(false)
  const busy = checking || update.phase === 'checking'
  // 应用内更新走 Tauri updater + GitHub Release；网页预览版没有更新器，只隐藏这一项
  const channelReady = REPO_READY && isTauri

  const check = async () => {
    if (!channelReady || busy) return
    setChecking(true)
    dispatch({ type: 'check' })
    try {
      const next = await performUpdateCheck(invoke)
      dispatch({ type: 'checked', info: next.info })
    } catch (err) {
      dispatch({ type: 'error', message: err instanceof Error ? err.message : String(err) })
    } finally {
      setChecking(false)
    }
  }

  const versionTitle = update.phase === 'available' && update.info
    ? `发现新版本 v${update.info.version}`
    : update.phase === 'latest'
      ? '已是最新版本'
      : busy
        ? '正在检查更新…'
        : update.phase === 'error'
          ? '检查更新失败'
          : '检查更新'

  return (
    <div className="space-y-4">
      <div className="rounded-card border border-line bg-surface-2 p-4">
        <div className="flex items-start gap-3">
          <div className="min-w-0 flex-1">
            <h3 className="text-title text-ink-1">盼盼工作台</h3>
            <p className="mt-0.5 font-mono text-caption text-ink-3">v{__APP_VERSION__} · 开发者 盼盼盼2222</p>
            <p className="mt-2 text-body leading-relaxed text-ink-2">
              这个工作台还在长，用得顺手的地方请留下，用不顺手的地方告诉我。
            </p>
          </div>
          <Tooltip label="重新检查更新">
            <IconButton label="重新检查更新" onClick={() => void check()} disabled={busy || !channelReady}>
              <RefreshCw size={16} className={busy ? 'animate-spin' : ''} />
            </IconButton>
          </Tooltip>
        </div>
      </div>

      <Section title="版本与更新">
        <Row
          icon={<RefreshCw size={15} />}
          title={versionTitle}
          subtitle={channelReady ? `当前版本 v${__APP_VERSION__} · 更新源 GitHub Releases` : '网页预览版不支持应用内更新'}
          onClick={() => void check()}
          disabled={!channelReady || busy}
          right={
            <span className="flex items-center gap-1.5">
              {update.phase === 'available' && update.info && (
                <span className="rounded-chip bg-brand px-1.5 py-0.5 font-mono text-caption text-white">v{update.info.version}</span>
              )}
              {update.phase === 'latest' && <Check size={14} className="text-success" />}
            </span>
          }
        />
        <Row
          icon={<History size={15} />}
          title="更新日志"
          subtitle="这个版本改了什么"
          onClick={() => setChangelogOpen(true)}
          right={<span className="text-body-sm text-ink-3">›</span>}
        />
      </Section>

      <Section title="支持与反馈">
        <Row
          icon={<MessageSquare size={15} />}
          title="反馈问题"
          subtitle="在 GitHub 提交 Issue"
          disabled={!REPO_READY}
          onClick={() => window.open(REPO_ISSUES_URL, '_blank', 'noopener')}
          right={<ExternalLink size={14} className="text-ink-3" />}
        />
        <Row
          icon={<BookOpen size={15} />}
          title="使用说明"
          subtitle="安装、配置与已知限制"
          disabled={!REPO_READY}
          onClick={() => window.open(REPO_README_URL, '_blank', 'noopener')}
          right={<ExternalLink size={14} className="text-ink-3" />}
        />
        <Row
          icon={<Scale size={15} />}
          title="报告安全漏洞"
          subtitle="私下提交，不公开细节"
          disabled={!REPO_READY}
          onClick={() => window.open(REPO_SECURITY_URL, '_blank', 'noopener')}
          right={<ExternalLink size={14} className="text-ink-3" />}
        />
      </Section>

      <Section title="赞助">
        <div className="px-4 py-3 text-body-sm leading-relaxed text-ink-2">
          如果这个工作台帮到了你，可以通过开发者提供的渠道赞助支持。本版不包含返利、推荐链接或任何分成入口。
        </div>
      </Section>

      <Section title="开源协议">
        <Row
          icon={<Scale size={15} />}
          title="开源许可"
          subtitle="MIT License"
          disabled={!REPO_READY}
          onClick={() => window.open(REPO_LICENSE_URL, '_blank', 'noopener')}
          right={<ExternalLink size={14} className="text-ink-3" />}
        />
        <Row
          icon={<Type size={15} />}
          title="第三方许可"
          subtitle="字体与依赖库的许可说明"
          onClick={onOpenFontLicenses}
          right={<span className="text-body-sm text-ink-3">›</span>}
        />
      </Section>

      <p className="flex items-start gap-1.5 px-1 text-caption leading-relaxed text-ink-3">
        <FileText size={12} className="mt-[2px] shrink-0" />
        本项目基于上游 MIT 许可代码继续开发，上游版权与完整许可见 LICENSE 与第三方许可清单。
      </p>

      <Modal
        open={changelogOpen}
        title="更新日志"
        onClose={() => setChangelogOpen(false)}
        width={640}
        footer={(
          <button
            type="button"
            onClick={() => setChangelogOpen(false)}
            className="inline-flex h-8 items-center rounded-control bg-surface-2 px-3 text-body-sm text-ink-1"
          >
            关闭
          </button>
        )}
      >
        <ChangelogBody raw={changelogRaw} />
      </Modal>
    </div>
  )
}
