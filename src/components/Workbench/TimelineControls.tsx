'use client';

import React from 'react';
import { useStudioStore } from '@/store/useStudioStore';

interface TimelineControlsProps {
  variant?: 'full' | 'compact' | 'theater';
}

export const TimelineControls: React.FC<TimelineControlsProps> = ({ variant = 'full' }) => {
  const { 
    processedSubs, 
    jumpLineVal, 
    setJumpLineVal, 
    setPreviewIndex, 
    showAllSubs, 
    setShowAllSubs
  } = useStudioStore();

  const handleJumpToLine = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!processedSubs || processedSubs.length === 0) return;
    
    const lineNum = parseInt(jumpLineVal, 10);
    if (isNaN(lineNum)) return;

    const targetIdx = Math.max(0, Math.min(processedSubs.length - 1, lineNum - 1));
    setPreviewIndex(targetIdx);

    if (targetIdx >= 50 && !showAllSubs) {
      setShowAllSubs(true);
    }
  };

  if (!processedSubs || processedSubs.length === 0) return null;

  const jumpPercent = (
    (Math.max(1, Math.min(parseInt(jumpLineVal || '1', 10), processedSubs.length)) / 
    processedSubs.length) * 100
  ).toFixed(1);

  if (variant === 'compact') {
    return (
      <div className="w-full min-w-[220px] max-w-[420px] bg-[#121216]/55 border border-white/5 px-3 py-2 rounded-xl flex items-center gap-3">
        <input
          type="range"
          min="1"
          max={processedSubs.length}
          value={parseInt(jumpLineVal || '1', 10)}
          onChange={e => {
            setJumpLineVal(e.target.value);
            setPreviewIndex(parseInt(e.target.value, 10) - 1);
          }}
          onMouseUp={() => handleJumpToLine()}
          onTouchEnd={() => handleJumpToLine()}
          className="v9-timeline-dial-slider flex-1 min-w-0"
          aria-label="字幕预览进度"
        />
        <span className="text-xs font-mono text-[#c2cce3] w-12 text-right tabular-nums">
          {jumpPercent}%
        </span>
      </div>
    );
  }

  if (variant === 'theater') {
    return (
      <div className="w-full bg-[#08080c]/78 border border-white/[0.07] px-4 py-3 rounded-xl flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4 shadow-[0_12px_32px_rgba(0,0,0,0.28)] backdrop-blur-md">
        <div className="flex items-center gap-2 shrink-0">
          <span className="text-xs font-semibold text-neutral-300">预览进度</span>
          <span className="text-xs font-mono text-[#c2cce3] tabular-nums">
            {Math.max(1, Math.min(parseInt(jumpLineVal || '1', 10), processedSubs.length))} / {processedSubs.length}
          </span>
        </div>
        <input
          type="range"
          min="1"
          max={processedSubs.length}
          value={parseInt(jumpLineVal || '1', 10)}
          onChange={e => {
            setJumpLineVal(e.target.value);
            setPreviewIndex(parseInt(e.target.value, 10) - 1);
          }}
          onMouseUp={() => handleJumpToLine()}
          onTouchEnd={() => handleJumpToLine()}
          className="v9-timeline-dial-slider w-full flex-1 min-w-0"
          aria-label="字幕预览进度"
        />
        <form onSubmit={handleJumpToLine} className="v9-dial-gauge flex items-center gap-2 shrink-0">
          <span className="v9-dial-gauge-label">行</span>
          <input
            type="number"
            min="1"
            max={processedSubs.length}
            value={jumpLineVal}
            onChange={e => setJumpLineVal(e.target.value)}
            className="v9-dial-gauge-input no-spin"
            placeholder="1"
            aria-label="跳转到字幕行"
          />
          <div className="w-[1px] h-3 bg-[#8fa3d1]/25" />
          <span className="v9-dial-gauge-value text-[#c2cce3]">{jumpPercent}%</span>
        </form>
      </div>
    );
  }

  return (
    <div className="v9-dial-slider-container w-full bg-white/[0.018] border border-white/[0.055] px-3 py-2.5 rounded-xl flex items-center justify-between gap-4">
      {/* Slider range input */}
      <div className="v9-dial-slider-wrapper flex-1 flex items-center min-w-0">
        <input 
          type="range" 
          min="1" 
          max={processedSubs.length} 
          value={parseInt(jumpLineVal || '1', 10)} 
          onChange={e => {
            setJumpLineVal(e.target.value);
            setPreviewIndex(parseInt(e.target.value, 10) - 1);
          }}
          onMouseUp={() => handleJumpToLine()}
          onTouchEnd={() => handleJumpToLine()}
          className="v9-timeline-dial-slider w-full"
          aria-label="字幕时间轴位置"
        />
      </div>
      
      {/* Dial Gauge */}
      <form onSubmit={handleJumpToLine} className="v9-dial-gauge flex items-center gap-2">
        <span className="v9-dial-gauge-label">行</span>
        <input 
          type="number"
          min="1"
          max={processedSubs.length}
          value={jumpLineVal}
          onChange={e => setJumpLineVal(e.target.value)}
          className="v9-dial-gauge-input no-spin"
          placeholder="1"
          aria-label="跳转到字幕行"
        />
        <div className="w-[1px] h-3 bg-[#8fa3d1]/25" />
        <span className="v9-dial-gauge-value text-[#c2cce3]">{jumpPercent}%</span>
      </form>
    </div>
  );
};
