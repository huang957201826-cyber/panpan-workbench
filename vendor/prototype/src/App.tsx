import React, { useState, useEffect, useRef, useCallback } from 'react';
import { TitleBar } from './components/TitleBar.tsx';
import { AppSidebar } from './components/AppSidebar.tsx';
import { InfiniteCanvas } from './components/InfiniteCanvas.tsx';
import { CardGridView } from './components/CardGridView.tsx';
import { BottomPromptBar } from './components/BottomPromptBar.tsx';
import { RightGeneratorDrawer } from './components/RightGeneratorDrawer.tsx';
import { ComfySidebar } from './components/ComfySidebar.tsx';
import { ComfyWorkflowView } from './components/ComfyWorkflowView.tsx';
import { WorkflowGalleryView } from './components/WorkflowGalleryView.tsx';
import { SkillHubView } from './components/SkillHubView.tsx';
import { HomeHubView } from './components/HomeHubView.tsx';
import { Taskbar } from './components/Taskbar.tsx';
import { SettingsModal } from './components/SettingsModal.tsx';
import {
  ActiveActivity,
  Artboard,
  GenerationParams,
  ProjectFolder,
  ProjectScheme,
  ReferenceImage,
  SkillItem,
  WorkflowHistoryRecord,
  WorkflowPreset,
  WorkflowProject,
  WorkflowToolId,
  WorkflowCategoryId,
} from './types.ts';
import { INITIAL_PROJECT_FOLDERS, INITIAL_REFERENCE_IMAGES } from './constants.ts';
import { INITIAL_WORKFLOW_PROJECTS, MOCK_WORKFLOW_PRESETS } from './data/mockWorkflows.ts';
import { MOCK_SKILLS } from './data/mockSkills.ts';
import { Monitor, Trash2 } from 'lucide-react';

