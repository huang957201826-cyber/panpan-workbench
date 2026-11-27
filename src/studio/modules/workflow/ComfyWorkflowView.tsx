import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  Play,
  ChevronDown,
  ChevronUp,
  Dice5,
  RefreshCw,
  Minus,
  Plus,
  Paintbrush,
  Upload,
  Download,
  Trash2,
  Eraser,
  Send,
  MoveHorizontal,
  Expand,
  X,
  RotateCcw,
  FolderOpen,
  FolderPlus,
  BookmarkPlus,
  FileJson,
  Square,
  FlipHorizontal2,
  Power,
  StickyNote,
  Image as ImageIcon,
  Check,
  Save,
} from 'lucide-react';
import type {
  Artboard,
  WorkflowGroupBox,
  WorkflowNode,
  NodeConnection,
  WorkflowPreset,
  WorkflowToolId,
  WorkflowProject,
  WorkflowHistoryRecord,
} from './types';
import { InteractiveDotGrid } from './InteractiveDotGrid';
import { runWorkflow } from '../../adapters/workflow';
import { fetchOutputImage } from '../../../lib/comfyClient';

interface ComfyWorkflowViewProps {
  activePreset: WorkflowPreset;
  workflowProjects: WorkflowProject[];
  activeProjectId: string;
  onSelectProject: (projectId: string) => void;
  onCreateProject: (name: string) => void;
  onSaveProject?: (values: Record<string, string | number | boolean>) => void;
  onSaveAsNewPreset?: (preset: WorkflowPreset) => void;
  onOverwriteCustomPreset?: (preset: WorkflowPreset) => void;
  onSelectToolCategory?: (category: WorkflowToolId, currentOutputUrl: string) => void;
  onAddHistoryRecord: (projectId: string, record: WorkflowHistoryRecord) => void;
  onDeleteHistoryRecord: (projectId: string, recordId: string) => void;
  onSendToCanvas?: (record: WorkflowHistoryRecord) => void;
  onQueueComplete?: (msg: string) => void;
  onSavePreset?: (name: string) => void;
  canvasArtboards?: Artboard[];
  chainedInputImageUrl?: string | null;
  onConsumeChainedImage?: () => void;
}

const PORT_COLORS: Record<string, string> = {
  model: '#d97706',
  clip: '#8b5cf6',
  vae: '#e11d48',
  latent: '#0284c7',
  conditioning: '#6366f1',
  image: '#059669',
  mask: '#ea580c',
  number: '#94a3b8',
  default: '#64748b',
};

const ASPECT_RATIO_OPTIONS = ['跟随原图', '16:9', '4:3', '1:1', '3:4', '9:16'];

/** 原型演示用的模型名不一定装了对应权重，默认回落到本机已装的 RealESRGAN */
function normalizeUpscaleModel(value: unknown) {
  const raw = String(value ?? '');
  if (raw.endsWith('.pth')) return raw;
  return 'RealESRGAN_x4plus.pth';
}

