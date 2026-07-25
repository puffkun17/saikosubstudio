'use client';

import React, { useState, useEffect, useRef } from 'react';
import { ChevronDown, SquareArrowRightExit } from 'lucide-react';
import { useShallow } from 'zustand/react/shallow';
import { useStudioStore, type CreditDeclaration } from '@/store/useStudioStore';
import {
  appendCreatorCredit as appendCreatorCreditCue,
  applyAuxiliarySubtitleMode,
  generateSrtContent,
  generateAssContent,
  type AssScriptMeta,
} from '@/utils/subtitleCore';

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
    addLog,
  } = useStudioStore(useShallow((state) => ({
    processedSubs: state.processedSubs,
    customFilename: state.customFilename,
    customStyle: state.customStyle,
    creatorCredit: state.creatorCredit,
    appendCreatorCredit: state.appendCreatorCredit,
    creditDeclaration: state.creditDeclaration,
    creditPlacement: state.creditPlacement,
    isOfficialSubtitle: state.isOfficialSubtitle,
    addLog: state.addLog,
  })));

  const handleDownload = (format: 'ass' | 'srt') => {
    if (!processedSubs || processedSubs.length === 0) return;
    try {
      let content = '';
      let mimeType = 'text/plain';
      let extension = '';

      const exportSubs = appendCreatorCredit
        ? appendCreatorCreditCue(processedSubs, creatorCredit, creditPlacement)
        : processedSubs;
      const auxiliaryMode = customStyle.auxiliaryMode || 'keep';
      const filteredExportSubs = applyAuxiliarySubtitleMode(exportSubs, auxiliaryMode);
      const hiddenAuxiliaryCount = exportSubs.length - filteredExportSubs.length;
      const exportStyle = { ...customStyle, auxiliaryMode: 'keep' as const };

      if (format === 'srt') {
        content = generateSrtContent(filteredExportSubs, exportStyle);
        mimeType = 'text/srt';
        extension = 'srt';
      } else {
        const scriptMeta = buildAssScriptMeta({
          creatorCredit,
          creditDeclaration,
          isOfficialSubtitle,
        });
        content = generateAssContent(filteredExportSubs, exportStyle, customFilename, scriptMeta);
        mimeType = 'text/x-ass';
        extension = 'ass';
      }

      const blob = new Blob([content], { type: `${mimeType};charset=utf-8` });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `${customFilename || 'subtitles'}.${extension}`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      addLog(
        hiddenAuxiliaryCount > 0
          ? `导出成功: ${format.toUpperCase()} 格式，已按辅助字幕策略隐藏 ${hiddenAuxiliaryCount} 行`
          : `导出成功: ${format.toUpperCase()} 格式`,
        'success',
      );
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      addLog(`导出失败: ${msg}`, 'error');
    }
  };

  return { handleDownload };
};

const EXPORT_OPTIONS = [
  {
    format: 'ass' as const,
    badge: 'ASS',
    title: '高级字幕',
    description: '配置颜色与样式；丰富字幕表达需求',
    emphasized: true,
  },
  {
    format: 'srt' as const,
    badge: 'SRT',
    title: '纯文本字幕',
    description: '轻便兼容；朴素简洁',
    emphasized: false,
  },
];

/**
 * #9 — Export dropdown that closes on outside click
 */
export const ExportDropdown: React.FC<{ variant?: 'primary' | 'ghost' }> = ({ variant = 'primary' }) => {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const { handleDownload } = useExport();

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
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

  const primaryClass = 'ui-action ui-action--lg';
  const ghostClass = 'ui-action ui-action--secondary ui-action--lg';

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        className={variant === 'primary' ? primaryClass : ghostClass}
        onClick={() => setOpen(!open)}
        aria-expanded={open}
        aria-haspopup="menu"
      >
        <SquareArrowRightExit className="h-4 w-4" aria-hidden="true" />
        导出字幕
        <ChevronDown
          className={`h-4 w-4 opacity-70 transition-transform duration-200 ${open ? 'rotate-180' : ''}`}
          aria-hidden="true"
        />
      </button>

      {open && (
        <div
          role="menu"
          aria-label="选择导出格式"
          className="dropdown-pop absolute right-0 top-full z-[110] mt-2 w-[min(18.5rem,calc(100vw-2rem))] overflow-hidden rounded-lg border border-[var(--v4-line-strong)] bg-[var(--v4-panel-raised)] shadow-[0_18px_48px_rgba(26,61,55,0.18)]"
        >
          <div className="border-b border-[var(--v4-line)] px-3.5 py-2.5">
            <p className="text-xs font-semibold tracking-wide text-[var(--v4-text)]">选择格式</p>
            <p className="mt-0.5 text-[11px] leading-4 text-[var(--v4-text-faint)]">下载到本地，如视频文件所在目录等</p>
          </div>
          <div className="p-1.5">
            {EXPORT_OPTIONS.map((option) => (
              <button
                key={option.format}
                type="button"
                role="menuitem"
                className="v4-focus-ring flex w-full cursor-pointer items-start gap-3 rounded-md px-2.5 py-2.5 text-left transition-colors hover:bg-[var(--v4-accent-soft)]"
                onClick={() => {
                  handleDownload(option.format);
                  setOpen(false);
                }}
              >
                <span
                  className={`mt-0.5 inline-flex min-w-[2.75rem] shrink-0 items-center justify-center rounded-md px-1.5 py-1 font-mono text-[11px] font-bold tracking-wide
                    ${option.emphasized
                      ? 'border border-[var(--v4-accent)]/25 bg-[var(--v4-accent-soft)] text-[var(--v4-accent-strong)]'
                      : 'border border-[var(--v4-line)] bg-[var(--v4-panel-muted)] text-[var(--v4-text-muted)]'}`}
                >
                  {option.badge}
                </span>
                <span className="min-w-0">
                  <span className="block text-sm font-semibold text-[var(--v4-text)]">{option.title}</span>
                  <span className="mt-0.5 block text-[11px] leading-4 text-[var(--v4-text-muted)]">{option.description}</span>
                </span>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
