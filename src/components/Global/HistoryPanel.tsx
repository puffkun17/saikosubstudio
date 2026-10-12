'use client';

import React, { useRef, useState } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { AnimatePresence, motion } from 'framer-motion';
import { Trash2, X } from 'lucide-react';
import { useStudioStore } from '@/store/useStudioStore';
import { useUiModalFocus } from '@/hooks/useUiModalFocus';
import { RETENTION_DAYS_DEFAULT } from '@/core/taskStore';

/**
 * 历史（spec §4: core entry, icon + text, all three acts).
 * Backed by IndexedDB (taskStore): one entry per task, 30-day retention, one-click clear.
 * The old localStorage archive is migrated once on load and then removed.
 */
export const HistoryPanel: React.FC = () => {
  const { libraryList, loadFromLibrary, deleteFromLibrary, isLibraryOpen, setLibraryOpen, clearHistory } = useStudioStore(useShallow((s) => ({
    libraryList: s.libraryList,
    loadFromLibrary: s.loadFromLibrary,
    deleteFromLibrary: s.deleteFromLibrary,
    isLibraryOpen: s.isLibraryOpen,
    setLibraryOpen: s.setLibraryOpen,
    clearHistory: s.clearHistory,
  })));
  const [confirmClear, setConfirmClear] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const close = () => { setConfirmClear(false); setLibraryOpen(false); };
  useUiModalFocus(isLibraryOpen, ref, close);

  return (
    <AnimatePresence>
      {isLibraryOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[2000] flex items-center justify-center bg-black/60 p-3 sm:p-4"
          onClick={(e) => { if (e.target === e.currentTarget) close(); }}
        >
          <motion.div
            ref={ref}
            data-surface="cream"
            initial={{ y: 12, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 12, opacity: 0 }}
            className="history-panel ui-modal ui-modal--wide flex max-h-[85vh] w-full flex-col overflow-hidden !p-0"
            role="dialog"
            aria-modal="true"
            aria-labelledby="history-title"
            tabIndex={-1}
          >
            <header className="flex items-center justify-between gap-3 border-b border-[var(--surface-line)] px-4 py-3">
              <div className="min-w-0">
                <h2 id="history-title" className="ds-head">历史</h2>
                <p className="ds-meta">仅保存在本设备，{RETENTION_DAYS_DEFAULT} 天后自动清除</p>
              </div>
              <button type="button" className="ui-action ui-action--quiet ui-action--icon ui-action--icon-sm" onClick={close} aria-label="关闭历史" title="关闭">
                <X className="h-4 w-4" aria-hidden="true" />
              </button>
            </header>

            <div className="flex-1 overflow-y-auto">
              {libraryList.length > 0 ? (
                <ul className="divide-y divide-[var(--surface-line)]">
                  {libraryList.map((item) => (
                    <li key={item.id} className="flex items-center gap-2 px-4 py-2">
                      <button
                        type="button"
                        className="v4-focus-ring min-w-0 flex-1 rounded-md py-1 text-left hover:text-[var(--v5-accent-strong)]"
                        onClick={() => { loadFromLibrary(item); close(); }}
                      >
                        <span className="ds-body block truncate font-semibold">{item.name}</span>
                        <span className="ds-meta block">
                          {item.date} · {item.subs.length} 行 · {item.subs.some((s) => s.text.includes('\n')) ? '双语' : '单语'}
                        </span>
                      </button>
                      <button
                        type="button"
                        className="ui-action ui-action--quiet ui-action--icon ui-action--icon-sm"
                        onClick={() => deleteFromLibrary(item.id)}
                        aria-label={`删除：${item.name}`}
                        title="删除这条"
                      >
                        <Trash2 className="h-4 w-4" aria-hidden="true" />
                      </button>
                    </li>
                  ))}
                </ul>
              ) : (
                <div className="px-4 py-10 text-center">
                  <p className="ds-body font-semibold">暂无历史记录</p>
                  <p className="ds-meta mt-1">合并完成后自动保存</p>
                </div>
              )}
            </div>

            <footer className="flex items-center justify-between gap-2 border-t border-[var(--surface-line)] px-4 py-2">
              <span className="ds-meta">{libraryList.length} 条</span>
              {confirmClear ? (
                <span className="flex items-center gap-2">
                  <span className="ds-meta">删除全部历史记录与源字幕？</span>
                  <button type="button" className="ds-entry" onClick={() => setConfirmClear(false)}>取消</button>
                  <button
                    type="button"
                    className="ds-entry !text-[var(--v5-danger)]"
                    onClick={async () => { await clearHistory(); setConfirmClear(false); }}
                  >
                    确认清空
                  </button>
                </span>
              ) : (
                <button type="button" className="ds-entry" disabled={libraryList.length === 0} onClick={() => setConfirmClear(true)}>
                  <Trash2 className="h-4 w-4" aria-hidden="true" />
                  清除本地数据
                </button>
              )}
            </footer>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};
