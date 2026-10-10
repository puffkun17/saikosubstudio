'use client';

import React, { useState, useEffect, useRef } from 'react';
import { ChevronDown, SquareArrowRightExit } from 'lucide-react';
import { useShallow } from 'zustand/react/shallow';
import { useStudioStore, type CreditDeclaration } from '@/store/useStudioStore';
import { OverlayPortal } from '@/components/Global/OverlayPortal';
import {
  appendCreatorCredit as appendCreatorCreditCue,
  applyAuxiliarySubtitleMode,
  generateSrtContent,
  generateAssContent,
  createWrapReport,
  type AssScriptMeta,
} from '@/utils/subtitleCore';
import {
  ASS_PRESET_IDS,
  DEFAULT_EXPORT_PRESET_ID,
  DEFAULT_NAMING_ID,
  EXPORT_PRESETS,
  NAMING_OPTIONS,
  SRT_ADDON_IDS,
  SRT_ADDON_LABELS,
  getExportPreset,
  getNamingOption,
  planExportBundle,
  resolvePresetStyle,
  type ExportPresetId,
} from '@/utils/exportPresets';
import { buildMergeReviewQueue } from '@/utils/timeline/alignmentDiff';

const PRESET_STORAGE_KEY = 'saiko_export_preset';
const NAMING_STORAGE_KEY = 'saiko_export_naming';
const SRT_ADDONS_STORAGE_KEY = 'saiko_export_srt_addons';

const readStoredChoice = (key: string): string | null => {
  try {
    return typeof localStorage !== 'undefined' ? localStorage.getItem(key) : null;
  } catch {
    return null;
  }
};

const writeStoredChoice = (key: string, value: string) => {
  try {
    localStorage.setItem(key, value);
  } catch {
    /* ignore quota / private mode */
  }
};

export interface ExportRequest {
  assPresetId: ExportPresetId;
  srtAddonIds: ExportPresetId[];
  namingId: string;
}

/**
 * Export choices, remembered locally (§B: choose a plan, not parameters).
 * Default = one ASS file; SRT variants are opt-in add-ons that turn the download into a zip.
 */
export const useExportChoices = () => {
  const [assPresetId, setAssPresetIdState] = useState<ExportPresetId>(DEFAULT_EXPORT_PRESET_ID);
  const [namingId, setNamingIdState] = useState<string>(DEFAULT_NAMING_ID);
  const [srtAddonIds, setSrtAddonIdsState] = useState<ExportPresetId[]>([]);
  useEffect(() => {
    const storedPreset = getExportPreset(readStoredChoice(PRESET_STORAGE_KEY));
    setAssPresetIdState(storedPreset.formats.includes('ass') ? storedPreset.id : DEFAULT_EXPORT_PRESET_ID);
    setNamingIdState(getNamingOption(readStoredChoice(NAMING_STORAGE_KEY)).id);
    const storedAddons = (readStoredChoice(SRT_ADDONS_STORAGE_KEY) || '').split(',');
    setSrtAddonIdsState(SRT_ADDON_IDS.filter((id) => storedAddons.includes(id)));
  }, []);
  const setAssPresetId = (id: ExportPresetId) => {
    setAssPresetIdState(id);
    writeStoredChoice(PRESET_STORAGE_KEY, id);
  };
  const setNamingId = (id: string) => {
    setNamingIdState(id);
    writeStoredChoice(NAMING_STORAGE_KEY, id);
  };
  const toggleSrtAddon = (id: ExportPresetId) => {
    setSrtAddonIdsState((prev) => {
      const next = SRT_ADDON_IDS.filter((item) => (item === id ? !prev.includes(id) : prev.includes(item)));
      writeStoredChoice(SRT_ADDONS_STORAGE_KEY, next.join(','));
      return next;
    });
  };
  return { assPresetId, setAssPresetId, namingId, setNamingId, srtAddonIds, toggleSrtAddon };
};

const triggerDownload = (blob: Blob, filename: string) => {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
};

const DECLARATION_LABEL: Record<CreditDeclaration, string | null> = {
  none: null,
  original: '原创字幕',
  'ai-assisted': '含 AI 提示/生成辅助',
  translated: '翻译或二次整理',
};

