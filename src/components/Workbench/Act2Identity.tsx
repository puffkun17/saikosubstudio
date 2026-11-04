'use client';

import React from 'react';
import { useShallow } from 'zustand/react/shallow';
import { historyIdFor } from '@/core/identity';
import { useStudioStore } from '@/store/useStudioStore';
import { resolveFilmTitles } from '@/utils/filmTitles';
import type { TaskPair } from '@/store/types';

/** Task identity: full name, episode key appended only when the title does not already carry it. */
export function taskIdentityLabel(task: Pick<TaskPair, 'title' | 'epKey'> | undefined, fallback = '字幕调校'): string {
  if (!task) return fallback;
  const title = task.title.trim();
  const ep = task.epKey?.trim();
  if (ep && !title.toUpperCase().includes(ep.toUpperCase())) {
    return title ? `${title} ${ep.toUpperCase()}` : ep.toUpperCase();
  }
  return title || ep?.toUpperCase() || fallback;
}

/**
 * InfoBar primary: the task, not the TMDB title.
 * Names stay intact (no hard max-width). Overflow scrolls the switcher or ellipsizes the single title.
 */
export const WorkbenchTaskIdentity: React.FC = () => {
  const { tasks, selectedTaskId, switchEpisode, isProcessing, savedIds } = useStudioStore(useShallow((s) => ({
    tasks: s.tasks,
    selectedTaskId: s.selectedTaskId,
    switchEpisode: s.switchEpisode,
    isProcessing: s.isProcessing,
    savedIds: s.libraryList.map((item) => item.id).join('|'),
  })));
  const saved = new Set(savedIds.split('|').filter(Boolean));
  const active = tasks.find((task) => task.id === selectedTaskId) ?? tasks[0];
  const activeLabel = taskIdentityLabel(active);

  if (tasks.length < 2) {
    return (
      <h2 className="ds-title wb-task-name" title={active?.title || activeLabel}>
        {activeLabel}
      </h2>
    );
  }

  return (
    <div className="wb-task-identity">
      <h2 className="wb-sr">{activeLabel}</h2>
      <div className="wb-task-switch" role="tablist" aria-label="任务">
      {tasks.map((task) => {
        const selected = task.id === selectedTaskId;
        const label = taskIdentityLabel(task);
        const done = saved.has(historyIdFor(task.id));
        return (
          <button
            key={task.id}
            type="button"
            role="tab"
            aria-selected={selected}
            disabled={isProcessing}
            title={task.title}
            className="wb-task-switch__tab wb-focus-ring"
            onClick={() => switchEpisode(task.id)}
          >
            <span>{label}</span>
            <span className={`wb-task-switch__dot${done ? ' is-done' : ''}`} aria-label={done ? '已合并' : '未合并'} />
          </button>
        );
      })}
      </div>
    </div>
  );
};

/**
 * Source line under the task: film title, year, genres, task count.
 * Light A. Omits the film title when it repeats the task name.
 */
export const WorkbenchSourceMeta: React.FC = () => {
  const { tasks, selectedTaskId, tmdbData, customFilename, activeTaskTitle } = useStudioStore(useShallow((s) => ({
    tasks: s.tasks,
    selectedTaskId: s.selectedTaskId,
    tmdbData: s.tmdbData,
    customFilename: s.customFilename,
    activeTaskTitle: s.tasks.find((t) => t.id === s.selectedTaskId)?.title ?? '',
  })));
  const active = tasks.find((task) => task.id === selectedTaskId);
  const taskLabel = taskIdentityLabel(active, activeTaskTitle || '字幕调校');
  const film = resolveFilmTitles(
    tmdbData?.title,
    tmdbData?.originalTitle,
    activeTaskTitle || customFilename || '',
  ).main.trim();
  const taskTitle = active?.title.trim() ?? '';
  const filmRepeatsTask = Boolean(film) && (
    film === taskLabel
    || film === taskTitle
    || taskLabel.startsWith(film)
  );
  const year = tmdbData?.year?.trim() || '';
  const genres = (tmdbData?.genres ?? []).map((genre) => genre.trim()).filter(Boolean);

  return (
    <div className="wb-source-meta">
      {!filmRepeatsTask && film ? (
        <span className="wb-source-title" title={year ? `${film} ${year}` : film}>
          {film}
          {year ? (
            <time className="wb-source-year" dateTime={year}>{year}</time>
          ) : null}
        </span>
      ) : year ? (
        <time className="wb-source-year" dateTime={year}>{year}</time>
      ) : null}
      {genres.length > 0 ? (
        <span className="wb-source-genres" title={genres.join('、')} aria-label="类型">
          {genres.map((genre) => (
            <span key={genre} className="wb-genre">{genre}</span>
          ))}
        </span>
      ) : null}
      <span className="ui-meta-row wb-source-count">{tasks.length} 个任务</span>
      {!tmdbData ? <span className="ui-meta-row wb-source-count">未匹配</span> : null}
    </div>
  );
};
