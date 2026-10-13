'use client';

import React from 'react';
import { AlertTriangle } from 'lucide-react';
import { OverlayPortal } from '@/components/Global/OverlayPortal';

/** 开启「原创」前的警示确认：只有原创字幕才允许改动署名。 */
export const OriginalConfirmDialog: React.FC<{ onCancel: () => void; onConfirm: () => void }> = ({ onCancel, onConfirm }) => {
  React.useEffect(() => {
    const onKey = (event: KeyboardEvent) => { if (event.key === 'Escape') onCancel(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onCancel]);
  return (
    <OverlayPortal>
      <div
        className="ui-modal-layer fixed inset-0 grid place-items-center bg-black/70 p-4 backdrop-blur-sm"
        onClick={(event) => { if (event.target === event.currentTarget) onCancel(); }}
      >
        <div role="alertdialog" aria-modal="true" aria-labelledby="original-confirm-title" aria-describedby="original-confirm-desc" className="ui-modal" data-testid="original-confirm">
          <h3 id="original-confirm-title" className="flex items-center gap-2 text-lg font-semibold text-[var(--v5-warning,var(--v4-warning))]">
            <AlertTriangle className="h-5 w-5" aria-hidden="true" />
            确认这是原创字幕
          </h3>
          <p id="original-confirm-desc" className="mt-2 text-sm leading-6 text-[var(--v4-text-muted)]">
            仅当字幕由你本人翻译或制作时开启。开启后，工作台可删改署名并添加「我的署名」，文件信息写入「原创」声明。转载他人或官方字幕请勿开启，原译者署名应原样保留。
          </p>
          <div className="mt-5 grid grid-cols-2 gap-2">
            <button type="button" className="ui-action ui-action--quiet w-full" onClick={onCancel} autoFocus>取消</button>
            <button type="button" className="ui-action w-full" onClick={onConfirm} data-testid="original-confirm-ok">确认开启</button>
          </div>
        </div>
      </div>
    </OverlayPortal>
  );
};
