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
  isMainPathSecondaryLanguage,
  type AssScriptMeta,
  type SubtitleAttribution,
} from '@/utils/subtitleCore';
import {
  ASS_PRESET_IDS,
  DEFAULT_NAMING_ID,
  EXPORT_PRESETS,
  NAMING_OPTIONS,
  SRT_ADDON_IDS,
  SRT_ADDON_LABELS,
  getNamingOption,
  planExportBundle,
  resolvePresetStyle,
  type ExportPresetId,
} from '@/utils/exportPresets';
import {
  HDR_BUNDLE_FOLDER,
  HDR_LEVEL_ORDER,
  HDR_LEVELS_PROVISIONAL,
  type HdrLevelId,
} from '@/utils/hdrPresets';
import { buildMergeReviewQueue } from '@/utils/timeline/alignmentDiff';
import { applyCreditPlan, buildClosingCreditLines, classifyCreditCue, planCredits } from '@/core/credits';
import { buildExportBaseFromMeta, type NamingMode } from '@/core/taskModel';

const NAMING_STORAGE_KEY = 'saiko_export_naming';
const SRT_ADDONS_STORAGE_KEY = 'saiko_export_srt_addons';
const NAME_MODE_STORAGE_KEY = 'saiko_export_name_mode';

export const NAME_MODE_OPTIONS: { id: NamingMode; label: string }[] = [
  { id: 'original', label: '原文名' },
  { id: 'zh+original', label: '中文 + 原文名' },
];
const isNameMode = (v: unknown): v is NamingMode => v === 'original' || v === 'zh+original';

/**
 * Export base name: manual title > borrowed video filename > TMDB 原文名(.年份.SxxEyy) > task title.
 */
export const useExportBaseName = (mode: NamingMode): string =>
  useStudioStore((state) => {
    if (state.filenameSource === 'manual' && state.customFilename.trim()) return state.customFilename;
    return buildExportBaseFromMeta(state.tmdbData, state.filenameEpKey, mode, {
      videoName: state.borrowedVideoName,
      fallback: state.customFilename || 'subtitles',
    });
  });

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
  nameMode: NamingMode;
  /** 同时生成 HDR 版: level of the extra ASS under HDR/ (null = SDR only). */
  hdrLevel: HdrLevelId | null;
}

/**
 * Export choices, remembered locally (§B: choose a plan, not parameters).
 * Default = one ASS file; SRT variants are opt-in add-ons that turn the download into a zip.
 */
