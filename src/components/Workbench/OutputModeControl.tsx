'use client';

import React from 'react';
import { useShallow } from 'zustand/react/shallow';
import { useStudioStore } from '@/store/useStudioStore';
import type { AuxiliarySubtitleMode } from '@/utils/subtitleCore';
import { countHiddenByPolicy } from '@/core/lineKinds';

const OPTIONS: { value: AuxiliarySubtitleMode; label: string; tip: string }[] = [
  { value: 'keep', label: '完整', tip: '全保留：辅助字幕全部保留到预览与导出' },
  { value: 'smart', label: '智能', tip: '隐去环境音与配乐类 SDH；标题告示、歌词、署名不受影响' },
  { value: 'clean', label: '清洁', tip: '对白优先：另隐去其余 SDH 与旁白说明；标题告示、歌词、署名不受影响' },
];

/** Compact 3-segment 输出 control for the workbench header (行为同 AuxiliaryPolicy). */
export const OutputModeControl: React.FC = () => {
  const { processedSubs, customStyle, setCustomStyle } = useStudioStore(useShallow((s) => ({
    processedSubs: s.processedSubs,
    customStyle: s.customStyle,
    setCustomStyle: s.setCustomStyle,
  })));
  const mode = customStyle.auxiliaryMode || 'keep';
  const hidden = React.useMemo(() => {
    const subs = processedSubs ?? [];
    return {
      keep: 0,
      smart: countHiddenByPolicy(subs, 'smart'),
      clean: countHiddenByPolicy(subs, 'clean'),
    };
  }, [processedSubs]);

  return (
    <div className="wb-out" data-testid="output-mode" role="radiogroup" aria-label="输出模式">
      <span className="wb-out__label">输出</span>
      <div className="wb-out__seg">
        {OPTIONS.map((o) => {
          const hideN = hidden[o.value];
          const label = o.value === 'clean' && hideN > 0 ? `${o.label} −${hideN}` : o.label;
          const tip = hideN > 0 && o.value !== 'keep'
            ? `${o.tip}（当前隐去 ${hideN} 行）`
            : o.tip;
          return (
            <button
              key={o.value}
              type="button"
              role="radio"
              aria-checked={mode === o.value}
              className={`wb-out__btn wb-focus-ring ${mode === o.value ? 'wb-sel' : ''}`}
              title={tip}
              onClick={() => setCustomStyle({ ...customStyle, auxiliaryMode: o.value })}
              data-aux={o.value}
            >
              {label}
            </button>
          );
        })}
      </div>
    </div>
  );
};
