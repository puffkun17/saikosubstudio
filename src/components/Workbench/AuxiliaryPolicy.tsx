'use client';

import React from 'react';
import { useShallow } from 'zustand/react/shallow';
import { useStudioStore } from '@/store/useStudioStore';
import { applyAuxiliarySubtitleMode, type AuxiliarySubtitleMode } from '@/utils/subtitleCore';
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
    const subs = processedSubs ?? [];
    const auxiliary = subs.filter((sub) => sub.cueKind === 'sound_caption' || sub.cueKind === 'screen_text' || sub.cueKind === 'narration'
      || (sub.auxiliary?.category && sub.auxiliary.category !== 'unknown')).length;
    const screen = subs.filter((sub) => sub.cueKind === 'screen_text' || sub.auxiliary?.category === 'screen_text').length;
    const kept = (m: AuxiliarySubtitleMode) => applyAuxiliarySubtitleMode(subs, m).length;
    return { auxiliary, screen, hidden: { keep: 0, smart: subs.length - kept('smart'), clean: subs.length - kept('clean') } };
  }, [processedSubs]);

  return (
    <div className="workbench-aux flex flex-col gap-[var(--ds-gap-item)] p-[var(--ds-pad-card)] md:flex-row md:items-center md:justify-between md:gap-[var(--ds-gap-section)]" data-testid="aux-policy">
      <div className="flex min-w-0 flex-col gap-1">
        <div className="flex items-center gap-2">
          <h2 className="ds-label">辅助字幕</h2>
          <InfoHint label="辅助字幕说明" side="right">
            SDH 音效、标题告示、歌词等非对白内容。完整：全部保留；智能：只隐去高置信的环境音；清洁：只留对白。只影响保留哪些行，不改样式。
          </InfoHint>
        </div>
        <p className="ds-meta">
          {stats.auxiliary > 0
            ? `检测到 ${stats.auxiliary} 条（标题告示 ${stats.screen} 条）。当前将隐去 ${stats.hidden[mode]} 条。`
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
            {o.label}<span className="opacity-70 max-md:hidden">· {o.desc}</span>
          </button>
        ))}
      </div>
    </div>
  );
};
