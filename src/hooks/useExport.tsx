'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useStudioStore } from '@/store/useStudioStore';
import { generateSrtContent, generateAssContent } from '@/utils/subtitleCore';

/**
 * #16 — Shared export hook to avoid duplication in WorkbenchStep + TheaterStep
 */
export const useExport = () => {
  const { processedSubs, customFilename, customStyle, addLog } = useStudioStore();

  const handleDownload = (format: 'ass' | 'srt') => {
    if (!processedSubs || processedSubs.length === 0) return;
    try {
      let content = '';
      let mimeType = 'text/plain';
      let extension = '';

      if (format === 'srt') {
        content = generateSrtContent(processedSubs);
        mimeType = 'text/srt';
        extension = 'srt';
      } else {
        content = generateAssContent(processedSubs, customStyle, customFilename);
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
      addLog(`导出失败: ${e.message}`, 'error');
    }
  };

  return { handleDownload };
};

/**
 * #9 — Export dropdown that closes on outside click
 */
export const ExportDropdown: React.FC<{ variant?: 'gold' | 'ghost' }> = ({ variant = 'gold' }) => {
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

  const goldClass = 'py-1.5 px-3 md:py-2 md:px-4 glass-btn-ar text-white font-bold text-xs md:text-sm flex items-center gap-1.5 transition-all cursor-pointer';
  const ghostClass = 'py-1.5 px-3.5 glass-btn-ar text-white font-bold text-xs flex items-center gap-1.5 transition-all cursor-pointer';

  return (
    <div className="relative" ref={ref}>
      <button
        className={variant === 'gold' ? goldClass : ghostClass}
        onClick={() => setOpen(!open)}
      >
        <svg className="w-3.5 h-3.5 text-violet-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
        </svg>
        导出
        <svg className="w-3 h-3 opacity-60" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {open && (
        <div className="absolute top-full right-0 mt-1.5 glass-panel-ar rounded-xl overflow-hidden shadow-2xl z-50 min-w-[140px] animate-in fade-in slide-in-from-top-1 duration-150">
          <button
            className="w-full py-3 px-4 text-xs font-semibold hover:bg-white/5 text-left border-b border-white/[0.06] transition text-white/80 hover:text-white flex items-center gap-2 cursor-pointer"
            onClick={() => { handleDownload('ass'); setOpen(false); }}
          >
            <span className="font-mono text-violet-400 text-[0.625rem] bg-violet-500/10 px-1.5 py-0.5 rounded">ASS</span>
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
