'use client';

import React, { useState, useEffect } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { applyOverridesToProfile } from '@/utils/previewStyle';
import { useSelectedStyleEntry } from '@/components/Settings/StyleLibrary';
import { resolveExportBase, useStudioStore, type CreditDeclaration } from '@/store/useStudioStore';
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
import { REVIEW_CODE_TABLE, deriveExportReview, reviewLabel } from '@/core/exportReview';
import { arrayIndexOfLine, lineNumberOf } from '@/core/lineKinds';
import { reviewTaskKey } from '@/core/reviewKey';
import { reviewNoticeMessage, reviewNoticeTitle } from '@/components/Global/ReviewNoticeSync';
import { applyCreditPlan, buildClosingCreditLines, classifyCreditCue, planCredits } from '@/core/credits';
import type { NamingMode } from '@/core/taskModel';

const NAMING_STORAGE_KEY = 'saiko_export_naming';
const SRT_ADDONS_STORAGE_KEY = 'saiko_export_srt_addons';

export const NAME_MODE_OPTIONS: { id: NamingMode; label: string }[] = [
  { id: 'original', label: '原片名' },
  { id: 'zh+original', label: '中文名 + 原片名' },
];

/** R-xx list for the export menu (derived; never blocks the download). */
export const useExportReview = () => {
  const { processedSubs, tmdbData, filenameEpKey, isTv } = useStudioStore(useShallow((s) => ({
    processedSubs: s.processedSubs,
    tmdbData: s.tmdbData,
    filenameEpKey: s.filenameEpKey,
    isTv: s.tasks.find((t) => t.id === s.selectedTaskId)?.epKey != null || /S\d+E\d+/i.test(s.customFilename),
  })));
  return React.useMemo(() => {
    const rows = processedSubs ?? [];
    if (rows.length === 0) return [];
    const queue = buildMergeReviewQueue(rows);
    // R-11 = 单轨未配对行（与复核弹窗「单轨」同一批条目），行号一律 1 起始（row.index）。
    const unresolved = [...new Set(queue.items.filter((item) => item.category === 'single-track').flatMap((item) => item.rowIndexes))].sort((a, b) => a - b);
    const plan = planCredits({ primaryRows: rows });
    return deriveExportReview({
      rows,
      hasTmdb: Boolean(tmdbData),
      isTv,
      epKey: filenameEpKey,
      unresolvedRows: unresolved,
      movedStatementRows: plan.dropCueIndexes.map((i) => lineNumberOf(rows[i] ?? {}, i)),
    });
  }, [processedSubs, tmdbData, filenameEpKey, isTv]);
};

