import 'core-js/actual/array/at'
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import 'streamdown/styles.css'
import 'katex/dist/katex.min.css'
import '@fontsource/geist-sans/400.css'
import '@fontsource/geist-sans/500.css'
import '@fontsource/geist-sans/600.css'
import '@fontsource/geist-sans/700.css'
import '@fontsource/space-grotesk/500.css'
import '@fontsource/space-grotesk/600.css'
import './index.css'
import { getProxySetting } from './lib/networkProxy'
import { installBrowserBehaviorGuards, installExternalLinkHandler, isTauri, TITLEBAR_HEIGHT } from './lib/platform'
import { installTauriLog } from './lib/tauriLog'
import { installTauriStorageFlush, loadTauriStorage } from './lib/tauriStorage'
import { installMobileViewportGuards } from './lib/viewport'
import { buildDiagnostics } from './lib/diagnostics'
import ErrorBoundary from './components/ErrorBoundary'

installMobileViewportGuards()

// 经典滚动条占着右侧一整列，会伸进顶栏和标题栏，此时改用细滚动条并让页面在 [data-page-scroll] 里滚动（见 index.css）；
// 手机等悬浮滚动条不占宽度，仍滚动窗口，保留地址栏收起和下拉刷新。须在细滚动条样式生效前测量浏览器原生的滚动条。
// Firefox 不支持 ::-webkit-scrollbar，滚动条无法从顶栏下方开始，改为容器滚动后反而被顶栏遮住，所以仍滚动窗口
if (CSS.supports('selector(::-webkit-scrollbar)')) {
  const probe = document.createElement('div')
  probe.style.cssText = 'position:absolute;top:-9999px;width:100px;height:100px;overflow:scroll'
  document.body.appendChild(probe)
  if (probe.offsetWidth > probe.clientWidth) document.documentElement.dataset.classicScrollbar = ''
  probe.remove()
}

if (isTauri) {
  installTauriLog()
  installExternalLinkHandler()
  installBrowserBehaviorGuards()
  document.documentElement.style.setProperty('--safe-area-top', `${TITLEBAR_HEIGHT}px`)
  // 预先读取代理设置，打开设置时不必等待；失败时由设置页重新读取并显示原因
  void getProxySetting().catch((err) => console.warn('预读代理设置失败：', err))
}

// 客户端不注册 Service Worker，避免缓存与客户端版本更新冲突
if (!isTauri && 'serviceWorker' in navigator) {
  if (import.meta.env.PROD) {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register(`${import.meta.env.BASE_URL}sw.js`).catch((error) => {
        console.error('Service worker registration failed:', error)
      })
    })
  } else {
    navigator.serviceWorker.getRegistrations().then((registrations) => {
      registrations.forEach((registration) => registration.unregister())
    })
  }
}

// 模块加载或启动初始化失败时也要给出可操作的页面，而不是白屏
function renderStartupFailure(error: unknown) {
  const root = document.getElementById('root')
  if (!root) return
  const text = buildDiagnostics(error, { 版本: __APP_VERSION__, 客户端: isTauri ? 'Tauri' : 'Web' })
  root.textContent = ''
  const box = document.createElement('div')
  box.style.cssText = 'max-width:560px;margin:12vh auto;padding:24px;font-family:system-ui,sans-serif;color:#1f2937;line-height:1.6'
  const title = document.createElement('h1')
  title.textContent = '应用启动失败'
  title.style.cssText = 'font-size:20px;margin:0 0 8px'
  const hint = document.createElement('p')
  hint.textContent = '可以重新加载；若反复出现，请打开日志目录，或复制诊断信息后反馈。'
  hint.style.cssText = 'font-size:14px;color:#6b7280;margin:0 0 12px'
  const pre = document.createElement('pre')
  pre.textContent = text
  pre.style.cssText = 'max-height:220px;overflow:auto;white-space:pre-wrap;word-break:break-all;background:#f3f4f6;padding:12px;border-radius:12px;font-size:12px'
  const actions = document.createElement('div')
  actions.style.cssText = 'display:flex;gap:8px;margin-top:16px;flex-wrap:wrap'
  const makeButton = (label: string, onClick: () => void) => {
    const button = document.createElement('button')
    button.type = 'button'
    button.textContent = label
    button.style.cssText = 'padding:8px 14px;border-radius:10px;border:0;background:#2563eb;color:white;font-size:14px;cursor:pointer'
    button.onclick = onClick
    actions.appendChild(button)
  }
  makeButton('重新加载', () => location.reload())
  makeButton('复制诊断', () => {
    void navigator.clipboard?.writeText(text).then(
      () => alert('诊断信息已复制（敏感字段已脱敏）。'),
      () => alert('复制失败，请打开日志目录后反馈。'),
    )
  })
  if (isTauri) {
    makeButton('打开日志', () => {
      void import('./lib/tauriLog').then(({ openTauriLogDir }) => openTauriLogDir()).catch((err) => alert(String(err)))
    })
  }
  box.append(title, hint, pre, actions)
  root.appendChild(box)
}

// store 在模块加载时就会同步完成 persist hydration，因此 App（以及它引入的 store）必须在客户端设置读入内存之后才动态加载
async function start() {
  if (isTauri) {
    await loadTauriStorage()
    void installTauriStorageFlush().catch((err) => console.error('注册关闭前保存失败：', err))
  }
  const { default: App } = await import('./App')
  const root = document.getElementById('root')
  if (!root) throw new Error('找不到 #root 节点')
  createRoot(root).render(
    <StrictMode>
      <ErrorBoundary>
        <App />
      </ErrorBoundary>
    </StrictMode>,
  )
}

void start().catch((err) => {
  console.error('启动失败：', err)
  renderStartupFailure(err)
})
