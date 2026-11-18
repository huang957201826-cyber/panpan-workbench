import React, { useState, useRef, useEffect } from 'react';
import {
  X,
  Key,
  Sliders,
  Palette,
  Database,
  Info,
  Sun,
  Moon,
  Monitor,
  Check,
  ChevronDown,
  Plus,
  Trash2,
  Copy,
  Eye,
  EyeOff,
  CheckCircle2,
  AlertCircle,
  ExternalLink,
  Zap,
  Upload,
  Link2,
  ClipboardPaste,
  Save,
  RotateCcw,
  Search,
  RefreshCw,
  Download,
  ShieldAlert,
  BookOpen,
  MessageSquare,
} from 'lucide-react';
import { AppLogo } from '../../components/AppLogo';
import { invoke } from '@tauri-apps/api/core';
import { isTauri } from '../../../lib/platform';
import { performUpdateCheck } from '../../../lib/updateService';
import { testConnection } from '../../adapters/settings';
import { clearData, exportData, importData, useStore } from '../../../store';
import { trackDataTransfer } from '../../../lib/dataOperations';
import { changeSaveDirWithMigration } from '../../../components/settings/saveDirMigration';
import { getDefaultSaveDir, openDefaultSaveDir } from '../../../lib/saveFile';
import McpSettingsSection from '../../../components/settings/McpSettingsSection';
import StorageInfoSection from '../../../components/settings/StorageInfoSection';
import FontLicensesModal from '../../../components/settings/FontLicensesModal';
import { getCachedProxySetting, getProxySetting, setProxySetting, type ProxyMode } from '../../../lib/networkProxy';
import { normalizeBatchPromptConcurrency } from '../../../lib/batchPrompts';
import { requestBrowserNotificationPermission } from '../../../lib/browserNotification';
import type { UiScale } from '../../../types';

export interface ApiProfile {
  id: string;
  name: string;
  providerType: 'openai' | 'azure' | 'comfy' | 'custom';
  apiUrl: string;
  apiKey: string;
  apiMode: 'images' | 'responses';
  models: string[];
  streaming: boolean;
  partialImages: number;
  timeoutSec: number;
}

export interface DiscoveredModel {
  id: string;
  isImageModel: boolean;
  recommended?: boolean;
  tag?: string;
}

export interface RecommendedRelayNode {
  id: string;
  name: string;
  badge: string;
  highlight: string;
  priceHint: string;
  registerUrl: string;
  preset: {
    name: string;
    providerType: ApiProfile['providerType'];
    apiUrl: string;
    apiMode: ApiProfile['apiMode'];
    models: string[];
  };
}

const DEFAULT_API_PROFILES: ApiProfile[] = [
  {
    id: 'profile-tehui',
    name: '特惠 API',
    providerType: 'openai',
    apiUrl: 'https://api.tehui.xyz/v1',
    apiKey: '',
    apiMode: 'images',
    models: ['gpt-image-2.5', 'gpt-image-2-5', 'flux.1-dev'],
    streaming: false,
    partialImages: 1,
    timeoutSec: 120,
  },
  {
    id: 'profile-official',
    name: '官方 OpenAI 直连',
    providerType: 'openai',
    apiUrl: 'https://api.openai.com/v1',
    apiKey: '',
    apiMode: 'images',
    models: ['gpt-image-2.5', 'dall-e-3'],
    streaming: true,
    partialImages: 2,
    timeoutSec: 120,
  },
];

// 精选单一推荐中转节点（可配置远程 JSON 热更新，本地内置兜底）
const FEATURED_RELAY_NODE: RecommendedRelayNode = {
  id: 'relay-tehui',
  name: '特惠高速中转站',
  badge: '含返利 · 新客赠额度',
  highlight: '支持 gpt-image-2.5 / FLUX 全系列画图模型，国内直连稳定低延迟，按量计费永不过期。',
  priceHint: '低至 ¥0.08 / 张 · 99.9% 可用率',
  registerUrl: 'https://api.tehui.xyz/sign-up?aff=rf9W',
  preset: {
    name: '特惠高速中转站',
    providerType: 'openai',
    apiUrl: 'https://api.tehui.xyz/v1',
    apiMode: 'images',
    models: ['gpt-image-2.5'],
  },
};

const PROVIDER_LABELS: Record<ApiProfile['providerType'], string> = {
  openai: 'OpenAI 兼容接口',
  azure: 'Azure OpenAI',
  comfy: '本地 ComfyUI 引擎',
  custom: '自定义网关协议',
};

const PROVIDER_SHORT_LABELS: Record<ApiProfile['providerType'], string> = {
  openai: 'OpenAI',
  azure: 'Azure',
  comfy: '本地',
  custom: '自定义',
};

// 判断是否为画图模型
const isLikelyImageModel = (modelId: string): boolean => {
  const lower = modelId.toLowerCase();
  return /image|flux|dall|sd|midjourney|mj|ideogram|recraft|imagen|kling|kolors|wanx/.test(lower);
};

// 极简统一黑白复选框控件（取代原生突兀蓝色方框）
const MonoCheckbox: React.FC<{
  checked: boolean;
  onChange: (checked: boolean) => void;
  label: string;
}> = ({ checked, onChange, label }) => (
  <button
    type="button"
    onClick={() => onChange(!checked)}
    className="inline-flex items-center gap-2 cursor-pointer group text-caption text-slate-700 dark:text-slate-300"
  >
    <span
      className={`w-4 h-4 rounded-md flex items-center justify-center border transition-colors ${
        checked
          ? 'bg-black border-black text-white dark:bg-white dark:border-white dark:text-black'
          : 'bg-white dark:bg-[#1a1d2a] border-black/20 dark:border-white/25 group-hover:border-black/50 dark:group-hover:border-white/50'
      }`}
    >
      {checked && <Check className="w-3 h-3 stroke-[2.8]" />}
    </span>
    <span>{label}</span>
  </button>
);

// 极简统一黑白开关（取代 iOS 蓝色滑块）
const MonoSwitch: React.FC<{
  checked: boolean;
  onChange: (checked: boolean) => void;
}> = ({ checked, onChange }) => (
  <button
    type="button"
    onClick={() => onChange(!checked)}
    className={`w-10 h-5 rounded-full transition-colors relative cursor-pointer shrink-0 ${
      checked ? 'bg-black dark:bg-white' : 'bg-slate-300 dark:bg-zinc-700'
    }`}
  >
    <div
      className={`w-4 h-4 rounded-full bg-white dark:bg-black transition-transform absolute top-0.5 left-0.5 shadow-sm ${
        checked ? 'translate-x-5' : 'translate-x-0'
      }`}
    />
  </button>
);

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  wheelZoomDirect: boolean;
  onToggleWheelZoomDirect: (val: boolean) => void;
  isDark: boolean;
  onToggleTheme: () => void;
  onShowToast?: (msg: string) => void;
  initialTab?: SettingsTab;
}

type SettingsTab = 'api' | 'general' | 'appearance' | 'data' | 'about';

