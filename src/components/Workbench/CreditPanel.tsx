'use client';

import React from 'react';
import { Lock } from 'lucide-react';
import { useShallow } from 'zustand/react/shallow';
import { useStudioStore } from '@/store/useStudioStore';
import { classifyLineKind } from '@/core/lineKinds';
import { InfoHint } from '@/components/ui/InfoHint';
import { OriginalConfirmDialog } from '@/components/Ingest/OriginalConfirmDialog';

/**
 * 署名（内容，不是样式）：时间点始终保持原样。
 * 官方 / 非原创：只读。导入来源为「原创」时才可改字、删除并添加「我的署名」。
 * 署名在画面上的位置属于样式，在预览「样式」中设置。
 */
export const CreditPanel: React.FC = () => {
  const s = useStudioStore(useShallow((state) => ({
    processedSubs: state.processedSubs,
    isOriginalWork: state.isOriginalWork,
    isOfficialSubtitle: state.isOfficialSubtitle,
    appendCreatorCredit: state.appendCreatorCredit,
    creatorCredit: state.creatorCredit,
    setAppendCreatorCredit: state.setAppendCreatorCredit,
    setCreatorCredit: state.setCreatorCredit,
    editSubtitleText: state.editSubtitleText,
    setProcessedSubs: state.setProcessedSubs,
    setIsOriginalWork: state.setIsOriginalWork,
  })));
  const [confirming, setConfirming] = React.useState(false);
  const credits = React.useMemo(() => (s.processedSubs ?? []).filter((row) => classifyLineKind(row) === 'credit'), [s.processedSubs]);
  const editable = s.isOriginalWork;
  if (credits.length === 0 && !editable) return null;

  const removeLine = (index: number) => {
    const rows = (s.processedSubs ?? []).filter((row) => row.index !== index).map((row, i) => ({ ...row, index: i + 1 }));
    s.setProcessedSubs(rows);
  };

  const status = s.isOfficialSubtitle
    ? '官方字幕 · 已锁定'
    : editable ? '原创 · 可编辑' : '只读 · 导入时选择「原创」后可编辑';

  return (
    <div className="workbench-credit flex flex-col gap-[var(--ds-gap-item)] p-[var(--ds-pad-card)]" data-testid="credit-panel" data-editable={editable ? '1' : '0'}>
      <div className="flex items-center gap-2">
        <h2 className="ds-label">署名</h2>
        <InfoHint label="署名说明" side="right">
          署名属于字幕内容，始终保留在原时间点。画面位置在预览「样式」中设置。
        </InfoHint>
        <span className="ds-meta inline-flex items-center gap-1">
          {!editable && <Lock className="h-3 w-3" aria-hidden="true" />}
          {status}
        </span>
        {!s.isOfficialSubtitle && (
          <button
            type="button"
            className="ui-action ui-action--quiet ml-auto min-h-8 px-[var(--ds-ctl-px-sm)] text-xs"
            onClick={() => (editable ? s.setIsOriginalWork(false) : setConfirming(true))}
            data-testid="credit-original-toggle"
          >
            {editable ? '取消原创' : '设为原创'}
          </button>
        )}
      </div>
      {confirming && (
        <OriginalConfirmDialog onCancel={() => setConfirming(false)} onConfirm={() => { s.setIsOriginalWork(true); setConfirming(false); }} />
      )}
      {credits.length > 0 ? (
        <ul className="grid gap-[var(--ds-gap-item)]">
          {credits.map((row) => (
            <li key={row.rowId ?? row.index} className="flex flex-wrap items-center gap-2">
              <span className="ds-meta ds-mono shrink-0">#{row.index} · {row.ts.split(' --> ')[0].replace(',', '.')}</span>
              {editable ? (
                <>
                  <input
                    type="text"
                    className="ds-select min-w-0 flex-1"
                    defaultValue={row.text.replace(/\\N|\n/g, ' ')}
                    aria-label={`署名第 ${row.index} 行`}
                    onBlur={(event) => s.editSubtitleText(row.index, event.target.value)}
                  />
                  <button type="button" className="ui-action ui-action--quiet min-h-8 px-[var(--ds-ctl-px-sm)] text-xs" onClick={() => removeLine(row.index)}>
                    删除
                  </button>
                </>
              ) : (
                <span className="ds-body min-w-0 flex-1 truncate" title={row.text}>{row.text.replace(/\\N|\n/g, ' ')}</span>
              )}
            </li>
          ))}
        </ul>
      ) : (
        <p className="ds-meta">未检测到署名。</p>
      )}
      {editable && (
        <div className="flex flex-wrap items-center gap-2">
          <label className="ds-check">
            <input type="checkbox" checked={s.appendCreatorCredit} onChange={(event) => s.setAppendCreatorCredit(event.target.checked)} />
            <span>片尾添加我的署名</span>
          </label>
          {s.appendCreatorCredit && (
            <input
              type="text"
              className="ds-select min-w-0 flex-1"
              value={s.creatorCredit}
              onChange={(event) => s.setCreatorCredit(event.target.value)}
              placeholder="例如：Nexus Studio（导出为「双语合并：…」，紧跟最后一行）"
              aria-label="我的署名"
            />
          )}
        </div>
      )}
    </div>
  );
};