export const ComfyWorkflowView: React.FC<ComfyWorkflowViewProps> = ({
  activePreset,
  workflowProjects,
  activeProjectId,
  onSelectProject,
  onCreateProject,
  onSaveProject,
  onSaveAsNewPreset,
  onOverwriteCustomPreset,
  onSelectToolCategory,
  onAddHistoryRecord,
  onDeleteHistoryRecord,
  onSendToCanvas,
  onQueueComplete,
  onSavePreset,
  canvasArtboards = [],
  chainedInputImageUrl = null,
  onConsumeChainedImage,
}) => {
  const activeProject =
    workflowProjects.find((p) => p.id === activeProjectId) || workflowProjects[0];

  // Graph State synced to activePreset
  const [groups, setGroups] = useState<WorkflowGroupBox[]>(() =>
    JSON.parse(JSON.stringify(activePreset.groups || []))
  );
  const [nodes, setNodes] = useState<WorkflowNode[]>(() =>
    JSON.parse(JSON.stringify(activePreset.nodes || []))
  );
  const [connections, setConnections] = useState<NodeConnection[]>(() =>
    JSON.parse(JSON.stringify(activePreset.connections || []))
  );

  // Input / Output Images & Batch State
  const primaryNodeInit = activePreset.nodes.find((n) => n.type === 'LoadImagePrimary');
  const comparerNodeInit = activePreset.nodes.find((n) => n.type === 'ImageComparer');

  const [inputImageUrl, setInputImageUrl] = useState<string>('');
  const [refImageUrl, setRefImageUrl] = useState<string>('');
  const [outputImageUrl, setOutputImageUrl] = useState<string | null>(null);
  const [hasInputFile, setHasInputFile] = useState(false);
  const [runError, setRunError] = useState<string | null>(null);
  const [batchUrls, setBatchUrls] = useState<string[]>([]);
  const [activeBatchIndex, setActiveBatchIndex] = useState<number>(0);
  const [batchCount, setBatchCount] = useState<1 | 2 | 4>(1);

  // Split Compare & Lightboxes
  const [splitPercent, setSplitPercent] = useState<number>(48);
  const [draggingSplitScope, setDraggingSplitScope] = useState<'node' | 'modal' | null>(null);
  const [compareDisplayMode, setCompareDisplayMode] = useState<'split' | 'after' | 'before'>('split');
  const nodeCompareBoxRef = useRef<HTMLDivElement>(null);
  const modalCompareBoxRef = useRef<HTMLDivElement>(null);
  const [isLightboxOpen, setIsLightboxOpen] = useState(false);

  // Mask Editor State (Brush / Eraser / Rect / Invert)
  const [isMaskModalOpen, setIsMaskModalOpen] = useState(false);
  const [maskTool, setMaskTool] = useState<'brush' | 'eraser' | 'rect'>('brush');
  const [brushSize, setBrushSize] = useState<number>(38);
  const [hasMaskStrokes, setHasMaskStrokes] = useState<boolean>(false);
  const [maskSnapshotUrl, setMaskSnapshotUrl] = useState<string | null>(null);
  const maskCanvasRef = useRef<HTMLCanvasElement>(null);
  const isDrawingMaskRef = useRef<boolean>(false);
  const lastMaskPointRef = useRef<{ x: number; y: number } | null>(null);
  const rectStartRef = useRef<{ x: number; y: number } | null>(null);

  // Cutout Peek
  const [peekOriginalCutout, setPeekOriginalCutout] = useState<boolean>(false);

  // Header Popovers & Bottom History Dock
  const [isProjectMenuOpen, setIsProjectMenuOpen] = useState(false);
  const [isCreatingProjectInline, setIsCreatingProjectInline] = useState(false);
  const [newProjectName, setNewProjectName] = useState('');
  const [isSaveAsOpen, setIsSaveAsOpen] = useState(false);
  const [saveAsName, setSaveAsName] = useState('');
  const [isCanvasPickerOpen, setIsCanvasPickerOpen] = useState(false);
  const [isHistoryCollapsed, setIsHistoryCollapsed] = useState(false);
  const [selectedRecordId, setSelectedRecordId] = useState<string | null>(null);

  // Execution state
  const [isExecuting, setIsExecuting] = useState(false);
  const [execStageLabel, setExecStageLabel] = useState<string>('');
  const [execProgress, setExecProgress] = useState<number>(0);
  const [activeRunningNodeId, setActiveRunningNodeId] = useState<string | null>(null);

  // File upload refs
  const primaryUploadRef = useRef<HTMLInputElement>(null);
  const refUploadRef = useRef<HTMLInputElement>(null);
  /** 上传时留下的原始 File，只有它能直接交给引擎 */
  const primaryFileRef = useRef<File | null>(null);
  /** 真实产物；为 null 时下载与对比图都不可用 */
  const outputBlobRef = useRef<Blob | null>(null);

  // Canvas Pan / Zoom / Node & Group Dragging / Interactive Port Wiring
  const containerRef = useRef<HTMLDivElement>(null);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [pan, setPan] = useState<{ x: number; y: number }>({ x: 36, y: 74 });
  const [scale, setScale] = useState<number>(0.64);

  const [isPanning, setIsPanning] = useState(false);
  const startPanPosRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const isSpacePressedRef = useRef(false);

  const [draggingNodeId, setDraggingNodeId] = useState<string | null>(null);
  const nodeDragRef = useRef<{
    clientX: number;
    clientY: number;
    nodeX: number;
    nodeY: number;
    el: HTMLElement | null;
    dx: number;
    dy: number;
    raf: number | null;
  } | null>(null);

  const [draggingGroupId, setDraggingGroupId] = useState<string | null>(null);
  const groupDragRef = useRef<{
    clientX: number;
    clientY: number;
    origGroupX: number;
    origGroupY: number;
    childSnapshots: Record<string, { x: number; y: number }>;
  } | null>(null);

  // Port-to-port wiring state
  const [wiringFrom, setWiringFrom] = useState<{
    nodeId: string;
    portId: string;
    color: string;
  } | null>(null);

  // Reset Pan & Zoom Helper
  const focusCanvasAnchor = useCallback((anchor: 'all' | 'prompt' | 'workspace' | 'output' = 'all') => {
    if (anchor === 'all') {
      setScale(0.64);
      setPan({ x: 36, y: 74 });
    } else if (anchor === 'prompt') {
      setScale(0.92);
      setPan({ x: 24, y: 54 });
    } else if (anchor === 'workspace') {
      setScale(0.86);
      setPan({ x: -245, y: 50 });
    } else if (anchor === 'output') {
      setScale(0.94);
      setPan({ x: -840, y: 45 });
    }
  }, []);

  // Re-sync nodes & groups whenever activePreset switches
  useEffect(() => {
    setGroups(JSON.parse(JSON.stringify(activePreset.groups || [])));
    setNodes(JSON.parse(JSON.stringify(activePreset.nodes || [])));
    setConnections(JSON.parse(JSON.stringify(activePreset.connections || [])));
    const pNode = activePreset.nodes.find((n) => n.type === 'LoadImagePrimary');
    const cNode = activePreset.nodes.find((n) => n.type === 'ImageComparer');
    if (!primaryFileRef.current) setInputImageUrl('');
    setOutputImageUrl(null);
    outputBlobRef.current = null;
    setRunError(null);
    setBatchUrls([]);
    setActiveBatchIndex(0);
    setHasMaskStrokes(false);
    setMaskSnapshotUrl(null);
    setSelectedNodeId(null);
    focusCanvasAnchor('all');
  }, [activePreset.id, focusCanvasAnchor]);

  // Accept Chained Output Image Handoff (e.g., Render -> Inpaint / Upscale / Cutout)
  useEffect(() => {
    if (chainedInputImageUrl) {
      setInputImageUrl(chainedInputImageUrl);
      setOutputImageUrl(null);
      setBatchUrls([]);
      setHasMaskStrokes(false);
      setMaskSnapshotUrl(null);
      onConsumeChainedImage?.();
    }
  }, [chainedInputImageUrl, onConsumeChainedImage]);

  // Upload handlers
  const handlePrimaryUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    primaryFileRef.current = file;
    setHasInputFile(true);
    setRunError(null);
    const reader = new FileReader();
    reader.onload = (ev) => {
      if (typeof ev.target?.result === 'string') {
        setInputImageUrl(ev.target.result);
        setOutputImageUrl(null);
        outputBlobRef.current = null;
        setBatchUrls([]);
        clearMaskCanvas();
      }
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  const handleRefUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      if (typeof ev.target?.result === 'string') {
        setRefImageUrl(ev.target.result);
        setNodes((prev) =>
          prev.map((n) =>
            n.type === 'LoadImageReference'
              ? { ...n, properties: { ...n.properties, enabled: true, imageUrl: ev.target?.result } }
              : n
          )
        );
      }
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  // Mask Brush / Eraser / Rect / Invert Handlers
  const clearMaskCanvas = () => {
    const canvas = maskCanvasRef.current;
    if (canvas) {
      const ctx = canvas.getContext('2d');
      ctx?.clearRect(0, 0, canvas.width, canvas.height);
    }
    lastMaskPointRef.current = null;
    rectStartRef.current = null;
    setHasMaskStrokes(false);
    setMaskSnapshotUrl(null);
  };

  const paintMaskAt = (clientX: number, clientY: number, isStart = false) => {
    const canvas = maskCanvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const x = ((clientX - rect.left) / rect.width) * canvas.width;
    const y = ((clientY - rect.top) / rect.height) * canvas.height;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    if (maskTool === 'rect') {
      if (isStart) rectStartRef.current = { x, y };
      return;
    }

    const scaledSize = (brushSize / rect.width) * canvas.width;
    ctx.globalCompositeOperation = maskTool === 'eraser' ? 'destination-out' : 'source-over';
    ctx.strokeStyle = 'rgba(245, 158, 11, 0.58)';
    ctx.fillStyle = 'rgba(245, 158, 11, 0.58)';
    ctx.lineWidth = scaledSize;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    if (isStart || !lastMaskPointRef.current) {
      ctx.beginPath();
      ctx.arc(x, y, scaledSize * 0.5, 0, Math.PI * 2);
      ctx.fill();
    } else {
      ctx.beginPath();
      ctx.moveTo(lastMaskPointRef.current.x, lastMaskPointRef.current.y);
      ctx.lineTo(x, y);
      ctx.stroke();
    }
    ctx.globalCompositeOperation = 'source-over';
    lastMaskPointRef.current = { x, y };
    if (maskTool === 'brush') setHasMaskStrokes(true);
  };

  const finishRectMask = (clientX: number, clientY: number) => {
    if (maskTool !== 'rect' || !rectStartRef.current || !maskCanvasRef.current) return;
    const canvas = maskCanvasRef.current;
    const rect = canvas.getBoundingClientRect();
    const endX = ((clientX - rect.left) / rect.width) * canvas.width;
    const endY = ((clientY - rect.top) / rect.height) * canvas.height;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      const rx = Math.min(rectStartRef.current.x, endX);
      const ry = Math.min(rectStartRef.current.y, endY);
      const rw = Math.abs(endX - rectStartRef.current.x);
      const rh = Math.abs(endY - rectStartRef.current.y);
      if (rw > 6 && rh > 6) {
        ctx.fillStyle = 'rgba(245, 158, 11, 0.58)';
        ctx.fillRect(rx, ry, rw, rh);
        setHasMaskStrokes(true);
      }
    }
    rectStartRef.current = null;
  };

  const handleInvertMask = () => {
    const canvas = maskCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const data = imgData.data;
    for (let i = 0; i < data.length; i += 4) {
      const alpha = data[i + 3];
      if (alpha > 20) {
        data[i + 3] = 0;
      } else {
        data[i] = 245;
        data[i + 1] = 158;
        data[i + 2] = 11;
        data[i + 3] = 148;
      }
    }
    ctx.putImageData(imgData, 0, 0);
    setHasMaskStrokes(true);
  };

  const handleSaveMaskModal = () => {
    if (maskCanvasRef.current && hasMaskStrokes) {
      setMaskSnapshotUrl(maskCanvasRef.current.toDataURL('image/png'));
    }
    setIsMaskModalOpen(false);
  };

  // Split Compare dragging handlers
  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      if (!draggingSplitScope) return;
      const box =
        draggingSplitScope === 'node' ? nodeCompareBoxRef.current : modalCompareBoxRef.current;
      if (!box) return;
      const rect = box.getBoundingClientRect();
      const pct = Math.min(96, Math.max(4, ((e.clientX - rect.left) / rect.width) * 100));
      setSplitPercent(Math.round(pct));
    };
    const onUp = () => setDraggingSplitScope(null);
    if (draggingSplitScope) {
      window.addEventListener('mousemove', onMove);
      window.addEventListener('mouseup', onUp);
    }
    return () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
  }, [draggingSplitScope]);

  // Dev-only drag FPS meter: records rAF frame deltas while a node is dragged
  const [dragPerf, setDragPerf] = useState<{ avg: number; max: number; count: number } | null>(null);
  useEffect(() => {
    if (!import.meta.env.DEV || !draggingNodeId) return;
    const frames: number[] = [];
    let last = performance.now();
    let raf = requestAnimationFrame(function tick(t) {
      frames.push(t - last);
      last = t;
      raf = requestAnimationFrame(tick);
    });
    return () => {
      cancelAnimationFrame(raf);
      if (!frames.length) return;
      const avg = frames.reduce((sum, value) => sum + value, 0) / frames.length;
      setDragPerf({ avg: Math.round(avg * 10) / 10, max: Math.round(Math.max(...frames) * 10) / 10, count: frames.length });
    };
  }, [draggingNodeId]);

  // Node & Group Mouse Handlers
  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      if (isPanning) {
        setPan({
          x: e.clientX - startPanPosRef.current.x,
          y: e.clientY - startPanPosRef.current.y,
        });
      } else if (draggingNodeId && nodeDragRef.current) {
        const drag = nodeDragRef.current;
        const dx = (e.clientX - drag.clientX) / scale;
        const dy = (e.clientY - drag.clientY) / scale;
        drag.dx = dx;
        drag.dy = dy;
        // 拖拽期间只改 DOM transform，并按帧合并 mousemove，避免 React 重渲染和样式过渡滞后
        if (drag.el && drag.raf == null) {
          drag.raf = requestAnimationFrame(() => {
            drag.raf = null;
            if (nodeDragRef.current === drag && drag.el) {
              drag.el.style.transform = `translate3d(${drag.dx}px, ${drag.dy}px, 0)`;
            }
          });
        }
      } else if (draggingGroupId && groupDragRef.current) {
        const gDrag = groupDragRef.current;
        const dx = Math.round((e.clientX - gDrag.clientX) / scale);
        const dy = Math.round((e.clientY - gDrag.clientY) / scale);
        setGroups((prev) =>
          prev.map((g) =>
            g.id === draggingGroupId
              ? { ...g, x: gDrag.origGroupX + dx, y: gDrag.origGroupY + dy }
              : g
          )
        );
        setNodes((prev) =>
          prev.map((n) => {
            const snap = gDrag.childSnapshots[n.id];
            return snap ? { ...n, x: snap.x + dx, y: snap.y + dy } : n;
          })
        );
      }
    };
    const onUp = () => {
      const drag = nodeDragRef.current;
      if (draggingNodeId && drag) {
        if (drag.raf != null) cancelAnimationFrame(drag.raf);
        drag.raf = null;
        if (drag.el) drag.el.style.transform = '';
        const dx = drag.dx;
        const dy = drag.dy;
        setNodes((prev) =>
          prev.map((n) =>
            n.id === draggingNodeId
              ? { ...n, x: Math.round(drag.nodeX + dx), y: Math.round(drag.nodeY + dy) }
              : n
          )
        );
      }
      setIsPanning(false);
      setDraggingNodeId(null);
      nodeDragRef.current = null;
      setDraggingGroupId(null);
      groupDragRef.current = null;
    };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    return () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
  }, [isPanning, draggingNodeId, draggingGroupId, scale]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.code === 'Space' && !e.repeat) {
        if ((e.target as HTMLElement)?.closest('input, textarea, select')) return;
        isSpacePressedRef.current = true;
      } else if (e.code === 'Escape') {
        setWiringFrom(null);
        setIsProjectMenuOpen(false);
        setIsSaveAsOpen(false);
      }
    };
    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.code === 'Space') isSpacePressedRef.current = false;
    };
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, []);

  const zoomAtPoint = useCallback(
    (clientX: number, clientY: number, factor: number) => {
      if (!containerRef.current) return;
      const rect = containerRef.current.getBoundingClientRect();
      const mouseX = clientX - rect.left;
      const mouseY = clientY - rect.top;
      const nextScale = Math.min(1.8, Math.max(0.35, scale * factor));
      if (Math.abs(nextScale - scale) < 0.001) return;
      const ratio = nextScale / scale;
      setScale(nextScale);
      setPan({
        x: Math.round(mouseX - (mouseX - pan.x) * ratio),
        y: Math.round(mouseY - (mouseY - pan.y) * ratio),
      });
    },
    [scale, pan]
  );

  const handleCenterZoom = (factor: number) => {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    zoomAtPoint(rect.left + rect.width / 2, rect.top + rect.height / 2, factor);
  };

  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    const factor = e.deltaY < 0 ? 1.06 : 0.94;
    zoomAtPoint(e.clientX, e.clientY, factor);
  };

  const handleCanvasMouseDown = (e: React.MouseEvent) => {
    if ((e.target as HTMLElement).closest('.workflow-node, .workflow-group-header, button, input, select, textarea')) {
      return;
    }
    setWiringFrom(null);
    setIsProjectMenuOpen(false);
    if (e.button === 0 || e.button === 1 || isSpacePressedRef.current) {
      setIsPanning(true);
      startPanPosRef.current = { x: e.clientX - pan.x, y: e.clientY - pan.y };
      setSelectedNodeId(null);
    }
  };

  const handleGroupHeaderMouseDown = (e: React.MouseEvent, group: WorkflowGroupBox) => {
    e.stopPropagation();
    const childSnapshots: Record<string, { x: number; y: number }> = {};
    nodes.forEach((n) => {
      const inBounds =
        n.groupId === group.id ||
        (n.x >= group.x - 10 &&
          n.x <= group.x + group.width + 10 &&
          n.y >= group.y - 10 &&
          n.y <= group.y + group.height + 10);
      if (inBounds) childSnapshots[n.id] = { x: n.x, y: n.y };
    });
    setDraggingGroupId(group.id);
    groupDragRef.current = {
      clientX: e.clientX,
      clientY: e.clientY,
      origGroupX: group.x,
      origGroupY: group.y,
      childSnapshots,
    };
  };

  const handleNodeHeaderMouseDown = (e: React.MouseEvent, node: WorkflowNode) => {
    if ((e.target as HTMLElement).closest('button, select, input')) return;
    e.stopPropagation();
    setSelectedNodeId(node.id);
    setDraggingNodeId(node.id);
    nodeDragRef.current = {
      clientX: e.clientX,
      clientY: e.clientY,
      nodeX: node.x,
      nodeY: node.y,
      el: ((e.currentTarget as HTMLElement).closest('[data-node-id]') as HTMLElement | null) ?? null,
      dx: 0,
      dy: 0,
      raf: null,
    };
  };

  const handleUpdateNodeProp = (nodeId: string, propKey: string, val: any) => {
    setNodes((prev) =>
      prev.map((n) =>
        n.id === nodeId ? { ...n, properties: { ...n.properties, [propKey]: val } } : n
      )
    );
  };

  const handleToggleBypassNode = (nodeId: string) => {
    setNodes((prev) =>
      prev.map((n) => (n.id === nodeId ? { ...n, bypassed: !n.bypassed } : n))
    );
  };

  const getPortCoordinates = useCallback(
    (nodeId: string, portId: string, isOutput: boolean) => {
      const node = nodes.find((n) => n.id === nodeId);
      if (!node) return { x: 0, y: 0 };
      const HEADER_H = 34;
      const PORT_ROW_H = 19;
      if (isOutput) {
        const outIdx = node.outputs.findIndex((p) => p.id === portId);
        return {
          x: node.x + node.width,
          y: node.y + HEADER_H + 14 + Math.max(0, outIdx) * PORT_ROW_H,
        };
      }
      const inIdx = node.inputs.findIndex((p) => p.id === portId);
      return {
        x: node.x,
        y: node.y + HEADER_H + 14 + Math.max(0, inIdx) * PORT_ROW_H,
      };
    },
    [nodes]
  );

  // Port click wiring handlers
  const handleOutputPortClick = (e: React.MouseEvent, nodeId: string, portId: string, portType: string) => {
    e.stopPropagation();
    setWiringFrom({ nodeId, portId, color: PORT_COLORS[portType] || PORT_COLORS.default });
  };

  const handleInputPortClick = (e: React.MouseEvent, toNodeId: string, toPortId: string) => {
    e.stopPropagation();
    if (!wiringFrom || wiringFrom.nodeId === toNodeId) return;
    setConnections((prev) => {
      const filtered = prev.filter((c) => !(c.toNodeId === toNodeId && c.toPortId === toPortId));
      return [
        ...filtered,
        {
          id: `c-${Date.now()}`,
          fromNodeId: wiringFrom.nodeId,
          fromPortId: wiringFrom.portId,
          toNodeId,
          toPortId,
          color: wiringFrom.color,
        },
      ];
    });
    setWiringFrom(null);
  };

  // 四条流程共用一份提交逻辑，参数与必填项按表取
  const FLOW_SPECS: Record<string, { manifestId: string; label: string; tool: WorkflowToolId; needsMask: boolean; needsPrompt: boolean }> = {
    upscale: { manifestId: 'qwen-upscale', label: '无损放大', tool: 'upscale', needsMask: false, needsPrompt: false },
    cutout: { manifestId: 'matte-cutout', label: '抠图', tool: 'cutout', needsMask: false, needsPrompt: false },
    inpaint: { manifestId: 'qwen-retouch', label: '局部重绘', tool: 'inpaint', needsMask: true, needsPrompt: true },
    'model-to-render': { manifestId: 'qwen-su-render', label: '截图转效果图', tool: 'model-to-render', needsMask: false, needsPrompt: true },
  };
  const flowSpec = FLOW_SPECS[activePreset.category];
  const positivePrompt = String(
    nodes.find((n) => n.type === 'CLIPTextEncodePositive')?.properties?.text ?? '',
  ).trim();
  const missingInput = !flowSpec
    ? '该流程尚未接通生成链路'
    : !hasInputFile
    ? '请先上传一张原图'
    : flowSpec.needsMask && !hasMaskStrokes
    ? '请先在图像上涂抹蒙版'
    : flowSpec.needsPrompt && !positivePrompt
    ? '请先填写正向提示词'
    : null;

  /** 保存工作流时带走的参数快照；只收真实运行会用到的字段 */
  const collectProjectValues = () => {
    const values: Record<string, string | number | boolean> = { flow: activePreset.category };
    for (const node of nodes) {
      const props = node.properties ?? {};
      if (node.type === 'CLIPTextEncodePositive' && props.text) {
        values.positivePrompt = String(props.text);
      }
      if (node.type === 'BasicScheduler') {
        if (props.denoise != null) values.denoise = Number(props.denoise);
        if (props.steps != null) values.steps = Number(props.steps);
      }
      if (node.type === 'SeedControl' && props.seed != null) values.seed = Number(props.seed);
      if (props.mode === 'upscale-tile') {
        if (props.scale != null) values.scale = Number(props.scale);
        if (props.upscaleModel) values.model = String(props.upscaleModel);
      }
    }
    return values;
  };

  const maskFile = async () => {
    if (!maskSnapshotUrl) return null;
    const image = await new Promise<HTMLImageElement>((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = reject;
      img.src = maskSnapshotUrl;
    });
    const canvas = document.createElement('canvas');
    canvas.width = image.naturalWidth;
    canvas.height = image.naturalHeight;
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(image, 0, 0);
    // 画布里的遮罩是橙色叠加层，转成引擎要求的黑底白区
    const data = ctx.getImageData(0, 0, canvas.width, canvas.height);
    for (let i = 0; i < data.data.length; i += 4) {
      const marked = data.data[i + 3] > 20;
      data.data[i] = marked ? 255 : 0;
      data.data[i + 1] = marked ? 255 : 0;
      data.data[i + 2] = marked ? 255 : 0;
      data.data[i + 3] = 255;
    }
    ctx.putImageData(data, 0, 0);
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/png'));
    return blob ? new File([blob], 'mask.png', { type: 'image/png' }) : null;
  };

  const handleRunBatteryWorkflow = async () => {
    if (isExecuting || !activeProject || !flowSpec || missingInput) return;
    const file = primaryFileRef.current;
    if (!file) return;

    const controlNode = nodes.find((n) => n.properties?.mode === 'upscale-tile');
    const seedNode = nodes.find((n) => n.type === 'SeedControl');
    const params: Record<string, unknown> = { image: file };
    if (flowSpec.manifestId === 'qwen-upscale') {
      params.scale = Number(controlNode?.properties?.scale ?? 1);
      params.model = normalizeUpscaleModel(controlNode?.properties?.upscaleModel);
    } else if (flowSpec.manifestId === 'matte-cutout') {
      params.model = 'birefnet-general.safetensors';
    } else {
      params.prompt = positivePrompt;
      params.denoise = flowSpec.manifestId === 'qwen-retouch' ? 0.55 : 0.7;
      if (flowSpec.manifestId === 'qwen-su-render') {
        params.steps = 20;
        params.seed = Number(seedNode?.properties?.seed ?? 0) || Math.floor(Math.random() * 1_000_000_000);
      }
      if (flowSpec.needsMask) {
        const mask = await maskFile();
        if (!mask) {
          setRunError('没有拿到蒙版图，请重新涂抹后再试');
          return;
        }
        params.mask = mask;
      }
    }

    setRunError(null);
    setIsExecuting(true);
    setExecProgress(0);
    setExecStageLabel('上传原图…');
    const startedAt = performance.now();

    try {
      const result = await runWorkflow(flowSpec.manifestId, params, {
        onStage: (stage) => {
          setExecStageLabel(stage === 'uploading' ? '上传原图…' : stage === 'queued' ? '排队中…' : '渲染中…');
        },
      });
      const image = result.images[0];
      if (!image) throw new Error('引擎没有返回图片');
      const blob = await fetchOutputImage(image);
      outputBlobRef.current = blob;
      const url = URL.createObjectURL(blob);
      setOutputImageUrl(url);
      setBatchUrls([url]);
      setActiveBatchIndex(0);
      setCompareDisplayMode('split');

      const seconds = ((performance.now() - startedAt) / 1000).toFixed(1);
      const record: WorkflowHistoryRecord = {
        id: `rec-${Date.now()}`,
        presetId: activePreset.id,
        presetName: activePreset.name,
        toolId: flowSpec.tool,
        toolLabel: flowSpec.label,
        title: `${activePreset.name} · ${seconds}s`,
        inputUrl: inputImageUrl,
        outputUrl: url,
        batchUrls: [url],
        createdAt: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        duration: `${seconds}s`,
        resolution: '原图尺寸',
        summary: `${flowSpec.label} · ${seconds}s`,
        paramsSnapshot: { label: flowSpec.label },
      };
      onAddHistoryRecord(activeProject.id, record);
      setSelectedRecordId(record.id);
      clearMaskCanvas();
      onQueueComplete?.(`「${activePreset.name}」已完成，用时 ${seconds}s`);
    } catch (err) {
      console.error('工作流执行失败：', err);
      const message = err instanceof Error ? err.message : String(err);
      setRunError(message);
      if (err instanceof TypeError || /连不上|连接|fetch|network|refused/i.test(message)) {
        window.dispatchEvent(new CustomEvent('panpan-engine-recheck'));
      }
    } finally {
      setIsExecuting(false);
      setActiveRunningNodeId(null);
      setExecStageLabel('');
      setExecProgress(0);
    }
  };

  // Restore History Record + Parameter Snapshot back into Battery Nodes
  const handleSelectHistoryRecord = (rec: WorkflowHistoryRecord) => {
    setSelectedRecordId(rec.id);
    setInputImageUrl(rec.inputUrl);
    setOutputImageUrl(rec.outputUrl);
    setBatchUrls(rec.batchUrls || [rec.outputUrl]);
    setActiveBatchIndex(0);
    setCompareDisplayMode('split');

    if (rec.paramsSnapshot) {
      setNodes((prev) =>
        prev.map((n) => {
          if (n.type === 'CLIPTextEncodePositive' && rec.paramsSnapshot.positivePrompt) {
            return { ...n, properties: { ...n.properties, text: rec.paramsSnapshot.positivePrompt } };
          }
          if (n.type === 'CLIPTextEncodeNegative' && rec.paramsSnapshot.negativePrompt) {
            return { ...n, properties: { ...n.properties, text: rec.paramsSnapshot.negativePrompt } };
          }
          if (n.type === 'AspectRatioSize' && rec.paramsSnapshot.aspectRatio) {
            return { ...n, properties: { ...n.properties, aspectRatio: rec.paramsSnapshot.aspectRatio } };
          }
          if (n.type === 'BasicScheduler') {
            return {
              ...n,
              properties: {
                ...n.properties,
                denoise: rec.paramsSnapshot.denoise ?? n.properties.denoise,
                steps: rec.paramsSnapshot.steps ?? n.properties.steps,
              },
            };
          }
          if (n.type === 'SeedControl' && rec.paramsSnapshot.seed) {
            return { ...n, properties: { ...n.properties, seed: rec.paramsSnapshot.seed } };
          }
          return n;
        })
      );
    }
    onQueueComplete?.(`已回溯「${rec.title}」的图像与全部电池参数`);
  };

  // Save / Overwrite Custom Workflow Preset
  const handleOverwriteCurrentPreset = () => {
    if (!activePreset.isCustom || !onOverwriteCustomPreset) return;
    const updatedPreset: WorkflowPreset = {
      ...activePreset,
      coverBeforeUrl: inputImageUrl,
      coverAfterUrl: outputImageUrl || activePreset.coverAfterUrl || inputImageUrl,
      groups: JSON.parse(JSON.stringify(groups)),
      nodes: JSON.parse(JSON.stringify(nodes)),
      connections: JSON.parse(JSON.stringify(connections)),
    };
    onOverwriteCustomPreset(updatedPreset);
    setIsSaveAsOpen(false);
  };

  const handleConfirmSaveAsPreset = () => {
    const trimmed = saveAsName.trim();
    if (!trimmed || !onSaveAsNewPreset) return;
    const savedPreset: WorkflowPreset = {
      ...activePreset,
      id: `wf-custom-${Date.now()}`,
      name: trimmed,
      category: 'custom',
      categoryLabel: '本地已保存',
      badge: '自存预设',
      isCustom: true,
      isStarred: true,
      coverBeforeUrl: inputImageUrl,
      coverAfterUrl: outputImageUrl || activePreset.coverAfterUrl || inputImageUrl,
      groups: JSON.parse(JSON.stringify(groups)),
      nodes: JSON.parse(JSON.stringify(nodes)),
      connections: JSON.parse(JSON.stringify(connections)),
    };
    onSaveAsNewPreset(savedPreset);
    setSaveAsName('');
    setIsSaveAsOpen(false);
  };

  // Export current workflow as .json
  const handleExportWorkflowJson = () => {
    const payload = {
      name: activePreset.name,
      category: activePreset.category,
      description: activePreset.description,
      groups,
      nodes,
      connections,
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${activePreset.name.replace(/\s+/g, '_')}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    onQueueComplete?.(`已导出工作流「${activePreset.name}.json」`);
  };

  /** 统一下载：链接在下载开始后延迟释放，避免 Chromium 还没开始就吊销 */
  const saveBlob = (blob: Blob, filename: string) => {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.setTimeout(() => URL.revokeObjectURL(url), 10_000);
  };

  const handleDownloadOutput = async () => {
    const filename = `panpan-${activePreset.id}-${Date.now()}.png`;
    if (outputBlobRef.current) {
      saveBlob(outputBlobRef.current, filename);
      return;
    }
    // 历史回放只有预览地址：取回 Blob 再保存
    if (!outputImageUrl) {
      onQueueComplete?.('还没有生成结果，先运行一次再下载');
      return;
    }
    try {
      const response = await fetch(outputImageUrl);
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      saveBlob(await response.blob(), filename);
    } catch (err) {
      console.error('下载历史结果失败：', err);
      onQueueComplete?.(`下载失败：${err instanceof Error ? err.message : String(err)}`);
    }
  };

  // Derived properties for cutout / comparer nodes
  const controlNode = nodes.find((n) => n.type === 'PipelineControl');
  const isCutoutMode = activePreset.category === 'cutout';
  const cutoutBgMode: 'transparent' | 'white' | 'gray' =
    controlNode?.properties?.bgMode || 'transparent';
  const activeRecord = activeProject?.records.find((r) => r.id === selectedRecordId) || null;

  return (
    <div
      data-dragging={draggingNodeId || draggingGroupId || isPanning ? '' : undefined}
      className="relative w-full h-full bg-[#f3f4f8] dark:bg-[#0c0e14] text-slate-800 dark:text-slate-100 select-none overflow-hidden font-sans"
    >
      <input
        ref={primaryUploadRef}
        type="file"
        accept="image/*"
        onChange={handlePrimaryUpload}
        className="hidden"
      />
      <input
        ref={refUploadRef}
        type="file"
        accept="image/*"
        onChange={handleRefUpload}
        className="hidden"
      />

      {/* =========================================================================
          1. FULL-BLEED 4-GROUP COMFYUI BATTERY CANVAS
          ========================================================================= */}
      <div
        ref={containerRef}
        className="relative w-full h-full overflow-hidden cursor-grab active:cursor-grabbing"
        onMouseDown={handleCanvasMouseDown}
        onWheel={handleWheel}
      >
        <InteractiveDotGrid pan={pan} spacing={22} paused={Boolean(draggingNodeId || draggingGroupId || isPanning)} />

        {import.meta.env.DEV && dragPerf && (
          <div
            data-drag-perf
            className="absolute bottom-4 right-4 z-[60] rounded-lg bg-black/80 px-3 py-1.5 font-mono text-[11px] text-white"
          >
            avg {dragPerf.avg}ms · max {dragPerf.max}ms · {dragPerf.count}f
          </div>
        )}

        {/* 运行中的不确定进度条（不编造百分比） */}
        {isExecuting && (
          <div className="absolute top-0 left-0 right-0 z-40 h-0.5 bg-black/5 dark:bg-white/10 overflow-hidden pointer-events-none">
            <div className="h-full w-1/3 bg-black dark:bg-white animate-pulse" />
          </div>
        )}

        {runError && (
          <div className="absolute top-16 left-1/2 -translate-x-1/2 z-40 max-w-[560px] rounded-xl bg-rose-600/95 text-white text-[11.5px] leading-relaxed px-3.5 py-2 shadow-lg whitespace-pre-wrap">
            {runError}
          </div>
        )}

        {/* MINIMAL TOP FLOATING HEADER CAPSULES (Left: Title, Right: Save + Batch + Run) */}
        <div className="absolute top-3.5 left-4 right-4 z-30 pointer-events-none flex items-center justify-between gap-2.5">
          {/* Left: Workflow Title */}
          <div className="pointer-events-auto flex items-center gap-2 min-w-0">
            <div className="h-9 px-3.5 rounded-full bg-white/90 dark:bg-[#141620]/90 backdrop-blur-md border border-black/[0.05] dark:border-white/[0.08] soft-card-shadow hidden sm:flex items-center gap-2 min-w-0">
              <span className="text-[12px] font-bold text-slate-900 dark:text-white truncate max-w-[200px]">
                {activePreset.name}
              </span>
              {activePreset.isCustom && (
                <span className="px-1.5 py-0.5 rounded-full bg-[#f3f4f8] dark:bg-white/10 text-[9.5px] font-medium text-slate-500 dark:text-slate-300 shrink-0">
                  本地自存
                </span>
              )}
            </div>
          </div>

          {/* Right: Save Local (Overwrite / Save As / Export JSON) + Batch + Run CTA */}
          <div className="pointer-events-auto flex items-center gap-1.5 shrink-0 relative">
            <button
              type="button"
              onClick={() => void handleDownloadOutput()}
              aria-disabled={!outputBlobRef.current && !outputImageUrl}
              title={outputBlobRef.current || outputImageUrl ? '下载本次生成或历史结果的图片' : '还没有生成结果'}
              className={`h-9 px-3 rounded-full bg-white/95 dark:bg-[#141620]/95 backdrop-blur-md border border-black/[0.06] dark:border-white/[0.08] soft-card-shadow flex items-center gap-1.5 text-[11.5px] font-medium text-slate-700 dark:text-slate-200 hover:bg-black hover:text-white dark:hover:bg-white dark:hover:text-black transition cursor-pointer ${
                !outputBlobRef.current && !outputImageUrl ? 'opacity-40' : ''
              }`}
            >
              <Download className="w-3.5 h-3.5" />
              <span>下载图片</span>
            </button>

            <button
              type="button"
              onClick={() => onSaveProject?.(collectProjectValues())}
              title={activeProject && activeProject.id !== 'draft' ? '保存到当前工作流' : '保存为新工作流'}
              className="h-9 px-3 rounded-full bg-white/95 dark:bg-[#141620]/95 backdrop-blur-md border border-black/[0.06] dark:border-white/[0.08] soft-card-shadow flex items-center gap-1.5 text-[11.5px] font-medium text-slate-700 dark:text-slate-200 hover:bg-black hover:text-white dark:hover:bg-white dark:hover:text-black transition cursor-pointer"
            >
              <Save className="w-3.5 h-3.5" />
              <span>保存工作流</span>
            </button>

            <div className="relative">
              <button
                type="button"
                onClick={() => setIsSaveAsOpen(!isSaveAsOpen)}
                title="工作流预设"
                className="h-9 w-9 rounded-full bg-white/95 dark:bg-[#141620]/95 backdrop-blur-md border border-black/[0.06] dark:border-white/[0.08] soft-card-shadow flex items-center justify-center text-slate-500 hover:bg-black hover:text-white dark:hover:bg-white dark:hover:text-black transition cursor-pointer"
              >
                <span className="text-[15px] leading-none">…</span>
              </button>

              {isSaveAsOpen && (
                <div className="absolute right-0 top-11 w-[200px] p-1.5 rounded-2xl bg-white dark:bg-[#161822] border border-black/[0.08] dark:border-white/[0.1] soft-float-shadow z-50">
                  <button
                    type="button"
                    onClick={() => {
                      onSavePreset?.(activePreset.name);
                      setIsSaveAsOpen(false);
                    }}
                    className="w-full h-8 rounded-xl px-2.5 text-left text-[11.5px] font-medium text-slate-700 dark:text-slate-200 hover:bg-black/[0.05] dark:hover:bg-white/[0.08] cursor-pointer"
                  >
                    保存工作流预设
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      onSavePreset?.(`${activePreset.name} 副本`);
                      setIsSaveAsOpen(false);
                    }}
                    className="w-full h-8 rounded-xl px-2.5 text-left text-[11.5px] font-medium text-slate-700 dark:text-slate-200 hover:bg-black/[0.05] dark:hover:bg-white/[0.08] cursor-pointer"
                  >
                    另存为
                  </button>
                </div>
              )}
            </div>

            {/* Batch Count Pill */}
            <div className="h-9 px-1 rounded-full bg-white/95 dark:bg-[#141620]/95 backdrop-blur-md border border-black/[0.06] dark:border-white/[0.08] soft-card-shadow flex items-center text-[11px] font-mono">
              {([1, 2, 4] as const).map((cnt) => {
                const disabled = cnt !== 1;
                return (
                  <button
                    key={cnt}
                    type="button"
                    disabled={disabled}
                    onClick={() => {
                      if (!disabled) setBatchCount(cnt);
                    }}
                    className={`h-7 px-2 rounded-full transition ${
                      disabled
                        ? 'text-slate-300 dark:text-slate-600 cursor-not-allowed'
                        : batchCount === cnt
                        ? 'bg-black text-white dark:bg-white dark:text-black font-bold cursor-pointer'
                        : 'text-slate-400 hover:text-slate-800 dark:hover:text-white cursor-pointer'
                    }`}
                    title={disabled ? '批量出图尚未接通，当前仅支持单张' : '单次连续跑 1 张'}
                  >
                    ×{cnt}
                  </button>
                );
              })}
            </div>

            <button
              type="button"
              onClick={() => void handleRunBatteryWorkflow()}
              disabled={isExecuting || Boolean(missingInput)}
              title={missingInput ?? undefined}
              className="h-9 px-4 rounded-full bg-black text-white dark:bg-white dark:text-black text-[12px] font-semibold flex items-center gap-1.5 hover:opacity-90 active:scale-[0.98] transition cursor-pointer soft-float-shadow disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:opacity-40 whitespace-nowrap"
            >
              {isExecuting ? (
                <>
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  <span>{execStageLabel || '执行中'}</span>
                </>
              ) : (
                <>
                  <Play className="w-3.5 h-3.5 fill-current" />
                  <span>运行电池组</span>
                </>
              )}
            </button>

            {missingInput && !isExecuting && (
              <span className="text-[10.5px] text-rose-500 max-w-[150px] leading-tight">{missingInput}</span>
            )}
          </div>
        </div>

        {/* =====================================================================
            TRANSFORMED LAYER: GROUP BACKDROPS + WIRES + BATTERY NODES
            ===================================================================== */}
        <div
          className="w-full h-full transform-gpu origin-top-left"
          style={{ transform: `translate(${pan.x}px, ${pan.y}px) scale(${scale})` }}
        >
          {/* 1. Group Backdrop Boxes (Drag header to move entire group of nodes!) */}
          {groups.map((grp) => (
            <div
              key={grp.id}
              style={{
                left: `${grp.x}px`,
                top: `${grp.y}px`,
                width: `${grp.width}px`,
                height: `${grp.height}px`,
                borderColor: `${grp.color}38`,
              }}
              className="absolute rounded-2xl border bg-slate-500/[0.045] dark:bg-white/[0.03] pointer-events-none z-0"
            >
              <div
                onMouseDown={(e) => handleGroupHeaderMouseDown(e, grp)}
                style={{ backgroundColor: `${grp.color}18`, borderColor: `${grp.color}28` }}
                className="workflow-group-header pointer-events-auto h-8 px-3.5 rounded-t-2xl border-b flex items-center justify-between cursor-move"
              >
                <span className="text-[12px] font-bold tracking-tight text-slate-700 dark:text-slate-200">
                  {grp.title}
                </span>
                <span className="text-[10px] text-slate-400 font-mono">
                  拖动标题移动整组
                </span>
              </div>
            </div>
          ))}

          {/* 2. SVG Bezier Wires */}
          <svg
            className="absolute inset-0 pointer-events-none overflow-visible z-[5]"
            style={{ width: '4000px', height: '4000px' }}
          >
            {connections.map((conn) => {
              const start = getPortCoordinates(conn.fromNodeId, conn.fromPortId, true);
              const end = getPortCoordinates(conn.toNodeId, conn.toPortId, false);
              const dx = Math.max(42, Math.abs(end.x - start.x) * 0.45);
              const pathD = `M ${start.x} ${start.y} C ${start.x + dx} ${start.y}, ${end.x - dx} ${end.y}, ${end.x} ${end.y}`;
              const isActiveWire =
                isExecuting &&
                (conn.fromNodeId === activeRunningNodeId || conn.toNodeId === activeRunningNodeId);

              return (
                <path
                  key={conn.id}
                  d={pathD}
                  fill="none"
                  stroke={conn.color || '#64748b'}
                  strokeWidth={isActiveWire ? 3.2 : 1.7}
                  strokeOpacity={isActiveWire ? 0.98 : 0.62}
                  strokeLinecap="round"
                />
              );
            })}
          </svg>

          {/* 3. Battery Nodes */}
          {nodes.map((node) => {
            const isSelected = selectedNodeId === node.id;
            const isRunning = activeRunningNodeId === node.id;
            const isNote = node.type === 'NoteSticky';
            const isBypassed = Boolean(node.bypassed);

            return (
              <div
                key={node.id}
                data-node-id={node.id}
                className={`workflow-node absolute rounded-2xl border select-none z-10 ${draggingNodeId === node.id ? 'transition-none' : 'transition-all'} ${
                  isNote
                    ? 'bg-[#f6f1fc] dark:bg-[#231932] border-purple-400/35'
                    : 'bg-white dark:bg-[#141620]'
                } ${
                  isBypassed ? 'opacity-50 saturate-50' : ''
                } ${
                  isRunning
                    ? 'border-black dark:border-white ring-2 ring-black/20 dark:ring-white/25 shadow-xl'
                    : isSelected
                    ? 'border-black/40 dark:border-white/40 shadow-lg'
                    : 'border-black/[0.07] dark:border-white/[0.08] soft-card-shadow'
                }`}
                style={{ left: `${node.x}px`, top: `${node.y}px`, width: `${node.width}px` }}
                onClick={(e) => {
                  e.stopPropagation();
                  setSelectedNodeId(node.id);
                }}
              >
                {/* Node Header */}
                <div
                  onMouseDown={(e) => handleNodeHeaderMouseDown(e, node)}
                  className={`h-[34px] px-2.5 rounded-t-2xl border-b flex items-center justify-between gap-1.5 cursor-move ${
                    isNote
                      ? 'bg-purple-500/15 border-purple-500/20'
                      : 'bg-[#fafafa] dark:bg-[#191c28] border-black/[0.05] dark:border-white/[0.06]'
                  }`}
                  style={{ borderTop: `2.5px solid ${node.color || '#475569'}` }}
                >
                  <div className="flex items-center gap-1.5 min-w-0">
                    <span
                      className={`w-1.5 h-1.5 rounded-full shrink-0 ${
                        isBypassed
                          ? 'bg-purple-400'
                          : isRunning
                          ? 'bg-emerald-500 animate-ping'
                          : 'bg-emerald-500/80'
                      }`}
                    />
                    <span className="font-bold text-[11px] text-slate-900 dark:text-white truncate">
                      {node.title}
                    </span>
                  </div>

                  <div className="flex items-center gap-1 shrink-0" onMouseDown={(e) => e.stopPropagation()}>
                    {isRunning && (
                      <span className="text-[9px] px-1.5 py-0.5 rounded-full font-mono bg-black text-white dark:bg-white dark:text-black">
                        RUN
                      </span>
                    )}

                    {/* Inline Result Controls for ImageComparer */}
                    {node.type === 'ImageComparer' && outputImageUrl && (
                      <>
                        {!isCutoutMode ? (
                          <div className="flex items-center gap-0.5 p-0.5 rounded-full bg-[#f0f1f6] dark:bg-white/[0.08] text-[9.5px]">
                            {[
                              { id: 'split', label: '对比' },
                              { id: 'after', label: '成图' },
                              { id: 'before', label: '原图' },
                            ].map((m) => (
                              <button
                                key={m.id}
                                type="button"
                                onClick={() => setCompareDisplayMode(m.id as any)}
                                className={`h-4.5 px-1.5 rounded-full font-medium cursor-pointer ${
                                  compareDisplayMode === m.id
                                    ? 'bg-black text-white dark:bg-white dark:text-black'
                                    : 'text-slate-500'
                                }`}
                              >
                                {m.label}
                              </button>
                            ))}
                          </div>
                        ) : (
                          <button
                            type="button"
                            onMouseDown={() => setPeekOriginalCutout(true)}
                            onMouseUp={() => setPeekOriginalCutout(false)}
                            onMouseLeave={() => setPeekOriginalCutout(false)}
                            className="h-5 px-2 rounded-full bg-[#f0f1f6] dark:bg-white/[0.08] text-[9.5px] font-medium cursor-pointer"
                          >
                            看原图
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => setIsLightboxOpen(true)}
                          className="w-5 h-5 rounded-full hover:bg-black/5 dark:hover:bg-white/10 flex items-center justify-center text-slate-500 cursor-pointer"
                          title="放大全屏对比"
                        >
                          <Expand className="w-3 h-3" />
                        </button>
                      </>
                    )}

                    {/* Node Bypass Toggle (like ComfyUI Ctrl+M) */}
                    {!isNote && node.type !== 'ImageComparer' && (
                      <button
                        type="button"
                        onClick={() => handleToggleBypassNode(node.id)}
                        className={`w-5 h-5 rounded-full flex items-center justify-center cursor-pointer transition ${
                          isBypassed
                            ? 'bg-purple-500/20 text-purple-600 dark:text-purple-300'
                            : 'text-slate-400 hover:text-slate-800 dark:hover:text-white'
                        }`}
                        title={isBypassed ? '已跳过此节点（点击恢复）' : '临时跳过此节点 (Bypass)'}
                      >
                        <Power className="w-2.5 h-2.5" />
                      </button>
                    )}
                  </div>
                </div>

                {/* Ports Row (Interactive click-to-wire!) */}
                {(node.inputs.length > 0 || node.outputs.length > 0) && (
                  <div className="px-2.5 pt-1.5 pb-1 flex justify-between items-start gap-2">
                    <div className="flex flex-col gap-1">
                      {node.inputs.map((port) => (
                        <button
                          key={port.id}
                          type="button"
                          onClick={(e) => handleInputPortClick(e, node.id, port.id)}
                          className={`flex items-center gap-1.5 text-left cursor-crosshair ${
                            wiringFrom ? 'hover:scale-105' : ''
                          }`}
                          title={wiringFrom ? '点击连接到此端口' : `输入: ${port.name}`}
                        >
                          <span
                            className={`w-2.5 h-2.5 rounded-full border border-black/25 shrink-0 ${
                              wiringFrom ? 'ring-2 ring-black/20 dark:ring-white/30' : ''
                            }`}
                            style={{ backgroundColor: PORT_COLORS[port.type] || PORT_COLORS.default }}
                          />
                          <span className="font-mono text-[9px] text-slate-400">{port.name}</span>
                        </button>
                      ))}
                    </div>
                    <div className="flex flex-col gap-1 items-end ml-auto">
                      {node.outputs.map((port) => {
                        const isWiringActive =
                          wiringFrom?.nodeId === node.id && wiringFrom?.portId === port.id;
                        return (
                          <button
                            key={port.id}
                            type="button"
                            onClick={(e) => handleOutputPortClick(e, node.id, port.id, port.type)}
                            className="flex items-center gap-1.5 text-right cursor-crosshair"
                            title="点击从此端口拉出连线"
                          >
                            <span className="font-mono text-[9px] text-slate-400">{port.name}</span>
                            <span
                              className={`w-2.5 h-2.5 rounded-full border border-black/25 shrink-0 ${
                                isWiringActive ? 'ring-2 ring-black dark:ring-white scale-125' : ''
                              }`}
                              style={{ backgroundColor: PORT_COLORS[port.type] || PORT_COLORS.default }}
                            />
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Node Body by ComfyUI Node Type */}
                <div
                  className="px-2.5 pb-2.5 pt-1 space-y-2 text-[11px]"
                  onMouseDown={(e) => e.stopPropagation()}
                >
                  {/* 1. Positive Prompt */}
                  {node.type === 'CLIPTextEncodePositive' && (
                    <textarea
                      rows={4}
                      value={node.properties.text || ''}
                      onChange={(e) => handleUpdateNodeProp(node.id, 'text', e.target.value)}
                      placeholder="输入正面材质、光影、氛围与镜头描述..."
                      className="w-full p-2 rounded-xl bg-[#f3f4f8] dark:bg-black/30 border border-black/[0.06] dark:border-white/[0.08] text-[11px] leading-relaxed outline-none resize-none focus:border-purple-500/50"
                    />
                  )}

                  {/* 2. Negative Prompt */}
                  {node.type === 'CLIPTextEncodeNegative' && (
                    <textarea
                      rows={3}
                      value={node.properties.text || ''}
                      onChange={(e) => handleUpdateNodeProp(node.id, 'text', e.target.value)}
                      placeholder="输入反面排除项（低画质、门窗畸变、水印等）..."
                      className="w-full p-2 rounded-xl bg-[#f3f4f8] dark:bg-black/30 border border-black/[0.06] dark:border-white/[0.08] text-[11px] leading-relaxed outline-none resize-none focus:border-black/35"
                    />
                  )}

                  {/* 3. LoadImagePrimary (+ Mask Editor) */}
                  {node.type === 'LoadImagePrimary' && (
                    <div className="space-y-2">
                      <div
                        onClick={() => primaryUploadRef.current?.click()}
                        className="group relative h-[100px] rounded-xl overflow-hidden bg-[#f3f4f8] dark:bg-black/30 border border-black/[0.06] dark:border-white/[0.08] cursor-pointer"
                      >
                        {inputImageUrl ? (
                          <>
                            <img
                              src={inputImageUrl}
                              alt="Primary input"
                              className="w-full h-full object-cover"
                            />
                            {maskSnapshotUrl && (
                              <img
                                src={maskSnapshotUrl}
                                alt="Mask overlay"
                                className="absolute inset-0 w-full h-full object-cover pointer-events-none"
                              />
                            )}
                            <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition flex items-center justify-center opacity-0 group-hover:opacity-100">
                              <span className="px-2 py-0.5 rounded-full bg-white text-black text-[10px] font-semibold">
                                更换图片
                              </span>
                            </div>
                          </>
                        ) : (
                          <div className="absolute inset-1 rounded-lg border border-dashed border-black/15 dark:border-white/20 flex flex-col items-center justify-center gap-1 text-slate-400">
                            <ImageIcon className="w-4 h-4" />
                            <span className="text-[10px]">点击上传或拖入图片</span>
                          </div>
                        )}
                      </div>
                      <div className="grid grid-cols-3 gap-1">
                        <button
                          type="button"
                          onClick={() => primaryUploadRef.current?.click()}
                          className="h-6.5 rounded-lg bg-[#f3f4f8] dark:bg-white/[0.06] hover:bg-black/[0.08] text-[10px] font-medium flex items-center justify-center gap-1 cursor-pointer"
                        >
                          <Upload className="w-3 h-3 shrink-0" />
                          <span>上传</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => setIsCanvasPickerOpen(true)}
                          className="h-6.5 rounded-lg bg-[#f3f4f8] dark:bg-white/[0.06] hover:bg-black/[0.08] text-[10px] font-medium flex items-center justify-center gap-1 cursor-pointer"
                          title="从项目画布或历史成图中直接选图"
                        >
                          <ImageIcon className="w-3 h-3 shrink-0" />
                          <span>画布选图</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => setIsMaskModalOpen(true)}
                          className={`h-6.5 rounded-lg text-[10px] font-semibold flex items-center justify-center gap-1 cursor-pointer ${
                            hasMaskStrokes
                              ? 'bg-amber-500/15 text-amber-700 dark:text-amber-300 border border-amber-500/30'
                              : 'bg-black text-white dark:bg-white dark:text-black'
                          }`}
                        >
                          <Paintbrush className="w-3 h-3 shrink-0" />
                          <span>{hasMaskStrokes ? '已涂遮罩' : '蒙版'}</span>
                        </button>
                      </div>
                    </div>
                  )}

                  {/* 4. LoadImageReference (Optional Reference Image 2) */}
                  {node.type === 'LoadImageReference' && (
                    <div className="space-y-1.5">
                      <div className="flex items-center gap-2">
                        <div
                          onClick={() => refUploadRef.current?.click()}
                          className="w-16 h-12 rounded-lg bg-[#f3f4f8] dark:bg-black/30 border border-dashed border-black/15 dark:border-white/15 flex items-center justify-center overflow-hidden cursor-pointer shrink-0"
                        >
                          {refImageUrl ? (
                            <img src={refImageUrl} alt="Reference" className="w-full h-full object-cover" />
                          ) : (
                            <Upload className="w-3.5 h-3.5 text-slate-400" />
                          )}
                        </div>
                        <div className="flex-1 min-w-0 space-y-1">
                          <div className="flex items-center justify-between text-[10px]">
                            <span className="text-slate-500">参考权重</span>
                            <span className="font-mono">{(node.properties.weight ?? 0.75).toFixed(2)}</span>
                          </div>
                          <input
                            type="range"
                            min={0.1}
                            max={1.0}
                            step={0.05}
                            value={node.properties.weight ?? 0.75}
                            onChange={(e) => handleUpdateNodeProp(node.id, 'weight', Number(e.target.value))}
                            className="w-full accent-black dark:accent-white h-1 bg-black/10 rounded-full cursor-pointer"
                          />
                        </div>
                      </div>
                    </div>
                  )}

                  {/* 5. Checkpoint & LoRA Loader */}
                  {node.type === 'CheckpointAndLora' && (
                    <div className="space-y-1.5">
                      <div className="space-y-0.5">
                        <span className="text-[9.5px] text-slate-400">基础大模型 (Checkpoint)</span>
                        <select
                          value={node.properties.ckpt_name || ''}
                          onChange={(e) => handleUpdateNodeProp(node.id, 'ckpt_name', e.target.value)}
                          className="w-full bg-[#f3f4f8] dark:bg-black/30 border border-black/[0.06] dark:border-white/[0.08] rounded-lg px-2 py-1 text-[10.5px] outline-none"
                        >
                          <option value="flux1-dev-fp8.safetensors">flux1-dev-fp8.safetensors</option>
                          <option value="flux1-fill-dev.safetensors">flux1-fill-dev.safetensors</option>
                          <option value="sd_xl_base_1.0.safetensors">sd_xl_base_1.0.safetensors</option>
                          <option value="SUPIR-v0Q_fp16.safetensors">SUPIR-v0Q_fp16.safetensors</option>
                          <option value="BiRefNet-general.safetensors">BiRefNet-general.safetensors</option>
                        </select>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <select
                          value={node.properties.lora_name || ''}
                          onChange={(e) => handleUpdateNodeProp(node.id, 'lora_name', e.target.value)}
                          className="flex-1 min-w-0 bg-[#f3f4f8] dark:bg-black/30 border border-black/[0.06] dark:border-white/[0.08] rounded-lg px-2 py-1 text-[10.5px] outline-none"
                        >
                          <option value="ArchPhoto_Realism_v2.safetensors">ArchPhoto_Realism_v2</option>
                          <option value="SU_ClayToPhoto_v3.safetensors">SU_ClayToPhoto_v3</option>
                          <option value="BlueHour_Lighting_v1.safetensors">BlueHour_Lighting_v1</option>
                          <option value="WabiSabi_Interior_XL.safetensors">WabiSabi_Interior_XL</option>
                          <option value="无">无 LoRA</option>
                        </select>
                        <span className="text-[10px] font-mono bg-[#f3f4f8] dark:bg-black/30 px-1.5 py-1 rounded-lg tabular-nums">
                          {(node.properties.lora_strength ?? 0.75).toFixed(2)}
                        </span>
                      </div>
                    </div>
                  )}

                  {/* 6. AspectRatioSize */}
                  {node.type === 'AspectRatioSize' && (
                    <div className="space-y-1.5">
                      <div className="grid grid-cols-3 gap-1">
                        {ASPECT_RATIO_OPTIONS.map((ar) => (
                          <button
                            key={ar}
                            type="button"
                            onClick={() => handleUpdateNodeProp(node.id, 'aspectRatio', ar)}
                            className={`h-6 rounded-md text-[10px] font-medium cursor-pointer transition ${
                              node.properties.aspectRatio === ar
                                ? 'bg-black text-white dark:bg-white dark:text-black font-semibold'
                                : 'bg-[#f3f4f8] dark:bg-white/[0.06] text-slate-600 dark:text-slate-300'
                            }`}
                          >
                            {ar}
                          </button>
                        ))}
                      </div>
                      <select
                        value={node.properties.resolutionTier || '2K (2048px)'}
                        onChange={(e) => handleUpdateNodeProp(node.id, 'resolutionTier', e.target.value)}
                        className="w-full bg-[#f3f4f8] dark:bg-black/30 border border-black/[0.06] rounded-lg px-2 py-1 text-[10.5px] outline-none"
                      >
                        <option value="1K (1024px)">1K 标准出图 (1024px)</option>
                        <option value="2K (2048px)">2K 高清交付 (2048px)</option>
                        <option value="4× 超清 (8K)">4× 超清输出 (8K)</option>
                        <option value="高精裁剪精修">局部裁剪高精重绘</option>
                        <option value="原图无损导出">跟随原图原始分辨率</option>
                      </select>
                    </div>
                  )}

                  {/* 7. PipelineControl (ControlNet / MaskPrep / UpscaleTile / CutoutEdge) */}
                  {node.type === 'PipelineControl' && (
                    <div className="space-y-2">
                      {node.properties.mode === 'controlnet' && (
                        <>
                          <div className="space-y-0.5">
                            <div className="flex justify-between text-[10px]">
                              <span>Lineart 线稿锁定权重</span>
                              <span className="font-mono">{(node.properties.lineartWeight ?? 0.85).toFixed(2)}</span>
                            </div>
                            <input
                              type="range"
                              min={0}
                              max={1}
                              step={0.05}
                              value={node.properties.lineartWeight ?? 0.85}
                              onChange={(e) => handleUpdateNodeProp(node.id, 'lineartWeight', Number(e.target.value))}
                              className="w-full accent-black dark:accent-white h-1 bg-black/10 rounded-full cursor-pointer"
                            />
                          </div>
                          <div className="space-y-0.5">
                            <div className="flex justify-between text-[10px]">
                              <span>Depth 景深空间权重</span>
                              <span className="font-mono">{(node.properties.depthWeight ?? 0.75).toFixed(2)}</span>
                            </div>
                            <input
                              type="range"
                              min={0}
                              max={1}
                              step={0.05}
                              value={node.properties.depthWeight ?? 0.75}
                              onChange={(e) => handleUpdateNodeProp(node.id, 'depthWeight', Number(e.target.value))}
                              className="w-full accent-black dark:accent-white h-1 bg-black/10 rounded-full cursor-pointer"
                            />
                          </div>
                        </>
                      )}

                      {node.properties.mode === 'mask-prep' && (
                        <>
                          <div className="flex items-center justify-between gap-2 text-[10px]">
                            <span>羽化 {node.properties.featherPx ?? 12}px</span>
                            <input
                              type="range"
                              min={0}
                              max={32}
                              step={2}
                              value={node.properties.featherPx ?? 12}
                              onChange={(e) => handleUpdateNodeProp(node.id, 'featherPx', Number(e.target.value))}
                              className="w-28 accent-black dark:accent-white h-1 bg-black/10 rounded-full cursor-pointer"
                            />
                          </div>
                          <div className="flex items-center justify-between gap-2 text-[10px]">
                            <span>扩边 {node.properties.expandPx ?? 6}px</span>
                            <input
                              type="range"
                              min={-16}
                              max={32}
                              step={2}
                              value={node.properties.expandPx ?? 6}
                              onChange={(e) => handleUpdateNodeProp(node.id, 'expandPx', Number(e.target.value))}
                              className="w-28 accent-black dark:accent-white h-1 bg-black/10 rounded-full cursor-pointer"
                            />
                          </div>
                          <button
                            type="button"
                            onClick={() => handleUpdateNodeProp(node.id, 'inpaintCrop', !node.properties.inpaintCrop)}
                            className={`w-full h-6.5 rounded-lg text-[10px] font-semibold cursor-pointer ${
                              node.properties.inpaintCrop
                                ? 'bg-black text-white dark:bg-white dark:text-black'
                                : 'bg-[#f3f4f8] text-slate-500'
                            }`}
                          >
                            {node.properties.inpaintCrop ? '✓ 已开启高精裁剪重绘 (防模糊)' : '关闭高精裁剪重绘'}
                          </button>
                        </>
                      )}

                      {node.properties.mode === 'upscale-tile' && (
                        <>
                          <div className="flex items-center justify-between gap-2 text-[10px]">
                            <span>额外缩放 ×{Number(node.properties.scale ?? 1).toFixed(2)}</span>
                            <input
                              type="range"
                              min={1}
                              max={2}
                              step={0.05}
                              value={Number(node.properties.scale ?? 1)}
                              onChange={(e) => handleUpdateNodeProp(node.id, 'scale', Number(e.target.value))}
                              className="w-24 accent-black dark:accent-white h-1 bg-black/10 rounded-full cursor-pointer"
                            />
                          </div>
                          <div className="grid grid-cols-2 gap-1.5">
                            <select
                              value={normalizeUpscaleModel(node.properties.upscaleModel)}
                              onChange={(e) => handleUpdateNodeProp(node.id, 'upscaleModel', e.target.value)}
                              className="bg-[#f3f4f8] dark:bg-black/30 rounded-lg px-1.5 py-1 text-[10px] outline-none"
                            >
                              <option value="RealESRGAN_x4plus.pth">RealESRGAN_x4plus</option>
                              <option value="4x-UltraSharp.pth">4x-UltraSharp</option>
                              <option value="4x_foolhardy_Remacri.pth">4x Remacri</option>
                            </select>
                            <select
                              value={node.properties.tileSize || 1024}
                              onChange={(e) => handleUpdateNodeProp(node.id, 'tileSize', Number(e.target.value))}
                              className="bg-[#f3f4f8] dark:bg-black/30 rounded-lg px-1.5 py-1 text-[10px] outline-none"
                            >
                              <option value={512}>Tile 512</option>
                              <option value={1024}>Tile 1024</option>
                            </select>
                          </div>
                          <p className="text-[9.5px] leading-relaxed text-slate-400">
                            缩放 1 表示只用放大模型自带倍率；模型与缩放会随运行一并提交。
                          </p>
                          <button
                            type="button"
                            onClick={() => handleUpdateNodeProp(node.id, 'seamFix', !node.properties.seamFix)}
                            className={`w-full h-6.5 rounded-lg text-[10px] font-semibold cursor-pointer ${
                              node.properties.seamFix
                                ? 'bg-black text-white dark:bg-white dark:text-black'
                                : 'bg-[#f3f4f8] text-slate-500'
                            }`}
                          >
                            {node.properties.seamFix ? '✓ 分块接缝无缝融合已开启' : '接缝融合已关闭'}
                          </button>
                        </>
                      )}

                      {node.properties.mode === 'cutout-edge' && (
                        <>
                          <div className="flex items-center justify-between gap-2 text-[10px]">
                            <span>去白边收缩 {node.properties.erodePx ?? -1}px</span>
                            <input
                              type="range"
                              min={-8}
                              max={8}
                              step={1}
                              value={node.properties.erodePx ?? -1}
                              onChange={(e) => handleUpdateNodeProp(node.id, 'erodePx', Number(e.target.value))}
                              className="w-24 accent-black dark:accent-white h-1 bg-black/10 rounded-full cursor-pointer"
                            />
                          </div>
                          <div className="grid grid-cols-3 gap-1">
                            {[
                              { id: 'transparent', label: '透明底' },
                              { id: 'white', label: '纯白底' },
                              { id: 'gray', label: '暖灰底' },
                            ].map((bg) => (
                              <button
                                key={bg.id}
                                type="button"
                                onClick={() => handleUpdateNodeProp(node.id, 'bgMode', bg.id)}
                                className={`h-6 rounded-md text-[10px] font-medium cursor-pointer ${
                                  (node.properties.bgMode || 'transparent') === bg.id
                                    ? 'bg-black text-white dark:bg-white dark:text-black font-semibold'
                                    : 'bg-[#f3f4f8] dark:bg-white/[0.06] text-slate-500'
                                }`}
                              >
                                {bg.label}
                              </button>
                            ))}
                          </div>
                        </>
                      )}
                    </div>
                  )}

                  {/* 8. NoteSticky */}
                  {node.type === 'NoteSticky' && (
                    <div className="flex items-start gap-1.5 text-purple-950/85 dark:text-purple-100/90">
                      <StickyNote className="w-3.5 h-3.5 text-purple-600 dark:text-purple-300 shrink-0 mt-0.5" />
                      <textarea
                        rows={3}
                        value={node.properties.text || ''}
                        onChange={(e) => handleUpdateNodeProp(node.id, 'text', e.target.value)}
                        className="w-full bg-transparent border-none outline-none text-[10.5px] leading-relaxed resize-none"
                      />
                    </div>
                  )}

                  {/* 9. SeedControl */}
                  {node.type === 'SeedControl' && (
                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between gap-1.5">
                        <span className="text-[10px] text-slate-400">随机种</span>
                        <div className="flex items-center gap-1">
                          <input
                            type="number"
                            value={node.properties.seed || 270708280910890}
                            onChange={(e) => handleUpdateNodeProp(node.id, 'seed', Number(e.target.value))}
                            className="w-32 bg-[#f3f4f8] dark:bg-black/30 rounded-lg px-2 py-0.5 font-mono text-[10.5px] text-right outline-none"
                          />
                          <button
                            type="button"
                            onClick={() =>
                              handleUpdateNodeProp(node.id, 'seed', Math.floor(Math.random() * 999999999999))
                            }
                            className="p-1 rounded-lg hover:bg-black/5 text-slate-500 cursor-pointer"
                            title="随机生成新种子"
                          >
                            <Dice5 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                      <div className="flex items-center justify-between text-[10px]">
                        <span className="text-slate-400">生成后控制</span>
                        <select
                          value={node.properties.control_after_generate || 'randomize'}
                          onChange={(e) =>
                            handleUpdateNodeProp(node.id, 'control_after_generate', e.target.value)
                          }
                          className="bg-[#f3f4f8] dark:bg-black/30 rounded-lg px-2 py-0.5 font-mono text-[10px] outline-none"
                        >
                          <option value="randomize">randomize (每次随机)</option>
                          <option value="fixed">fixed (锁定固定)</option>
                        </select>
                      </div>
                    </div>
                  )}

                  {/* 10. KSamplerAndGuidance */}
                  {node.type === 'KSamplerAndGuidance' && (
                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between text-[10.5px]">
                        <span className="text-slate-400">采样器</span>
                        <select
                          value={node.properties.sampler_name || 'euler'}
                          onChange={(e) => handleUpdateNodeProp(node.id, 'sampler_name', e.target.value)}
                          className="w-36 bg-[#f3f4f8] dark:bg-black/30 rounded-lg px-2 py-0.5 font-mono text-[10.5px] outline-none"
                        >
                          <option value="euler">euler</option>
                          <option value="dpmpp_2m">dpmpp_2m</option>
                          <option value="uni_pc">uni_pc</option>
                        </select>
                      </div>
                      <div className="space-y-0.5">
                        <div className="flex justify-between text-[10px]">
                          <span className="text-slate-400">基础引导 (CFG)</span>
                          <span className="font-mono">{(node.properties.cfg ?? 3.5).toFixed(1)}</span>
                        </div>
                        <input
                          type="range"
                          min={1.0}
                          max={10.0}
                          step={0.5}
                          value={node.properties.cfg ?? 3.5}
                          onChange={(e) => handleUpdateNodeProp(node.id, 'cfg', Number(e.target.value))}
                          className="w-full accent-black dark:accent-white h-1 bg-black/10 rounded-full cursor-pointer"
                        />
                      </div>
                    </div>
                  )}

                  {/* 11. BasicScheduler */}
                  {node.type === 'BasicScheduler' && (
                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between text-[10.5px]">
                        <span className="text-slate-400">调度器</span>
                        <select
                          value={node.properties.scheduler || 'simple'}
                          onChange={(e) => handleUpdateNodeProp(node.id, 'scheduler', e.target.value)}
                          className="w-36 bg-[#f3f4f8] dark:bg-black/30 rounded-lg px-2 py-0.5 font-mono text-[10.5px] outline-none"
                        >
                          <option value="simple">simple</option>
                          <option value="karras">karras</option>
                          <option value="normal">normal</option>
                        </select>
                      </div>
                      <div className="flex items-center justify-between text-[10px]">
                        <span className="text-slate-400">步数 (Steps)</span>
                        <input
                          type="number"
                          min={1}
                          max={60}
                          value={node.properties.steps ?? 25}
                          onChange={(e) => handleUpdateNodeProp(node.id, 'steps', Number(e.target.value))}
                          className="w-16 bg-[#f3f4f8] dark:bg-black/30 rounded px-1.5 py-0.5 font-mono text-right outline-none"
                        />
                      </div>
                      <div className="space-y-0.5">
                        <div className="flex justify-between text-[10px]">
                          <span className="font-semibold text-slate-700 dark:text-slate-200">
                            降噪 / 重绘幅度 (Denoise)
                          </span>
                          <span className="font-mono font-bold">
                            {(node.properties.denoise ?? 0.45).toFixed(2)}
                          </span>
                        </div>
                        <input
                          type="range"
                          min={0.0}
                          max={1.0}
                          step={0.05}
                          value={node.properties.denoise ?? 0.45}
                          onChange={(e) => handleUpdateNodeProp(node.id, 'denoise', Number(e.target.value))}
                          className="w-full accent-black dark:accent-white h-1.5 bg-black/10 rounded-full cursor-pointer"
                        />
                      </div>
                    </div>
                  )}

                  {/* 12. VAEDecode */}
                  {node.type === 'VAEDecode' && (
                    <div className="text-[10px] text-slate-400 font-mono">
                      Latent → RGBA 像素解码就绪
                    </div>
                  )}

                  {/* 13. SaveImage */}
                  {node.type === 'SaveImage' && (
                    <div className="flex items-center gap-1.5">
                      <input
                        type="text"
                        value={node.properties.filename_prefix || 'PanPan_Out'}
                        onChange={(e) => handleUpdateNodeProp(node.id, 'filename_prefix', e.target.value)}
                        className="flex-1 bg-[#f3f4f8] dark:bg-black/30 rounded-lg px-2 py-1 font-mono text-[10px] outline-none"
                      />
                      <button
                        type="button"
                        onClick={() => void handleDownloadOutput()}
                        aria-disabled={!outputBlobRef.current && !outputImageUrl}
                        title={outputBlobRef.current || outputImageUrl ? '下载图片' : '还没有真实产物，先运行一次'}
                        className={`h-7 px-2.5 rounded-lg bg-[#f3f4f8] dark:bg-white/[0.08] hover:bg-black hover:text-white text-[10px] font-medium cursor-pointer ${
                          !outputBlobRef.current && !outputImageUrl ? 'opacity-40' : ''
                        }`}
                      >
                        下载
                      </button>
                    </div>
                  )}

                  {/* 14. #31 ImageComparer (rgthree-style AB Wipe Compare) */}
                  {node.type === 'ImageComparer' && (
                    <div className="space-y-2">
                      {isCutoutMode ? (
                        <div
                          className="relative h-[228px] rounded-xl overflow-hidden border border-black/[0.06] dark:border-white/[0.08] flex items-center justify-center"
                          style={
                            peekOriginalCutout
                              ? { backgroundColor: '#f3f4f8' }
                              : cutoutBgMode === 'transparent'
                              ? {
                                  backgroundImage:
                                    'linear-gradient(45deg, #e5e7eb 25%, transparent 25%), linear-gradient(-45deg, #e5e7eb 25%, transparent 25%), linear-gradient(45deg, transparent 75%, #e5e7eb 75%), linear-gradient(-45deg, transparent 75%, #e5e7eb 75%)',
                                  backgroundSize: '18px 18px',
                                  backgroundPosition: '0 0, 0 9px, 9px -9px, -9px 0px',
                                  backgroundColor: '#ffffff',
                                }
                              : cutoutBgMode === 'white'
                              ? { backgroundColor: '#ffffff' }
                              : { backgroundColor: '#e8eaef' }
                          }
                        >
                          {inputImageUrl || outputImageUrl ? (
                            <img
                              src={peekOriginalCutout ? inputImageUrl : outputImageUrl || inputImageUrl}
                              alt="Cutout comparer"
                              className={`max-w-[86%] max-h-[86%] object-contain ${
                                !peekOriginalCutout && outputImageUrl && cutoutBgMode === 'transparent'
                                  ? 'mix-blend-multiply drop-shadow-md'
                                  : ''
                              }`}
                            />
                          ) : (
                            <div className="flex flex-col items-center gap-1 text-slate-400">
                              <ImageIcon className="w-4 h-4" />
                              <span className="text-[10px]">上传原图后在这里对比</span>
                            </div>
                          )}
                        </div>
                      ) : (
                        <div
                          ref={nodeCompareBoxRef}
                          onMouseDown={(e) => {
                            if (compareDisplayMode !== 'split' || !outputImageUrl) return;
                            e.stopPropagation();
                            const rect = e.currentTarget.getBoundingClientRect();
                            const pct = Math.min(96, Math.max(4, ((e.clientX - rect.left) / rect.width) * 100));
                            setSplitPercent(Math.round(pct));
                            setDraggingSplitScope('node');
                          }}
                          className={`relative h-[228px] rounded-xl overflow-hidden border border-black/[0.06] dark:border-white/[0.08] bg-[#f3f4f8] dark:bg-black/30 ${
                            compareDisplayMode === 'split' && outputImageUrl ? 'cursor-ew-resize' : ''
                          }`}
                        >
                          {inputImageUrl || outputImageUrl ? (
                            <img
                              src={
                                compareDisplayMode === 'before'
                                  ? inputImageUrl
                                  : outputImageUrl || inputImageUrl
                              }
                              alt="Output B"
                              className="w-full h-full object-cover pointer-events-none select-none"
                            />
                          ) : (
                            <div className="absolute inset-0 flex flex-col items-center justify-center gap-1 text-slate-400">
                              <ImageIcon className="w-4 h-4" />
                              <span className="text-[10px]">上传原图后在这里对比</span>
                            </div>
                          )}

                          {compareDisplayMode === 'split' && outputImageUrl && (
                            <>
                              <div
                                className="absolute inset-0 overflow-hidden pointer-events-none"
                                style={{ clipPath: `inset(0 ${100 - splitPercent}% 0 0)` }}
                              >
                                <img
                                  src={inputImageUrl}
                                  alt="Input A"
                                  className="w-full h-full object-cover select-none"
                                />
                              </div>

                              <div
                                className="absolute top-0 bottom-0 w-0.5 bg-white shadow-[0_0_8px_rgba(0,0,0,0.45)] pointer-events-none"
                                style={{ left: `${splitPercent}%` }}
                              >
                                <div className="w-7 h-7 rounded-full bg-white text-black shadow-lg border border-black/15 flex items-center justify-center absolute top-1/2 -translate-x-1/2 -translate-y-1/2">
                                  <MoveHorizontal className="w-3.5 h-3.5" />
                                </div>
                              </div>

                              <span className="absolute top-2 left-2 px-1.5 py-0.5 rounded bg-black/65 text-white text-[9px] font-mono pointer-events-none">
                                A 原图
                              </span>
                              <span className="absolute top-2 right-2 px-1.5 py-0.5 rounded bg-black/75 text-white text-[9px] font-mono pointer-events-none">
                                B 成图
                              </span>
                            </>
                          )}
                        </div>
                      )}

                      {/* Batch Thumbnails if count > 1 */}
                      {batchUrls.length > 1 && (
                        <div className="flex items-center gap-1.5">
                          {batchUrls.map((bUrl, idx) => (
                            <button
                              key={idx}
                              type="button"
                              onClick={() => {
                                setActiveBatchIndex(idx);
                                setOutputImageUrl(bUrl);
                              }}
                              className={`relative flex-1 h-10 rounded-lg overflow-hidden border-2 cursor-pointer transition ${
                                activeBatchIndex === idx
                                  ? 'border-black dark:border-white'
                                  : 'border-transparent opacity-70 hover:opacity-100'
                              }`}
                            >
                              <img src={bUrl} alt={`Batch ${idx + 1}`} className="w-full h-full object-cover" />
                              <span className="absolute bottom-0.5 right-0.5 px-1 rounded bg-black/70 text-white text-[8px] font-mono">
                                #{idx + 1}
                              </span>
                            </button>
                          ))}
                        </div>
                      )}

                      {/* Pipeline Chaining & Send to Canvas */}
                      <div className="flex items-center justify-between gap-1.5 pt-0.5">
                        <div className="flex items-center gap-1 flex-wrap">
                          {onSelectToolCategory && activePreset.category !== 'inpaint' && (
                            <button
                              type="button"
                              onClick={() => onSelectToolCategory('inpaint', outputImageUrl || inputImageUrl)}
                              className="h-6 px-2 rounded-lg bg-[#f3f4f8] dark:bg-white/[0.06] hover:bg-black hover:text-white text-[10px] font-medium cursor-pointer"
                            >
                              送去精修
                            </button>
                          )}
                          {onSelectToolCategory && activePreset.category !== 'upscale' && (
                            <button
                              type="button"
                              onClick={() => onSelectToolCategory('upscale', outputImageUrl || inputImageUrl)}
                              className="h-6 px-2 rounded-lg bg-[#f3f4f8] dark:bg-white/[0.06] hover:bg-black hover:text-white text-[10px] font-medium cursor-pointer"
                            >
                              送去放大
                            </button>
                          )}
                          {onSelectToolCategory && activePreset.category !== 'cutout' && (
                            <button
                              type="button"
                              onClick={() => onSelectToolCategory('cutout', outputImageUrl || inputImageUrl)}
                              className="h-6 px-2 rounded-lg bg-[#f3f4f8] dark:bg-white/[0.06] hover:bg-black hover:text-white text-[10px] font-medium cursor-pointer"
                            >
                              送去抠图
                            </button>
                          )}
                        </div>

                        {onSendToCanvas && (
                          <button
                            type="button"
                            onClick={() =>
                              onSendToCanvas(
                                activeRecord || {
                                  id: `rec-${Date.now()}`,
                                  presetId: activePreset.id,
                                  presetName: activePreset.name,
                                  toolId:
                                    activePreset.category === 'custom'
                                      ? 'model-to-render'
                                      : activePreset.category,
                                  toolLabel: activePreset.categoryLabel,
                                  title: `${activePreset.name} · 成果`,
                                  inputUrl: inputImageUrl,
                                  outputUrl: outputImageUrl || inputImageUrl,
                                  createdAt: '刚刚',
                                  duration: '3.6s',
                                  resolution: '2560 × 1440',
                                  summary: activePreset.name,
                                  paramsSnapshot: {},
                                }
                              )
                            }
                            className="h-6 px-2.5 rounded-lg bg-black text-white dark:bg-white dark:text-black text-[10px] font-semibold flex items-center gap-1 cursor-pointer shrink-0"
                          >
                            <Send className="w-2.5 h-2.5" />
                            <span>入画布</span>
                          </button>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* =====================================================================
            2. BOTTOM FLOATING ARCHIVE HISTORY DOCK (Subtle Folder Prefix + History)
            ===================================================================== */}
        <div className="absolute bottom-3 left-3 right-3 min-[680px]:bottom-4 min-[680px]:left-1/2 min-[680px]:right-auto min-[680px]:-translate-x-1/2 z-30 pointer-events-auto min-[680px]:max-w-[76%] flex items-center justify-center">
          {isHistoryCollapsed ? (
            <button
              type="button"
              onClick={() => setIsHistoryCollapsed(false)}
              className="h-8.5 px-3.5 rounded-full bg-white/90 dark:bg-[#141620]/90 backdrop-blur-md border border-black/[0.06] dark:border-white/[0.08] soft-card-shadow flex items-center gap-1.5 text-[11px] font-medium text-slate-500 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white cursor-pointer"
            >
              <FolderOpen className="w-3 h-3 text-slate-400" />
              <span>
                {activeProject?.name} · 历史 ({activeProject?.records.length || 0})
              </span>
              <ChevronUp className="w-3 h-3" />
            </button>
          ) : (
            <div className="relative h-[50px] px-2.5 rounded-full bg-white/95 dark:bg-[#141620]/95 backdrop-blur-md border border-black/[0.06] dark:border-white/[0.08] soft-float-shadow flex items-center gap-2">
              {/* Quiet Inline Archive Folder Switcher */}
              <div className="relative shrink-0">
                <button
                  type="button"
                  onClick={() => setIsProjectMenuOpen(!isProjectMenuOpen)}
                  className="h-7.5 px-2.5 rounded-full hover:bg-black/[0.05] dark:hover:bg-white/[0.08] flex items-center gap-1.5 text-[11px] font-medium text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white transition cursor-pointer"
                  title="切换运行结果归档文件夹"
                >
                  <FolderOpen className="w-3 h-3 text-slate-400 shrink-0" />
                  <span className="truncate max-w-[96px]">{activeProject?.name || '默认工作流'}</span>
                  <span className="text-[10px] font-mono opacity-60 tabular-nums">
                    ({activeProject?.records.length || 0})
                  </span>
                  <ChevronUp className="w-3 h-3 opacity-60" />
                </button>

                {isProjectMenuOpen && (
                  <div className="absolute left-0 bottom-11 w-[250px] rounded-2xl bg-white dark:bg-[#161822] border border-black/[0.08] dark:border-white/[0.1] soft-float-shadow p-2 z-50 space-y-1.5">
                    <div className="px-2 py-1 text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                      成果归档目录
                    </div>
                    <div className="max-h-44 overflow-y-auto no-scrollbar space-y-1">
                      {workflowProjects.map((proj) => {
                        const isSel = proj.id === activeProject?.id;
                        return (
                          <button
                            key={proj.id}
                            type="button"
                            onClick={() => {
                              onSelectProject(proj.id);
                              setIsProjectMenuOpen(false);
                            }}
                            className={`w-full px-2.5 py-1.5 rounded-xl flex items-center justify-between text-[11.5px] cursor-pointer transition ${
                              isSel
                                ? 'bg-black text-white dark:bg-white dark:text-black font-semibold'
                                : 'hover:bg-black/[0.04] dark:hover:bg-white/[0.06] text-slate-700 dark:text-slate-200'
                            }`}
                          >
                            <span className="truncate">{proj.name}</span>
                            <span className="text-[10px] font-mono opacity-70 tabular-nums">
                              {proj.records.length} 条
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>

              <div className="h-4.5 w-px bg-black/[0.07] dark:bg-white/[0.08] shrink-0" />

              {!activeProject || activeProject.records.length === 0 ? (
                <span className="text-[11px] text-slate-400 px-2 whitespace-nowrap">
                  暂无历史 · 运行电池组后自动归档
                </span>
              ) : (
                <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar max-w-[460px]">
                  {activeProject.records.map((rec) => {
                    const isSelected = rec.id === selectedRecordId;
                    return (
                      <div
                        key={rec.id}
                        onClick={() => handleSelectHistoryRecord(rec)}
                        title={`${rec.title} (${rec.summary})${rec.missingImageIds?.length ? ' · 图片缺失' : ''} · 点击还原图与全部参数`}
                        className={`group relative w-9 h-9 rounded-xl overflow-hidden shrink-0 cursor-pointer transition-all border-2 ${
                          isSelected
                            ? 'border-black dark:border-white scale-105 shadow-xs'
                            : 'border-transparent opacity-80 hover:opacity-100'
                        }`}
                      >
                        {rec.outputUrl ? (
                          <img
                            src={rec.outputUrl}
                            alt={rec.title}
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <span className="flex h-full w-full items-center justify-center bg-amber-50 text-[8px] font-medium text-amber-700 dark:bg-amber-950/40 dark:text-amber-300">
                            缺图
                          </span>
                        )}
                        <span className="absolute bottom-0 inset-x-0 bg-black/65 text-white text-[8px] text-center leading-[12px] truncate px-0.5">
                          {rec.toolLabel.slice(0, 2)}
                        </span>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            onDeleteHistoryRecord(activeProject.id, rec.id);
                          }}
                          className="opacity-0 group-hover:opacity-100 absolute top-0 right-0 w-3.5 h-3.5 bg-black/75 text-white flex items-center justify-center rounded-bl-md cursor-pointer"
                          title="删除记录"
                        >
                          <Trash2 className="w-2 h-2" />
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}

              <button
                type="button"
                onClick={() => setIsHistoryCollapsed(true)}
                className="w-7 h-7 rounded-full hover:bg-black/[0.05] dark:hover:bg-white/[0.08] flex items-center justify-center text-slate-400 cursor-pointer shrink-0"
                title="收起历史胶囊"
              >
                <ChevronDown className="w-3.5 h-3.5" />
              </button>
            </div>
          )}
        </div>

        {/* =====================================================================
            3. BOTTOM-RIGHT ZOOM & FIT CONTROLS
            ===================================================================== */}
        <div className="absolute bottom-16 right-3 min-[680px]:bottom-4 min-[680px]:right-4 z-30 flex items-center gap-1 bg-white/95 dark:bg-[#141620]/95 backdrop-blur-md border border-black/[0.06] dark:border-white/[0.08] rounded-full px-2 py-1 soft-card-shadow text-[11px] font-mono">
          <button
            type="button"
            onClick={() => handleCenterZoom(0.9)}
            className="w-6 h-6 rounded-full hover:bg-black/5 flex items-center justify-center cursor-pointer"
          >
            <Minus className="w-3 h-3" />
          </button>
          <span
            onClick={() => focusCanvasAnchor('all')}
            className="px-1.5 cursor-pointer min-w-[38px] text-center"
            title="点击重置全景视图"
          >
            {Math.round(scale * 100)}%
          </span>
          <button
            type="button"
            onClick={() => handleCenterZoom(1.1)}
            className="w-6 h-6 rounded-full hover:bg-black/5 flex items-center justify-center cursor-pointer"
          >
            <Plus className="w-3 h-3" />
          </button>
          <button
            type="button"
            onClick={() => focusCanvasAnchor('all')}
            className="w-6 h-6 rounded-full hover:bg-black/5 flex items-center justify-center cursor-pointer"
            title="全景居中"
          >
            <RotateCcw className="w-3 h-3" />
          </button>
        </div>
      </div>

      {/* =========================================================================
          MODAL A: PRO MASK EDITOR (Brush / Eraser / Rect / Invert)
          ========================================================================= */}
      {isMaskModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-6">
          <div className="w-full max-w-[860px] rounded-3xl bg-white dark:bg-[#141620] border border-black/10 dark:border-white/10 shadow-2xl overflow-hidden flex flex-col">
            <div className="h-14 px-5 border-b border-black/[0.06] dark:border-white/[0.08] flex items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <span className="font-bold text-[13.5px]">蒙版编辑器</span>
                <div className="flex items-center gap-1 p-1 rounded-full bg-[#f3f4f8] dark:bg-white/[0.06]">
                  {[
                    { id: 'brush', label: '画笔', icon: Paintbrush },
                    { id: 'eraser', label: '橡皮擦', icon: Eraser },
                    { id: 'rect', label: '框选', icon: Square },
                  ].map((tool) => {
                    const TIcon = tool.icon;
                    return (
                      <button
                        key={tool.id}
                        type="button"
                        onClick={() => setMaskTool(tool.id as any)}
                        className={`h-7 px-3 rounded-full text-[11.5px] font-medium flex items-center gap-1 cursor-pointer ${
                          maskTool === tool.id
                            ? 'bg-black text-white dark:bg-white dark:text-black font-semibold'
                            : 'text-slate-600 dark:text-slate-300'
                        }`}
                      >
                        <TIcon className="w-3 h-3" />
                        <span>{tool.label}</span>
                      </button>
                    );
                  })}
                </div>
                {maskTool !== 'rect' && (
                  <div className="flex items-center gap-2 text-[11px] text-slate-500">
                    <span>大小 {brushSize}px</span>
                    <input
                      type="range"
                      min={12}
                      max={80}
                      step={2}
                      value={brushSize}
                      onChange={(e) => setBrushSize(Number(e.target.value))}
                      className="w-24 accent-black dark:accent-white h-1.5 bg-black/10 rounded-full cursor-pointer"
                    />
                  </div>
                )}
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleInvertMask}
                  className="h-8 px-3 rounded-full bg-[#f3f4f8] dark:bg-white/[0.08] text-[11.5px] font-medium flex items-center gap-1 cursor-pointer"
                  title="保留涂抹区不变，仅重绘外部背景"
                >
                  <FlipHorizontal2 className="w-3.5 h-3.5" />
                  <span>反选蒙版</span>
                </button>
                <button
                  type="button"
                  onClick={clearMaskCanvas}
                  className="h-8 px-3 rounded-full bg-[#f3f4f8] dark:bg-white/[0.08] text-[11.5px] font-medium cursor-pointer"
                >
                  清空
                </button>
                <button
                  type="button"
                  onClick={handleSaveMaskModal}
                  className="h-8 px-4 rounded-full bg-black text-white dark:bg-white dark:text-black text-[11.5px] font-semibold cursor-pointer"
                >
                  应用蒙版
                </button>
              </div>
            </div>

            <div className="p-4 bg-[#f3f4f8] dark:bg-[#0c0e14] flex items-center justify-center">
              <div className="relative w-full aspect-video rounded-2xl overflow-hidden bg-black/5">
                <img
                  src={inputImageUrl}
                  alt="Mask edit target"
                  className="w-full h-full object-contain pointer-events-none"
                />
                <canvas
                  ref={maskCanvasRef}
                  width={1280}
                  height={720}
                  onMouseDown={(e) => {
                    isDrawingMaskRef.current = true;
                    paintMaskAt(e.clientX, e.clientY, true);
                  }}
                  onMouseMove={(e) => {
                    if (isDrawingMaskRef.current) paintMaskAt(e.clientX, e.clientY, false);
                  }}
                  onMouseUp={(e) => {
                    if (maskTool === 'rect') finishRectMask(e.clientX, e.clientY);
                    isDrawingMaskRef.current = false;
                    lastMaskPointRef.current = null;
                  }}
                  onMouseLeave={() => {
                    isDrawingMaskRef.current = false;
                    lastMaskPointRef.current = null;
                  }}
                  className="absolute inset-0 w-full h-full cursor-crosshair"
                />
              </div>
            </div>
          </div>
        </div>
      )}

      {/* =========================================================================
          MODAL B: FULLSCREEN IMAGE COMPARER LIGHTBOX
          ========================================================================= */}
      {isLightboxOpen && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-6">
          <div className="w-full max-w-[1040px] h-[84vh] rounded-3xl bg-white dark:bg-[#141620] border border-black/10 dark:border-white/10 shadow-2xl overflow-hidden flex flex-col">
            <div className="h-13 px-5 border-b border-black/[0.06] dark:border-white/[0.08] flex items-center justify-between shrink-0">
              <span className="font-bold text-[13.5px]">
                {activeRecord?.title || `${activePreset.name} · 高清成果对比`}
              </span>
              <div className="flex items-center gap-2">
                {!isCutoutMode && outputImageUrl && (
                  <div className="flex items-center gap-0.5 p-0.5 rounded-full bg-[#f3f4f8] dark:bg-white/[0.08] text-[11px]">
                    {[
                      { id: 'split', label: '卷帘对比' },
                      { id: 'after', label: '成图' },
                      { id: 'before', label: '原图' },
                    ].map((m) => (
                      <button
                        key={m.id}
                        type="button"
                        onClick={() => setCompareDisplayMode(m.id as any)}
                        className={`h-6 px-2.5 rounded-full font-medium cursor-pointer ${
                          compareDisplayMode === m.id
                            ? 'bg-black text-white dark:bg-white dark:text-black'
                            : 'text-slate-500'
                        }`}
                      >
                        {m.label}
                      </button>
                    ))}
                  </div>
                )}
                <button
                  type="button"
                  onClick={handleDownloadOutput}
                  className="h-8 px-3 rounded-full bg-[#f3f4f8] dark:bg-white/[0.08] text-[11.5px] font-medium flex items-center gap-1 cursor-pointer"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>下载</span>
                </button>
                <button
                  type="button"
                  onClick={() => setIsLightboxOpen(false)}
                  className="w-8 h-8 rounded-full hover:bg-black/5 flex items-center justify-center cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            <div className="flex-1 min-h-0 p-5 bg-[#f3f4f8] dark:bg-[#0c0e14] flex items-center justify-center">
              {isCutoutMode ? (
                <div
                  className="relative max-w-full max-h-full aspect-square h-full rounded-2xl overflow-hidden flex items-center justify-center shadow-md"
                  style={
                    cutoutBgMode === 'transparent'
                      ? {
                          backgroundImage:
                            'linear-gradient(45deg, #e5e7eb 25%, transparent 25%), linear-gradient(-45deg, #e5e7eb 25%, transparent 25%), linear-gradient(45deg, transparent 75%, #e5e7eb 75%), linear-gradient(-45deg, transparent 75%, #e5e7eb 75%)',
                          backgroundSize: '20px 20px',
                          backgroundPosition: '0 0, 0 10px, 10px -10px, -10px 0px',
                          backgroundColor: '#ffffff',
                        }
                      : cutoutBgMode === 'white'
                      ? { backgroundColor: '#ffffff' }
                      : { backgroundColor: '#e8eaef' }
                  }
                >
                  <img
                    src={outputImageUrl || inputImageUrl}
                    alt="Fullscreen cutout"
                    className={`max-w-[88%] max-h-[88%] object-contain ${
                      outputImageUrl && cutoutBgMode === 'transparent' ? 'mix-blend-multiply' : ''
                    }`}
                  />
                </div>
              ) : (
                <div
                  ref={modalCompareBoxRef}
                  onMouseDown={(e) => {
                    if (compareDisplayMode !== 'split' || !outputImageUrl) return;
                    const rect = e.currentTarget.getBoundingClientRect();
                    const pct = Math.min(96, Math.max(4, ((e.clientX - rect.left) / rect.width) * 100));
                    setSplitPercent(Math.round(pct));
                    setDraggingSplitScope('modal');
                  }}
                  className={`relative max-w-full max-h-full aspect-video h-full rounded-2xl overflow-hidden bg-black/5 shadow-md ${
                    compareDisplayMode === 'split' && outputImageUrl ? 'cursor-ew-resize' : ''
                  }`}
                >
                  <img
                    src={
                      compareDisplayMode === 'before'
                        ? inputImageUrl
                        : outputImageUrl || inputImageUrl
                    }
                    alt="Fullscreen output"
                    className="w-full h-full object-cover pointer-events-none select-none"
                  />
                  {compareDisplayMode === 'split' && outputImageUrl && (
                    <>
                      <div
                        className="absolute inset-0 overflow-hidden pointer-events-none"
                        style={{ clipPath: `inset(0 ${100 - splitPercent}% 0 0)` }}
                      >
                        <img
                          src={inputImageUrl}
                          alt="Fullscreen before"
                          className="w-full h-full object-cover select-none"
                        />
                      </div>
                      <div
                        className="absolute top-0 bottom-0 w-0.5 bg-white shadow-lg pointer-events-none"
                        style={{ left: `${splitPercent}%` }}
                      >
                        <div className="w-8 h-8 rounded-full bg-white text-black shadow-lg border border-black/10 flex items-center justify-center absolute top-1/2 -translate-x-1/2 -translate-y-1/2">
                          <MoveHorizontal className="w-4 h-4" />
                        </div>
                      </div>
                    </>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* =========================================================================
          MODAL C: CANVAS & ARCHIVE IMAGE PICKER ("从画布选图")
          ========================================================================= */}
      {isCanvasPickerOpen && (
        <div
          className="fixed inset-0 z-50 bg-black/55 backdrop-blur-xs flex items-center justify-center p-6"
          onClick={() => setIsCanvasPickerOpen(false)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-[740px] max-h-[80vh] rounded-3xl bg-white dark:bg-[#141620] border border-black/10 dark:border-white/10 shadow-2xl overflow-hidden flex flex-col"
          >
            <div className="h-14 px-5 border-b border-black/[0.06] dark:border-white/[0.08] flex items-center justify-between shrink-0">
              <div>
                <div className="font-bold text-[13.5px]">从画布或历史记录选图</div>
                <div className="text-[11px] text-slate-400">
                  点选任意方案画板或工作流成图，一键载入「加载图像 (1)」
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsCanvasPickerOpen(false)}
                className="w-8 h-8 rounded-full hover:bg-black/5 flex items-center justify-center cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="flex-1 min-h-0 overflow-y-auto p-5 space-y-5">
              {/* Section 1: Canvas Artboards */}
              <div className="space-y-2.5">
                <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                  当前设计方案画板 ({canvasArtboards.filter((a) => a.imageUrl).length})
                </div>
                {canvasArtboards.filter((a) => a.imageUrl).length === 0 ? (
                  <div className="py-6 rounded-2xl bg-[#f3f4f8] dark:bg-white/[0.04] text-center text-[12px] text-slate-400">
                    当前空间画布暂无图片画板
                  </div>
                ) : (
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                    {canvasArtboards
                      .filter((a) => a.imageUrl)
                      .map((ab) => (
                        <button
                          key={ab.id}
                          type="button"
                          onClick={() => {
                            setInputImageUrl(ab.imageUrl);
                            setOutputImageUrl(null);
                            setBatchUrls([]);
                            clearMaskCanvas();
                            setIsCanvasPickerOpen(false);
                            onQueueComplete?.(`已载入画板「${ab.title}」`);
                          }}
                          className="group text-left rounded-2xl overflow-hidden bg-[#f3f4f8] dark:bg-white/[0.04] border border-black/[0.06] dark:border-white/[0.08] hover:border-black dark:hover:border-white transition cursor-pointer"
                        >
                          <div className="h-28 w-full overflow-hidden">
                            <img
                              src={ab.imageUrl}
                              alt={ab.title}
                              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-200"
                            />
                          </div>
                          <div className="px-2.5 py-2">
                            <div className="text-[11.5px] font-semibold truncate">{ab.title}</div>
                            <div className="text-[10px] text-slate-400 font-mono">{ab.resolution}</div>
                          </div>
                        </button>
                      ))}
                  </div>
                )}
              </div>

              {/* Section 2: Active Workflow Project History */}
              {activeProject && activeProject.records.length > 0 && (
                <div className="space-y-2.5">
                  <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                    当前保存的工作流成图 · {activeProject.name} ({activeProject.records.length})
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                    {activeProject.records.map((rec) => (
                      <button
                        key={rec.id}
                        type="button"
                        onClick={() => {
                          setInputImageUrl(rec.outputUrl);
                          setOutputImageUrl(null);
                          setBatchUrls([]);
                          clearMaskCanvas();
                          setIsCanvasPickerOpen(false);
                          onQueueComplete?.(`已载入归档成图「${rec.title}」`);
                        }}
                        className="group text-left rounded-2xl overflow-hidden bg-[#f3f4f8] dark:bg-white/[0.04] border border-black/[0.06] dark:border-white/[0.08] hover:border-black dark:hover:border-white transition cursor-pointer"
                      >
                        <div className="h-28 w-full overflow-hidden">
                          <img
                            src={rec.outputUrl}
                            alt={rec.title}
                            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-200"
                          />
                        </div>
                        <div className="px-2.5 py-2">
                          <div className="text-[11.5px] font-semibold truncate">{rec.title}</div>
                          <div className="text-[10px] text-slate-400 truncate">{rec.createdAt}</div>
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