const buildAssScriptMeta = ({
  creatorCredit,
  creditDeclaration,
  isOfficialSubtitle,
}: {
  creatorCredit: string;
  creditDeclaration: CreditDeclaration;
  isOfficialSubtitle: boolean;
}): AssScriptMeta | undefined => {
  const comments: string[] = [];
  const declaration = DECLARATION_LABEL[creditDeclaration];
  if (declaration) comments.push(`声明：${declaration}`);
  if (isOfficialSubtitle) comments.push('来源：官方字幕');
  const originalScript = creatorCredit.trim() || undefined;
  const updateDetails = comments.length > 0 ? comments.join('；') : undefined;
  if (!originalScript && comments.length === 0) return undefined;
  return {
    originalScript,
    comments,
    updateDetails,
  };
};

/**
 * #16 — Shared export hook to avoid duplication in WorkbenchStep + TheaterStep
 */
export const useExport = () => {
  const {
    processedSubs,
    customFilename,
    customStyle,
    creatorCredit,
    appendCreatorCredit,
    creditDeclaration,
    creditPlacement,
    isOfficialSubtitle,
    selectedTaskId,
    mergeReviewCheckedByTask,
    addLog,
    setStatusNotice,
    isTraditional,
  } = useStudioStore(useShallow((state) => ({
    processedSubs: state.processedSubs,
    customFilename: state.customFilename,
    customStyle: state.customStyle,
    creatorCredit: state.creatorCredit,
    appendCreatorCredit: state.appendCreatorCredit,
    creditDeclaration: state.creditDeclaration,
    creditPlacement: state.creditPlacement,
    isOfficialSubtitle: state.isOfficialSubtitle,
    selectedTaskId: state.selectedTaskId,
    mergeReviewCheckedByTask: state.mergeReviewCheckedByTask,
    addLog: state.addLog,
    setStatusNotice: state.setStatusNotice,
    isTraditional: (() => {
      const task = state.tasks.find((item) => item.id === state.selectedTaskId);
      return task?.zh?.lang === 'zh-TW' || task?.zh?.languagePair?.primary === 'zh-TW';
    })(),
  })));

  /** ASS (+ optional SRT add-ons). More than one file → one zip, built locally in the browser. */
  const handleExport = async ({ assPresetId, srtAddonIds, namingId }: ExportRequest) => {
    if (!processedSubs || processedSubs.length === 0) return;

    const taskKey = selectedTaskId || customFilename || '_default';
    const queue = buildMergeReviewQueue(processedSubs);
    const checked = new Set(mergeReviewCheckedByTask[taskKey] ?? []);
    const checkedCount = queue.items.reduce((count, item) => count + (checked.has(item.id) ? 1 : 0), 0);
    const remaining = Math.max(0, queue.total - checkedCount);
    if (remaining > 0) {
      const skipConfirm = typeof sessionStorage !== 'undefined'
        && sessionStorage.getItem('saiko_skip_review_confirm') === '1';
      if (!skipConfirm) {
        const ok = window.confirm(`还有 ${remaining} 项未核对，仍要继续？`);
        if (!ok) return;
        try {
          sessionStorage.setItem('saiko_skip_review_confirm', '1');
        } catch {
          /* ignore quota / private mode */
        }
      }
      setStatusNotice({
        id: 'merge-review-unchecked',
        tone: 'notice',
        title: `还有 ${remaining} 项未核对，仍可继续`,
        message: `合轴待复核已核对 ${checkedCount} / 共 ${queue.total}。导出不会被拦截。`,
      });
    }

    try {
      const exportSubs = appendCreatorCredit
        ? appendCreatorCreditCue(processedSubs, creatorCredit, creditPlacement)
        : processedSubs;
      const auxiliaryMode = customStyle.auxiliaryMode || 'keep';
      const filteredExportSubs = applyAuxiliarySubtitleMode(exportSubs, auxiliaryMode);
      const hiddenAuxiliaryCount = exportSubs.length - filteredExportSubs.length;
      const plan = planExportBundle(customFilename || 'subtitles', namingId, assPresetId, srtAddonIds, { traditional: isTraditional });
      const report = createWrapReport();
      const scriptMeta = buildAssScriptMeta({ creatorCredit, creditDeclaration, isOfficialSubtitle });

      const files = plan.files.map((file) => {
        const preset = EXPORT_PRESETS[file.presetId];
        const exportStyle = { ...resolvePresetStyle(customStyle, preset), auxiliaryMode: 'keep' as const };
        const runOptions = { profile: preset.profile, report };
        const content = file.format === 'srt'
          ? generateSrtContent(filteredExportSubs, exportStyle, runOptions)
          : generateAssContent(filteredExportSubs, exportStyle, customFilename, scriptMeta, runOptions);
        return { ...file, content };
      });

      if (plan.zipName) {
        // Local only: the zip is assembled in this tab (jszip, already a dependency) — nothing is uploaded.
        const { default: JSZip } = await import('jszip');
        const zip = new JSZip();
        for (const file of files) zip.file(file.filename, file.content);
        const blob = await zip.generateAsync({ type: 'blob', compression: 'DEFLATE', mimeType: 'application/zip' });
        triggerDownload(blob, plan.zipName);
      } else {
        const [file] = files;
        triggerDownload(new Blob([file.content], { type: 'text/x-ass;charset=utf-8' }), file.filename);
      }

      const what = plan.zipName
        ? `打包下载 ${plan.zipName}（ASS + ${files.length - 1} 个 SRT）`
        : `ASS（${EXPORT_PRESETS[plan.files[0].presetId].label}）`;
      addLog(
        hiddenAuxiliaryCount > 0
          ? `导出成功: ${what}，已按辅助字幕策略隐藏 ${hiddenAuxiliaryCount} 行`
          : `导出成功: ${what}`,
        'success',
      );
      if (report.overflow > 0) {
        addLog(`智能换行：${report.overflow} 行在预设宽度内仍放不下（如超长网址），未硬塞第三行，建议复核`, 'info');
      }
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      addLog(`导出失败: ${msg}`, 'error');
    }
  };

  return { handleExport, isTraditional };
};

