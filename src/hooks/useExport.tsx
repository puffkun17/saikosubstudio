'use client';

import React, { useState, useEffect, useRef } from 'react';
import { ChevronDown, SquareArrowRightExit } from 'lucide-react';
import { useStudioStore } from '@/store/useStudioStore';
import { appendCreatorCredit as appendCreatorCreditCue, generateSrtContent, generateAssContent } from '@/utils/subtitleCore';

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

      if (format === 'srt') {
        content = generateSrtContent(exportSubs, customStyle);
        mimeType = 'text/srt';
        extension = 'srt';
      } else {
        content = generateAssContent(exportSubs, customStyle, customFilename);
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

      addLog(`导出成功: ${format.toUpperCase()} 格式`, 'success');
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

  const primaryClass = 'py-1.5 px-3 md:py-2 md:px-4 glass-btn-ar text-white font-bold text-xs md:text-sm flex items-center gap-1.5 transition-all cursor-pointer';
  const ghostClass = 'py-1.5 px-3.5 glass-btn-ar text-white font-bold text-xs flex items-center gap-1.5 transition-all cursor-pointer';

  return (
    <div className="relative" ref={ref}>
      <button
        className={variant === 'primary' ? primaryClass : ghostClass}
        onClick={() => setOpen(!open)}
      >
        <SquareArrowRightExit className="w-3.5 h-3.5 text-white/70" aria-hidden="true" />
        导出
        <ChevronDown className="w-3 h-3 opacity-60" aria-hidden="true" />
      </button>

      {open && (
        <div className="absolute top-full right-0 z-[110] mt-1.5 min-w-[140px] overflow-hidden rounded-xl glass-panel-ar shadow-2xl animate-in fade-in slide-in-from-top-1 duration-150">
          <button
            className="w-full py-3 px-4 text-xs font-semibold hover:bg-white/5 text-left border-b border-white/[0.06] transition text-white/80 hover:text-white flex items-center gap-2 cursor-pointer"
            onClick={() => { handleDownload('ass'); setOpen(false); }}
          >
            <span className="font-mono text-[#e6dfe6] text-[0.625rem] bg-[#998aa0]/18 border border-[#b9a7b5]/20 px-1.5 py-0.5 rounded">ASS</span>
            ASS 格式 (.ass)
          </button>
          <button
            className="w-full py-3 px-4 text-xs font-semibold hover:bg-white/5 text-left transition text-white/80 hover:text-white flex items-center gap-2 cursor-pointer"
            onClick={() => { handleDownload('srt'); setOpen(false); }}
          >
            <span className="font-mono text-white/50 text-[0.625rem] bg-white/5 px-1.5 py-0.5 rounded">SRT</span>
            SRT 格式 (.srt)
          </button>
        </div>
      )}
    </div>
  );
};
