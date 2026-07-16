'use client';

import React, { useState, useEffect, useRef } from 'react';
import { ChevronDown, SquareArrowRightExit } from 'lucide-react';
import { useStudioStore } from '@/store/useStudioStore';
import { appendCreatorCredit as appendCreatorCreditCue, applyAuxiliarySubtitleMode, generateSrtContent, generateAssContent } from '@/utils/subtitleCore';

/**
 * #16 — Shared export hook to avoid duplication in WorkbenchStep + TheaterStep
 */
export const useExport = () => {
  const { processedSubs, customFilename, customStyle, creatorCredit, appendCreatorCredit, addLog } = useStudioStore();

  const handleDownload = (format: 'ass' | 'srt') => {
    if (!processedSubs || processedSubs.length === 0) return;
    try {
      let content = '';
      let mimeType = 'text/plain';
      let extension = '';

      const exportSubs = appendCreatorCredit
        ? appendCreatorCreditCue(processedSubs, creatorCredit)
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
        content = generateAssContent(filteredExportSubs, exportStyle, customFilename);
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

  const primaryClass = 'v4-focus-ring flex h-10 cursor-pointer items-center gap-1.5 rounded-md border border-[var(--v4-line)] bg-[var(--v4-panel-muted)] px-3.5 text-sm font-semibold text-[var(--v4-text)] transition-colors hover:border-[var(--v4-line-strong)] hover:bg-[var(--v4-panel)]';
  const ghostClass = primaryClass;

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        className={variant === 'primary' ? primaryClass : ghostClass}
        onClick={() => setOpen(!open)}
        aria-expanded={open}
        aria-haspopup="true"
      >
        <SquareArrowRightExit className="w-3.5 h-3.5 text-white/70" aria-hidden="true" />
        导出
        <ChevronDown className="w-3 h-3 opacity-60" aria-hidden="true" />
      </button>

      {open && (
        <div className="glass-panel-ar absolute right-0 top-full z-[110] mt-1.5 min-w-[160px] overflow-hidden rounded-lg shadow-[0_16px_40px_rgba(0,0,0,0.46)] animate-in fade-in slide-in-from-top-1 duration-150">
          <button
            className="w-full py-3 px-4 text-xs font-semibold hover:bg-white/5 text-left border-b border-white/[0.06] transition text-white/80 hover:text-white flex items-center gap-2 cursor-pointer"
            onClick={() => { handleDownload('ass'); setOpen(false); }}
          >
            <span className="font-mono text-[#e6dfe6] text-xs bg-[#998aa0]/18 border border-[#b9a7b5]/20 px-1.5 py-0.5 rounded">ASS</span>
            导出 ASS
          </button>
          <button
            className="w-full py-3 px-4 text-xs font-semibold hover:bg-white/5 text-left transition text-white/80 hover:text-white flex items-center gap-2 cursor-pointer"
            onClick={() => { handleDownload('srt'); setOpen(false); }}
          >
            <span className="font-mono text-white/50 text-xs bg-white/5 px-1.5 py-0.5 rounded">SRT</span>
            导出 SRT
          </button>
        </div>
      )}
    </div>
  );
};
