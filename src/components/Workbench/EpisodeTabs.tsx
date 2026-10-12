'use client';

import React from 'react';
import { useShallow } from 'zustand/react/shallow';
import { useStudioStore } from '@/store/useStudioStore';

/**
 * Episode tabs (workbench). Each episode keeps its own result in history; switching saves the
 * current one first. Hidden when there is only one task.
 */
export const EpisodeTabs: React.FC = () => {
  const { tasks, selectedTaskId, switchEpisode, isProcessing, savedIds } = useStudioStore(useShallow((s) => ({
    tasks: s.tasks,
    selectedTaskId: s.selectedTaskId,
    switchEpisode: s.switchEpisode,
    isProcessing: s.isProcessing,
    savedIds: s.libraryList.map((item) => item.id).join('|'),
  })));
  if (tasks.length < 2) return null;
  const saved = new Set(savedIds.split('|'));
  return (
    <div className="episode-tabs" role="tablist" aria-label="分集">
      {tasks.map((task) => {
        const active = task.id === selectedTaskId;
        const label = task.epKey || task.title;
        const done = saved.has(`hist_${task.id.replace(/[^\w\u4e00-\u9fff.-]+/g, '_')}`);
        return (
          <button
            key={task.id}
            type="button"
            role="tab"
            aria-selected={active}
            disabled={isProcessing}
            title={task.files.map((f) => f.name).join('\n') || task.title}
            className="episode-tabs__tab v4-focus-ring"
            onClick={() => switchEpisode(task.id)}
          >
            <span className="ds-mono">{label}</span>
            <span className={`episode-tabs__dot ${done ? 'is-done' : ''}`} aria-label={done ? '已合并' : '未合并'} />
          </button>
        );
      })}
    </div>
  );
};
