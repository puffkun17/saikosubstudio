'use client';

import React from 'react';
import { useShallow } from 'zustand/react/shallow';
import { useStudioStore } from '@/store/useStudioStore';
import type { AuxiliarySubtitleMode } from '@/utils/subtitleCore';
import { countHiddenByPolicy, countLineKinds } from '@/core/lineKinds';
import { InfoHint } from '@/components/ui/InfoHint';

const OPTIONS: { value: AuxiliarySubtitleMode; label: string; desc: string }[] = [
  { value: 'keep', label: '完整', desc: '全保留' },
  { value: 'smart', label: '智能', desc: '隐去环境音' },
  { value: 'clean', label: '清洁', desc: '对白优先' },
];

/**
 * 辅助字幕策略：留下哪些内容，属于第二幕的内容决定，不是样式。
 * 写在侧栏样式本体上（不进样式微调），预览和导出都按它过滤。
 */
export const AuxiliaryPolicy: React.FC = () => {
  const { processedSubs, customStyle, setCustomStyle } = useStudioStore(useShallow((s) => ({
    processedSubs: s.processedSubs,
    customStyle: s.customStyle,
    setCustomStyle: s.setCustomStyle,
  })));
  const mode = customStyle.auxiliaryMode || 'keep';
  const stats = React.useMemo(() => {
    // 与工作台分类、复核弹窗、预览、导出同一分类与同一过滤函数。
    const subs = processedSubs ?? [];
    const counts = countLineKinds(subs);
    return {
      auxiliary: counts.auxiliary,
      screen: counts.screen,
      hidden: { keep: 0, smart: countHiddenByPolicy(subs, 'smart'), clean: countHiddenByPolicy(subs, 'clean') },
    };
  }, [processedSubs]);

  return (
    <div className="workbench-aux flex flex-col gap-[var(--ds-gap-item)] p-[var(--ds-pad-card)] md:flex-row md:items-center md:justify-between md:gap-[var(--ds-gap-section)]" data-testid="aux-policy">
      <div className="flex min-w-0 flex-col gap-1">
        <div className="flex items-center gap-2">
          <h2 className="ds-label">辅助字幕</h2>
          <InfoHint label="辅助字幕说明" side="right">
            SDH 音效、标题告示、歌词、旁白、署名等非对白行。完整：全部保留；智能：隐去环境音与配乐类 SDH；清洁：另隐去其余 SDH 与旁白说明。标题告示、歌词、署名不受影响。只决定保留哪些行，不改样式。
          </InfoHint>
        </div>
        <p className="ds-meta">
          {stats.auxiliary > 0
            ? `辅助内容 ${stats.auxiliary} 行，当前隐去 ${stats.hidden[mode]} 行。`
            : '未检测到辅助内容。'}
        </p>
      </div>
      <div className="ui-choice-group md:w-auto max-md:w-full" role="radiogroup" aria-label="辅助字幕策略">
        {OPTIONS.map((o) => (
          <button
            key={o.value}
            type="button"
            role="radio"
            aria-checked={mode === o.value}
            className={`ui-choice flex-1 ${mode === o.value ? 'ui-choice--on' : ''}`}
            title={`${o.desc}${stats.hidden[o.value] ? `，隐去 ${stats.hidden[o.value]} 条` : ''}`}
            onClick={() => setCustomStyle({ ...customStyle, auxiliaryMode: o.value })}
            data-aux={o.value}
          >
            {o.label}<span className="opacity-70">· {o.value === 'keep' ? o.desc : `隐去 ${stats.hidden[o.value]}`}</span>
          </button>
        ))}
      </div>
    </div>
  );
};
