import { hashHex } from './identity';

/**
 * Act 1 舞台对象 id（plan B，dragzone-proposal §5）。
 *
 * 一个文件从「拖入」到「本次清单 / 暂存区」再到解码后的 Subfile，始终是同一个 objectId：
 * - 顶层条目（拖入的文件 / 文件夹里的文件 / 压缩包）：由队列去重键（相对路径 + 名字 + 大小 + mtime）派生；
 * - 压缩包内的轨：父 objectId + 包内路径。
 * 它只用于 UI 连续性（React key、layoutId、移动动画），不进导出、不进持久化 id 体系。
 */
export const STAGE_OBJECT_PREFIX = 'obj';

export function stageObjectId(queueKey: string): string {
  return `${STAGE_OBJECT_PREFIX}:${hashHex(`q|${queueKey}`, 12)}`;
}

export function archiveEntryObjectId(parentObjectId: string, entryPath: string): string {
  return `${parentObjectId}/${hashHex(`e|${entryPath}`, 8)}`;
}

/** 两个 objectId 是否同一个顶层对象（或其包内轨）。 */
export function sameStageRoot(a: string, b: string): boolean {
  const root = (id: string) => id.split('/')[0];
  return root(a) === root(b);
}
