import { useEffect, useState } from 'react'
import { initStore, useStore } from './store'
import { clearUrlSettingParams, hasUrlSettingParams } from './lib/urlSettings'
import { createDefaultOpenAIProfile, hasDefaultPresetConfig, isAgentTextApiProfile, normalizeSettings } from './lib/apiProfiles'
import { getCustomProviderConfigUrl, hasEmbeddedDefaultConfig, loadCustomProviderSettingsFromUrl, loadEmbeddedDefaultConfig } from './lib/customProviderConfigUrl'
import { getDefaultPresetProfileId, getPresetProfileIds, isPresetConfigOnlyEnabled, setPresetConfig } from './lib/presetConfig'
import { useDockerApiUrlMigrationNotice } from './hooks/useDockerApiUrlMigrationNotice'
import { useAppFonts } from './hooks/useAppFonts'
import { useColorMode } from './hooks/useColorMode'
import { useUiScale } from './hooks/useUiScale'
import { promptImportLink, useImportLinks } from './hooks/useImportLinks'
import { useSaveLocationPrompt } from './hooks/useSaveLocationPrompt'
import { usePrivacyModeShortcut } from './hooks/usePrivacyMode'
import Header from './components/Header'
import SearchBar from './components/SearchBar'
import TaskGrid from './components/TaskGrid'
import CanvasWorkbench from './components/canvas/CanvasWorkbench'
import InputBar from './components/InputBar'
import StudioShell from './studio/StudioShell'
import DetailModal from './components/DetailModal'
import Lightbox from './components/Lightbox'
import SettingsModal from './components/SettingsModal'
import ConfirmDialog from './components/ConfirmDialog'
import DataProgressDialog from './components/DataProgressDialog'
import Toast from './components/Toast'
import DbBlockedNotice from './components/DbBlockedNotice'
import MaskEditorModal from './components/MaskEditorModal'
import SketchBoardModal from './components/SketchBoardModal'
import TitleBar from './components/TitleBar'
import ImageContextMenu from './components/ImageContextMenu'
import { FavoriteCollectionPickerModal, FavoriteCollectionsView, ManageCollectionsModal } from './components/FavoriteCollections'
import { showStartupNotices, type NoticeSection } from './components/startupNotice'
import { useGlobalClickSuppression } from './lib/clickSuppression'
import { takeDataDirNotice } from './lib/dbTauri'
import { installCliBridge } from './lib/cliBridge'
import { isTauri, TITLEBAR_HEIGHT } from './lib/platform'
import { setSaveToDefaultDir } from './lib/saveFile'
import { setTauriLogEnabled } from './lib/tauriLog'
import { getSecretCleanupError, getTauriStorageLoadError } from './lib/tauriStorage'
import { getPageScroller } from './lib/pageScroll'
import { useCanvasViewStore } from './lib/canvasViewStore'

let defaultConfigImportStarted = false