export const useExportChoices = () => {
  // Preset + HDR live in the store so the preview toolbar and this menu stay in sync (preview == export).
  const { assPresetId, setAssPresetId, hdrEnabled, hdrLevelChoice, setHdr } = useStudioStore(useShallow((s) => ({
    assPresetId: s.exportPresetId,
    setAssPresetId: s.setExportPresetId,
    hdrEnabled: s.hdrEnabled,
    hdrLevelChoice: s.hdrLevel,
    setHdr: s.setHdr,
  })));
  const [namingId, setNamingIdState] = useState<string>(DEFAULT_NAMING_ID);
  const [srtAddonIds, setSrtAddonIdsState] = useState<ExportPresetId[]>([]);
  const [nameMode, setNameModeState] = useState<NamingMode>('original');
  useEffect(() => {
    setNamingIdState(getNamingOption(readStoredChoice(NAMING_STORAGE_KEY)).id);
    const storedAddons = (readStoredChoice(SRT_ADDONS_STORAGE_KEY) || '').split(',');
    setSrtAddonIdsState(SRT_ADDON_IDS.filter((id) => storedAddons.includes(id)));
    const storedMode = readStoredChoice(NAME_MODE_STORAGE_KEY);
    if (isNameMode(storedMode)) setNameModeState(storedMode);
  }, []);
  const setHdrEnabled = (enabled: boolean) => setHdr(enabled);
  const setHdrLevelChoice = (level: HdrLevelId) => setHdr(hdrEnabled, level);
  const hdrLevel: HdrLevelId | null = hdrEnabled ? hdrLevelChoice : null;
  const setNamingId = (id: string) => {
    setNamingIdState(id);
    writeStoredChoice(NAMING_STORAGE_KEY, id);
  };
  const setNameMode = (mode: NamingMode) => {
    setNameModeState(mode);
    writeStoredChoice(NAME_MODE_STORAGE_KEY, mode);
  };
  const toggleSrtAddon = (id: ExportPresetId) => {
    setSrtAddonIdsState((prev) => {
      const next = SRT_ADDON_IDS.filter((item) => (item === id ? !prev.includes(id) : prev.includes(item)));
      writeStoredChoice(SRT_ADDONS_STORAGE_KEY, next.join(','));
      return next;
    });
  };
  return {
    assPresetId, setAssPresetId, namingId, setNamingId, srtAddonIds, toggleSrtAddon,
    hdrEnabled, setHdrEnabled, hdrLevelChoice, setHdrLevelChoice, hdrLevel, nameMode, setNameMode,
  };
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

const joinAttribution = (list: SubtitleAttribution[], roles: SubtitleAttribution['role'][]) =>
  [...new Set(list.filter((item) => roles.includes(item.role)).map((item) => item.value.trim()).filter(Boolean))].join('; ') || undefined;

const buildAssScriptMeta = ({
  creatorCredit,
  creditDeclaration,
  isOfficialSubtitle,
  attributions = [],
}: {
  creatorCredit: string;
  creditDeclaration: CreditDeclaration;
  isOfficialSubtitle: boolean;
  attributions?: SubtitleAttribution[];
}): AssScriptMeta | undefined => {
  const comments: string[] = [];
  const declaration = DECLARATION_LABEL[creditDeclaration];
  if (declaration) comments.push(`声明：${declaration}`);
  if (isOfficialSubtitle) comments.push('来源：官方字幕');
  // The merging user goes to Script Updated By; original credits keep their own fields
  // (core/credits rules). Never write the user's name into Original Script.
  const scriptUpdatedBy = creatorCredit.trim() || undefined;
  const originalTranslation = joinAttribution(attributions, ['translator', 'publisher']);
  const originalEditing = joinAttribution(attributions, ['editor', 'proofreader']);
  const originalTiming = joinAttribution(attributions, ['timing']);
  const updateDetails = comments.length > 0 ? comments.join('；') : undefined;
  if (!scriptUpdatedBy && !originalTranslation && !originalEditing && !originalTiming && comments.length === 0) return undefined;
  return {
    originalTranslation,
    originalEditing,
    originalTiming,
    scriptUpdatedBy,
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
    filenameSource,
    filenameEpKey,
    borrowedVideoName,
    tmdbData,
    customStyle,
    creatorCredit,
    detectedAttributions,
    appendCreatorCredit,
    keepOriginalCredit,
    creditDeclaration,
    creditPlacement,
    isOfficialSubtitle,
    selectedTaskId,
    mergeReviewCheckedByTask,
    addLog,
    setStatusNotice,
    isTraditional,
    secondaryLang,
  } = useStudioStore(useShallow((state) => ({
    processedSubs: state.processedSubs,
    customFilename: state.customFilename,
    filenameSource: state.filenameSource,
    filenameEpKey: state.filenameEpKey,
    borrowedVideoName: state.borrowedVideoName,
    tmdbData: state.tmdbData,
    customStyle: state.customStyle,
    creatorCredit: state.creatorCredit,
    detectedAttributions: state.detectedAttributions,
    appendCreatorCredit: state.appendCreatorCredit,
    keepOriginalCredit: state.keepOriginalCredit,
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
    /** Second-language tag for the「通用 · .zh-Hans.<lang>」naming (en / es / fr / ja / ko …). */
    secondaryLang: (() => {
      const task = state.tasks.find((item) => item.id === state.selectedTaskId);
      const lang = task?.en?.lang || task?.zh?.languagePair?.secondary || 'en';
      return isMainPathSecondaryLanguage(lang) ? lang : 'en';
    })(),
  })));

  /** ASS (+ optional SRT add-ons). More than one file → one zip, built locally in the browser. */
  const handleExport = async ({ assPresetId, srtAddonIds, namingId, hdrLevel, nameMode }: ExportRequest) => {
    if (!processedSubs || processedSubs.length === 0) return;

    const taskKey = selectedTaskId || customFilename || '_default';
    const queue = buildMergeReviewQueue(processedSubs);
    const checked = new Set(mergeReviewCheckedByTask[taskKey] ?? []);
    const checkedCount = queue.items.reduce((count, item) => count + (checked.has(item.id) ? 1 : 0), 0);
    const remaining = Math.max(0, queue.total - checkedCount);
    if (remaining > 0) {
      setStatusNotice({
        id: 'merge-review-unchecked',
        tone: 'notice',
        title: `还有 ${remaining} 项未核对，仍可继续`,
        message: `合轴待复核已核对 ${checkedCount} / 共 ${queue.total}。导出不会被拦截。`,
      });
    }

    try {
      // Credit block (core/credits): secondary statements leave the timeline (→ anonymous thanks),
      // formal credits stay in place and are never filtered; the user's 「双语合并：」 line comes after the original.
      const creditPlan = planCredits({
        primaryRows: processedSubs,
        user: appendCreatorCredit && creatorCredit.trim() ? { name: creatorCredit, placement: creditPlacement } : undefined,
        keepFormalInPlace: keepOriginalCredit,
      });
      const exportSubs = buildClosingCreditLines(creditPlan).reduce(
        (rows, line) => appendCreatorCreditCue(rows, line, creditPlacement, true),
        applyCreditPlan(processedSubs, creditPlan),
      );
      const auxiliaryMode = customStyle.auxiliaryMode || 'keep';
      const isFormalCredit = (row: { text: string }) => classifyCreditCue(row.text.replace(/\\N|\n/g, ' '))?.kind === 'formal';
      const closing = new Set(buildClosingCreditLines(creditPlan));
      const filteredExportSubs = applyAuxiliarySubtitleMode(
        exportSubs,
        auxiliaryMode,
        (row) => (creditPlan.keepFormalInPlace && isFormalCredit(row)) || closing.has(row.text),
      );
      const hiddenAuxiliaryCount = exportSubs.length - filteredExportSubs.length;
      const baseName = filenameSource === 'manual' && customFilename.trim()
        ? customFilename
        : buildExportBaseFromMeta(tmdbData, filenameEpKey, nameMode, { videoName: borrowedVideoName, fallback: customFilename || 'subtitles' });
      const plan = planExportBundle(baseName, namingId, assPresetId, srtAddonIds, { traditional: isTraditional, hdr: hdrLevel, secondary: secondaryLang });
      const report = createWrapReport();
      const scriptMeta = buildAssScriptMeta({ creatorCredit, creditDeclaration, isOfficialSubtitle, attributions: detectedAttributions });

      const files = plan.files.map((file) => {
        const preset = EXPORT_PRESETS[file.presetId];
        const exportStyle = { ...resolvePresetStyle(customStyle, preset), auxiliaryMode: 'keep' as const };
        // The HDR copy re-runs the same export; don't double-count its wrap stats.
        const runOptions = { profile: preset.profile, report: file.hdr ? undefined : report, hdr: file.hdr ?? null };
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

      const hdrCount = files.filter((file) => file.hdr).length;
      const srtCount = files.filter((file) => file.format === 'srt').length;
      const what = plan.zipName
        ? `打包下载 ${plan.zipName}（${describeBundle(hdrCount, srtCount)}）`
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

  return { handleExport, isTraditional, secondaryLang };
};

/** 「ASS + HDR 版 + 2 个 SRT」 */
const describeBundle = (hdrCount: number, srtCount: number): string =>
  ['ASS', hdrCount > 0 ? 'HDR 版' : '', srtCount > 0 ? `${srtCount} 个 SRT` : ''].filter(Boolean).join(' + ');


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
  const { handleExport, isTraditional, secondaryLang } = useExport();
  const {
    assPresetId, setAssPresetId, namingId, setNamingId, srtAddonIds, toggleSrtAddon,
    hdrEnabled, setHdrEnabled, hdrLevelChoice, setHdrLevelChoice, hdrLevel, nameMode, setNameMode,
  } = useExportChoices();
  const exportBaseName = useExportBaseName(nameMode);
  const plan = planExportBundle(exportBaseName, namingId, assPresetId, srtAddonIds, { traditional: isTraditional, hdr: hdrLevel, secondary: secondaryLang });
  const planHdrCount = plan.files.filter((file) => file.hdr).length;
  const planSrtCount = plan.files.filter((file) => file.format === 'srt').length;
  const bundled = Boolean(plan.zipName);

  useEffect(() => {
    if (!open) return;

    const updatePosition = () => {
      const rect = buttonRef.current?.getBoundingClientRect();
      if (!rect) return;
      const width = Math.min(21.25 * 16, window.innerWidth - 16);
      const left = Math.min(
        window.innerWidth - width - 8,
        Math.max(8, rect.right - width),
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
    // Always the opaque light panel (also on the dark theater): fixes dark-on-dark labels.
    `ui-menu export-menu dropdown-pop z-[var(--z-dropdown)]${menuShell === 'theater' ? ' export-menu--on-dark' : ''}`;

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
            data-surface="cream"
            style={{
              position: 'fixed',
              top: menuPos.top,
              left: menuPos.left,
              width: menuPos.width,
            }}
            className={menuClass}
          >
            <div className="export-menu__body">
              <p className="ds-title">导出字幕</p>
              <div className="export-menu__row">
                <span className="ds-label">
                  文件名
                  <span className="ds-info" title="默认用片子的原文名（和片源文件名一致），也可在前面加上中文片名。" aria-label="文件名说明">ⓘ</span>
                </span>
                <div className="ds-segmented" role="radiogroup" aria-label="文件名">
                  {NAME_MODE_OPTIONS.map((option) => (
                    <button
                      key={option.id}
                      type="button"
                      role="radio"
                      aria-checked={nameMode === option.id}
                      className="ds-segmented__item"
                      onClick={() => setNameMode(option.id)}
                    >
                      {option.label}
                    </button>
                  ))}
                </div>
              </div>
              <div className="export-menu__grid">
                <label className="min-w-0">
                  <span className="ds-label">样式</span>
                  <select
                    className="ds-select"
                    value={assPresetId}
                    onChange={(event) => setAssPresetId(event.target.value as ExportPresetId)}
                    aria-label="ASS 样式"
                  >
                    {ASS_PRESET_IDS.map((id) => (
                      <option key={id} value={id}>{EXPORT_PRESETS[id].label}</option>
                    ))}
                  </select>
                </label>
                <label className="min-w-0">
                  <span className="ds-label">语言后缀</span>
                  <select
                    className="ds-select"
                    value={namingId}
                    onChange={(event) => setNamingId(event.target.value)}
                    aria-label="语言后缀"
                  >
                    {NAMING_OPTIONS.map((option) => (
                      <option key={option.id} value={option.id}>{option.id === 'plain' ? '不加' : option.label}</option>
                    ))}
                  </select>
                </label>
              </div>
              <fieldset className="export-menu__row">
                <legend className="ds-label">另附 SRT（可选）</legend>
                <div className="flex flex-wrap gap-x-3 gap-y-1">
                  {SRT_ADDON_IDS.map((id) => (
                    <label key={id} className="ds-check" title={EXPORT_PRESETS[id].description}>
                      <input
                        type="checkbox"
                        checked={srtAddonIds.includes(id)}
                        onChange={() => toggleSrtAddon(id)}
                      />
                      {SRT_ADDON_LABELS[id]}
                    </label>
                  ))}
                </div>
              </fieldset>
              <div className="export-menu__row flex items-center gap-2">
                <label className="ds-check" title={`HDR 版放在 zip 的 ${HDR_BUNDLE_FOLDER}/ 文件夹；SRT 不生成 HDR 版`}>
                  <input
                    type="checkbox"
                    checked={hdrEnabled}
                    onChange={(event) => setHdrEnabled(event.target.checked)}
                  />
                  另附 HDR 版
                </label>
                <select
                  className="ds-select !w-auto"
                  value={hdrLevelChoice}
                  disabled={!hdrEnabled}
                  onChange={(event) => setHdrLevelChoice(event.target.value as HdrLevelId)}
                  aria-label="HDR 档位"
                  title={HDR_LEVELS_PROVISIONAL[hdrLevelChoice].hint}
                >
                  {HDR_LEVEL_ORDER.map((id) => (
                    <option key={id} value={id}>{HDR_LEVELS_PROVISIONAL[id].label}</option>
                  ))}
                </select>
              </div>
            </div>
            <div className="p-1.5">
              <button
                type="button"
                disabled={busy}
                className="export-menu__download v4-focus-ring"
                title={plan.files.map((file) => file.filename).join('\n')}
                onClick={async () => {
                  setBusy(true);
                  try {
                    await handleExport({ assPresetId, srtAddonIds, namingId, hdrLevel, nameMode });
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
                  <span className="ds-body block font-semibold">
                    {bundled ? `打包下载（${describeBundle(planHdrCount, planSrtCount)}）` : '下载 ASS'}
                  </span>
                  <span className="ds-meta ds-mono block truncate">
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