export const SettingsModal: React.FC<SettingsModalProps> = ({
  isOpen,
  onClose,
  wheelZoomDirect,
  onToggleWheelZoomDirect,
  isDark,
  onToggleTheme,
  onShowToast,
  initialTab,
}) => {
  const [activeTab, setActiveTab] = useState<SettingsTab>(initialTab ?? 'api');

  // 打开设置时若来自「查看」之类的外部跳转，切到请求的页签
  useEffect(() => {
    if (isOpen && initialTab) setActiveTab(initialTab);
  }, [initialTab, isOpen]);

  // API Profiles State (Persisted to localStorage)
  const [profiles, setProfiles] = useState<ApiProfile[]>(() => {
    try {
      const saved = localStorage.getItem('panpan_api_profiles_v2');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch {
      // ignore
    }
    return DEFAULT_API_PROFILES;
  });

  const [activeProfileId, setActiveProfileId] = useState<string>(() => {
    try {
      return localStorage.getItem('panpan_active_profile_id_v2') || DEFAULT_API_PROFILES[0].id;
    } catch {
      return DEFAULT_API_PROFILES[0].id;
    }
  });

  const currentSavedProfile = profiles.find((p) => p.id === activeProfileId) || profiles[0];
  const [draft, setDraft] = useState<ApiProfile>(currentSavedProfile);
  const [isCreatingNew, setIsCreatingNew] = useState(false);
  const [isProfileDropdownOpen, setIsProfileDropdownOpen] = useState(false);
  const [showApiKey, setShowApiKey] = useState(false);
  const [showAdvancedApi, setShowAdvancedApi] = useState(false);

  // 默认折叠推荐中转站节点（克制不喧宾夺主）
  const [showRelaySection, setShowRelaySection] = useState(false);

  // Import modal
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [importText, setImportText] = useState('');
  const [importError, setImportError] = useState<string | null>(null);

  // Guided banner & save feedback
  const [relayImportHint, setRelayImportHint] = useState<string | null>(null);
  const [saveFeedback, setSaveFeedback] = useState<'idle' | 'saved'>('idle');
  const [confirmCloseUnsaved, setConfirmCloseUnsaved] = useState(false);

  // Connection test & discovered models state
  const [isTesting, setIsTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ status: 'idle' | 'success' | 'error'; message: string }>({
    status: 'idle',
    message: '',
  });
  const [discoveredModels, setDiscoveredModels] = useState<DiscoveredModel[]>([]);
  const [showAllDiscovered, setShowAllDiscovered] = useState(false);
  const [modelSearchQuery, setModelSearchQuery] = useState('');
  const [showManualModelInput, setShowManualModelInput] = useState(false);
  const [manualModelInput, setManualModelInput] = useState('');

  // General tab states (精简版 + 更多设置折叠)
  const [defaultDownloadPath, setDefaultDownloadPath] = useState('');
  const [showMoreGeneral, setShowMoreGeneral] = useState(false);

  // 与正式设置共用的真实配置（以下派生值直接读写 store）
  const settings = useStore((state) => state.settings);
  const setSettings = useStore((state) => state.setSettings);
  const submitShortcut = settings.enterSubmit ? 'enter' : 'ctrl-enter';
  const setSubmitShortcut = (value: 'ctrl-enter' | 'enter') => setSettings({ enterSubmit: value === 'enter' });
  const uiScale = `${settings.uiScale ?? 100}%` as '100%' | '110%' | '125%' | '150%';
  const setUiScale = (value: '100%' | '110%' | '125%' | '150%') =>
    setSettings({ uiScale: Number(value.replace('%', '')) as UiScale });
  const concurrency = normalizeBatchPromptConcurrency(settings.batchPromptConcurrency);
  const setConcurrency = (value: number) =>
    setSettings({ batchPromptConcurrency: normalizeBatchPromptConcurrency(value), batchPromptConcurrencyLimited: true });
  const themePreference = (settings.colorMode ?? 'system') as 'light' | 'dark' | 'system';
  const uiFontMode = settings.uiFont === 'system' ? 'system' : 'builtin';
  const setUiFontMode = (value: 'builtin' | 'system') => setSettings({ uiFont: value });
  const [networkProxy, setNetworkProxy] = useState<'system' | 'direct' | 'custom'>(
    getCachedProxySetting()?.mode === 'none'
      ? 'direct'
      : getCachedProxySetting()?.mode === 'custom'
      ? 'custom'
      : 'system',
  );

  // Data tab states
  const [storageVersion, setStorageVersion] = useState(0);
  const [showFontLicenses, setShowFontLicenses] = useState(false);
  const [exportIncludeConfig, setExportIncludeConfig] = useState(true);
  const [exportIncludeTasks, setExportIncludeTasks] = useState(true);
  const [importIncludeConfig, setImportIncludeConfig] = useState(true);
  const [importIncludeTasks, setImportIncludeTasks] = useState(true);
  const [clearIncludeConfig, setClearIncludeConfig] = useState(true);
  const [clearIncludeTasks, setClearIncludeTasks] = useState(true);

  // About tab states
  const [updateCheckStatus, setUpdateCheckStatus] = useState<'idle' | 'checking' | 'latest' | 'available' | 'error'>('idle');
  const [updateCheckMessage, setUpdateCheckMessage] = useState('');
  const [showLicenseDetails, setShowLicenseDetails] = useState(false);

  // Local inline banner fallback
  const [localBannerMsg, setLocalBannerMsg] = useState<string | null>(null);

  // Refs
  const apiKeyInputRef = useRef<HTMLInputElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const importInputRef = useRef<HTMLInputElement>(null);
  const modalRef = useRef<HTMLDivElement>(null);
  const step3Ref = useRef<HTMLDivElement>(null);

  // Sync draft when switching saved profile
  useEffect(() => {
    if (!isCreatingNew) {
      const found = profiles.find((p) => p.id === activeProfileId) || profiles[0];
      if (found) setDraft(found);
    }
  }, [activeProfileId, profiles, isCreatingNew]);

  // Close profile dropdown on outside click
  useEffect(() => {
    const handleOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsProfileDropdownOpen(false);
      }
    };
    if (isProfileDropdownOpen) {
      document.addEventListener('mousedown', handleOutside);
    }
    return () => document.removeEventListener('mousedown', handleOutside);
  }, [isProfileDropdownOpen]);

  // 导入/清空后让存储信息重新挂载，读取最新占用
  const refreshStorageInfo = () => setStorageVersion((value) => value + 1);

  useEffect(() => {
    if (!isOpen || !isTauri) return;
    getDefaultSaveDir()
      .then(setDefaultDownloadPath)
      .catch((err) => console.error('读取默认保存地址失败：', err));
  }, [isOpen]);

  const persistProfiles = (nextProfiles: ApiProfile[], nextActiveId: string) => {
    try {
      localStorage.setItem('panpan_api_profiles_v2', JSON.stringify(nextProfiles));
      localStorage.setItem('panpan_active_profile_id_v2', nextActiveId);
    } catch {
      // ignore
    }
  };

  // 代理设置存在本机数据库里，启动时已预读；未预读到就打开时补读一次
  useEffect(() => {
    if (!isOpen || !isTauri || getCachedProxySetting()) return;
    getProxySetting()
      .then((saved) => setNetworkProxy(saved.mode === 'none' ? 'direct' : saved.mode === 'custom' ? 'custom' : 'system'))
      .catch((err) => console.error('读取代理设置失败：', err));
  }, [isOpen]);

  if (!isOpen) return null;

  const hasUnsavedChanges =
    activeTab === 'api' &&
    (isCreatingNew || JSON.stringify(draft) !== JSON.stringify(currentSavedProfile));

  const notifyUser = (msg: string) => {
    if (onShowToast) {
      onShowToast(msg);
    } else {
      setLocalBannerMsg(msg);
      setTimeout(() => setLocalBannerMsg(null), 2600);
    }
  };

  const handleCheckUpdate = async () => {
    setUpdateCheckStatus('checking');
    setUpdateCheckMessage('');
    if (!isTauri) {
      setUpdateCheckStatus('error');
      setUpdateCheckMessage('当前环境不支持应用内更新');
      return;
    }
    try {
      const result = await performUpdateCheck(invoke);
      if (result.phase === 'available' && result.info) {
        setUpdateCheckStatus('available');
        setUpdateCheckMessage(`发现新版本 v${result.info.version}`);
        return;
      }
      setUpdateCheckStatus('latest');
      setUpdateCheckMessage(`已是最新版本 v${__APP_VERSION__}`);
    } catch (error) {
      setUpdateCheckStatus('error');
      setUpdateCheckMessage(`检查失败：${error instanceof Error ? error.message : String(error)}`);
    }
  };

  const handleChangeDownloadDir = async () => {
    try {
      const dir = await changeSaveDirWithMigration();
      if (dir) setDefaultDownloadPath(dir);
    } catch (err) {
      console.error('更改默认保存地址失败：', err);
      useStore.getState().showToast(typeof err === 'string' ? err : '更改默认保存地址失败', 'error');
    }
  };

  const handleOpenDownloadDir = async () => {
    try {
      await openDefaultSaveDir();
    } catch (err) {
      console.error('打开默认保存地址失败：', err);
      useStore.getState().showToast(typeof err === 'string' ? err : '打开默认保存地址失败', 'error');
    }
  };

  const handleExportData = async () => {
    await trackDataTransfer(() => exportData({ exportConfig: exportIncludeConfig, exportTasks: exportIncludeTasks }));
  };

  const handleImportData = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    e.target.value = '';
    if (!files.length) return;
    const imported = await importData(files, { importConfig: importIncludeConfig, importTasks: importIncludeTasks });
    if (imported) refreshStorageInfo();
  };

  const handleClearData = () => {
    useStore.getState().setConfirmDialog({
      title: '清空所选数据',
      message: '确定要清空所选的数据吗？此操作不可恢复。',
      tone: 'danger',
      action: async () => {
        await clearData({ clearConfig: clearIncludeConfig, clearTasks: clearIncludeTasks });
        refreshStorageInfo();
      },
    });
  };

  const handleRequestClose = () => {
    if (hasUnsavedChanges) {
      setConfirmCloseUnsaved(true);
      return;
    }
    setConfirmCloseUnsaved(false);
    onClose();
  };

  const handleSelectTheme = (mode: 'light' | 'dark' | 'system') => {
    setSettings({ colorMode: mode });
  };

  const handleToggleFinishNotify = async () => {
    if (settings.taskCompletionNotification) {
      setSettings({ taskCompletionNotification: false });
      return;
    }
    const result = await requestBrowserNotificationPermission();
    if (result.ok) {
      setSettings({ taskCompletionNotification: true });
      notifyUser('任务通知已开启');
      return;
    }
    const reasonText: Record<string, string> = {
      unsupported: '当前环境不支持系统通知',
      insecure: '系统通知需要安全连接',
      denied: '系统通知已被拒绝，请在系统设置里允许',
      default: '未获得系统通知权限',
      error: '申请系统通知权限失败',
    };
    notifyUser(reasonText[result.reason] ?? '系统通知不可用');
  };

  const handleProxyChange = async (value: 'system' | 'direct' | 'custom') => {
    const saved = getCachedProxySetting();
    if (value === 'custom' && !saved?.url) {
      notifyUser('自定义代理需要先在正式设置页填写代理地址');
      return;
    }
    try {
      await setProxySetting({ mode: value === 'direct' ? 'none' : value, url: saved?.url ?? '' });
      setNetworkProxy(value);
      notifyUser('网络代理已切换');
    } catch (err) {
      console.error('保存代理设置失败：', err);
      notifyUser(typeof err === 'string' ? err : '保存代理设置失败');
    }
  };

  // Start Creating a New Blank API Profile
  const handleStartNewProfile = () => {
    const newId = `profile-${Date.now()}`;
    setIsCreatingNew(true);
    setIsProfileDropdownOpen(false);
    setRelayImportHint(null);
    setTestResult({ status: 'idle', message: '' });
    setDiscoveredModels([]);
    setSaveFeedback('idle');
    setConfirmCloseUnsaved(false);
    setDraft({
      id: newId,
      name: `新节点配置 ${profiles.length + 1}`,
      providerType: 'openai',
      apiUrl: '',
      apiKey: '',
      apiMode: 'images',
      models: [],
      streaming: false,
      partialImages: 1,
      timeoutSec: 120,
    });
  };

  // One-click Fill from Featured Relay Node
  const handleApplyRelayPreset = (node: RecommendedRelayNode) => {
    const newId = `profile-${Date.now()}`;
    setIsCreatingNew(true);
    setIsProfileDropdownOpen(false);
    setTestResult({ status: 'idle', message: '' });
    setDiscoveredModels([]);
    setSaveFeedback('idle');
    setConfirmCloseUnsaved(false);
    setDraft({
      id: newId,
      name: node.preset.name,
      providerType: node.preset.providerType,
      apiUrl: node.preset.apiUrl,
      apiKey: '',
      apiMode: node.preset.apiMode,
      models: node.preset.models,
      streaming: false,
      partialImages: 1,
      timeoutSec: 120,
    });
    setRelayImportHint(
      `已自动填好「${node.name}」的接口地址与默认模型！请粘贴您复制的 sk- 密钥后点击「测试连接并获取模型」或直接保存。`
    );

    setTimeout(() => {
      apiKeyInputRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      apiKeyInputRef.current?.focus();
    }, 100);
  };

  // Save Draft
  const handleSaveProfile = (closeAfterSave = false) => {
    const cleanName = draft.name.trim() || '未命名 API 配置';
    const cleanUrl = draft.apiUrl.trim();
    if (!cleanUrl) {
      setTestResult({
        status: 'error',
        message: '第 1 步的 API 地址不能为空，请填写接口网址（如 https://api.xxx.com/v1）',
      });
      return;
    }

    const finalProfile: ApiProfile = {
      ...draft,
      name: cleanName,
      apiUrl: cleanUrl,
      apiKey: draft.apiKey.trim(),
      models: draft.models.length > 0 ? draft.models : ['gpt-image-2.5'],
    };

    const nextProfiles = isCreatingNew
      ? [...profiles, finalProfile]
      : profiles.map((p) => (p.id === finalProfile.id ? finalProfile : p));

    setProfiles(nextProfiles);
    setActiveProfileId(finalProfile.id);
    setDraft(finalProfile);
    setIsCreatingNew(false);
    setRelayImportHint(null);
    setConfirmCloseUnsaved(false);
    persistProfiles(nextProfiles, finalProfile.id);
    setSaveFeedback('saved');
    notifyUser(`已保存并启用「${finalProfile.name}」`);

    if (closeAfterSave) {
      onClose();
    } else {
      setTimeout(() => setSaveFeedback('idle'), 2500);
    }
  };

  const handleResetOrCancelNew = () => {
    setIsCreatingNew(false);
    setRelayImportHint(null);
    setTestResult({ status: 'idle', message: '' });
    setDiscoveredModels([]);
    setConfirmCloseUnsaved(false);
    setDraft(currentSavedProfile);
  };

  const handleSelectSavedProfile = (profileId: string) => {
    setIsCreatingNew(false);
    setRelayImportHint(null);
    setTestResult({ status: 'idle', message: '' });
    setDiscoveredModels([]);
    setConfirmCloseUnsaved(false);
    setActiveProfileId(profileId);
    setIsProfileDropdownOpen(false);
    persistProfiles(profiles, profileId);
    const chosen = profiles.find((p) => p.id === profileId);
    if (chosen) notifyUser(`已切换配置为「${chosen.name}」`);
  };

  const handleDeleteProfile = (e: React.MouseEvent, profileId: string) => {
    e.stopPropagation();
    if (profiles.length <= 1) {
      notifyUser('至少需要保留一套 API 配置');
      return;
    }
    const nextProfiles = profiles.filter((p) => p.id !== profileId);
    const nextActiveId = profileId === activeProfileId ? nextProfiles[0].id : activeProfileId;
    setProfiles(nextProfiles);
    setActiveProfileId(nextActiveId);
    persistProfiles(nextProfiles, nextActiveId);
    notifyUser('已删除该 API 配置');
  };

  const handleDuplicateProfile = (e: React.MouseEvent, profile: ApiProfile) => {
    e.stopPropagation();
    const copyId = `profile-${Date.now()}`;
    const copied: ApiProfile = {
      ...profile,
      id: copyId,
      name: `${profile.name} (副本)`,
    };
    const nextProfiles = [...profiles, copied];
    setProfiles(nextProfiles);
    setActiveProfileId(copyId);
    setIsCreatingNew(false);
    setIsProfileDropdownOpen(false);
    persistProfiles(nextProfiles, copyId);
    notifyUser(`已复制并切换至「${copied.name}」`);
  };

  // URL sanitization helper on blur
  const sanitizeUrl = (raw: string) => {
    let cleaned = raw.trim().replace(/\s+/g, '');
    // If user accidentally pasted full endpoint path like /v1/images/generations, keep base /v1
    if (cleaned.endsWith('/images/generations')) {
      cleaned = cleaned.replace('/images/generations', '');
    }
    return cleaned;
  };

  // Test Connection & Fetch Available Models
  const handleTestAndFetchModels = async () => {
    const cleanUrl = sanitizeUrl(draft.apiUrl);
    const cleanKey = draft.apiKey.trim();

    if (cleanUrl !== draft.apiUrl || cleanKey !== draft.apiKey) {
      setDraft((prev) => ({ ...prev, apiUrl: cleanUrl, apiKey: cleanKey }));
    }

    if (!cleanUrl || (!cleanUrl.startsWith('http://') && !cleanUrl.startsWith('https://'))) {
      setTestResult({
        status: 'error',
        message: '第 1 步地址格式有误：请确保以 https:// 或 http:// 开头',
      });
      return;
    }

    if (draft.providerType !== 'comfy' && !cleanKey) {
      setTestResult({
        status: 'error',
        message: '尚未填写 API Key：请先在第 2 步粘贴 sk- 开头的密钥再测试',
      });
      apiKeyInputRef.current?.focus();
      return;
    }

    setIsTesting(true);
    setTestResult({ status: 'idle', message: '' });
    const startedAt = performance.now();

    try {
      const result = await testConnection(cleanUrl, cleanKey, { timeoutMs: 8000 });
      const latencyMs = Math.max(1, Math.round(performance.now() - startedAt));
      if (!result.ok) {
        setDiscoveredModels([]);
        setTestResult({ status: 'error', message: result.error ?? '连接失败' });
        return;
      }
      if (result.models.length === 0) {
        setDiscoveredModels([]);
        setTestResult({ status: 'error', message: '接口没有返回模型列表，请确认地址与密钥权限' });
        return;
      }
      const modelsResult: DiscoveredModel[] = result.models.map((id) => ({
        id,
        isImageModel: isLikelyImageModel(id),
        recommended: /gpt-image-2\.5|flux/i.test(id),
      }));
      const imageCount = modelsResult.filter((m) => m.isImageModel).length;
      setDiscoveredModels(modelsResult);
      setTestResult({
        status: 'success',
        message: `连接成功（${latencyMs}ms）· 返回 ${modelsResult.length} 个模型，其中 ${imageCount} 个画图模型`,
      });

      if (draft.models.length === 0) {
        const autoPicks = modelsResult
          .filter((m) => m.isImageModel && m.recommended)
          .slice(0, 2)
          .map((m) => m.id);
        if (autoPicks.length > 0) setDraft((prev) => ({ ...prev, models: autoPicks }));
      }

      setTimeout(() => {
        step3Ref.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      }, 120);
    } finally {
      setIsTesting(false);
    }
  };

  // Toggle a model in draft.models
  const handleToggleModel = (modelId: string) => {
    const exists = draft.models.includes(modelId);
    if (exists) {
      setDraft({ ...draft, models: draft.models.filter((m) => m !== modelId) });
    } else {
      setDraft({ ...draft, models: [...draft.models, modelId] });
    }
  };

  // Select all visible image models from discovered pool
  const handleSelectAllImageModels = () => {
    const imageIds = discoveredModels.filter((m) => m.isImageModel).map((m) => m.id);
    const merged = Array.from(new Set([...draft.models, ...imageIds]));
    setDraft({ ...draft, models: merged });
    notifyUser(`已一键加入 ${imageIds.length} 个可用画图模型`);
  };

  // Add manual fallback model ID
  const handleAddManualModel = () => {
    const cleaned = manualModelInput.trim();
    if (!cleaned) return;
    if (!draft.models.includes(cleaned)) {
      setDraft({ ...draft, models: [...draft.models, cleaned] });
    }
    setManualModelInput('');
    setShowManualModelInput(false);
  };

  // Paste API Key from Clipboard
  const handlePasteApiKey = async () => {
    try {
      const text = await navigator.clipboard.readText();
      if (text) {
        setDraft({ ...draft, apiKey: text.trim() });
        notifyUser('已从剪贴板粘贴密钥');
      }
    } catch {
      notifyUser('请在输入框内按 Ctrl+V / ⌘V 粘贴');
    }
  };

  // Parse Share URL or .ppconfig JSON
  const handleParseImportPayload = () => {
    const raw = importText.trim();
    setImportError(null);
    if (!raw) {
      setImportError('请先粘贴分享链接或配置码内容');
      return;
    }

    try {
      if (raw.includes('apiUrl=') || raw.includes('apiKey=')) {
        const queryString = raw.includes('?') ? raw.split('?')[1] : raw;
        const params = new URLSearchParams(queryString);
        const apiUrl = params.get('apiUrl') || '';
        const apiKey = params.get('apiKey') || '';
        const modelStr = params.get('model') || 'gpt-image-2.5';
        const apiMode = params.get('apiMode') === 'responses' ? 'responses' : 'images';
        const name = params.get('name') || '链接导入配置';

        setIsCreatingNew(true);
        setDraft({
          id: `profile-${Date.now()}`,
          name,
          providerType: 'openai',
          apiUrl,
          apiKey,
          apiMode,
          models: modelStr
            .split(',')
            .map((s) => s.trim())
            .filter(Boolean),
          streaming: false,
          partialImages: 1,
          timeoutSec: 120,
        });
        setIsImportModalOpen(false);
        setImportText('');
        setRelayImportHint('已从分享链接自动解析出配置！请确认后点击底部「保存新增配置」。');
        return;
      }

      const parsed = JSON.parse(raw);
      const firstProfile = Array.isArray(parsed.profiles) ? parsed.profiles[0] : parsed;
      if (firstProfile && (firstProfile.apiUrl || firstProfile.baseUrl || firstProfile.url)) {
        const rawModels = Array.isArray(firstProfile.models)
          ? firstProfile.models
          : String(firstProfile.models || firstProfile.model || 'gpt-image-2.5')
              .split(',')
              .map((s) => s.trim())
              .filter(Boolean);

        setIsCreatingNew(true);
        setDraft({
          id: `profile-${Date.now()}`,
          name: firstProfile.name || '导入配置',
          providerType: 'openai',
          apiUrl: firstProfile.apiUrl || firstProfile.baseUrl || firstProfile.url || '',
          apiKey: firstProfile.apiKey || '',
          apiMode: firstProfile.apiMode === 'responses' ? 'responses' : 'images',
          models: rawModels,
          streaming: Boolean(firstProfile.streaming),
          partialImages: Number(firstProfile.partialImages ?? 1),
          timeoutSec: 120,
        });
        setIsImportModalOpen(false);
        setImportText('');
        setRelayImportHint('已成功解析配置码！请核对密钥后点击底部「保存新增配置」。');
        return;
      }

      setImportError('未能识别格式：请粘贴包含 ?apiUrl= 的链接或有效的 JSON / .ppconfig 内容');
    } catch {
      setImportError('解析失败：内容不是有效的链接参数或 JSON 格式');
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      if (typeof ev.target?.result === 'string') {
        setImportText(ev.target.result);
        setIsImportModalOpen(true);
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  const handleCopyShareLink = () => {
    const params = new URLSearchParams({
      name: draft.name,
      apiUrl: draft.apiUrl,
      apiMode: draft.apiMode,
      model: draft.models.join(','),
    });
    navigator.clipboard.writeText(`panpan://import?${params.toString()}`);
    notifyUser('已复制配置分享链接（已脱敏，不含 API Key）');
  };

  // Filtered discovered models for Step 3
  const visibleDiscoveredModels = discoveredModels.filter((m) => {
    if (!showAllDiscovered && !m.isImageModel) return false;
    if (modelSearchQuery.trim() && !m.id.toLowerCase().includes(modelSearchQuery.toLowerCase())) {
      return false;
    }
    return true;
  });

  return (
    <div
      onClick={handleRequestClose}
      className="fixed inset-0 z-50 bg-black/30 dark:bg-black/60 backdrop-blur-md flex items-center justify-center p-4 select-none animate-in fade-in duration-150"
    >
      <div
        ref={modalRef}
        onClick={(e) => e.stopPropagation()}
        className="w-[820px] max-w-[96vw] h-[660px] max-h-[90vh] rounded-3xl flex flex-col border border-black/[0.08] dark:border-white/[0.08] shadow-2xl overflow-hidden text-slate-800 dark:text-slate-100 bg-[#fbfcfd] dark:bg-[#141620]"
      >
        {/* =========================================================================
            MODAL HEADER
            ========================================================================= */}
        <div className="h-[54px] px-6 flex items-center justify-between border-b border-black/[0.06] dark:border-white/[0.07] bg-white dark:bg-[#161822] shrink-0">
          <div className="flex items-center gap-2.5">
            <h3 className="text-title font-bold text-slate-900 dark:text-white tracking-tight">
              设置
            </h3>
            {localBannerMsg && (
              <span className="text-caption text-emerald-700 dark:text-emerald-400 font-medium animate-in fade-in">
                · {localBannerMsg}
              </span>
            )}
          </div>

          <div className="flex items-center gap-3">
            <span className="text-caption font-mono text-slate-400 tabular-nums">v{__APP_VERSION__}</span>
            <button
              onClick={handleRequestClose}
              className="w-8 h-8 rounded-full hover:bg-black/[0.05] dark:hover:bg-white/[0.08] text-slate-400 hover:text-slate-700 dark:hover:text-white flex items-center justify-center transition cursor-pointer"
              title="关闭设置"
            >
              <X className="w-4 h-4 stroke-[1.8]" />
            </button>
          </div>
        </div>

        {/* =========================================================================
            MODAL BODY: LEFT 5-TAB NAVIGATION + RIGHT CONTENT
            ========================================================================= */}
        <div className="flex flex-1 min-h-0 overflow-hidden">
          {/* Left Vertical Sub-Tabs (5 clean categories, AI工具集成 removed) */}
          <aside className="w-[180px] shrink-0 p-3 border-r border-black/[0.05] dark:border-white/[0.06] bg-white/75 dark:bg-[#11131b] flex flex-col justify-between">
            <div className="space-y-1 text-caption">
              {[
                { id: 'api', label: 'API 配置', icon: Key },
                { id: 'general', label: '通用', icon: Sliders },
                { id: 'appearance', label: '外观', icon: Palette },
                { id: 'data', label: '数据', icon: Database },
                { id: 'about', label: '关于', icon: Info },
              ].map((item) => {
                const Icon = item.icon;
                const isActive = activeTab === item.id;
                return (
                  <button
                    key={item.id}
                    onClick={() => {
                      setConfirmCloseUnsaved(false);
                      setActiveTab(item.id as SettingsTab);
                    }}
                    className={`w-full h-10 px-3.5 rounded-full flex items-center gap-2.5 transition-all cursor-pointer text-left font-medium whitespace-nowrap ${
                      isActive
                        ? 'bg-black text-white dark:bg-white dark:text-black shadow-sm'
                        : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-black/[0.04] dark:hover:bg-white/[0.06]'
                    }`}
                  >
                    <Icon className="w-4 h-4 stroke-[1.8] shrink-0" />
                    <span className="truncate">{item.label}</span>
                  </button>
                );
              })}
            </div>

            <div className="px-2 pt-3 border-t border-black/[0.04] dark:border-white/[0.05] text-caption text-slate-400 leading-relaxed">
              所有密钥与偏好仅保存在本地设备。
            </div>
          </aside>

          {/* Right Content Stage */}
          <div className="flex-1 flex flex-col min-w-0 bg-[#f3f4f8] dark:bg-[#0c0e14]">
            <div className="flex-1 overflow-y-auto p-6 space-y-5">
              {/* =====================================================================
                  TAB 1: API CONFIGURATION
                  ===================================================================== */}
              {activeTab === 'api' && (
                <div className="space-y-5">
                  {/* ZONE A: 已保存配置下拉 + 醒目新增入口 */}
                  <section className="space-y-2.5">
                    <div className="flex items-center justify-between">
                      <div>
                        <h4 className="text-body font-semibold text-slate-900 dark:text-white">
                          已保存的 API 配置
                        </h4>
                        <p className="text-caption text-slate-500 dark:text-slate-400">
                          下拉切换已保存配置，或点击右侧按钮新建一套
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => setIsImportModalOpen(true)}
                        className="text-caption font-medium text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg hover:bg-black/[0.04] dark:hover:bg-white/[0.06] transition cursor-pointer whitespace-nowrap"
                      >
                        <Link2 className="w-3.5 h-3.5" />
                        <span>导入配置链接 / 文件</span>
                      </button>
                    </div>

                    <div className="flex items-center gap-3">
                      {/* Custom Saved API Dropdown */}
                      <div className="relative flex-1 min-w-0" ref={dropdownRef}>
                        <button
                          type="button"
                          onClick={() => setIsProfileDropdownOpen(!isProfileDropdownOpen)}
                          className="w-full h-11 px-4 rounded-2xl bg-white dark:bg-[#141620] border border-black/[0.08] dark:border-white/[0.1] hover:border-black/20 dark:hover:border-white/25 soft-card-shadow flex items-center justify-between gap-3 transition cursor-pointer text-left"
                        >
                          <div className="flex items-center gap-2.5 min-w-0">
                            <span
                              className={`w-2 h-2 rounded-full shrink-0 ${
                                isCreatingNew
                                  ? 'bg-amber-500'
                                  : currentSavedProfile.apiKey || currentSavedProfile.providerType === 'comfy'
                                  ? 'bg-emerald-500'
                                  : 'bg-slate-300 dark:bg-slate-600'
                              }`}
                            />
                            <span className="text-body font-semibold text-slate-900 dark:text-white truncate">
                              {isCreatingNew ? `正在新建：${draft.name || '新配置'}` : currentSavedProfile.name}
                            </span>
                            <span className="text-caption text-slate-400 dark:text-slate-500 truncate hidden sm:inline">
                              · {PROVIDER_SHORT_LABELS[isCreatingNew ? draft.providerType : currentSavedProfile.providerType]} ·{' '}
                              {(isCreatingNew ? draft.models : currentSavedProfile.models).length} 个画图模型
                            </span>
                          </div>
                          <ChevronDown
                            className={`w-4 h-4 text-slate-400 shrink-0 transition-transform ${
                              isProfileDropdownOpen ? 'rotate-180' : ''
                            }`}
                          />
                        </button>

                        {/* Dropdown Menu */}
                        {isProfileDropdownOpen && (
                          <div className="absolute left-0 right-0 top-[calc(100%+6px)] z-30 rounded-2xl bg-white dark:bg-[#181b26] border border-black/[0.08] dark:border-white/[0.1] soft-float-shadow p-1.5 space-y-1 animate-in fade-in slide-in-from-top-1 duration-150">
                            <div className="px-3 py-1.5 text-caption font-medium text-slate-400 flex items-center justify-between">
                              <span>已保存配置（共 {profiles.length} 套）</span>
                              <span>点击切换</span>
                            </div>

                            <div className="max-h-56 overflow-y-auto space-y-1">
                              {profiles.map((p) => {
                                const isSelected = !isCreatingNew && p.id === activeProfileId;
                                return (
                                  <div
                                    key={p.id}
                                    onClick={() => handleSelectSavedProfile(p.id)}
                                    className={`group px-3 py-2.5 rounded-xl flex items-center justify-between gap-2 cursor-pointer transition ${
                                      isSelected
                                        ? 'bg-black/[0.05] dark:bg-white/[0.08] text-slate-900 dark:text-white'
                                        : 'hover:bg-black/[0.03] dark:hover:bg-white/[0.04] text-slate-700 dark:text-slate-300'
                                    }`}
                                  >
                                    <div className="flex items-center gap-2.5 min-w-0">
                                      <div className="w-4 flex items-center justify-center shrink-0">
                                        {isSelected ? (
                                          <Check className="w-4 h-4 text-slate-900 dark:text-white stroke-[2.2]" />
                                        ) : (
                                          <span
                                            className={`w-1.5 h-1.5 rounded-full ${
                                              p.apiKey ? 'bg-emerald-500' : 'bg-slate-300 dark:bg-slate-600'
                                            }`}
                                          />
                                        )}
                                      </div>
                                      <div className="min-w-0">
                                        <div className="text-caption font-semibold truncate">{p.name}</div>
                                        <div className="text-caption text-slate-400 truncate font-mono">
                                          {PROVIDER_SHORT_LABELS[p.providerType]} · {p.apiUrl || '未填地址'}
                                        </div>
                                      </div>
                                    </div>

                                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                                      <button
                                        onClick={(e) => handleDuplicateProfile(e, p)}
                                        className="w-7 h-7 rounded-lg hover:bg-black/[0.06] dark:hover:bg-white/[0.1] flex items-center justify-center text-slate-500 hover:text-slate-900 dark:hover:text-white cursor-pointer"
                                        title="复制此配置"
                                      >
                                        <Copy className="w-3.5 h-3.5" />
                                      </button>
                                      {profiles.length > 1 && (
                                        <button
                                          onClick={(e) => handleDeleteProfile(e, p.id)}
                                          className="w-7 h-7 rounded-lg hover:bg-rose-500/10 flex items-center justify-center text-slate-400 hover:text-rose-600 cursor-pointer"
                                          title="删除此配置"
                                        >
                                          <Trash2 className="w-3.5 h-3.5" />
                                        </button>
                                      )}
                                    </div>
                                  </div>
                                );
                              })}
                            </div>

                            <div className="pt-1 border-t border-black/[0.05] dark:border-white/[0.06]">
                              <button
                                onClick={handleStartNewProfile}
                                className="w-full px-3 py-2 rounded-xl text-caption font-semibold text-slate-900 dark:text-white hover:bg-black/[0.04] dark:hover:bg-white/[0.06] flex items-center gap-2 transition cursor-pointer"
                              >
                                <Plus className="w-4 h-4" />
                                <span>新增空白 API 配置</span>
                              </button>
                            </div>
                          </div>
                        )}
                      </div>

                      {/* Prominent "+ 新增 API" Pill */}
                      <button
                        type="button"
                        onClick={handleStartNewProfile}
                        className="h-11 px-5 rounded-full bg-black text-white dark:bg-white dark:text-black font-semibold text-caption flex items-center gap-1.5 hover:opacity-90 active:scale-[0.98] transition cursor-pointer shadow-sm shrink-0 whitespace-nowrap"
                      >
                        <Plus className="w-4 h-4 stroke-[2.2]" />
                        <span>新增 API</span>
                      </button>
                    </div>

                    {/* New Mode Notice Strip + Quick link to Relay Node */}
                    {isCreatingNew && (
                      <div className="px-4 py-2.5 rounded-xl bg-amber-500/[0.08] border border-amber-500/20 flex flex-wrap items-center justify-between gap-2 text-caption text-amber-800 dark:text-amber-300">
                        <span>
                          当前处于<strong>「新建配置模式」</strong>：填完下方 3 步后点击右下角保存即可。
                        </span>
                        <div className="flex items-center gap-3 shrink-0">
                          {!showRelaySection && (
                            <button
                              type="button"
                              onClick={() => setShowRelaySection(true)}
                              className="text-caption font-semibold underline underline-offset-2 hover:opacity-80 cursor-pointer"
                            >
                              没有现成号？选用推荐高速节点 →
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={handleResetOrCancelNew}
                            className="text-caption font-semibold text-slate-600 dark:text-slate-300 hover:underline cursor-pointer"
                          >
                            取消新建
                          </button>
                        </div>
                      </div>
                    )}
                  </section>

                  {/* ZONE B: 精选推荐中转节点（默认折叠，仅保留 1 个紧凑横向节点） */}
                  <section className="rounded-2xl bg-white dark:bg-[#141620] border border-black/[0.06] dark:border-white/[0.07] overflow-hidden">
                    <button
                      type="button"
                      onClick={() => setShowRelaySection(!showRelaySection)}
                      className="w-full px-4 py-2.5 flex items-center justify-between text-left hover:bg-black/[0.015] dark:hover:bg-white/[0.02] transition cursor-pointer"
                    >
                      <div className="flex items-center gap-2 text-caption">
                        <Zap className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                        <span className="font-medium text-slate-700 dark:text-slate-200">
                          还没有 API 密钥？展开查看推荐高速中转节点（买完可一键填入）
                        </span>
                      </div>
                      <ChevronDown
                        className={`w-4 h-4 text-slate-400 shrink-0 transition-transform ${
                          showRelaySection ? 'rotate-180' : ''
                        }`}
                      />
                    </button>

                    {showRelaySection && (
                      <div className="px-4 pb-4 pt-3 border-t border-black/[0.04] dark:border-white/[0.05]">
                        <div className="p-3.5 rounded-xl bg-[#f8f9fc] dark:bg-white/[0.03] border border-black/[0.05] dark:border-white/[0.06] flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                          <div className="space-y-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="text-body font-bold text-slate-900 dark:text-white">
                                {FEATURED_RELAY_NODE.name}
                              </span>
                              <span className="text-caption font-medium text-amber-600 dark:text-amber-400">
                                · {FEATURED_RELAY_NODE.badge}
                              </span>
                              <span className="text-caption font-mono text-slate-400">
                                · {FEATURED_RELAY_NODE.priceHint}
                              </span>
                            </div>
                            <p className="text-caption text-slate-500 dark:text-slate-400 leading-relaxed">
                              {FEATURED_RELAY_NODE.highlight}
                            </p>
                          </div>

                          <div className="flex items-center gap-2 shrink-0">
                            <a
                              href={FEATURED_RELAY_NODE.registerUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="h-8 px-3 rounded-full border border-black/[0.12] dark:border-white/[0.14] bg-white dark:bg-[#1a1d2a] hover:bg-slate-50 dark:hover:bg-white/[0.06] text-slate-800 dark:text-slate-200 text-caption font-medium flex items-center gap-1 transition whitespace-nowrap"
                            >
                              <span>去注册/购买</span>
                              <ExternalLink className="w-3 h-3" />
                            </a>
                            <button
                              type="button"
                              onClick={() => handleApplyRelayPreset(FEATURED_RELAY_NODE)}
                              className="h-8 px-3.5 rounded-full bg-black text-white dark:bg-white dark:text-black text-caption font-semibold hover:opacity-90 active:scale-[0.98] transition cursor-pointer whitespace-nowrap"
                            >
                              一键填入配置
                            </button>
                          </div>
                        </div>
                      </div>
                    )}
                  </section>

                  {/* ZONE C: 小白向「1 → 2 → 3」引导流 */}
                  <div className="rounded-2xl bg-white dark:bg-[#141620] border border-black/[0.06] dark:border-white/[0.07] soft-card-shadow divide-y divide-black/[0.05] dark:divide-white/[0.06]">
                    {/* STEP 1: 服务地址与名称 */}
                    <div className="p-5 space-y-4">
                      <div className="flex items-start gap-3">
                        <span className="w-6 h-6 rounded-full bg-black text-white dark:bg-white dark:text-black text-caption font-bold flex items-center justify-center shrink-0 mt-0.5 tabular-nums">
                          1
                        </span>
                        <div className="space-y-0.5">
                          <h5 className="text-body font-bold text-slate-900 dark:text-white">
                            第 1 步 · 填写配置名称与接口地址
                          </h5>
                          <p className="text-caption text-slate-500 dark:text-slate-400 leading-relaxed">
                            起个好记的名字。若用中转站，类型保持默认「OpenAI 兼容接口」，将后台提供的 API 网址粘贴进下方即可。
                          </p>
                        </div>
                      </div>

                      <div className="pl-9 space-y-3.5">
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                          <div className="space-y-1.5">
                            <label className="text-caption font-medium text-slate-700 dark:text-slate-300">
                              配置名称
                            </label>
                            <input
                              type="text"
                              value={draft.name}
                              onChange={(e) => setDraft({ ...draft, name: e.target.value })}
                              placeholder="例如：特惠 API / 常用节点"
                              className="w-full h-10 px-3.5 rounded-xl border border-black/[0.08] dark:border-white/[0.1] bg-[#f8f9fc] dark:bg-[#1a1d2a] text-caption text-slate-900 dark:text-white outline-none focus:border-black/40 dark:focus:border-white/40 transition"
                            />
                          </div>

                          <div className="space-y-1.5">
                            <label className="text-caption font-medium text-slate-700 dark:text-slate-300">
                              服务商类型（一般保持默认）
                            </label>
                            <select
                              value={draft.providerType}
                              onChange={(e) =>
                                setDraft({
                                  ...draft,
                                  providerType: e.target.value as ApiProfile['providerType'],
                                })
                              }
                              className="w-full h-10 px-3 rounded-xl border border-black/[0.08] dark:border-white/[0.1] bg-[#f8f9fc] dark:bg-[#1a1d2a] text-caption text-slate-900 dark:text-white outline-none cursor-pointer focus:border-black/40 dark:focus:border-white/40 transition"
                            >
                              {Object.entries(PROVIDER_LABELS).map(([k, label]) => (
                                <option key={k} value={k}>
                                  {label}
                                </option>
                              ))}
                            </select>
                          </div>
                        </div>

                        <div className="space-y-1.5">
                          <label className="text-caption font-medium text-slate-700 dark:text-slate-300">
                            API 地址（URL）
                          </label>
                          <input
                            type="text"
                            value={draft.apiUrl}
                            onChange={(e) => setDraft({ ...draft, apiUrl: e.target.value })}
                            onBlur={(e) => {
                              const cleaned = sanitizeUrl(e.target.value);
                              if (cleaned !== draft.apiUrl) {
                                setDraft({ ...draft, apiUrl: cleaned });
                              }
                            }}
                            placeholder="https://api.tehui.xyz/v1"
                            className="w-full h-10 px-3.5 rounded-xl border border-black/[0.08] dark:border-white/[0.1] bg-[#f8f9fc] dark:bg-[#1a1d2a] font-mono text-caption text-slate-900 dark:text-white outline-none focus:border-black/40 dark:focus:border-white/40 transition"
                          />
                        </div>
                      </div>
                    </div>

                    {/* STEP 2: 粘贴 Key 并测试获取可用模型 */}
                    <div className="p-5 space-y-4">
                      <div className="flex items-start gap-3">
                        <span className="w-6 h-6 rounded-full bg-black text-white dark:bg-white dark:text-black text-caption font-bold flex items-center justify-center shrink-0 mt-0.5 tabular-nums">
                          2
                        </span>
                        <div className="space-y-0.5">
                          <h5 className="text-body font-bold text-slate-900 dark:text-white">
                            第 2 步 · 粘贴 API Key 并测试获取模型
                          </h5>
                          <p className="text-caption text-slate-500 dark:text-slate-400 leading-relaxed">
                            去中转站后台「令牌 / API Key」复制 <code className="font-mono text-slate-700 dark:text-slate-200">sk-</code> 开头的密钥粘贴到下面，点击<strong>「测试连接并获取模型」</strong>。
                          </p>
                        </div>
                      </div>

                      <div className="pl-9 space-y-3">
                        {relayImportHint && (
                          <div className="px-3.5 py-2.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-caption text-emerald-700 dark:text-emerald-300 font-medium">
                            {relayImportHint}
                          </div>
                        )}

                        <div className="flex flex-col sm:flex-row gap-2.5">
                          <div className="relative flex-1">
                            <input
                              ref={apiKeyInputRef}
                              type={showApiKey ? 'text' : 'password'}
                              value={draft.apiKey}
                              onChange={(e) => setDraft({ ...draft, apiKey: e.target.value })}
                              onBlur={(e) => {
                                const trimmed = e.target.value.trim();
                                if (trimmed !== draft.apiKey) {
                                  setDraft({ ...draft, apiKey: trimmed });
                                }
                              }}
                              placeholder="在此粘贴 sk- 开头的密钥..."
                              className="w-full h-10 pl-3.5 pr-20 rounded-xl border border-black/[0.08] dark:border-white/[0.1] bg-[#f8f9fc] dark:bg-[#1a1d2a] font-mono text-caption text-slate-900 dark:text-white outline-none focus:border-black/50 dark:focus:border-white/50 focus:ring-2 focus:ring-black/[0.06] dark:focus:ring-white/[0.08] transition"
                            />
                            <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1">
                              <button
                                type="button"
                                onClick={handlePasteApiKey}
                                className="px-2 py-1 rounded-md text-caption font-medium text-slate-500 hover:text-slate-900 dark:hover:text-white hover:bg-black/[0.05] dark:hover:bg-white/[0.08] flex items-center gap-1 cursor-pointer transition"
                                title="从剪贴板粘贴"
                              >
                                <ClipboardPaste className="w-3 h-3" />
                                <span>粘贴</span>
                              </button>
                              <button
                                type="button"
                                onClick={() => setShowApiKey(!showApiKey)}
                                className="w-7 h-7 rounded-md text-slate-400 hover:text-slate-700 dark:hover:text-white flex items-center justify-center cursor-pointer transition"
                                title={showApiKey ? '隐藏密钥' : '显示密钥'}
                              >
                                {showApiKey ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                              </button>
                            </div>
                          </div>

                          <button
                            type="button"
                            onClick={handleTestAndFetchModels}
                            disabled={isTesting}
                            className="h-10 px-4 rounded-xl bg-black text-white dark:bg-white dark:text-black hover:opacity-90 text-caption font-semibold transition cursor-pointer shrink-0 disabled:opacity-50 whitespace-nowrap"
                          >
                            {isTesting ? '检测并拉取中...' : '测试连接并获取模型'}
                          </button>
                        </div>

                        {testResult.status !== 'idle' && (
                          <div
                            className={`px-3.5 py-2.5 rounded-xl text-caption flex items-center gap-2 ${
                              testResult.status === 'success'
                                ? 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400'
                                : 'bg-rose-500/10 text-rose-600 dark:text-rose-400'
                            }`}
                          >
                            {testResult.status === 'success' ? (
                              <CheckCircle2 className="w-4 h-4 shrink-0" />
                            ) : (
                              <AlertCircle className="w-4 h-4 shrink-0" />
                            )}
                            <span>{testResult.message}</span>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* STEP 3: 点选加入画图模型（免手输）与保存提示 */}
                    <div className="p-5 space-y-4" ref={step3Ref}>
                      <div className="flex items-start gap-3">
                        <span className="w-6 h-6 rounded-full bg-black text-white dark:bg-white dark:text-black text-caption font-bold flex items-center justify-center shrink-0 mt-0.5 tabular-nums">
                          3
                        </span>
                        <div className="space-y-0.5">
                          <h5 className="text-body font-bold text-slate-900 dark:text-white">
                            第 3 步 · 点选要使用的画图模型，并点右下角保存
                          </h5>
                          <p className="text-caption text-slate-500 dark:text-slate-400 leading-relaxed">
                            上面展示已启用的模型（首页直接可选）；测试连接后下方会自动列出该节点支持的可用模型，<strong>点一下即可加入，不用手动敲字</strong>。最后请点击右下角黑色<strong>「保存此配置」</strong>。
                          </p>
                        </div>
                      </div>

                      <div className="pl-9 space-y-4">
                        {/* 上半区：已加入使用的画图模型 */}
                        <div className="space-y-2">
                          <div className="flex items-center justify-between text-caption">
                            <span className="font-semibold text-slate-700 dark:text-slate-200">
                              已加入使用的画图模型（{draft.models.length} 个）
                            </span>
                            {draft.models.length > 0 && (
                              <button
                                type="button"
                                onClick={() => setDraft({ ...draft, models: [] })}
                                className="text-slate-400 hover:text-rose-600 text-caption cursor-pointer"
                              >
                                清空已选
                              </button>
                            )}
                          </div>

                          {draft.models.length === 0 ? (
                            <div className="px-3.5 py-2.5 rounded-xl bg-[#f8f9fc] dark:bg-white/[0.03] border border-dashed border-black/15 dark:border-white/15 text-caption text-slate-400">
                              暂未加入模型：请点击上方「测试连接并获取模型」，然后从下方列表点选加入。
                            </div>
                          ) : (
                            <div className="flex flex-wrap gap-2">
                              {draft.models.map((m) => (
                                <span
                                  key={m}
                                  className="inline-flex items-center gap-1.5 h-7.5 pl-3 pr-2 rounded-full bg-black text-white dark:bg-white dark:text-black text-caption font-mono font-medium"
                                >
                                  <span>{m}</span>
                                  <button
                                    type="button"
                                    onClick={() => handleToggleModel(m)}
                                    className="w-4 h-4 rounded-full hover:bg-white/20 dark:hover:bg-black/15 flex items-center justify-center cursor-pointer"
                                    title="移除该模型"
                                  >
                                    <X className="w-3 h-3" />
                                  </button>
                                </span>
                              ))}
                            </div>
                          )}
                        </div>

                        {/* 下半区：测试拉取到的可用模型池 */}
                        <div className="p-3.5 rounded-xl bg-[#f8f9fc] dark:bg-white/[0.03] border border-black/[0.05] dark:border-white/[0.06] space-y-3">
                          {discoveredModels.length === 0 ? (
                            <div className="flex items-center justify-between gap-3">
                              <span className="text-caption text-slate-500 dark:text-slate-400">
                                点击第 2 步「测试连接并获取模型」后，可用画图模型将自动出现在这里供点选加入。
                              </span>
                              <button
                                type="button"
                                onClick={handleTestAndFetchModels}
                                disabled={isTesting}
                                className="text-caption font-semibold text-slate-900 dark:text-white underline underline-offset-2 shrink-0 cursor-pointer"
                              >
                                立即拉取
                              </button>
                            </div>
                          ) : (
                            <>
                              <div className="flex flex-wrap items-center justify-between gap-2">
                                <div className="flex items-center gap-2 flex-1 min-w-[160px]">
                                  <div className="relative flex-1 max-w-[200px]">
                                    <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
                                    <input
                                      type="text"
                                      value={modelSearchQuery}
                                      onChange={(e) => setModelSearchQuery(e.target.value)}
                                      placeholder="搜索拉取到的模型..."
                                      className="w-full h-7 pl-7 pr-2 rounded-lg border border-black/[0.08] dark:border-white/[0.1] bg-white dark:bg-[#161822] text-caption outline-none"
                                    />
                                  </div>
                                  <MonoCheckbox
                                    checked={showAllDiscovered}
                                    onChange={setShowAllDiscovered}
                                    label="含非画图模型"
                                  />
                                </div>

                                <button
                                  type="button"
                                  onClick={handleSelectAllImageModels}
                                  className="h-7 px-2.5 rounded-lg bg-white dark:bg-[#1a1d2a] border border-black/[0.1] dark:border-white/[0.12] hover:border-black/30 text-caption font-semibold text-slate-800 dark:text-slate-200 cursor-pointer transition whitespace-nowrap"
                                >
                                  一键全选画图模型
                                </button>
                              </div>

                              <div className="flex flex-wrap gap-2 max-h-40 overflow-y-auto pt-0.5">
                                {visibleDiscoveredModels.map((item) => {
                                  const added = draft.models.includes(item.id);
                                  return (
                                    <button
                                      key={item.id}
                                      type="button"
                                      onClick={() => handleToggleModel(item.id)}
                                      className={`h-7.5 px-3 rounded-lg text-caption font-mono flex items-center gap-1.5 border transition cursor-pointer ${
                                        added
                                          ? 'bg-black/[0.07] dark:bg-white/[0.14] border-black/25 dark:border-white/30 text-slate-900 dark:text-white font-semibold'
                                          : 'bg-white dark:bg-[#161822] border-black/[0.07] dark:border-white/[0.08] text-slate-600 dark:text-slate-300 hover:border-black/25 dark:hover:border-white/25'
                                      }`}
                                    >
                                      <span>{added ? '✓' : '+'}</span>
                                      <span>{item.id}</span>
                                      {item.tag && (
                                        <span className="text-micro font-sans text-slate-400">
                                          · {item.tag}
                                        </span>
                                      )}
                                    </button>
                                  );
                                })}
                              </div>
                            </>
                          )}

                          {/* 兜底手动补充入口 */}
                          <div className="pt-2 border-t border-black/[0.04] dark:border-white/[0.05] flex items-center justify-between gap-2">
                            {!showManualModelInput ? (
                              <button
                                type="button"
                                onClick={() => setShowManualModelInput(true)}
                                className="text-caption text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 cursor-pointer"
                              >
                                + 列表中没有想要的冷门模型？点击手动补充 ID
                              </button>
                            ) : (
                              <div className="flex items-center gap-2 w-full">
                                <input
                                  type="text"
                                  value={manualModelInput}
                                  onChange={(e) => setManualModelInput(e.target.value)}
                                  onKeyDown={(e) => {
                                    if (e.key === 'Enter') {
                                      e.preventDefault();
                                      handleAddManualModel();
                                    }
                                  }}
                                  placeholder="输入自定义模型 ID 后回车..."
                                  className="flex-1 h-7.5 px-2.5 rounded-lg border border-black/[0.1] dark:border-white/[0.12] bg-white dark:bg-[#161822] font-mono text-caption outline-none"
                                  autoFocus
                                />
                                <button
                                  type="button"
                                  onClick={handleAddManualModel}
                                  className="h-7.5 px-3 rounded-lg bg-black text-white dark:bg-white dark:text-black text-caption font-semibold cursor-pointer"
                                >
                                  加入
                                </button>
                                <button
                                  type="button"
                                  onClick={() => setShowManualModelInput(false)}
                                  className="text-caption text-slate-400 hover:text-slate-600 px-1.5 cursor-pointer"
                                >
                                  取消
                                </button>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* ZONE D: 高级与专业参数（默认折叠） */}
                  <section className="rounded-2xl bg-white dark:bg-[#141620] border border-black/[0.06] dark:border-white/[0.07] overflow-hidden">
                    <button
                      type="button"
                      onClick={() => setShowAdvancedApi(!showAdvancedApi)}
                      className="w-full px-5 py-3.5 flex items-center justify-between text-left hover:bg-black/[0.015] dark:hover:bg-white/[0.02] transition cursor-pointer"
                    >
                      <div>
                        <span className="text-caption font-semibold text-slate-800 dark:text-slate-200">
                          高级与专业参数（新手无需修改）
                        </span>
                        <span className="text-caption text-slate-400 ml-2.5">
                          接口模式 · 流式传输 · .ppconfig 文件导入导出
                        </span>
                      </div>
                      <ChevronDown
                        className={`w-4 h-4 text-slate-400 transition-transform ${
                          showAdvancedApi ? 'rotate-180' : ''
                        }`}
                      />
                    </button>

                    {showAdvancedApi && (
                      <div className="px-5 pb-5 pt-4 border-t border-black/[0.05] dark:border-white/[0.06] space-y-4 text-caption">
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                          <div className="space-y-1.5">
                            <label className="font-medium text-slate-700 dark:text-slate-300">
                              API 接口模式
                            </label>
                            <select
                              value={draft.apiMode}
                              onChange={(e) =>
                                setDraft({ ...draft, apiMode: e.target.value as 'images' | 'responses' })
                              }
                              className="w-full h-9 px-3 rounded-xl border border-black/[0.08] dark:border-white/[0.1] bg-[#f8f9fc] dark:bg-[#1a1d2a] text-caption outline-none cursor-pointer"
                            >
                              <option value="images">Images API (/v1/images)</option>
                              <option value="responses">Responses API (/v1/responses)</option>
                            </select>
                          </div>

                          <div className="space-y-1.5">
                            <label className="font-medium text-slate-700 dark:text-slate-300">
                              请求超时上限（秒）
                            </label>
                            <input
                              type="number"
                              min={15}
                              max={600}
                              value={draft.timeoutSec}
                              onChange={(e) =>
                                setDraft({ ...draft, timeoutSec: Number(e.target.value) || 120 })
                              }
                              className="w-full h-9 px-3 rounded-xl border border-black/[0.08] dark:border-white/[0.1] bg-[#f8f9fc] dark:bg-[#1a1d2a] font-mono text-caption outline-none tabular-nums"
                            />
                          </div>
                        </div>

                        <div className="flex items-center justify-between py-2 border-t border-black/[0.04] dark:border-white/[0.05]">
                          <div>
                            <div className="font-medium text-slate-800 dark:text-slate-200">
                              流式传输（Streaming）
                            </div>
                            <div className="text-caption text-slate-400">
                              开启后边生成边返回预览图，部分中转站不支持时请保持关闭
                            </div>
                          </div>
                          <MonoSwitch
                            checked={draft.streaming}
                            onChange={(val) => setDraft({ ...draft, streaming: val })}
                          />
                        </div>

                        {draft.streaming && (
                          <div className="flex items-center justify-between py-1">
                            <div>
                              <div className="font-medium text-slate-800 dark:text-slate-200">
                                请求中间步骤图像数（partial_images）
                              </div>
                              <div className="text-caption text-slate-400">
                                建议设为 1–2 张以保持连接心跳
                              </div>
                            </div>
                            <select
                              value={draft.partialImages}
                              onChange={(e) =>
                                setDraft({ ...draft, partialImages: Number(e.target.value) })
                              }
                              className="h-8 px-3 rounded-lg border border-black/[0.08] dark:border-white/[0.1] bg-[#f8f9fc] dark:bg-[#1a1d2a] font-mono text-caption outline-none cursor-pointer"
                            >
                              <option value={0}>0 张</option>
                              <option value={1}>1 张</option>
                              <option value={2}>2 张</option>
                              <option value={3}>3 张</option>
                            </select>
                          </div>
                        )}

                        <div className="pt-3 border-t border-black/[0.04] dark:border-white/[0.05] flex flex-wrap items-center justify-between gap-2">
                          <span className="text-caption text-slate-400">
                            支持 .ppconfig 配置文件或参数链接导入导出
                          </span>
                          <div className="flex items-center gap-2">
                            <input
                              ref={fileInputRef}
                              type="file"
                              accept=".ppconfig,.json"
                              onChange={handleFileUpload}
                              className="hidden"
                            />
                            <button
                              type="button"
                              onClick={() => fileInputRef.current?.click()}
                              className="h-8 px-3 rounded-lg border border-black/[0.1] dark:border-white/[0.12] hover:bg-black/[0.04] dark:hover:bg-white/[0.06] text-caption font-medium flex items-center gap-1.5 cursor-pointer transition"
                            >
                              <Upload className="w-3.5 h-3.5" />
                              <span>选择 .ppconfig 文件</span>
                            </button>
                            <button
                              type="button"
                              onClick={handleCopyShareLink}
                              className="h-8 px-3 rounded-lg border border-black/[0.1] dark:border-white/[0.12] hover:bg-black/[0.04] dark:hover:bg-white/[0.06] text-caption font-medium flex items-center gap-1.5 cursor-pointer transition"
                            >
                              <Copy className="w-3.5 h-3.5" />
                              <span>复制配置分享链接</span>
                            </button>
                          </div>
                        </div>
                      </div>
                    )}
                  </section>
                </div>
              )}

              {/* =====================================================================
                  TAB 2: 通用 (精简 2 卡片 + 默认折叠进阶运行设置)
                  ===================================================================== */}
              {activeTab === 'general' && (
                <div className="space-y-4">
                  {/* Card 1: 操作与输入习惯 */}
                  <section className="rounded-2xl bg-white dark:bg-[#141620] border border-black/[0.06] dark:border-white/[0.07] soft-card-shadow p-5 space-y-4">
                    <h4 className="text-body font-bold text-slate-900 dark:text-white">
                      操作与输入习惯
                    </h4>

                    <div className="flex items-center justify-between gap-4 pb-3.5 border-b border-black/[0.05] dark:border-white/[0.06]">
                      <div>
                        <div className="font-medium text-slate-800 dark:text-slate-200 text-caption">
                          任务提交快捷键
                        </div>
                        <div className="text-caption text-slate-400">
                          选择 Ctrl+Enter 时回车为换行；选择 Enter 时 Shift+Enter 为换行
                        </div>
                      </div>
                      <div className="flex items-center gap-1 p-1 rounded-full bg-[#f3f4f8] dark:bg-white/[0.06] shrink-0">
                        {[
                          { id: 'ctrl-enter', label: 'Ctrl + Enter' },
                          { id: 'enter', label: 'Enter' },
                        ].map((opt) => (
                          <button
                            key={opt.id}
                            type="button"
                            onClick={() => setSubmitShortcut(opt.id as 'ctrl-enter' | 'enter')}
                            className={`h-7 px-3 rounded-full text-caption font-medium transition cursor-pointer whitespace-nowrap ${
                              submitShortcut === opt.id
                                ? 'bg-black text-white dark:bg-white dark:text-black shadow-2xs'
                                : 'text-slate-500 hover:text-slate-900 dark:hover:text-white'
                            }`}
                          >
                            {opt.label}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div className="flex items-center justify-between gap-4 pb-3.5 border-b border-black/[0.05] dark:border-white/[0.06]">
                      <div>
                        <div className="font-medium text-slate-800 dark:text-slate-200 text-caption">
                          界面缩放比例
                        </div>
                        <div className="text-caption text-slate-400">
                          仅放大界面文字与按钮，不影响画布图片尺寸
                        </div>
                      </div>
                      <div className="flex items-center gap-1 p-1 rounded-full bg-[#f3f4f8] dark:bg-white/[0.06] shrink-0">
                        {(['100%', '110%', '125%', '150%'] as const).map((s) => (
                          <button
                            key={s}
                            type="button"
                            onClick={() => setUiScale(s)}
                            className={`h-7 px-2.5 rounded-full text-caption font-mono font-medium transition cursor-pointer ${
                              uiScale === s
                                ? 'bg-black text-white dark:bg-white dark:text-black shadow-2xs'
                                : 'text-slate-500 hover:text-slate-900 dark:hover:text-white'
                            }`}
                          >
                            {s}
                          </button>
                        ))}
                      </div>
                    </div>

                  </section>

                  {/* Card 2: 下载与通知 */}
                  <section className="rounded-2xl bg-white dark:bg-[#141620] border border-black/[0.06] dark:border-white/[0.07] soft-card-shadow p-5 space-y-4">
                    <h4 className="text-body font-bold text-slate-900 dark:text-white">
                      下载与通知
                    </h4>

                    <div className="flex items-center justify-between gap-4 pb-3.5 border-b border-black/[0.05] dark:border-white/[0.06]">
                      <div className="min-w-0">
                        <div className="font-medium text-slate-800 dark:text-slate-200 text-caption">
                          默认下载保存目录
                        </div>
                        <div className="text-caption font-mono text-slate-400 truncate mt-0.5">
                          {defaultDownloadPath}
                        </div>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <button
                          type="button"
                          onClick={() => void handleChangeDownloadDir()}
                          className="h-8 px-3 rounded-full bg-[#f3f4f8] dark:bg-white/[0.08] hover:bg-black hover:text-white dark:hover:bg-white dark:hover:text-black text-caption font-medium transition cursor-pointer"
                        >
                          更改
                        </button>
                        <button
                          type="button"
                          onClick={() => void handleOpenDownloadDir()}
                          className="h-8 px-3 rounded-full bg-[#f3f4f8] dark:bg-white/[0.08] hover:bg-black hover:text-white dark:hover:bg-white dark:hover:text-black text-caption font-medium transition cursor-pointer"
                        >
                          打开
                        </button>
                      </div>
                    </div>

                    <div className="flex items-center justify-between gap-4">
                      <div>
                        <div className="font-medium text-slate-800 dark:text-slate-200 text-caption">
                          任务完成或失败时发送系统通知
                        </div>
                        <div className="text-caption text-slate-400">
                          切到其他软件时也能及时收到出图完成提醒
                        </div>
                      </div>
                      <MonoSwitch
                        checked={Boolean(settings.taskCompletionNotification)}
                        onChange={() => void handleToggleFinishNotify()}
                      />
                    </div>
                  </section>

                  {/* Collapsible: 更多运行与隐私设置 */}
                  <section className="rounded-2xl bg-white dark:bg-[#141620] border border-black/[0.06] dark:border-white/[0.07] overflow-hidden">
                    <button
                      type="button"
                      onClick={() => setShowMoreGeneral(!showMoreGeneral)}
                      className="w-full px-5 py-3.5 flex items-center justify-between text-left hover:bg-black/[0.015] dark:hover:bg-white/[0.02] transition cursor-pointer"
                    >
                      <div>
                        <span className="text-caption font-semibold text-slate-800 dark:text-slate-200">
                          更多运行、网络与隐私设置
                        </span>
                        <span className="text-caption text-slate-400 ml-2.5">
                          并发数 · 重试规则 · 网络代理 · 隐私快捷键
                        </span>
                      </div>
                      <ChevronDown
                        className={`w-4 h-4 text-slate-400 transition-transform ${
                          showMoreGeneral ? 'rotate-180' : ''
                        }`}
                      />
                    </button>

                    {showMoreGeneral && (
                      <div className="px-5 pb-5 pt-4 border-t border-black/[0.05] dark:border-white/[0.06] space-y-4 text-caption">
                        <div className="flex items-center justify-between">
                          <div>
                            <div className="font-medium text-slate-800 dark:text-slate-200">
                              连续提交并发数
                            </div>
                            <div className="text-caption text-slate-400">
                              同时执行的生图任务上限，调整后即启用并发限制
                            </div>
                          </div>
                          <div className="flex items-center gap-2 px-3 py-1 rounded-full bg-[#f3f4f8] dark:bg-white/[0.08] font-mono tabular-nums">
                            <button
                              type="button"
                              onClick={() => setConcurrency(Math.max(1, concurrency - 1))}
                              className="px-1 text-slate-500 hover:text-black dark:hover:text-white cursor-pointer"
                            >
                              -
                            </button>
                            <span>{concurrency}</span>
                            <button
                              type="button"
                              onClick={() => setConcurrency(Math.min(10, concurrency + 1))}
                              className="px-1 text-slate-500 hover:text-black dark:hover:text-white cursor-pointer"
                            >
                              +
                            </button>
                          </div>
                        </div>

                        <div className="flex items-center justify-between">
                          <div>
                            <div className="font-medium text-slate-800 dark:text-slate-200">
                              重试任务方式
                            </div>
                            <div className="text-caption text-slate-400">
                              点击重新生成时，新建卡片还是覆盖原卡片
                            </div>
                          </div>
                          <select
                            value={settings.retryMode === 'new' ? 'new' : 'overwrite'}
                            onChange={(e) =>
                              setSettings({ retryMode: e.target.value === 'new' ? 'new' : 'overwriteAll' })
                            }
                            className="h-8 px-3 rounded-xl border border-black/[0.08] dark:border-white/[0.1] bg-[#f8f9fc] dark:bg-[#1a1d2a] outline-none cursor-pointer"
                          >
                            <option value="new">新建任务</option>
                            <option value="overwrite">覆盖原结果</option>
                          </select>
                        </div>

                        <div className="flex items-center justify-between">
                          <div>
                            <div className="font-medium text-slate-800 dark:text-slate-200">
                              允许模型优化改写提示词
                            </div>
                            <div className="text-caption text-slate-400">
                              关闭时严格按你输入的原词请求，不附加改写前缀
                            </div>
                          </div>
                          <MonoSwitch
                            checked={Boolean(settings.allowPromptRewrite)}
                            onChange={(value) => setSettings({ allowPromptRewrite: value })}
                          />
                        </div>

                        <div className="flex items-center justify-between">
                          <div>
                            <div className="font-medium text-slate-800 dark:text-slate-200">
                              网络代理
                            </div>
                            <div className="text-caption text-slate-400">
                              API 请求与检查更新所使用的网络通道
                            </div>
                          </div>
                          <select
                            value={networkProxy}
                            onChange={(e) => void handleProxyChange(e.target.value as 'system' | 'direct' | 'custom')}
                            className="h-8 px-3 rounded-xl border border-black/[0.08] dark:border-white/[0.1] bg-[#f8f9fc] dark:bg-[#1a1d2a] outline-none cursor-pointer"
                          >
                            <option value="system">跟随系统代理</option>
                            <option value="direct">直连（不用代理）</option>
                            <option value="custom">自定义端口</option>
                          </select>
                        </div>

                        <div className="flex items-center justify-between">
                          <div>
                            <div className="font-medium text-slate-800 dark:text-slate-200">
                              一键隐私遮罩快捷键
                            </div>
                            <div className="text-caption text-slate-400">
                              按下可瞬间隐藏历史记录与输入内容，再按一次恢复
                            </div>
                          </div>
                          <kbd className="px-3 py-1 rounded-lg bg-[#f3f4f8] dark:bg-white/[0.08] font-mono text-caption">
                            {settings.privacyModeShortcut || 'Ctrl + Shift + H'}
                          </kbd>
                        </div>
                      </div>
                    )}
                  </section>

                  {/* AI 工具集成：直接复用手头的 MCP 组件 */}
                  <section className="rounded-2xl bg-white dark:bg-[#141620] border border-black/[0.06] dark:border-white/[0.07] soft-card-shadow p-5 space-y-3">
                    <div>
                      <h4 className="text-body font-bold text-slate-900 dark:text-white">
                        AI 工具集成
                      </h4>
                      <p className="text-caption text-slate-400 mt-0.5">
                        本机 MCP 服务，与正式设置页共用同一份配置
                      </p>
                    </div>
                    {isTauri ? (
                      <McpSettingsSection />
                    ) : (
                      <p className="text-caption text-slate-400">MCP 服务仅在桌面端可用。</p>
                    )}
                  </section>
                </div>
              )}

              {/* =====================================================================
                  TAB 3: 外观 (三卡视觉切换 + 精简字体)
                  ===================================================================== */}
              {activeTab === 'appearance' && (
                <div className="space-y-4">
                  <section className="rounded-2xl bg-white dark:bg-[#141620] border border-black/[0.06] dark:border-white/[0.07] soft-card-shadow p-5 space-y-4">
                    <div>
                      <h4 className="text-body font-bold text-slate-900 dark:text-white">
                        颜色主题
                      </h4>
                      <p className="text-caption text-slate-400 mt-0.5">
                        选择「跟随系统」时，随操作系统浅色或深色模式自动切换
                      </p>
                    </div>

                    <div className="grid grid-cols-3 gap-3">
                      {[
                        { id: 'light', label: '浅色质感', desc: '温润暖灰底板', icon: Sun },
                        { id: 'dark', label: '黑曜石深色', desc: '专注夜间沉浸', icon: Moon },
                        { id: 'system', label: '跟随系统', desc: '自动同步切换', icon: Monitor },
                      ].map((opt) => {
                        const Icon = opt.icon;
                        const active = themePreference === opt.id;
                        return (
                          <button
                            key={opt.id}
                            type="button"
                            onClick={() => handleSelectTheme(opt.id as 'light' | 'dark' | 'system')}
                            className={`p-4 rounded-2xl border flex flex-col items-center justify-center gap-1.5 transition-all cursor-pointer ${
                              active
                                ? 'border-black dark:border-white bg-black text-white dark:bg-white dark:text-black shadow-sm'
                                : 'border-black/[0.08] dark:border-white/[0.1] bg-[#f8f9fc] dark:bg-white/[0.03] text-slate-600 dark:text-slate-300 hover:border-black/25 dark:hover:border-white/25'
                            }`}
                          >
                            <Icon className="w-4.5 h-4.5 stroke-[1.8]" />
                            <span className="text-caption font-semibold mt-0.5">{opt.label}</span>
                            <span
                              className={`text-micro ${
                                active ? 'opacity-75' : 'text-slate-400'
                              }`}
                            >
                              {opt.desc}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  </section>

                  <section className="rounded-2xl bg-white dark:bg-[#141620] border border-black/[0.06] dark:border-white/[0.07] soft-card-shadow p-5 space-y-3">
                    <div className="flex items-center justify-between gap-4">
                      <div>
                        <h4 className="text-body font-bold text-slate-900 dark:text-white">
                          界面字体
                        </h4>
                        <p className="text-caption text-slate-400 mt-0.5">
                          内置思源黑体针对高分屏已做清晰度优化，也可切换回系统默认字体
                        </p>
                      </div>

                      <div className="flex items-center gap-1 p-1 rounded-full bg-[#f3f4f8] dark:bg-white/[0.06] shrink-0">
                        {[
                          { id: 'builtin', label: '内置字体' },
                          { id: 'system', label: '系统字体' },
                        ].map((opt) => (
                          <button
                            key={opt.id}
                            type="button"
                            onClick={() => setUiFontMode(opt.id as 'builtin' | 'system')}
                            className={`h-7 px-3.5 rounded-full text-caption font-medium transition cursor-pointer whitespace-nowrap ${
                              uiFontMode === opt.id
                                ? 'bg-black text-white dark:bg-white dark:text-black shadow-2xs'
                                : 'text-slate-500 hover:text-slate-900 dark:hover:text-white'
                            }`}
                          >
                            {opt.label}
                          </button>
                        ))}
                      </div>
                    </div>
                  </section>
                </div>
              )}

              {/* =====================================================================
                  TAB 4: 数据 (全面去蓝去杂色，统一黑白暖灰触感)
                  ===================================================================== */}
              {activeTab === 'data' && (
                <div className="space-y-4">
                  {/* 本地存储：复用正式设置页的数据目录组件 */}
                  {isTauri ? (
                    <StorageInfoSection key={storageVersion} />
                  ) : (
                    <p className="text-caption text-slate-400">存储信息仅在桌面端可见。</p>
                  )}

                  {/* 导入导出并排卡片（纯黑白勾选框） */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <section className="rounded-2xl bg-white dark:bg-[#141620] border border-black/[0.06] dark:border-white/[0.07] soft-card-shadow p-4 space-y-3 flex flex-col justify-between">
                      <div className="space-y-2.5">
                        <div className="flex items-center gap-2 text-body font-bold text-slate-900 dark:text-white">
                          <Download className="w-4 h-4 text-slate-500" />
                          <span>导出数据备份</span>
                        </div>
                        <p className="text-caption text-slate-400 leading-relaxed">
                          备份将自动分卷保存，默认不含敏感 API Key。
                        </p>
                        <div className="flex flex-col gap-2 pt-1">
                          <MonoCheckbox
                            checked={exportIncludeConfig}
                            onChange={setExportIncludeConfig}
                            label="包含配置（不含 API Key）"
                          />
                          <MonoCheckbox
                            checked={exportIncludeTasks}
                            onChange={setExportIncludeTasks}
                            label="包含任务和图片"
                          />
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => void handleExportData()}
                        className="w-full h-9 rounded-full bg-[#f3f4f8] dark:bg-white/[0.08] hover:bg-black hover:text-white dark:hover:bg-white dark:hover:text-black text-caption font-semibold transition cursor-pointer"
                      >
                        导出所选数据
                      </button>
                    </section>

                    <section className="rounded-2xl bg-white dark:bg-[#141620] border border-black/[0.06] dark:border-white/[0.07] soft-card-shadow p-4 space-y-3 flex flex-col justify-between">
                      <div className="space-y-2.5">
                        <div className="flex items-center gap-2 text-body font-bold text-slate-900 dark:text-white">
                          <Upload className="w-4 h-4 text-slate-500" />
                          <span>从 ZIP 恢复导入</span>
                        </div>
                        <p className="text-caption text-slate-400 leading-relaxed">
                          支持选择单个普通备份，或一次性选中全部分卷包。
                        </p>
                        <div className="flex flex-col gap-2 pt-1">
                          <MonoCheckbox
                            checked={importIncludeConfig}
                            onChange={setImportIncludeConfig}
                            label="包含配置"
                          />
                          <MonoCheckbox
                            checked={importIncludeTasks}
                            onChange={setImportIncludeTasks}
                            label="包含任务和图片"
                          />
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => importInputRef.current?.click()}
                        className="w-full h-9 rounded-full bg-[#f3f4f8] dark:bg-white/[0.08] hover:bg-black hover:text-white dark:hover:bg-white dark:hover:text-black text-caption font-semibold transition cursor-pointer"
                      >
                        从 ZIP 导入所选数据
                      </button>
                      <input
                        ref={importInputRef}
                        type="file"
                        accept=".zip"
                        multiple
                        className="hidden"
                        onChange={(e) => void handleImportData(e)}
                      />
                    </section>
                  </div>

                  {/* 克制高级感清除数据卡片（告别大块粉红背景） */}
                  <section className="rounded-2xl bg-white dark:bg-[#141620] border border-black/[0.06] dark:border-white/[0.07] p-4 flex flex-wrap items-center justify-between gap-3">
                    <div className="space-y-2">
                      <div className="flex items-center gap-2 text-caption font-bold text-rose-600 dark:text-rose-400">
                        <ShieldAlert className="w-4 h-4" />
                        <span>清除本地数据（不可逆操作）</span>
                      </div>
                      <div className="flex items-center gap-4">
                        <MonoCheckbox
                          checked={clearIncludeConfig}
                          onChange={setClearIncludeConfig}
                          label="包含配置"
                        />
                        <MonoCheckbox
                          checked={clearIncludeTasks}
                          onChange={setClearIncludeTasks}
                          label="包含任务和图片"
                        />
                      </div>
                      <p className="text-micro text-slate-400">
                        不包含技能库和保存的工作流；这两类数据请通过备份恢复或分别删除。
                      </p>
                    </div>

                    <button
                      type="button"
                      onClick={handleClearData}
                      disabled={!clearIncludeConfig && !clearIncludeTasks}
                      className="h-8.5 px-4 rounded-full border border-rose-500/30 text-rose-600 dark:text-rose-400 hover:bg-rose-500/10 text-caption font-semibold transition cursor-pointer disabled:opacity-50 disabled:cursor-default"
                    >
                      清空所选数据
                    </button>
                  </section>
                </div>
              )}

              {/* =====================================================================
                  TAB 5: 关于 (品牌名片化 + 精简列表 + 修正矛盾文案)
                  ===================================================================== */}
              {activeTab === 'about' && (
                <div className="space-y-4">
                  {/* 品牌名片卡 */}
                  <section className="rounded-2xl bg-white dark:bg-[#141620] border border-black/[0.06] dark:border-white/[0.07] soft-card-shadow p-5 flex items-center justify-between gap-4">
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 rounded-2xl bg-[#f3f4f8] dark:bg-white/[0.06] flex items-center justify-center shrink-0">
                        <AppLogo size={26} className="text-black dark:text-white" />
                      </div>
                      <div className="space-y-0.5">
                        <div className="flex items-center gap-2">
                          <h4 className="text-title font-bold text-slate-900 dark:text-white">
                            盼盼工作台
                          </h4>
                          <span className="text-caption font-mono text-slate-400 tabular-nums">
                            v{__APP_VERSION__}
                          </span>
                        </div>
                        <p className="text-caption text-slate-500 dark:text-slate-400">
                          开发者 盼盼盼2222 · 顺手的地方请留下，不顺手的地方欢迎随时反馈。
                        </p>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => {
                        void handleCheckUpdate();
                      }}
                      disabled={updateCheckStatus === 'checking'}
                      className="h-9 px-4 rounded-full bg-black text-white dark:bg-white dark:text-black text-caption font-semibold flex items-center gap-1.5 hover:opacity-90 transition cursor-pointer shrink-0 whitespace-nowrap disabled:opacity-60 disabled:cursor-default"
                    >
                      <RefreshCw
                        className={`w-3.5 h-3.5 ${updateCheckStatus === 'checking' ? 'animate-spin' : ''}`}
                      />
                      <span>
                        {updateCheckStatus === 'checking'
                          ? '检查中...'
                          : updateCheckStatus === 'latest'
                          ? '已是最新版本'
                          : updateCheckStatus === 'available'
                          ? '发现新版本'
                          : '检查更新'}
                      </span>
                    </button>
                  </section>

                  {updateCheckMessage && (
                    <p
                      className={`px-1 text-caption ${
                        updateCheckStatus === 'error' ? 'text-red-500' : 'text-slate-500 dark:text-slate-400'
                      }`}
                    >
                      {updateCheckMessage}
                    </p>
                  )}

                  {/* 精简支持与文档列表 */}
                  <section className="rounded-2xl bg-white dark:bg-[#141620] border border-black/[0.06] dark:border-white/[0.07] soft-card-shadow divide-y divide-black/[0.05] dark:divide-white/[0.06]">
                    <a
                      href="#guide"
                      onClick={(e) => {
                        e.preventDefault();
                        notifyUser('已在应用内准备好看图与 API 新手引导');
                      }}
                      className="px-5 py-3.5 flex items-center justify-between hover:bg-black/[0.015] dark:hover:bg-white/[0.02] transition"
                    >
                      <div className="flex items-center gap-3">
                        <BookOpen className="w-4 h-4 text-slate-400" />
                        <div>
                          <div className="text-caption font-semibold text-slate-800 dark:text-slate-200">
                            使用说明与常见问题
                          </div>
                          <div className="text-caption text-slate-400">
                            快速上手 API 配置、画布快捷键与参考图用法
                          </div>
                        </div>
                      </div>
                      <ExternalLink className="w-3.5 h-3.5 text-slate-400" />
                    </a>

                    <a
                      href="#feedback"
                      onClick={(e) => {
                        e.preventDefault();
                        notifyUser('请通过工作台联系渠道提交反馈建议');
                      }}
                      className="px-5 py-3.5 flex items-center justify-between hover:bg-black/[0.015] dark:hover:bg-white/[0.02] transition"
                    >
                      <div className="flex items-center gap-3">
                        <MessageSquare className="w-4 h-4 text-slate-400" />
                        <div>
                          <div className="text-caption font-semibold text-slate-800 dark:text-slate-200">
                            反馈问题与功能建议
                          </div>
                          <div className="text-caption text-slate-400">
                            提交 Bug 截图或期望新增的创作功能
                          </div>
                        </div>
                      </div>
                      <ExternalLink className="w-3.5 h-3.5 text-slate-400" />
                    </a>
                  </section>

                  {/* 开源许可（默认折叠详情） */}
                  <section className="rounded-2xl bg-white dark:bg-[#141620] border border-black/[0.06] dark:border-white/[0.07] overflow-hidden">
                    <button
                      type="button"
                      onClick={() => setShowLicenseDetails(!showLicenseDetails)}
                      className="w-full px-5 py-3 flex items-center justify-between text-left hover:bg-black/[0.015] dark:hover:bg-white/[0.02] transition cursor-pointer"
                    >
                      <span className="text-caption font-medium text-slate-600 dark:text-slate-300">
                        开源协议与第三方许可（MIT License）
                      </span>
                      <ChevronDown
                        className={`w-4 h-4 text-slate-400 transition-transform ${
                          showLicenseDetails ? 'rotate-180' : ''
                        }`}
                      />
                    </button>
                    {showLicenseDetails && (
                      <div className="px-5 pb-4 pt-2 border-t border-black/[0.04] dark:border-white/[0.05] text-caption text-slate-400 leading-relaxed">
                        本项目基于上游 MIT 许可协议继续开发，集成 Lucide Icons 与开源字体子集（SIL OFL 1.1），完整许可文本随安装包附带。
                      </div>
                    )}
                    <button
                      type="button"
                      onClick={() => setShowFontLicenses(true)}
                      className="w-full px-5 py-3 border-t border-black/[0.04] dark:border-white/[0.05] flex items-center justify-between text-left hover:bg-black/[0.015] dark:hover:bg-white/[0.02] transition cursor-pointer"
                    >
                      <span className="text-caption font-medium text-slate-600 dark:text-slate-300">
                        字体许可
                      </span>
                      <ExternalLink className="w-3.5 h-3.5 text-slate-400" />
                    </button>
                  </section>
                </div>
              )}
            </div>

            {/* =====================================================================
                STICKY BOTTOM ACTION FOOTER (含未保存防误关保护)
                ===================================================================== */}
            <div className="h-[60px] px-6 border-t border-black/[0.06] dark:border-white/[0.07] bg-white dark:bg-[#161822] flex items-center justify-between gap-4 shrink-0">
              {confirmCloseUnsaved && hasUnsavedChanges ? (
                <>
                  <span className="text-caption font-medium text-amber-600 dark:text-amber-400 flex items-center gap-2">
                    <AlertCircle className="w-4 h-4 shrink-0" />
                    <span>当前 API 配置有修改尚未保存，确定直接关闭吗？</span>
                  </span>
                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      type="button"
                      onClick={() => {
                        handleResetOrCancelNew();
                        onClose();
                      }}
                      className="h-8.5 px-3.5 rounded-full border border-black/[0.1] dark:border-white/[0.12] text-slate-600 dark:text-slate-300 text-caption font-medium hover:bg-black/5 cursor-pointer"
                    >
                      放弃并关闭
                    </button>
                    <button
                      type="button"
                      onClick={() => handleSaveProfile(true)}
                      className="h-8.5 px-4 rounded-full bg-black text-white dark:bg-white dark:text-black text-caption font-semibold hover:opacity-90 cursor-pointer"
                    >
                      保存并关闭
                    </button>
                  </div>
                </>
              ) : activeTab === 'api' ? (
                <>
                  <div className="flex items-center gap-2 text-caption min-w-0">
                    {saveFeedback === 'saved' ? (
                      <span className="flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400 font-medium">
                        <CheckCircle2 className="w-4 h-4 shrink-0" />
                        <span>已保存并立即生效！可在顶部下拉栏随时切换</span>
                      </span>
                    ) : hasUnsavedChanges ? (
                      <span className="flex items-center gap-2 text-amber-600 dark:text-amber-400 font-medium">
                        <span className="w-2 h-2 rounded-full bg-amber-500 shrink-0" />
                        <span className="truncate">
                          {isCreatingNew ? '正在新建配置，填写后请点击右侧保存' : '当前配置有修改尚未保存'}
                        </span>
                      </span>
                    ) : (
                      <span className="text-slate-400 truncate">
                        当前使用「{currentSavedProfile.name}」· 修改内容后点击右侧保存
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-2.5 shrink-0">
                    {hasUnsavedChanges && (
                      <button
                        type="button"
                        onClick={handleResetOrCancelNew}
                        className="h-9 px-3.5 rounded-full border border-black/[0.1] dark:border-white/[0.12] hover:bg-black/[0.04] dark:hover:bg-white/[0.06] text-slate-600 dark:text-slate-300 text-caption font-medium flex items-center gap-1.5 transition cursor-pointer whitespace-nowrap"
                      >
                        <RotateCcw className="w-3.5 h-3.5" />
                        <span>{isCreatingNew ? '取消新建' : '撤销修改'}</span>
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => handleSaveProfile(false)}
                      className="h-9 px-5 rounded-full bg-black text-white dark:bg-white dark:text-black hover:opacity-90 active:scale-[0.98] text-caption font-semibold flex items-center gap-1.5 transition cursor-pointer shadow-sm whitespace-nowrap"
                    >
                      <Save className="w-3.5 h-3.5" />
                      <span>{isCreatingNew ? '保存新增配置' : '保存此配置'}</span>
                    </button>
                  </div>
                </>
              ) : (
                <>
                  <span className="text-caption text-slate-400">当前页面偏好修改实时生效</span>
                  <button
                    type="button"
                    onClick={onClose}
                    className="h-9 px-5 rounded-full bg-black text-white dark:bg-white dark:text-black hover:opacity-90 text-caption font-semibold transition cursor-pointer"
                  >
                    完成
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* =========================================================================
          INLINE IMPORT MODAL (Share Link ?apiUrl=... or .ppconfig JSON)
          ========================================================================= */}
      {isImportModalOpen && (
        <div
          onClick={() => setIsImportModalOpen(false)}
          className="fixed inset-0 z-60 bg-black/35 backdrop-blur-xs flex items-center justify-center p-4"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-[480px] max-w-[94vw] rounded-2xl bg-white dark:bg-[#181b26] border border-black/10 dark:border-white/10 shadow-2xl p-5 space-y-4"
          >
            <div className="flex items-center justify-between">
              <h4 className="text-body font-bold text-slate-900 dark:text-white">
                粘贴配置链接或 .ppconfig 内容导入
              </h4>
              <button
                onClick={() => setIsImportModalOpen(false)}
                className="w-7 h-7 rounded-full hover:bg-black/5 dark:hover:bg-white/10 flex items-center justify-center text-slate-400 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <p className="text-caption text-slate-500 dark:text-slate-400 leading-relaxed">
              可直接粘贴服务商分享的参数链接（含 <code className="font-mono">?apiUrl=...</code>），或选择本地 <code className="font-mono">.ppconfig</code> 文件。
            </p>
            <textarea
              rows={4}
              value={importText}
              onChange={(e) => setImportText(e.target.value)}
              placeholder="在此粘贴配置链接（如 panpan://import?apiUrl=https://...&apiKey=sk-...）或 JSON 内容..."
              className="w-full p-3 rounded-xl border border-black/10 dark:border-white/10 bg-[#f8f9fc] dark:bg-[#10121a] font-mono text-caption outline-none resize-none"
            />
            {importError && (
              <div className="text-caption text-rose-500 flex items-center gap-1.5">
                <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                <span>{importError}</span>
              </div>
            )}
            <div className="flex items-center justify-between pt-1">
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="text-caption font-medium text-slate-600 dark:text-slate-300 hover:underline flex items-center gap-1.5 cursor-pointer"
              >
                <Upload className="w-3.5 h-3.5" />
                <span>从本地文件读取</span>
              </button>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setIsImportModalOpen(false)}
                  className="h-8 px-3.5 rounded-full text-caption text-slate-500 hover:bg-black/5 dark:hover:bg-white/5 cursor-pointer"
                >
                  取消
                </button>
                <button
                  type="button"
                  onClick={handleParseImportPayload}
                  className="h-8 px-4 rounded-full bg-black text-white dark:bg-white dark:text-black text-caption font-semibold cursor-pointer hover:opacity-90"
                >
                  解析并填入
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {showFontLicenses && (
        <FontLicensesModal scrollBoundaryRef={modalRef} onClose={() => setShowFontLicenses(false)} />
      )}
    </div>
  );
};