const selectClass = 'v4-focus-ring mt-0.5 w-full truncate rounded-md border border-[var(--v4-line)] bg-[var(--v4-panel-muted)] px-1.5 py-1 text-xs text-[var(--v4-text)]';

/**
 * #9 — Export dropdown：菜单走 OverlayPortal + fixed，避免被放映厅样式壳压住。
 * Theater 下复用 theater-style-shell 玻璃，不单独改配色。
 * 默认下载一个 ASS；勾选 SRT 附加项后改为「打包下载」zip（本地生成）。
 */
export const ExportDropdown: React.FC<{
  variant?: 'primary' | 'ghost';
  menuShell?: 'default' | 'theater';
}> = ({ variant = 'primary', menuShell = 'default' }) => {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [menuPos, setMenuPos] = useState<{ top: number; left: number; width: number } | null>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const { handleExport, isTraditional } = useExport();
  const { assPresetId, setAssPresetId, namingId, setNamingId, srtAddonIds, toggleSrtAddon } = useExportChoices();
  const { customFilename } = useStudioStore(useShallow((state) => ({ customFilename: state.customFilename })));
  const plan = planExportBundle(customFilename || 'subtitles', namingId, assPresetId, srtAddonIds, { traditional: isTraditional });
  const bundled = Boolean(plan.zipName);

  useEffect(() => {
    if (!open) return;

    const updatePosition = () => {
      const rect = buttonRef.current?.getBoundingClientRect();
      if (!rect) return;
      const width = Math.min(18.5 * 16, window.innerWidth - 32);
      const left = Math.min(
        window.innerWidth - width - 16,
        Math.max(16, rect.right - width),
      );
      setMenuPos({
        top: rect.bottom + 8,
        left,
        width,
      });
    };

    updatePosition();
    window.addEventListener('resize', updatePosition);
    window.addEventListener('scroll', updatePosition, true);
    return () => {
      window.removeEventListener('resize', updatePosition);
      window.removeEventListener('scroll', updatePosition, true);
    };
  }, [open]);

  // Close on outside click（按钮 + 菜单均算内部）
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      const target = e.target as Node;
      if (buttonRef.current?.contains(target) || menuRef.current?.contains(target)) return;
      setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const handler = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false);
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [open]);

  const primaryClass = 'ui-action ui-action--lg export-next-cta';
  const ghostClass = 'ui-action ui-action--secondary ui-action--lg';
  const menuClass =
    menuShell === 'theater'
      ? 'theater-style-shell dropdown-pop z-[var(--z-dropdown)] min-w-[12rem] overflow-hidden rounded-lg'
      : 'ui-menu dropdown-pop z-[var(--z-dropdown)]';

  return (
    <div className="relative">
      <button
        ref={buttonRef}
        type="button"
        className={variant === 'primary' ? primaryClass : ghostClass}
        onClick={() => setOpen(!open)}
        aria-expanded={open}
        aria-haspopup="dialog"
      >
        <SquareArrowRightExit className="h-4 w-4" aria-hidden="true" />
        导出字幕
        <ChevronDown
          className={`h-4 w-4 opacity-70 transition-transform duration-200 ${open ? 'rotate-180' : ''}`}
          aria-hidden="true"
        />
      </button>

      {open && menuPos && (
        <OverlayPortal>
          <div
            ref={menuRef}
            role="dialog"
            aria-label="导出字幕"
            style={{
              position: 'fixed',
              top: menuPos.top,
              left: menuPos.left,
              width: menuPos.width,
            }}
            className={menuClass}
          >
            <div className="border-b border-[var(--v4-line)] px-3.5 py-2.5">
              <p className="text-xs font-semibold tracking-wide text-[var(--v4-text)]">导出字幕</p>
              <p className="mt-0.5 text-xs leading-4 text-[var(--v4-text-faint)]">下载到本地，如视频文件所在目录等</p>
              <div className="mt-2 grid grid-cols-2 gap-1.5">
                <label className="min-w-0">
                  <span className="block text-[0.6875rem] leading-4 text-[var(--v4-text-faint)]">ASS 预设</span>
                  <select
                    className={selectClass}
                    value={assPresetId}
                    onChange={(event) => setAssPresetId(event.target.value as ExportPresetId)}
                    aria-label="ASS 预设"
                  >
                    {ASS_PRESET_IDS.map((id) => (
                      <option key={id} value={id}>{EXPORT_PRESETS[id].label}</option>
                    ))}
                  </select>
                </label>
                <label className="min-w-0">
                  <span className="block text-[0.6875rem] leading-4 text-[var(--v4-text-faint)]">命名</span>
                  <select
                    className={selectClass}
                    value={namingId}
                    onChange={(event) => setNamingId(event.target.value)}
                    aria-label="文件命名"
                  >
                    {NAMING_OPTIONS.map((option) => (
                      <option key={option.id} value={option.id}>{option.label}</option>
                    ))}
                  </select>
                </label>
              </div>
              <fieldset className="mt-2">
                <legend className="text-[0.6875rem] leading-4 text-[var(--v4-text-faint)]">附带 SRT（可选，勾选后打包下载）</legend>
                <div className="mt-0.5 flex flex-wrap gap-x-3 gap-y-1">
                  {SRT_ADDON_IDS.map((id) => (
                    <label key={id} className="inline-flex cursor-pointer items-center gap-1 text-xs text-[var(--v4-text-muted)]" title={EXPORT_PRESETS[id].description}>
                      <input
                        type="checkbox"
                        className="v4-focus-ring h-3.5 w-3.5 accent-[var(--v4-accent)]"
                        checked={srtAddonIds.includes(id)}
                        onChange={() => toggleSrtAddon(id)}
                      />
                      {SRT_ADDON_LABELS[id]}
                    </label>
                  ))}
                </div>
              </fieldset>
            </div>
            <div className="p-1.5">
              <button
                type="button"
                disabled={busy}
                className="v4-focus-ring flex w-full cursor-pointer items-start gap-3 rounded-md px-2.5 py-2.5 text-left transition-colors hover:bg-[var(--v4-accent-soft)] disabled:cursor-wait disabled:opacity-60"
                title={plan.files.map((file) => file.filename).join('\n')}
                onClick={async () => {
                  setBusy(true);
                  try {
                    await handleExport({ assPresetId, srtAddonIds, namingId });
                  } finally {
                    setBusy(false);
                    setOpen(false);
                  }
                }}
              >
                <span className="mt-0.5 inline-flex min-w-[2.75rem] shrink-0 items-center justify-center rounded-md border border-[var(--v4-accent)]/25 bg-[var(--v4-accent-soft)] px-1.5 py-1 font-mono text-xs font-bold tracking-wide text-[var(--v4-accent-strong)]">
                  {bundled ? 'ZIP' : 'ASS'}
                </span>
                <span className="min-w-0">
                  <span className="block text-sm font-semibold text-[var(--v4-text)]">
                    {bundled ? `打包下载（ASS + ${plan.files.length - 1} 个 SRT）` : '下载 ASS'}
                  </span>
                  <span className="mt-0.5 block truncate text-xs leading-4 text-[var(--v4-text-muted)]">
                    {plan.zipName ?? plan.files[0].filename}
                  </span>
                </span>
              </button>
            </div>
          </div>
        </OverlayPortal>
      )}
    </div>
  );
};