export default function App() {
  const appMode = useStore((s) => s.appMode)
  const viewMode = useCanvasViewStore((s) => s.viewMode)
  const isCanvasMode = appMode === 'gallery' && viewMode === 'canvas'
  // Agent 模式已下线；旧数据里如果还停在 agent，启动时拉回画廊
  useEffect(() => {
    if (appMode !== 'gallery') useStore.getState().setAppMode('gallery')
  }, [appMode])
  const filterFavorite = useStore((s) => s.filterFavorite)
  const activeFavoriteCollectionId = useStore((s) => s.activeFavoriteCollectionId)
  const writeLogFile = useStore((s) => s.settings.writeLogFile)
  const saveLocationMode = useStore((s) => s.settings.saveLocationMode)
  const privacyModeEpoch = useStore((s) => s.privacyModeEpoch)
  const settingsModalEpoch = useStore((s) => s.settingsModalEpoch)
  // 设置页已移除传统布局出口，工作台恒为默认入口；旧布局代码保留待后续剥离
  const studioShellEnabled = true
  const [startupImportDone, setStartupImportDone] = useState(false)
  useDockerApiUrlMigrationNotice()
  useAppFonts()
  useColorMode()
  useUiScale()
  useGlobalClickSuppression()
  useSaveLocationPrompt()
  usePrivacyModeShortcut()
  // 运行中的链接导入要等启动时的预置配置写入完，否则会被启动流程覆盖
  useImportLinks(startupImportDone)

  useEffect(() => {
    if (isTauri) return installCliBridge()
  }, [])

  useEffect(() => {
    if (!isTauri) return
    // 启动时的提示合并到一个弹窗中，避免后到的覆盖先到的：存储无法使用的原因，以及更改数据目录的结果
    void takeDataDirNotice()
      .catch((err) => {
        console.error('读取数据目录提示失败：', err)
        return { notices: [], custom: false }
      })
      .then(({ notices, custom }) => {
        const state = useStore.getState()
        const success = notices.find((notice) => notice.kind === 'success')
        if (success) state.showToast(success.message, 'success')
        const sections: NoticeSection[] = []
        const err = getTauriStorageLoadError()
        if (err) {
          // unavailable 涵盖目录不可写、数据库版本过高、版本信息损坏、无法打开数据库等，按 Rust 侧的说明区分建议
          const unavailable = err.code === 'unavailable'
          const corrupt = err.code === 'corrupt' || err.message.includes('损坏')
          const advice = corrupt
            ? '数据库未通过完整性检查。请关闭应用，保留原 data.db，并把数据目录 data/backups 中最近的 db-pre-migrate-*.db 备份交给维护者恢复。'
            : !unavailable
              ? '读取设置时数据库出错，可能已损坏。可以先在「设置 → 数据管理」中尝试导出备份，再反馈问题。'
              : err.message.includes('不可写')
                ? custom
                  ? '请在「设置 → 数据管理」中把数据目录改到有写权限的位置。'
                  : '可能装在了需要管理员权限的位置，比如 C:\\Program Files。可以重新安装到其他位置，或在「设置 → 数据管理」中更改数据目录。'
                : err.message.includes('高于当前客户端')
                  ? '数据目录由更新版本的客户端创建，请升级到最新版本的客户端后再打开。'
                  : '数据库可能被其他程序占用或已损坏，关闭相关程序后重启再尝试。'
          sections.push({
            title: corrupt ? '数据库已损坏' : '无法保存数据',
            message: corrupt
              ? '应用无法读写数据库，已停止加载任务。'
              : unavailable
                ? '数据目录无法使用，这次的改动不会被保存。'
                : '读取设置失败，当前是默认设置，这次的改动不会被保存。',
            details: [`原因：${err.message}`, advice],
          })
        }
        const cleanupError = getSecretCleanupError()
        if (cleanupError) {
          sections.push({
            title: 'API Key 安全清理未完成',
            message: '旧明文可能暂存在数据库日志中，应用会在下次启动自动重试。',
            details: [cleanupError],
          })
        }
        sections.push(...notices.filter((notice) => notice.kind === 'warning'))
        showStartupNotices(sections)
      })
  }, [])

  useEffect(() => {
    if (isTauri) setTauriLogEnabled(writeLogFile)
  }, [writeLogFile])

  useEffect(() => {
    // 网页版始终由浏览器下载，忽略备份中带来的该设置
    setSaveToDefaultDir(isTauri && saveLocationMode === 'default')
  }, [saveLocationMode])

  useEffect(() => {
    if (defaultConfigImportStarted) return
    defaultConfigImportStarted = true

    // 链接中的设置参数先取出留待确认，再立即从地址栏清除，避免刷新后再次提示或密钥留在地址栏
    const searchParams = new URLSearchParams(window.location.search)
    const importParams = hasUrlSettingParams(searchParams) ? new URLSearchParams(searchParams) : null
    if (importParams) {
      clearUrlSettingParams(searchParams)
      const nextSearch = searchParams.toString()
      window.history.replaceState(null, '', `${window.location.pathname}${nextSearch ? `?${nextSearch}` : ''}${window.location.hash}`)
    }

    const customProviderConfigUrl = getCustomProviderConfigUrl()
    const embeddedDefaultConfig = hasEmbeddedDefaultConfig()
    const loadDefaultConfig = () => embeddedDefaultConfig
      ? Promise.resolve().then(() => loadEmbeddedDefaultConfig())
      : loadCustomProviderSettingsFromUrl(customProviderConfigUrl)

    void initStore()
      .then(async () => {
        const importedSettings = embeddedDefaultConfig || customProviderConfigUrl
          ? await loadDefaultConfig()
          : hasDefaultPresetConfig()
            ? {
                customProviders: [],
                profiles: [{ ...createDefaultOpenAIProfile(), isDefault: true }],
              }
            : null
        setPresetConfig(importedSettings)

        const state = useStore.getState()
        if (importedSettings) {
          await state.setPresetImportedSettings(importedSettings)
        } else if (state.previousPresetConfig) {
          await state.setPresetImportedSettings({ customProviders: [], profiles: [] })
        }

        const syncedState = useStore.getState()
        if (!importedSettings) {
          useStore.setState({ dismissedPresetProfileIds: [], dismissedPresetProviderIds: [] })
          if (syncedState.settings.profiles.some((profile) => profile.isDefault)) {
            syncedState.setSettings({
              profiles: syncedState.settings.profiles.map((profile) => profile.isDefault ? { ...profile, isDefault: undefined } : profile),
            })
          }
        }

        const current = useStore.getState()
        const presetIds = getPresetProfileIds()
        const defaultPresetId = getDefaultPresetProfileId()
        const settings = isPresetConfigOnlyEnabled()
          ? normalizeSettings({
              ...current.settings,
              activeProfileId: presetIds.has(current.settings.activeProfileId)
                ? current.settings.activeProfileId
                : defaultPresetId ?? [...presetIds][0],
              agentTextProfileId: current.settings.agentTextProfileId && presetIds.has(current.settings.agentTextProfileId)
                ? current.settings.agentTextProfileId
                : current.settings.profiles.find((profile) => presetIds.has(profile.id) && isAgentTextApiProfile(profile))?.id ?? null,
              agentImageProfileId: current.settings.agentImageProfileId && presetIds.has(current.settings.agentImageProfileId)
                ? current.settings.agentImageProfileId
                : defaultPresetId ?? [...presetIds][0],
            })
          : current.settings
        current.setSettings(settings)
      })
      .catch((error) => {
        console.warn('Failed to import preset config:', error)
        setPresetConfig(null)
      })
      .finally(() => {
        // 不等待用户确认，客户端的剪贴板和 deep link 监听依赖它
        setStartupImportDone(true)
        // 预置配置写入后再提示，确认框按导入前的实际设置描述变化
        if (importParams) promptImportLink(importParams, true)
      })
  }, [])

  useEffect(() => {
    const preventPageImageDrag = (e: DragEvent) => {
      if ((e.target as HTMLElement | null)?.closest('img')) {
        e.preventDefault()
      }
    }

    document.addEventListener('dragstart', preventPageImageDrag)
    return () => document.removeEventListener('dragstart', preventPageImageDrag)
  }, [])

  useEffect(() => {
    if (viewMode !== 'canvas') return
    delete document.documentElement.dataset.header
    getPageScroller().scrollTo(0, 0)
  }, [viewMode])

  // 进入隐私模式时重新挂载带有内部弹窗或菜单的组件，直接丢弃其中未保存的内容
  const overlays = (
    <>
      <DetailModal key={`detail-${privacyModeEpoch}`} />
      <Lightbox key={`lightbox-${privacyModeEpoch}`} />
      <SettingsModal key={`settings-${settingsModalEpoch}`} />
      <DataProgressDialog />
      <ConfirmDialog />
      <FavoriteCollectionPickerModal />
      <ManageCollectionsModal />
      <Toast />
      <DbBlockedNotice />
      <MaskEditorModal key={`mask-${privacyModeEpoch}`} />
      <SketchBoardModal key={`sketch-${privacyModeEpoch}`} />
      <ImageContextMenu key={`menu-${privacyModeEpoch}`} />
    </>
  )

  if (studioShellEnabled) {
    return (
      <>
        <StudioShell />
        {overlays}
      </>
    )
  }

  return (
    <>
      {isCanvasMode ? (
        <CanvasWorkbench />
      ) : (
        <div data-page-scroll>
          <Header />
          <main data-home-main data-drag-select-surface className="pb-48">
            <div className="safe-area-x max-w-7xl mx-auto">
              <SearchBar />
              {filterFavorite && !activeFavoriteCollectionId ? <FavoriteCollectionsView /> : <TaskGrid />}
            </div>
          </main>
        </div>
      )}
      {!isCanvasMode && <InputBar key={`input-${privacyModeEpoch}`} />}
      {overlays}
      {TITLEBAR_HEIGHT > 0 && <TitleBar />}
    </>
  )
}
