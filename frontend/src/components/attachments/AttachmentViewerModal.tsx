import { useState, useEffect, useRef, useCallback } from 'react';
import {
  X,
  ZoomIn,
  ZoomOut,
  RotateCw,
  RefreshCw,
  Columns,
  Maximize2,
  Minimize2,
  FileText,
  AlertCircle,
  Loader2,
  Contrast,
  Link as LinkIcon,
  Unlink as UnlinkIcon,
} from 'lucide-react';
import { PatientAttachmentDto } from '../../types/attachments';
import { attachmentService } from '../../services/attachmentService';
import { Button } from '../ui/button';

export interface AttachmentViewerModalProps {
  isOpen: boolean;
  onClose: () => void;
  patientName: string;
  attachments: PatientAttachmentDto[];
  initialAttachmentId?: number;
  initialCompareAttachmentId?: number;
}

interface PaneTransform {
  scale: number;
  offsetX: number;
  offsetY: number;
  rotation: number;
  isInverted: boolean;
}

const DEFAULT_TRANSFORM: PaneTransform = {
  scale: 1,
  offsetX: 0,
  offsetY: 0,
  rotation: 0,
  isInverted: false,
};

export function AttachmentViewerModal({
  isOpen,
  onClose,
  patientName,
  attachments,
  initialAttachmentId,
  initialCompareAttachmentId,
}: AttachmentViewerModalProps) {
  // Mode: single pane vs dual comparison
  const [isCompareMode, setIsCompareMode] = useState<boolean>(Boolean(initialCompareAttachmentId));
  const [syncPanZoom, setSyncPanZoom] = useState<boolean>(false);
  const [isFullscreen, setIsFullscreen] = useState<boolean>(false);

  // Selected attachments for Pane A (primary) and Pane B (comparison)
  const [selectedIdA, setSelectedIdA] = useState<number | null>(
    initialAttachmentId || (attachments.length > 0 ? attachments[0].id : null)
  );
  const [selectedIdB, setSelectedIdB] = useState<number | null>(
    initialCompareAttachmentId || (attachments.length > 1 ? attachments[1].id : null)
  );

  // Blob URLs
  const [blobUrlA, setBlobUrlA] = useState<{ url: string; mimeType: string } | null>(null);
  const [blobUrlB, setBlobUrlB] = useState<{ url: string; mimeType: string } | null>(null);
  const [isLoadingA, setIsLoadingA] = useState<boolean>(false);
  const [isLoadingB, setIsLoadingB] = useState<boolean>(false);
  const [errorA, setErrorA] = useState<string | null>(null);
  const [errorB, setErrorB] = useState<string | null>(null);

  // Transforms
  const [transformA, setTransformA] = useState<PaneTransform>(DEFAULT_TRANSFORM);
  const [transformB, setTransformB] = useState<PaneTransform>(DEFAULT_TRANSFORM);

  // Active object URLs tracking for cleanup
  const activeUrlsRef = useRef<Set<string>>(new Set());

  // Cleanup all object URLs on unmount
  useEffect(() => {
    return () => {
      activeUrlsRef.current.forEach((url) => {
        try {
          URL.revokeObjectURL(url);
        } catch {
          // ignore
        }
      });
      activeUrlsRef.current.clear();
    };
  }, []);

  // Update initial selections if props change
  useEffect(() => {
    if (initialAttachmentId) {
      setSelectedIdA(initialAttachmentId);
    } else if (attachments.length > 0 && selectedIdA === null) {
      setSelectedIdA(attachments[0].id);
    }
  }, [initialAttachmentId, attachments]);

  useEffect(() => {
    if (initialCompareAttachmentId) {
      setSelectedIdB(initialCompareAttachmentId);
      setIsCompareMode(true);
    }
  }, [initialCompareAttachmentId]);

  // Fetch Pane A Blob
  useEffect(() => {
    if (!isOpen || !selectedIdA) {
      setBlobUrlA(null);
      return;
    }

    let isCancelled = false;
    setIsLoadingA(true);
    setErrorA(null);

    attachmentService
      .fetchAttachmentBlobUrl(selectedIdA)
      .then((res) => {
        if (isCancelled) {
          URL.revokeObjectURL(res.url);
          return;
        }
        activeUrlsRef.current.add(res.url);
        setBlobUrlA((prev) => {
          if (prev?.url) {
            URL.revokeObjectURL(prev.url);
            activeUrlsRef.current.delete(prev.url);
          }
          return res;
        });
      })
      .catch((err) => {
        if (!isCancelled) setErrorA(err.message || 'فشل تحميل الملف');
      })
      .finally(() => {
        if (!isCancelled) setIsLoadingA(false);
      });

    return () => {
      isCancelled = true;
    };
  }, [isOpen, selectedIdA]);

  // Fetch Pane B Blob (if compare mode)
  useEffect(() => {
    if (!isOpen || !isCompareMode || !selectedIdB) {
      setBlobUrlB(null);
      return;
    }

    let isCancelled = false;
    setIsLoadingB(true);
    setErrorB(null);

    attachmentService
      .fetchAttachmentBlobUrl(selectedIdB)
      .then((res) => {
        if (isCancelled) {
          URL.revokeObjectURL(res.url);
          return;
        }
        activeUrlsRef.current.add(res.url);
        setBlobUrlB((prev) => {
          if (prev?.url) {
            URL.revokeObjectURL(prev.url);
            activeUrlsRef.current.delete(prev.url);
          }
          return res;
        });
      })
      .catch((err) => {
        if (!isCancelled) setErrorB(err.message || 'فشل تحميل الملف');
      })
      .finally(() => {
        if (!isCancelled) setIsLoadingB(false);
      });

    return () => {
      isCancelled = true;
    };
  }, [isOpen, isCompareMode, selectedIdB]);

  // Reset transforms when selection changes
  useEffect(() => {
    setTransformA(DEFAULT_TRANSFORM);
  }, [selectedIdA]);

  useEffect(() => {
    setTransformB(DEFAULT_TRANSFORM);
  }, [selectedIdB]);

  const handleClose = useCallback(() => {
    // Revoke current active URLs on close to avoid memory leaks
    if (blobUrlA?.url) {
      URL.revokeObjectURL(blobUrlA.url);
      activeUrlsRef.current.delete(blobUrlA.url);
      setBlobUrlA(null);
    }
    if (blobUrlB?.url) {
      URL.revokeObjectURL(blobUrlB.url);
      activeUrlsRef.current.delete(blobUrlB.url);
      setBlobUrlB(null);
    }
    onClose();
  }, [blobUrlA, blobUrlB, onClose]);

  if (!isOpen) return null;

  const currentAttachmentA = attachments.find((a) => a.id === selectedIdA);
  const currentAttachmentB = attachments.find((a) => a.id === selectedIdB);

  // Zoom handlers
  const handleZoom = (pane: 'A' | 'B', delta: number) => {
    const update = (prev: PaneTransform) => ({
      ...prev,
      scale: Math.min(Math.max(0.4, Number((prev.scale + delta).toFixed(2))), 5.0),
    });

    if (pane === 'A' || syncPanZoom) setTransformA(update);
    if (pane === 'B' || syncPanZoom) setTransformB(update);
  };

  const handleRotate = (pane: 'A' | 'B') => {
    const update = (prev: PaneTransform) => ({
      ...prev,
      rotation: (prev.rotation + 90) % 360,
    });
    if (pane === 'A' || syncPanZoom) setTransformA(update);
    if (pane === 'B' || syncPanZoom) setTransformB(update);
  };

  const handleInvert = (pane: 'A' | 'B') => {
    const update = (prev: PaneTransform) => ({
      ...prev,
      isInverted: !prev.isInverted,
    });
    if (pane === 'A' || syncPanZoom) setTransformA(update);
    if (pane === 'B' || syncPanZoom) setTransformB(update);
  };

  const handleReset = (pane: 'A' | 'B') => {
    if (pane === 'A' || syncPanZoom) setTransformA(DEFAULT_TRANSFORM);
    if (pane === 'B' || syncPanZoom) setTransformB(DEFAULT_TRANSFORM);
  };

  // Render a viewer pane
  const renderPane = (
    pane: 'A' | 'B',
    attachment: PatientAttachmentDto | undefined,
    blobData: { url: string; mimeType: string } | null,
    isLoading: boolean,
    error: string | null,
    transform: PaneTransform,
    onSelectId: (id: number) => void
  ) => {
    const isPdf =
      blobData?.mimeType.includes('pdf') ||
      attachment?.originalFileName.toLowerCase().endsWith('.pdf') ||
      attachment?.mimeType?.includes('pdf');

    return (
      <div className="flex-1 flex flex-col h-full bg-slate-950 border border-slate-800 rounded-xl overflow-hidden relative">
        {/* Pane Toolbar */}
        <div className="flex items-center justify-between px-3 py-2 bg-slate-900 border-b border-slate-800 text-xs text-slate-300 z-10">
          <div className="flex items-center gap-2">
            <span className="font-bold text-sky-400">
              {pane === 'A' ? 'الفحص الأساسي:' : 'فحص المقارنة:'}
            </span>
            <select
              value={attachment?.id || ''}
              onChange={(e) => onSelectId(Number(e.target.value))}
              className="bg-slate-800 text-slate-200 border border-slate-700 rounded px-2 py-1 text-xs focus:ring-1 focus:ring-sky-500 max-w-[220px] truncate"
            >
              {attachments.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.title} ({item.fileType} -{' '}
                  {new Date(item.uploadedAtUtc).toLocaleDateString('ar-EG')})
                </option>
              ))}
            </select>
          </div>

          {!isPdf && (
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => handleZoom(pane, 0.25)}
                className="p-1 hover:bg-slate-800 rounded text-slate-300 transition-colors"
                title="تكبير (+)"
              >
                <ZoomIn className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={() => handleZoom(pane, -0.25)}
                className="p-1 hover:bg-slate-800 rounded text-slate-300 transition-colors"
                title="تصغير (-)"
              >
                <ZoomOut className="w-4 h-4" />
              </button>
              <span className="font-mono text-[11px] px-1 text-slate-400">
                {Math.round(transform.scale * 100)}%
              </span>
              <button
                type="button"
                onClick={() => handleRotate(pane)}
                className="p-1 hover:bg-slate-800 rounded text-slate-300 transition-colors"
                title="تدوير 90 درجة"
              >
                <RotateCw className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={() => handleInvert(pane)}
                className={`p-1 rounded transition-colors ${
                  transform.isInverted
                    ? 'bg-amber-500 text-slate-950 font-bold'
                    : 'hover:bg-slate-800 text-slate-300'
                }`}
                title="عكس الألوان (سالب أشعة X-Ray)"
              >
                <Contrast className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={() => handleReset(pane)}
                className="p-1 hover:bg-slate-800 rounded text-slate-300 transition-colors"
                title="إعادة ضبط الموضع"
              >
                <RefreshCw className="w-4 h-4" />
              </button>
            </div>
          )}
        </div>

        {/* Pane Canvas / Viewport */}
        <div className="flex-1 relative overflow-hidden flex items-center justify-center bg-slate-950 select-none">
          {isLoading && (
            <div className="flex flex-col items-center gap-2 text-slate-400">
              <Loader2 className="w-8 h-8 animate-spin text-sky-500" />
              <span className="text-xs">جاري تحميل الفحص من الخادم...</span>
            </div>
          )}

          {error && (
            <div className="flex flex-col items-center gap-2 text-rose-400 text-xs text-center p-4">
              <AlertCircle className="w-8 h-8" />
              <span>{error}</span>
            </div>
          )}

          {!isLoading && !error && blobData && (
            <>
              {isPdf ? (
                <iframe
                  src={blobData.url}
                  className="w-full h-full border-none bg-white rounded-b-xl"
                  title={attachment?.title || 'PDF Document'}
                />
              ) : (
                <div
                  className="w-full h-full flex items-center justify-center cursor-grab active:cursor-grabbing"
                  onMouseDown={(e) => {
                    const startX = e.clientX - transform.offsetX;
                    const startY = e.clientY - transform.offsetY;

                    const handleMouseMove = (moveEvt: MouseEvent) => {
                      const newOffsetX = moveEvt.clientX - startX;
                      const newOffsetY = moveEvt.clientY - startY;

                      const update = (prev: PaneTransform) => ({
                        ...prev,
                        offsetX: newOffsetX,
                        offsetY: newOffsetY,
                      });

                      if (pane === 'A' || syncPanZoom) setTransformA(update);
                      if (pane === 'B' || syncPanZoom) setTransformB(update);
                    };

                    const handleMouseUp = () => {
                      window.removeEventListener('mousemove', handleMouseMove);
                      window.removeEventListener('mouseup', handleMouseUp);
                    };

                    window.addEventListener('mousemove', handleMouseMove);
                    window.addEventListener('mouseup', handleMouseUp);
                  }}
                  onWheel={(e) => {
                    e.preventDefault();
                    const delta = e.deltaY < 0 ? 0.15 : -0.15;
                    handleZoom(pane, delta);
                  }}
                >
                  <img
                    src={blobData.url}
                    alt={attachment?.title || 'Medical Scan'}
                    className="max-w-none transition-transform duration-75 select-none pointer-events-none"
                    style={{
                      transform: `translate(${transform.offsetX}px, ${transform.offsetY}px) scale(${transform.scale}) rotate(${transform.rotation}deg)`,
                      filter: transform.isInverted ? 'invert(100%) hue-rotate(180deg)' : 'none',
                    }}
                  />
                </div>
              )}
            </>
          )}

          {/* Subtitle / Metadata Overlay */}
          {attachment && (
            <div className="absolute bottom-2 right-2 bg-slate-900/85 backdrop-blur-xs text-[11px] text-slate-300 px-2.5 py-1 rounded-md border border-slate-700/60 pointer-events-none">
              <span className="font-bold text-white">{attachment.title}</span> —{' '}
              <span>{attachment.originalFileName}</span> (
              {(attachment.sizeBytes / 1024).toFixed(0)} KB)
            </div>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-slate-950/85 backdrop-blur-md animate-in fade-in duration-150">
      <div
        className={`bg-slate-900 border border-slate-800 rounded-2xl flex flex-col shadow-2xl transition-all ${
          isFullscreen ? 'w-full h-full rounded-none' : 'w-full max-w-6xl h-[88vh]'
        }`}
      >
        {/* Top Header Bar */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-slate-800 text-white">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-sky-600 flex items-center justify-center text-white">
              <FileText className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-sm sm:text-base font-bold flex items-center gap-2">
                <span>استعراض الفحوصات والأشعة الطبية</span>
                <span className="text-xs font-normal text-slate-400">
                  | المريض: {patientName}
                </span>
              </h2>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Dual Comparison Toggle */}
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setIsCompareMode((prev) => !prev)}
              className={`text-xs gap-1.5 border-slate-700 ${
                isCompareMode
                  ? 'bg-sky-600 text-white border-sky-500'
                  : 'text-slate-300 hover:bg-slate-800'
              }`}
            >
              <Columns className="w-3.5 h-3.5" />
              <span>{isCompareMode ? 'إلغاء وضع المقارنة' : 'مقارنة فحصين جنباً إلى جنب'}</span>
            </Button>

            {/* Sync Pan/Zoom toggle (in compare mode) */}
            {isCompareMode && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setSyncPanZoom((prev) => !prev)}
                className={`text-xs gap-1 border-slate-700 ${
                  syncPanZoom ? 'bg-indigo-600 text-white' : 'text-slate-300 hover:bg-slate-800'
                }`}
                title="مزامنة التكبير والتحريك بين الفحصين"
              >
                {syncPanZoom ? (
                  <LinkIcon className="w-3.5 h-3.5" />
                ) : (
                  <UnlinkIcon className="w-3.5 h-3.5" />
                )}
                <span>{syncPanZoom ? 'المزامنة مفعّلة' : 'مزامنة الحركة'}</span>
              </Button>
            )}

            {/* Fullscreen Toggle */}
            <button
              type="button"
              onClick={() => setIsFullscreen((prev) => !prev)}
              className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors"
              title="ملء الشاشة"
            >
              {isFullscreen ? (
                <Minimize2 className="w-4 h-4" />
              ) : (
                <Maximize2 className="w-4 h-4" />
              )}
            </button>

            {/* Close */}
            <button
              type="button"
              onClick={handleClose}
              className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors"
              title="إغلاق"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Viewport Canvas Grid */}
        <div className="flex-1 p-3 flex gap-3 overflow-hidden">
          {renderPane(
            'A',
            currentAttachmentA,
            blobUrlA,
            isLoadingA,
            errorA,
            transformA,
            setSelectedIdA
          )}

          {isCompareMode &&
            renderPane(
              'B',
              currentAttachmentB,
              blobUrlB,
              isLoadingB,
              errorB,
              transformB,
              setSelectedIdB
            )}
        </div>
      </div>
    </div>
  );
}