export default function App() {
  // Theme state: Default to Light Theme
  const [isDark, setIsDark] = useState(false);

  // REAL DESKTOP FLOATING WINDOW GEOMETRY & RESIZING STATE
  const [isMaximized, setIsMaximized] = useState(false);
  const [isMinimized, setIsMinimized] = useState(false);
  const [windowSize, setWindowSize] = useState({ width: 1240, height: 760 });
  const [windowPos, setWindowPos] = useState({ x: 45, y: 20 });

  // Window drag movement state
  const [isDraggingWindow, setIsDraggingWindow] = useState(false);
  const dragStartOffsetRef = useRef({ x: 0, y: 0 });

  // Window border resizing state ('e' | 's' | 'se' | null)
  const [resizingWindowEdge, setResizingWindowEdge] = useState<'e' | 's' | 'se' | null>(null);
  const resizeStartGeomRef = useRef({ width: 1240, height: 760, clientX: 0, clientY: 0 });

  // Sidebar visibility & width
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [sidebarWidth, setSidebarWidth] = useState(230);

  // Active activity tab: 'home' | 'projects' | 'workflow' | 'skills'
  const [activeActivity, setActiveActivity] = useState<ActiveActivity>('home');

  // View Mode: 'canvas' (无限画布) | 'grid' (九宫格卡片)
  const [viewMode, setViewMode] = useState<'canvas' | 'grid'>('canvas');

  // Input Dock Position: 'bottom' (底部浮岛 HUD) | 'right' (右侧工作台 / Lovart 模式)
  const [inputDockPosition, setInputDockPosition] = useState<'bottom' | 'right'>('bottom');

  // Canvas interaction preference: Wheel directly zooms vs pans
  const [wheelZoomDirect, setWheelZoomDirect] = useState(true);

  // Project Folders & Schemes
  const [folders, setFolders] = useState<ProjectFolder[]>(INITIAL_PROJECT_FOLDERS);
  const [activeFolderId, setActiveFolderId] = useState(INITIAL_PROJECT_FOLDERS[0]?.id || 'folder-1');
  const [activeSchemeId, setActiveSchemeId] = useState(
    INITIAL_PROJECT_FOLDERS[0]?.schemes[0]?.id || 'scheme-1'
  );

  // Current scheme
  const currentScheme =
    folders
      .find((f) => f.id === activeFolderId)
      ?.schemes.find((s) => s.id === activeSchemeId) ||
    folders[0]?.schemes[0];

  const [prompt, setPrompt] = useState(currentScheme?.prompt || '');
  const [artboards, setArtboards] = useState<Artboard[]>(currentScheme?.artboards || []);
  const [selectedArtboardId, setSelectedArtboardId] = useState<string | null>(
    currentScheme?.artboards[0]?.id || null
  );
  const [focusArtboardId, setFocusArtboardId] = useState<string | null>(null);

  // Reference Images (Multi-modal prompting tray above the prompt box)
  const [referenceImages, setReferenceImages] = useState<ReferenceImage[]>(
    currentScheme?.referenceImages || INITIAL_REFERENCE_IMAGES
  );

  const [isGenerating, setIsGenerating] = useState(false);

  // Shared Generation Parameters (Synchronized between Bottom HUD and Right Drawer)
  const [generationParams, setGenerationParams] = useState<GenerationParams>({
    model: 'gpt-image-2.5',
    dimension: '2560×1440',
    quality: 'auto',
    count: 1,
    format: 'PNG',
    transparent: false,
    filter: 'auto',
    steps: 28,
    cfgScale: 7.0,
  });

  // Undo / Redo history
  const [history, setHistory] = useState<string[]>([currentScheme?.prompt || '']);
  const [historyIndex, setHistoryIndex] = useState(0);

  // Settings Modal
  const [isSettingsModalOpen, setIsSettingsModalOpen] = useState(false);

  // Level-1 Workflow Library Presets (persisted custom + starred presets in localStorage)
  const [workflowPresets, setWorkflowPresets] = useState<WorkflowPreset[]>(() => {
    try {
      const saved = localStorage.getItem('panpan_workflow_presets_v2');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch {
      // ignore
    }
    return MOCK_WORKFLOW_PRESETS;
  });
  const [activeWorkflowPresetId, setActiveWorkflowPresetId] = useState<string>(() => {
    try {
      const savedId = localStorage.getItem('panpan_active_workflow_preset_v2');
      if (savedId) return savedId;
    } catch {
      // ignore
    }
    return MOCK_WORKFLOW_PRESETS[0]?.id || 'wf-model-single';
  });

  useEffect(() => {
    try {
      localStorage.setItem('panpan_workflow_presets_v2', JSON.stringify(workflowPresets));
    } catch {
      // ignore
    }
  }, [workflowPresets]);

  useEffect(() => {
    try {
      localStorage.setItem('panpan_active_workflow_preset_v2', activeWorkflowPresetId);
    } catch {
      // ignore
    }
  }, [activeWorkflowPresetId]);

  // Level-2 Workflow Projects & History State (persisted in localStorage)
  const [workflowProjects, setWorkflowProjects] = useState<WorkflowProject[]>(() => {
    try {
      const saved = localStorage.getItem('panpan_workflow_projects_v1');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch {
      // ignore parse errors
    }
    return INITIAL_WORKFLOW_PROJECTS;
  });
  const [activeWorkflowProjectId, setActiveWorkflowProjectId] = useState<string>(() => {
    try {
      const savedId = localStorage.getItem('panpan_active_workflow_project_v1');
      if (savedId) return savedId;
    } catch {
      // ignore
    }
    return INITIAL_WORKFLOW_PROJECTS[0]?.id || 'wf-proj-1';
  });

  useEffect(() => {
    try {
      localStorage.setItem('panpan_workflow_projects_v1', JSON.stringify(workflowProjects));
    } catch {
      // ignore quota errors
    }
  }, [workflowProjects]);

  useEffect(() => {
    try {
      localStorage.setItem('panpan_active_workflow_project_v1', activeWorkflowProjectId);
    } catch {
      // ignore
    }
  }, [activeWorkflowProjectId]);

  const [workflowSubView, setWorkflowSubView] = useState<'gallery' | 'canvas'>('gallery');
  const [activeWorkflowCategory, setActiveWorkflowCategory] = useState<'all' | WorkflowCategoryId>('all');
  const [isWorkflowArchiveOpen, setIsWorkflowArchiveOpen] = useState(false);
  const [chainedWorkflowImage, setChainedWorkflowImage] = useState<string | null>(null);
  const [activeSkillCategory, setActiveSkillCategory] = useState<string>('all');

  // Shared Pure-Text Skills State (synced between AppSidebar counts and SkillHubView)
  const [customSkills, setCustomSkills] = useState<SkillItem[]>(() => {
    try {
      const saved = localStorage.getItem('panpan_custom_skills_v1');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) return parsed;
      }
    } catch {
      // ignore
    }
    return [];
  });
  const [skillFavoriteOverrides, setSkillFavoriteOverrides] = useState<Record<string, boolean>>(() => {
    try {
      const saved = localStorage.getItem('panpan_skill_favorites_v1');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed && typeof parsed === 'object') return parsed;
      }
    } catch {
      // ignore
    }
    return {};
  });

  useEffect(() => {
    try {
      localStorage.setItem('panpan_custom_skills_v1', JSON.stringify(customSkills));
    } catch {
      // ignore
    }
  }, [customSkills]);

  useEffect(() => {
    try {
      localStorage.setItem('panpan_skill_favorites_v1', JSON.stringify(skillFavoriteOverrides));
    } catch {
      // ignore
    }
  }, [skillFavoriteOverrides]);

  const allSkills: SkillItem[] = React.useMemo(() => {
    return [...customSkills, ...MOCK_SKILLS].map((s) =>
      skillFavoriteOverrides[s.id] !== undefined
        ? { ...s, isFavorite: skillFavoriteOverrides[s.id] }
        : s
    );
  }, [customSkills, skillFavoriteOverrides]);

  const handleConsumeChainedImage = useCallback(() => {
    setChainedWorkflowImage(null);
  }, []);

  // Toast feedback state
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 2500);
  };

  // Level-1 Workflow Gallery & Preset CRUD Handlers
  const handleEnterWorkflowFromGallery = (presetId: string) => {
    setActiveWorkflowPresetId(presetId);
    setWorkflowSubView('canvas');
  };

  const handleOverwriteCustomWorkflowPreset = (updated: WorkflowPreset) => {
    setWorkflowPresets((prev) => prev.map((p) => (p.id === updated.id ? updated : p)));
    showToast(`已覆盖保存「${updated.name}」`);
  };

  const handleSaveAsNewWorkflowPreset = (newPreset: WorkflowPreset) => {
    setWorkflowPresets((prev) => [newPreset, ...prev]);
    setActiveWorkflowPresetId(newPreset.id);
    showToast(`已保存至「本地已保存」：${newPreset.name}`);
  };

  const handleDuplicateWorkflowPreset = (preset: WorkflowPreset) => {
    const cloned: WorkflowPreset = {
      ...JSON.parse(JSON.stringify(preset)),
      id: `wf-custom-${Date.now()}`,
      name: `${preset.name} 副本`,
      category: 'custom',
      categoryLabel: '本地已保存',
      badge: '自存副本',
      isCustom: true,
    };
    setWorkflowPresets((prev) => [cloned, ...prev]);
    showToast(`已复制「${preset.name}」至本地已保存`);
  };

  const handleRenameWorkflowPreset = (presetId: string, newName: string) => {
    setWorkflowPresets((prev) =>
      prev.map((p) => (p.id === presetId ? { ...p, name: newName } : p))
    );
    showToast(`已重命名为「${newName}」`);
  };

  const handleDeleteWorkflowPreset = (presetId: string) => {
    setWorkflowPresets((prev) => {
      const remaining = prev.filter((p) => p.id !== presetId);
      if (activeWorkflowPresetId === presetId && remaining[0]) {
        setActiveWorkflowPresetId(remaining[0].id);
      }
      return remaining;
    });
    showToast('已删除该本地工作流');
  };

  const handleExportWorkflowPresetJson = (preset: WorkflowPreset) => {
    const payload = {
      name: preset.name,
      category: preset.category,
      description: preset.description,
      groups: preset.groups || [],
      nodes: preset.nodes,
      connections: preset.connections,
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${preset.name.replace(/\s+/g, '_')}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    showToast(`已导出工作流「${preset.name}.json」`);
  };

  const handleImportWorkflowJson = (imported: WorkflowPreset) => {
    setWorkflowPresets((prev) => [imported, ...prev]);
    setActiveWorkflowPresetId(imported.id);
    setWorkflowSubView('canvas');
    showToast(`已导入工作流「${imported.name}」至「本地已保存」`);
  };

  const handleChainWorkflowWithImage = (category: WorkflowToolId, imageUrl: string) => {
    const match =
      workflowPresets.find((p) => p.category === category && p.isStarred) ||
      workflowPresets.find((p) => p.category === category);
    if (match) {
      setActiveWorkflowPresetId(match.id);
      setChainedWorkflowImage(imageUrl);
      setWorkflowSubView('canvas');
      showToast(`已带入当前成果切换至「${match.name}」`);
    }
  };

  const handleReuseArchiveRecord = (record: WorkflowHistoryRecord) => {
    const targetPreset =
      (record.presetId && workflowPresets.find((p) => p.id === record.presetId)) ||
      workflowPresets.find((p) => p.category === record.toolId) ||
      workflowPresets[0];
    if (targetPreset) {
      setActiveWorkflowPresetId(targetPreset.id);
      setChainedWorkflowImage(record.outputUrl || record.inputUrl);
      setWorkflowSubView('canvas');
      showToast(`已载入「${record.title}」至工作流「${targetPreset.name}」`);
    }
  };

  // Level-2 Workflow Project & History Handlers
  const handleCreateWorkflowProject = (name: string) => {
    const newProj: WorkflowProject = {
      id: `wf-proj-${Date.now()}`,
      name,
      updatedAt: '刚刚',
      isStarred: false,
      records: [],
    };
    setWorkflowProjects((prev) => [newProj, ...prev]);
    setActiveWorkflowProjectId(newProj.id);
    showToast(`已新建归档项目「${name}」`);
  };

  const handleToggleStarWorkflowProject = (projectId: string) => {
    setWorkflowProjects((prev) =>
      prev.map((p) => (p.id === projectId ? { ...p, isStarred: !p.isStarred } : p))
    );
  };

  const handleAddWorkflowHistoryRecord = (projectId: string, record: WorkflowHistoryRecord) => {
    setWorkflowProjects((prev) =>
      prev.map((p) =>
        p.id === projectId
          ? { ...p, updatedAt: '刚刚', records: [record, ...p.records] }
          : p
      )
    );
  };

  const handleDeleteWorkflowHistoryRecord = (projectId: string, recordId: string) => {
    setWorkflowProjects((prev) =>
      prev.map((p) =>
        p.id === projectId
          ? { ...p, records: p.records.filter((r) => r.id !== recordId) }
          : p
      )
    );
    showToast('已删除该条工作流记录');
  };

  const handleSendWorkflowResultToCanvas = (record: WorkflowHistoryRecord) => {
    const newArtboardId = `artboard-wf-${Date.now()}`;
    const newArtboard: Artboard = {
      id: newArtboardId,
      title: `${record.toolLabel} · ${record.title}`,
      imageUrl: record.outputUrl,
      aspectRatio: '16:9',
      resolution: record.resolution || '2560 × 1440',
      model: `ComfyUI · ${record.toolLabel}`,
      renderTime: record.duration,
      x: 120 + ((artboards.length * 380) % 1200),
      y: 60 + Math.floor(artboards.length / 3) * 320,
      width: 700,
      height: 430,
      prompt: record.summary,
      createdAt: new Date().toLocaleString(),
      isStarred: false,
    };
    setArtboards((prev) => [newArtboard, ...prev]);
    setSelectedArtboardId(newArtboardId);
    setFocusArtboardId(newArtboardId);
    setViewMode('canvas');
    setActiveActivity('projects');
    showToast(`已将「${record.title}」存入空间画布`);
  };

  // Reorder reference images
  const handleReorderReferenceImages = (newOrder: ReferenceImage[]) => {
    const reindexed = newOrder.map((item, idx) => ({
      ...item,
      tagNumber: idx + 1,
    }));
    setReferenceImages(reindexed);
    showToast('已调整参考图顺序');
  };

  // Global Clipboard Paste: Ctrl+V / ⌘V directly creates reference image!
  useEffect(() => {
    const handlePaste = (e: ClipboardEvent) => {
      // Don't intercept if pasting plain text inside input or textarea
      const target = e.target as HTMLElement;
      const isInput = target && ['INPUT', 'TEXTAREA'].includes(target.tagName);
      const items = e.clipboardData?.items;
      if (!items) return;

      for (let i = 0; i < items.length; i++) {
        const item = items[i];
        if (item.type.indexOf('image') !== -1) {
          e.preventDefault();
          const blob = item.getAsFile();
          if (blob) {
            const reader = new FileReader();
            reader.onload = (event) => {
              if (event.target?.result) {
                const nextTag = referenceImages.length + 1;
                const newRef: ReferenceImage = {
                  id: `ref-paste-${Date.now()}`,
                  url: event.target.result as string,
                  name: `截图参考_${nextTag}`,
                  tagNumber: nextTag,
                  weight: 0.75,
                  role: 'ref',
                };
                setReferenceImages((prev) => [...prev, newRef]);
                showToast(`已从剪贴板添加参考图 @图${nextTag}`);
              }
            };
            reader.readAsDataURL(blob);
          }
          break;
        }
      }
    };
    window.addEventListener('paste', handlePaste);
    return () => window.removeEventListener('paste', handlePaste);
  }, [referenceImages.length]);

  // Sync document theme
  useEffect(() => {
    if (isDark) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [isDark]);

  const handleToggleTheme = () => {
    setIsDark(!isDark);
  };

  // Window Dragging across Desktop
  const handleTitleBarMouseDown = (e: React.MouseEvent) => {
    if (isMaximized) return;
    if ((e.target as HTMLElement)?.closest('button, input, select, textarea')) return;
    setIsDraggingWindow(true);
    dragStartOffsetRef.current = {
      x: e.clientX - windowPos.x,
      y: e.clientY - windowPos.y,
    };
  };

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (isDraggingWindow && !isMaximized) {
        setWindowPos({
          x: Math.max(10, Math.min(window.innerWidth - 300, e.clientX - dragStartOffsetRef.current.x)),
          y: Math.max(10, Math.min(window.innerHeight - 150, e.clientY - dragStartOffsetRef.current.y)),
        });
      } else if (resizingWindowEdge && !isMaximized) {
        const deltaX = e.clientX - resizeStartGeomRef.current.clientX;
        const deltaY = e.clientY - resizeStartGeomRef.current.clientY;

        setWindowSize((prev) => {
          let nextW = prev.width;
          let nextH = prev.height;

          if (resizingWindowEdge === 'e' || resizingWindowEdge === 'se') {
            nextW = Math.max(820, Math.min(window.innerWidth - 30, resizeStartGeomRef.current.width + deltaX));
          }
          if (resizingWindowEdge === 's' || resizingWindowEdge === 'se') {
            nextH = Math.max(520, Math.min(window.innerHeight - 60, resizeStartGeomRef.current.height + deltaY));
          }
          return { width: nextW, height: nextH };
        });
      }
    };

    const handleMouseUp = () => {
      setIsDraggingWindow(false);
      setResizingWindowEdge(null);
    };

    if (isDraggingWindow || resizingWindowEdge) {
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
      document.body.style.userSelect = 'none';
    }

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
      document.body.style.userSelect = '';
    };
  }, [isDraggingWindow, resizingWindowEdge, isMaximized]);

  // Switch Active Scheme
  const handleSelectScheme = (folderId: string, scheme: ProjectScheme) => {
    setActiveFolderId(folderId);
    setActiveSchemeId(scheme.id);
    setPrompt(scheme.prompt);
    setArtboards(scheme.artboards);
    setSelectedArtboardId(scheme.artboards[0]?.id || null);
    if (scheme.referenceImages) {
      setReferenceImages(scheme.referenceImages);
    }
    setHistory([scheme.prompt]);
    setHistoryIndex(0);
  };

  const handleToggleFolder = (folderId: string) => {
    setFolders((prev) =>
      prev.map((f) => (f.id === folderId ? { ...f, isExpanded: !f.isExpanded } : f))
    );
  };

  const handleNewFolder = () => {
    const newName = window.prompt('请输入新工作区文件夹名称', `工作区 0${folders.length + 1}`);
    if (!newName) return;
    const newFolder: ProjectFolder = {
      id: `folder-${Date.now()}`,
      name: newName,
      isExpanded: true,
      schemes: [],
    };
    setFolders([...folders, newFolder]);
    showToast(`已创建工作区「${newName}」`);
  };

  const handleNewScheme = (folderId?: string) => {
    const targetFolderId = folderId || activeFolderId;
    const newTitle = window.prompt('请输入新设计方案名称', `设计方案 ${Date.now().toString().slice(-4)}`);
    if (!newTitle) return;

    const newScheme: ProjectScheme = {
      id: `scheme-${Date.now()}`,
      title: newTitle,
      prompt: '在下方输入此方案的构想描述，输入 @图1 即可引用参考图...',
      updatedAt: '今天 刚刚',
      params: {
        model: 'gpt-image-2.5',
        dimension: '2560×1440',
        quality: 'auto',
        count: 1,
        format: 'PNG',
        transparent: false,
        filter: 'auto',
      },
      artboards: [
        {
          id: `artboard-${Date.now()}`,
          title: newTitle,
          imageUrl: artboards[0]?.imageUrl || '',
          aspectRatio: '16:9',
          resolution: '2560 × 1440',
          model: 'gpt-image-2.5',
          renderTime: '2.4s',
          x: 80,
          y: 40,
          width: 700,
          height: 430,
        },
      ],
      referenceImages: INITIAL_REFERENCE_IMAGES.slice(0, 2),
    };

    setFolders((prev) =>
      prev.map((f) =>
        f.id === targetFolderId
          ? { ...f, isExpanded: true, schemes: [newScheme, ...f.schemes] }
          : f
      )
    );
    handleSelectScheme(targetFolderId, newScheme);
    showToast(`已新建方案「${newTitle}」`);
  };

  // Undo / Redo
  const pushHistory = (newPrompt: string) => {
    const updated = history.slice(0, historyIndex + 1);
    updated.push(newPrompt);
    setHistory(updated);
    setHistoryIndex(updated.length - 1);
  };

  const handlePromptChange = (val: string) => {
    setPrompt(val);
  };

  const handleUndo = () => {
    if (historyIndex > 0) {
      const nextIdx = historyIndex - 1;
      setHistoryIndex(nextIdx);
      setPrompt(history[nextIdx]);
    }
  };

  const handleRedo = () => {
    if (historyIndex < history.length - 1) {
      const nextIdx = historyIndex + 1;
      setHistoryIndex(nextIdx);
      setPrompt(history[nextIdx]);
    }
  };

  const handleClearPrompt = () => {
    pushHistory('');
    setPrompt('');
  };

  const handleCopyConfig = () => {
    const configStr = JSON.stringify(
      {
        prompt,
        model: 'gpt-image-2.5',
        dimension: '2560×1440',
        referenceCount: referenceImages.length,
      },
      null,
      2
    );
    navigator.clipboard.writeText(configStr);
    showToast('已成功复制当前方案参数配置到剪贴板！');
  };

  const handleUpdateArtboard = (updated: Artboard) => {
    setArtboards((prev) =>
      prev.map((item) => (item.id === updated.id ? updated : item))
    );
    setFolders((prevFolders) =>
      prevFolders.map((folder) => {
        if (folder.id !== activeFolderId) return folder;
        return {
          ...folder,
          schemes: folder.schemes.map((s) => {
            if (s.id !== activeSchemeId) return s;
            return {
              ...s,
              artboards: s.artboards.map((a) => (a.id === updated.id ? updated : a)),
            };
          }),
        };
      })
    );
  };

  const handleDeleteArtboard = (id: string) => {
    setArtboards((prev) => prev.filter((item) => item.id !== id));
    showToast('已从画布移除图片');
  };

  // Reference Image Management
  const handleAddReferenceImage = (image: ReferenceImage) => {
    setReferenceImages((prev) => [...prev, image]);
    showToast(`已添加参考图「${image.name}」作为 @图${image.tagNumber}`);
  };

  const handleRemoveReferenceImage = (id: string) => {
    setReferenceImages((prev) => {
      const remaining = prev.filter((r) => r.id !== id);
      // Re-index tag numbers sequentially
      return remaining.map((r, idx) => ({ ...r, tagNumber: idx + 1 }));
    });
  };

  const handleClearReferenceImages = () => {
    setReferenceImages([]);
    showToast('已清空底栏全部参考图');
  };

  const handleUpdateReferenceWeight = (id: string, weight: number) => {
    setReferenceImages((prev) =>
      prev.map((r) => (r.id === id ? { ...r, weight } : r))
    );
  };

  // Set any artboard from canvas/grid as reference
  const handleSetAsReference = (artboard: Artboard) => {
    const newTagNum = referenceImages.length + 1;
    const newRef: ReferenceImage = {
      id: `ref-${Date.now()}`,
      url: artboard.imageUrl,
      name: artboard.title,
      tagNumber: newTagNum,
      weight: 0.8,
      role: 'structure',
    };
    setReferenceImages((prev) => [...prev, newRef]);
    showToast(`已将「${artboard.title}」添加为 @图${newTagNum}`);
  };

  // Recall artboard prompt and settings (复用配置)
  const handleRecallPrompt = (artboard: Artboard) => {
    if (artboard.prompt) {
      setPrompt(artboard.prompt);
      pushHistory(artboard.prompt);
    }
    if (artboard.model) {
      setGenerationParams((prev) => ({
        ...prev,
        model: artboard.model,
        dimension: artboard.resolution || prev.dimension,
      }));
    }
    showToast(`已复用「${artboard.title.split('·')[0].trim()}」全部生图配置`);
  };

  // Toggle artboard star status (收藏)
  const handleToggleStar = (artboardId: string) => {
    setArtboards((prev) =>
      prev.map((a) => (a.id === artboardId ? { ...a, isStarred: !a.isStarred } : a))
    );
    showToast('已更新收藏状态');
  };

  const handleToggleSkillFavorite = (skillId: string) => {
    const target = allSkills.find((s) => s.id === skillId);
    if (!target) return;
    const nextFav = !target.isFavorite;
    if (skillId.startsWith('skill-custom-')) {
      setCustomSkills((prev) =>
        prev.map((s) => (s.id === skillId ? { ...s, isFavorite: nextFav } : s))
      );
    } else {
      setSkillFavoriteOverrides((prev) => ({ ...prev, [skillId]: nextFav }));
    }
  };

  const handleCreateCustomSkill = (skill: SkillItem) => {
    setCustomSkills((prev) => [skill, ...prev]);
    showToast(`已新建技能「${skill.title}」`);
  };

  const handleDeleteCustomSkill = (skillId: string) => {
    setCustomSkills((prev) => prev.filter((s) => s.id !== skillId));
    showToast('已删除自建技能');
  };

  // Handle Skill Application from Module 3 (Skill Hub)
  const handleApplySkill = (
    skill: SkillItem,
    customizedPrompt: string,
    mode: 'replace' | 'append' = 'replace'
  ) => {
    const nextPrompt =
      mode === 'append'
        ? prompt.trim()
          ? `${prompt.trim()}, ${customizedPrompt}`
          : customizedPrompt
        : customizedPrompt;
    setPrompt(nextPrompt);
    pushHistory(nextPrompt);
    if (skill.suggestedParams) {
      setGenerationParams((prev) => ({
        ...prev,
        ...skill.suggestedParams,
      }));
    }
    setActiveActivity('projects');
    showToast(
      mode === 'append'
        ? `已追加技能「${skill.title}」至当前提示词`
        : `已替换为技能「${skill.title}」并同步至工作区`
    );
  };

  // Generation Action: Synchronous to both Canvas and Grid View
  const handleGenerate = (promptText: string, params: GenerationParams) => {
    setIsGenerating(true);
    pushHistory(promptText);

    setTimeout(() => {
      setIsGenerating(false);

      const renderSecs = (2.1 + Math.random() * 0.8).toFixed(1);
      const newArtboardId = `artboard-${Date.now()}`;
      const newArtboard: Artboard = {
        id: newArtboardId,
        title: `20261104-生图${artboards.length + 1} · ${currentScheme?.title || '新设计方案'}`,
        imageUrl: artboards[0]?.imageUrl || '',
        aspectRatio: '16:9',
        resolution: params.dimension,
        model: params.model,
        renderTime: `${renderSecs}s`,
        x: 120 + ((artboards.length * 380) % 1200),
        y: 60 + Math.floor(artboards.length / 3) * 320,
        width: 700,
        height: 430,
        prompt: promptText,
        seed: Math.floor(Math.random() * 900000000),
        quality: params.quality,
        format: params.format?.toLowerCase() || 'png',
        transparent: params.transparent,
        filter: params.filter,
        count: params.count,
        createdAt: new Date().toLocaleString(),
        duration: `00:${Math.floor(25 + Math.random() * 25)}`,
        taskId: `tsk${Date.now().toString(36)}`,
        imageId: `img${Math.random().toString(36).slice(2)}${Math.random().toString(36).slice(2)}`,
        isStarred: false,
        referenceImages: referenceImages.slice(),
      };

      setArtboards((prev) => [newArtboard, ...prev]);
      setSelectedArtboardId(newArtboardId);
      showToast(`渲染成功 · 耗时 ${renderSecs}s`);
    }, 1500);
  };

  const handleRegenerateArtboard = (artboard: Artboard) => {
    handleGenerate(prompt || artboard.prompt || '', {
      model: artboard.model,
      dimension: artboard.resolution,
      quality: 'auto',
      count: 1,
      format: 'PNG',
      transparent: false,
      filter: 'auto',
    });
  };

  const handleSendToCanvas = (artboard: Artboard) => {
    setArtboards((prev) => [artboard, ...prev.filter((a) => a.id !== artboard.id)]);
    setSelectedArtboardId(artboard.id);
    setViewMode('canvas');
    showToast(`已置顶「${artboard.title}」为主画板`);
  };

  return (
    <div className="h-screen w-screen overflow-hidden apple-wallpaper text-slate-800 dark:text-slate-100 font-sans select-none relative transition-colors duration-200">
      {/* 1. WINDOWS 11 DESKTOP ICONS (4px rhythm: 48px icons) */}
      <div className="absolute top-4 left-4 flex flex-col gap-4 z-0 pointer-events-auto opacity-75">
        <div
          onClick={() => setIsSettingsModalOpen(true)}
          className="flex flex-col items-center gap-1 w-16 p-1.5 rounded-xl hover:bg-black/5 dark:hover:bg-white/10 cursor-pointer transition group"
          title="此电脑 (查看本地存储与配置)"
        >
          <div className="w-10 h-10 rounded-xl bg-blue-500/20 border border-blue-400/30 flex items-center justify-center text-blue-600 dark:text-blue-300 group-hover:scale-105 transition-transform shadow-2xs">
            <Monitor className="w-5 h-5 stroke-[1.8]" />
          </div>
          <span className="text-[11px] text-slate-700 dark:text-slate-200 drop-shadow-xs font-medium">此电脑</span>
        </div>

        <div
          onClick={() => setArtboards(currentScheme?.artboards || [])}
          className="flex flex-col items-center gap-1 w-16 p-1.5 rounded-xl hover:bg-black/5 dark:hover:bg-white/10 cursor-pointer transition group"
          title="回收站"
        >
          <div className="w-10 h-10 rounded-xl bg-emerald-500/20 border border-emerald-400/30 flex items-center justify-center text-emerald-600 dark:text-emerald-300 group-hover:scale-105 transition-transform shadow-2xs">
            <Trash2 className="w-5 h-5 stroke-[1.8]" />
          </div>
          <span className="text-[11px] text-slate-700 dark:text-slate-200 drop-shadow-xs font-medium">回收站</span>
        </div>
      </div>

      {/* 2. REAL FLOATING DESKTOP WINDOW CONTAINER */}
      <div
        style={
          isMaximized
            ? { top: 0, left: 0, width: '100%', height: 'calc(100vh - 56px)', transform: 'none' }
            : {
                top: `${windowPos.y}px`,
                left: `${windowPos.x}px`,
                width: `${windowSize.width}px`,
                height: `${windowSize.height}px`,
              }
        }
        className={`fixed z-20 win-acrylic flex flex-col overflow-hidden transition-all duration-75 border border-black/10 dark:border-white/10 ${
          isMinimized
            ? 'opacity-0 scale-90 pointer-events-none'
            : isMaximized
            ? 'rounded-none'
            : 'rounded-xl shadow-2xl'
        }`}
      >
        {/* TitleBar: 36px Native Title Bar with Right View Switcher & Title Only in Center */}
        <TitleBar
          currentProjectTitle={currentScheme?.title || '未命名设计方案'}
          folders={folders}
          activeFolderId={activeFolderId}
          activeSchemeId={activeSchemeId}
          onSelectScheme={handleSelectScheme}
          onNewScheme={handleNewScheme}
          onNewFolder={handleNewFolder}
          canUndo={historyIndex > 0}
          canRedo={historyIndex < history.length - 1}
          onUndo={handleUndo}
          onRedo={handleRedo}
          onClearPrompt={handleClearPrompt}
          onCopyConfig={handleCopyConfig}
          isMaximized={isMaximized}
          onToggleMaximize={() => setIsMaximized(!isMaximized)}
          onMinimize={() => setIsMinimized(true)}
          onClose={() => setIsMinimized(true)}
          onOpenSettings={() => setIsSettingsModalOpen(true)}
          isSidebarCollapsed={isSidebarCollapsed}
          onToggleSidebar={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
          onTitleBarMouseDown={handleTitleBarMouseDown}
        />

        {/* WORKSPACE FLEX WRAPPER */}
        <div className="relative flex-1 w-full flex overflow-hidden">
          {/* Dual-tier Activity Rail (44px) + Collapsible Drawer (230px) */}
          <AppSidebar
            folders={folders}
            activeFolderId={activeFolderId}
            activeSchemeId={activeSchemeId}
            onSelectScheme={handleSelectScheme}
            onToggleFolder={handleToggleFolder}
            onNewScheme={handleNewScheme}
            onNewFolder={handleNewFolder}
            activeActivity={activeActivity}
            onSelectActivity={setActiveActivity}
            workflowSubView={workflowSubView}
            workflowPresets={workflowPresets}
            activeWorkflowCategory={activeWorkflowCategory}
            onSelectWorkflowCategory={setActiveWorkflowCategory}
            archiveRecordCount={workflowProjects.reduce((sum, p) => sum + p.records.length, 0)}
            onOpenArchiveDrawer={() => setIsWorkflowArchiveOpen(true)}
            skills={allSkills}
            activeSkillCategory={activeSkillCategory}
            onSelectSkillCategory={setActiveSkillCategory}
            onOpenSettings={() => setIsSettingsModalOpen(true)}
            isCollapsed={isSidebarCollapsed}
            onToggleCollapse={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
            width={sidebarWidth}
            onWidthChange={setSidebarWidth}
          />

          {/* Right Main Content Area: Horizontal Stage + Optional Lovart Right Studio */}
          <div className="flex-1 flex flex-row h-full overflow-hidden relative">
            {/* Center Canvas / Grid Stage (Infinite canvas dot grid extends 100% to bottom) */}
            <div className="relative flex-1 h-full w-full overflow-hidden">
              {/* Module 0: 首页灵感中心 (MiyaAI / Coders Home Hub) */}
              {activeActivity === 'home' ? (
                <HomeHubView
                  onGeneratePrompt={(promptText, model) => {
                    setPrompt(promptText);
                    const newParams = model ? { ...generationParams, model } : generationParams;
                    if (model) {
                      setGenerationParams(newParams);
                    }
                    setActiveActivity('projects');
                    handleGenerate(promptText, newParams);
                  }}
                  onOpenArtboard={(artboard) => {
                    setSelectedArtboardId(artboard.id);
                    setFocusArtboardId(artboard.id);
                    setActiveActivity('projects');
                  }}
                  onNavigateToProjects={() => setActiveActivity('projects')}
                  isGenerating={isGenerating}
                />
              ) : activeActivity === 'workflow' || activeActivity === 'engine' ? (
                workflowSubView === 'gallery' ? (
                  /* Stage 1: Visual Workflow Plaza Gallery (Unified Left Sidebar + Before/After Cards) */
                  <WorkflowGalleryView
                    presets={workflowPresets}
                    onSelectPreset={handleEnterWorkflowFromGallery}
                    onImportPresetJson={handleImportWorkflowJson}
                    onDuplicatePreset={handleDuplicateWorkflowPreset}
                    onRenamePreset={handleRenameWorkflowPreset}
                    onDeletePreset={handleDeleteWorkflowPreset}
                    onExportPresetJson={handleExportWorkflowPresetJson}
                    activeCategory={activeWorkflowCategory}
                    onSelectCategory={setActiveWorkflowCategory}
                    isArchiveDrawerOpen={isWorkflowArchiveOpen}
                    onToggleArchiveDrawer={setIsWorkflowArchiveOpen}
                    isSidebarCollapsed={isSidebarCollapsed}
                    onToggleSidebar={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
                    workflowProjects={workflowProjects}
                    activeWorkflowProjectId={activeWorkflowProjectId}
                    onSelectWorkflowProject={setActiveWorkflowProjectId}
                    onCreateWorkflowProject={handleCreateWorkflowProject}
                    onToggleStarWorkflowProject={handleToggleStarWorkflowProject}
                    onDeleteHistoryRecord={handleDeleteWorkflowHistoryRecord}
                    onSendToCanvas={handleSendWorkflowResultToCanvas}
                    onReuseRecord={handleReuseArchiveRecord}
                  />
                ) : (
                  /* Stage 2: Clean 4-Group ComfyUI Battery Canvas (Full-Width) */
                  <ComfyWorkflowView
                    activePreset={
                      workflowPresets.find((p) => p.id === activeWorkflowPresetId) ||
                      workflowPresets[0]
                    }
                    workflowProjects={workflowProjects}
                    activeProjectId={activeWorkflowProjectId}
                    onSelectProject={setActiveWorkflowProjectId}
                    onCreateProject={handleCreateWorkflowProject}
                    onBackToGallery={() => setWorkflowSubView('gallery')}
                    onSaveAsNewPreset={handleSaveAsNewWorkflowPreset}
                    onOverwriteCustomPreset={handleOverwriteCustomWorkflowPreset}
                    onSelectToolCategory={handleChainWorkflowWithImage}
                    onAddHistoryRecord={handleAddWorkflowHistoryRecord}
                    onDeleteHistoryRecord={handleDeleteWorkflowHistoryRecord}
                    onSendToCanvas={handleSendWorkflowResultToCanvas}
                    canvasArtboards={artboards}
                    chainedInputImageUrl={chainedWorkflowImage}
                    onConsumeChainedImage={handleConsumeChainedImage}
                    onQueueComplete={(msg) => {
                      showToast(msg);
                    }}
                  />
                )
              ) : activeActivity === 'skills' || activeActivity === 'models' ? (
                /* Module 3: 纯文提示词技能库 */
                <SkillHubView
                  skills={allSkills}
                  onApplySkill={handleApplySkill}
                  onToggleFavorite={handleToggleSkillFavorite}
                  onCreateSkill={handleCreateCustomSkill}
                  onDeleteSkill={handleDeleteCustomSkill}
                  activeCategory={activeSkillCategory}
                  onSelectCategory={setActiveSkillCategory}
                  isSidebarCollapsed={isSidebarCollapsed}
                  onToggleSidebar={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
                />
              ) : viewMode === 'grid' ? (
                /* View Mode B: 九宫格卡片流矩阵 */
                <div className="relative w-full h-full overflow-hidden">
                  <CardGridView
                    artboards={artboards}
                    currentScheme={currentScheme}
                    onSendToCanvas={handleSendToCanvas}
                    onSetAsReference={handleSetAsReference}
                    onRecallPrompt={handleRecallPrompt}
                    onDeleteArtboard={handleDeleteArtboard}
                    onToggleStar={handleToggleStar}
                    isGenerating={isGenerating}
                    viewMode={viewMode}
                    onSelectViewMode={setViewMode}
                  />

                  {/* Floating Frosted Glass Bottom HUD (Seamlessly floating over dot canvas) */}
                  {inputDockPosition === 'bottom' && (
                    <div className="absolute bottom-1.5 left-0 right-0 z-30 pointer-events-none flex justify-center">
                      <BottomPromptBar
                        prompt={prompt}
                        onPromptChange={handlePromptChange}
                        onGenerate={handleGenerate}
                        isGenerating={isGenerating}
                        referenceImages={referenceImages}
                        onAddReferenceImage={handleAddReferenceImage}
                        onRemoveReferenceImage={handleRemoveReferenceImage}
                        onClearReferenceImages={handleClearReferenceImages}
                        onUpdateReferenceWeight={handleUpdateReferenceWeight}
                        onReorderReferenceImages={handleReorderReferenceImages}
                        params={generationParams}
                        onParamsChange={setGenerationParams}
                        onDockRight={() => setInputDockPosition('right')}
                      />
                    </div>
                  )}
                </div>
              ) : (
                /* View Mode A: 无限画布 (Dot grid extends seamlessly to all boundaries) */
                <div className="relative w-full h-full overflow-hidden">
                  <InfiniteCanvas
                    artboards={artboards}
                    onUpdateArtboard={handleUpdateArtboard}
                    onRegenerateArtboard={handleRegenerateArtboard}
                    isGenerating={isGenerating}
                    selectedArtboardId={selectedArtboardId}
                    onSelectArtboard={setSelectedArtboardId}
                    focusArtboardId={focusArtboardId}
                    onClearFocus={() => setFocusArtboardId(null)}
                    wheelZoomDirect={wheelZoomDirect}
                    onSetAsReference={handleSetAsReference}
                    onRecallPrompt={handleRecallPrompt}
                    onDeleteArtboard={handleDeleteArtboard}
                    onToggleStar={handleToggleStar}
                    viewMode={viewMode}
                    onSelectViewMode={setViewMode}
                    isRightDockOpen={inputDockPosition === 'right'}
                    schemes={folders.find((f) => f.id === activeFolderId)?.schemes || []}
                    activeSchemeId={activeSchemeId}
                    onSelectScheme={(scheme) => handleSelectScheme(activeFolderId, scheme)}
                    onNewScheme={() => handleNewScheme(activeFolderId)}
                    isSidebarCollapsed={isSidebarCollapsed}
                    onToggleSidebar={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
                  />

                  {/* Floating Frosted Glass Bottom HUD (Seamlessly floating over dot canvas) */}
                  {inputDockPosition === 'bottom' && (
                    <div className="absolute bottom-1.5 left-0 right-0 z-30 pointer-events-none flex justify-center">
                      <BottomPromptBar
                        prompt={prompt}
                        onPromptChange={handlePromptChange}
                        onGenerate={handleGenerate}
                        isGenerating={isGenerating}
                        referenceImages={referenceImages}
                        onAddReferenceImage={handleAddReferenceImage}
                        onRemoveReferenceImage={handleRemoveReferenceImage}
                        onClearReferenceImages={handleClearReferenceImages}
                        onUpdateReferenceWeight={handleUpdateReferenceWeight}
                        onReorderReferenceImages={handleReorderReferenceImages}
                        params={generationParams}
                        onParamsChange={setGenerationParams}
                        onDockRight={() => setInputDockPosition('right')}
                      />
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Lovart-Style Right Generator & History Feed Drawer */}
            {inputDockPosition === 'right' && activeActivity === 'projects' && (
              <RightGeneratorDrawer
                prompt={prompt}
                onPromptChange={handlePromptChange}
                onGenerate={handleGenerate}
                isGenerating={isGenerating}
                referenceImages={referenceImages}
                onAddReferenceImage={handleAddReferenceImage}
                onRemoveReferenceImage={handleRemoveReferenceImage}
                onClearReferenceImages={handleClearReferenceImages}
                onUpdateReferenceWeight={handleUpdateReferenceWeight}
                onReorderReferenceImages={handleReorderReferenceImages}
                params={generationParams}
                onParamsChange={setGenerationParams}
                artboards={artboards}
                selectedArtboardId={selectedArtboardId}
                onSelectArtboard={setSelectedArtboardId}
                onFocusArtboard={(id: string) => {
                  setSelectedArtboardId(id);
                  setFocusArtboardId(id);
                  setViewMode('canvas');
                }}
                onSetAsReference={handleSetAsReference}
                onRecallPrompt={handleRecallPrompt}
                onCloseOrDockBottom={() => setInputDockPosition('bottom')}
              />
            )}
          </div>
        </div>

        {/* WINDOW RESIZE BORDER HANDLES (When not maximized) */}
        {!isMaximized && (
          <>
            <div
              onMouseDown={(e) => {
                e.preventDefault();
                setResizingWindowEdge('e');
                resizeStartGeomRef.current = {
                  width: windowSize.width,
                  height: windowSize.height,
                  clientX: e.clientX,
                  clientY: e.clientY,
                };
              }}
              className="absolute top-0 right-0 w-2 h-full cursor-e-resize hover:bg-black/10 dark:hover:bg-white/10 z-30"
              title="调整窗口宽度"
            />
            <div
              onMouseDown={(e) => {
                e.preventDefault();
                setResizingWindowEdge('s');
                resizeStartGeomRef.current = {
                  width: windowSize.width,
                  height: windowSize.height,
                  clientX: e.clientX,
                  clientY: e.clientY,
                };
              }}
              className="absolute bottom-0 left-0 w-full h-2 cursor-s-resize hover:bg-black/10 dark:hover:bg-white/10 z-30"
              title="调整窗口高度"
            />
            <div
              onMouseDown={(e) => {
                e.preventDefault();
                setResizingWindowEdge('se');
                resizeStartGeomRef.current = {
                  width: windowSize.width,
                  height: windowSize.height,
                  clientX: e.clientX,
                  clientY: e.clientY,
                };
              }}
              className="absolute bottom-0 right-0 w-3.5 h-3.5 cursor-se-resize hover:bg-black/20 dark:hover:bg-white/20 z-40"
              title="等比拉伸软件窗口"
            >
              <div className="w-1.5 h-1.5 border-r border-b border-black/30 dark:border-white/30 absolute bottom-1 right-1"></div>
            </div>
          </>
        )}
      </div>

      {/* 3. CENTERED FLOATING DOCK TASKBAR */}
      <Taskbar
        isWindowMinimized={isMinimized}
        onRestoreWindow={() => setIsMinimized(false)}
        onToggleWindow={() => setIsMinimized(!isMinimized)}
        onOpenSettings={() => setIsSettingsModalOpen(true)}
      />

      {/* Preferences & Configuration Modal */}
      <SettingsModal
        isOpen={isSettingsModalOpen}
        onClose={() => setIsSettingsModalOpen(false)}
        wheelZoomDirect={wheelZoomDirect}
        onToggleWheelZoomDirect={setWheelZoomDirect}
        isDark={isDark}
        onToggleTheme={handleToggleTheme}
        onShowToast={showToast}
      />

      {/* Quiet Toast Notification Pill */}
      {toastMessage && (
        <div className="fixed top-5 left-1/2 -translate-x-1/2 z-50 px-3.5 py-1.5 rounded-full bg-black/90 dark:bg-white/90 text-white dark:text-black text-xs font-medium shadow-2xl backdrop-blur-md animate-in fade-in slide-in-from-top-2 duration-150">
          {toastMessage}
        </div>
      )}
    </div>
  );
}
