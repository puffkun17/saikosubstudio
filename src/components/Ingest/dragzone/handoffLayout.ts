import { useMemo } from 'react';
import { stageSharedHandoffEnabled } from '@/core/stageFlags';
import { useIngestStage } from '@/store/useIngestStage';
import { useStudioStore } from '@/store/useStudioStore';

/**
 * 交接打开且已 markHandoff 时，只允许任务轨上的 sourceObjectId 继续带 layoutId。
 * 返回 null = 不收窄（暂存区搬移、交接关闭、放行前）。
 */
export const useHandoffLayoutAllow = (): ReadonlySet<string> | null => {
  const handoffAt = useIngestStage((state) => state.handoffAt);
  const tasks = useStudioStore((state) => state.tasks);
  return useMemo(() => {
    if (!stageSharedHandoffEnabled() || handoffAt == null) return null;
    const ids = new Set<string>();
    for (const task of tasks) {
      const files = task.files.length > 0
        ? task.files
        : [task.zh, task.en, task.commentary].filter((file) => file != null);
      for (const file of files) {
        if (file?.sourceObjectId) ids.add(file.sourceObjectId);
      }
    }
    return ids;
  }, [handoffAt, tasks]);
};

export const stageObjectMotion = (
  objectId: string,
  reduce: boolean | null,
  allowed: ReadonlySet<string> | null,
) => {
  if (reduce) return {};
  if (allowed && !allowed.has(objectId)) return {};
  return { layoutId: objectId, layout: 'position' as const };
};