/** Export base name — the single source (store resolveExportBase). */
export const useExportBaseName = (): string => useStudioStore(resolveExportBase);

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
  const nameMode = useStudioStore((s) => s.exportNameMode);
  const setNameMode = useStudioStore((s) => s.setExportNameMode);
  useEffect(() => {
    setNamingIdState(getNamingOption(readStoredChoice(NAMING_STORAGE_KEY)).id);
    const storedAddons = (readStoredChoice(SRT_ADDONS_STORAGE_KEY) || '').split(',');
    setSrtAddonIdsState(SRT_ADDON_IDS.filter((id) => storedAddons.includes(id)));
  }, []);
  const setHdrEnabled = (enabled: boolean) => setHdr(enabled);
  const setHdrLevelChoice = (level: HdrLevelId) => setHdr(hdrEnabled, level);
  const hdrLevel: HdrLevelId | null = hdrEnabled ? hdrLevelChoice : null;
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
    customStyle,
    creatorCredit,
    detectedAttributions,
    appendCreatorCredit,
    isOfficialSubtitle,
    isOriginalWork,
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
    isOfficialSubtitle: state.isOfficialSubtitle,
    isOriginalWork: state.isOriginalWork,
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

    const taskKey = reviewTaskKey(selectedTaskId, processedSubs);
    const queue = buildMergeReviewQueue(processedSubs);
    const checked = new Set(mergeReviewCheckedByTask[taskKey] ?? []);
    const checkedCount = queue.items.reduce((count, item) => count + (checked.has(item.id) ? 1 : 0), 0);
    const remaining = Math.max(0, queue.total - checkedCount);
    if (remaining > 0) {
      setStatusNotice({
        id: 'merge-review-unchecked',
        tone: 'notice',
        title: reviewNoticeTitle(remaining),
        message: reviewNoticeMessage(checkedCount, queue.total),
      });
    }

    try {
      // Credit block (core/credits): secondary statements leave the timeline (→ anonymous thanks),
      // formal credits stay in place and are never filtered; the user's 「双语合并：」 line comes after the original.
      const creditPlan = planCredits({
        primaryRows: processedSubs,
        // 署名是内容：始终留在原时间点；「我的署名」只在导入来源为「原创」时追加，紧跟最后一行。
        user: isOriginalWork && appendCreatorCredit && creatorCredit.trim() ? { name: creatorCredit, placement: 'after-last' } : undefined,
        keepFormalInPlace: true,
      });
      const exportSubs = buildClosingCreditLines(creditPlan).reduce(
        (rows, line) => appendCreatorCreditCue(rows, line, 'after-last', true),
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
      const baseName = resolveExportBase({ ...useStudioStore.getState(), exportNameMode: nameMode });
      const plan = planExportBundle(baseName, namingId, assPresetId, srtAddonIds, { traditional: isTraditional, hdr: hdrLevel, secondary: secondaryLang });
      const report = createWrapReport();
      const scriptMeta = buildAssScriptMeta({ creatorCredit: isOriginalWork && appendCreatorCredit ? creatorCredit : '', creditDeclaration: isOriginalWork ? 'original' : 'none', isOfficialSubtitle, attributions: detectedAttributions });

      const files = plan.files.map((file) => {
        const preset = EXPORT_PRESETS[file.presetId];
        // Chosen ASS preset carries the user's 样式参数 overrides (preview == export); add-on SRT presets stay fixed.
        const overrides = file.presetId === assPresetId ? useStudioStore.getState().styleOverrides : {};
        // 预览画幅不进入导出：画面规格固定 16:9 帧（分辨率由样式决定）。
        const exportStyle = { ...resolvePresetStyle(customStyle, preset), ...overrides, aspectRatio: '16:9' as const, auxiliaryMode: 'keep' as const };
        // The HDR copy re-runs the same export; don't double-count its wrap stats.
        const runOptions = { profile: applyOverridesToProfile(preset, overrides), report: file.hdr ? undefined : report, hdr: file.hdr ?? null };
        const content = file.format === 'srt'
          ? generateSrtContent(filteredExportSubs, exportStyle, runOptions)
          : generateAssContent(filteredExportSubs, exportStyle, baseName, scriptMeta, runOptions);
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
 * 导出面板：放在剧场右侧停靠面板内（spec v1.1 §6），不再是浮层菜单，不遮挡预览。
 * 默认下载一个 ASS；勾选 SRT 附加项后改为打包下载 zip（本地生成）。
 */
export const ExportPanel: React.FC<{ onOpenStyle?: () => void }> = ({ onOpenStyle }) => {
  const [busy, setBusy] = useState(false);
  const { handleExport, isTraditional, secondaryLang } = useExport();
  const {
    assPresetId, namingId, setNamingId, srtAddonIds, toggleSrtAddon,
    hdrEnabled, setHdrEnabled, hdrLevelChoice, setHdrLevelChoice, hdrLevel, nameMode, setNameMode,
  } = useExportChoices();
  const styleState = useStudioStore(useShallow((st) => ({
    templates: st.customTemplates, source: st.foundAssStyle, active: st.activePreset,
    base: st.customStyle, presetId: st.exportPresetId, overrides: st.styleOverrides,
  })));
  const { entry: styleEntry, tuned: styleTuned } = useSelectedStyleEntry(styleState.templates, styleState.source, styleState.active, styleState.base, styleState.presetId, styleState.overrides);
  const styleName = `${styleEntry?.name ?? '自定义'}${styleTuned ? ' · 已微调' : ''}`;
  const exportBaseName = useExportBaseName();
  const customFilename = useStudioStore((s) => s.customFilename);
  const filenameSource = useStudioStore((s) => s.filenameSource);
  const setCustomFilename = useStudioStore((s) => s.setCustomFilename);
  const isManualName = filenameSource === 'manual' && Boolean(customFilename.trim());
  const reviewItems = useExportReview();
  /** `line` is a 1-based line number (same as shown); map it back to the array position. */
  const jumpToRow = (line: number) => {
    const st = useStudioStore.getState();
    const idx = arrayIndexOfLine(st.processedSubs ?? [], line);
    if (idx < 0) return;
    st.setIsPreviewPlaying(false);
    st.setPreviewIndex(idx);
    st.setJumpLineVal(String(line));
  };
  const plan = planExportBundle(exportBaseName, namingId, assPresetId, srtAddonIds, { traditional: isTraditional, hdr: hdrLevel, secondary: secondaryLang });
  const planHdrCount = plan.files.filter((file) => file.hdr).length;
  const planSrtCount = plan.files.filter((file) => file.format === 'srt').length;
  const bundled = Boolean(plan.zipName);

  return (
          <div className="export-menu" aria-label="导出字幕">
            <div className="export-menu__body">
              <div className="export-menu__row">
                <span className="ds-label">
                  文件名
                  <span className="ds-info" title="默认用原片名（与片源文件名一致），可加中文名前缀；也可直接改写，清空即恢复自动命名。" aria-label="文件名说明">ⓘ</span>
                </span>
                <input
                  type="text"
                  className="ds-select font-mono"
                  value={isManualName ? customFilename : exportBaseName}
                  onChange={(event) => setCustomFilename(event.target.value, event.target.value.trim() ? 'manual' : 'unknown')}
                  aria-label="导出文件名"
                  data-testid="export-filename"
                />
                <div className="ds-segmented" role="radiogroup" aria-label="文件名">
                  {NAME_MODE_OPTIONS.map((option) => (
                    <button
                      key={option.id}
                      type="button"
                      role="radio"
                      aria-checked={nameMode === option.id}
                      className="ds-segmented__item"
                      disabled={isManualName}
                      onClick={() => setNameMode(option.id)}
                    >
                      {option.label}
                    </button>
                  ))}
                </div>
              </div>
              <div className="export-menu__grid">
                <div className="min-w-0">
                  <span className="ds-label">样式</span>
                  {/* 样式只在「样式」面板里选；这里只显示，避免两处各选一份。 */}
                  <button type="button" className="ds-select flex items-center justify-between gap-2" onClick={onOpenStyle} data-testid="export-style-link" title="在「样式」面板中更改">
                    <span className="truncate">{styleName}</span>
                    <span className="ds-meta shrink-0">更改</span>
                  </button>
                </div>
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
                <label className="ds-check" title={`HDR 版放在 zip 的 ${HDR_BUNDLE_FOLDER}/ 文件夹；SRT 不生成 HDR 版。开启后预览按所选档位显示。`}>
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
            {reviewItems.length > 0 && (
              <div className="export-menu__review">
                <p className="ds-label">
                  复核提示（不影响导出）
                  <span className="ds-info" title={REVIEW_CODE_TABLE.map(([code, label]) => `${code} ${label}`).join('\n')} aria-label="复核代码表">ⓘ</span>
                </p>
                <ul className="mt-1 grid gap-1">
                  {reviewItems.map((item) => (
                    <li key={item.code} className="ds-meta flex flex-wrap items-baseline gap-x-1.5">
                      <span className="ds-mono font-semibold text-[var(--ds-ink-2)]">{item.code}</span>
                      <span className="min-w-0">{reviewLabel(item.code)}</span>
                      {(item.cues ?? []).slice(0, 3).map((row) => (
                        <button key={row} type="button" className="underline decoration-dotted hover:text-[var(--v5-accent-strong)]" onClick={() => jumpToRow(row)}>
                          第 {row} 行
                        </button>
                      ))}
                      {(item.cues?.length ?? 0) > 3 && <span>等 {item.cues!.length} 行</span>}
                    </li>
                  ))}
                </ul>
              </div>
            )}
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
  );
};
