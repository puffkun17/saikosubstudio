'use client';

import React from 'react';
import { X } from 'lucide-react';
import { motion } from 'motion/react';
import { FileFormatIcon, LanguageMark, resolveFileFormat } from '@/components/ui/FileFormatIcon';
import { MiddleTruncate } from '@/components/ui/MiddleTruncate';
import { splitSharedPrefix } from '@/core/sharedNamePrefix';
import { EASE_OUT, MOTION_S } from '@/core/motion';
import {
  buildRenderNodes,
  formatBytes,
  languagesForItem,
  leafDelayMs,
  type PreflightItem,
} from '@/components/Ingest/dragzone/preflight';

/**
 * list v2 列表行规格（B 舞台复用同一组件）：
 * - 四列：格式图标 | 文件名（只显示区分段，中间截断保尾） | **定宽语言列**（牌左对齐、名字跟在牌后） | 移除。
 * - 定宽语言列让一组文件的语言牌落在同一条竖线上，不再随文件名长度左右跳。
 */
const TRACK_GRID = 'grid grid-cols-[auto_minmax(0,1fr)_4.75rem_auto] items-center gap-2.5 md:grid-cols-[auto_minmax(0,1fr)_5.5rem_auto] md:gap-3.5';

/** 动效：一般 0.25 s 上限（DESIGN.md §7），列表里没有远距离移动。 */
const LEAF_S = MOTION_S.slow;

/** 一组文件名的显示名：有共同前缀就只显示尾巴，否则显示全名。 */
export const groupDisplayNames = (names: string[]) => {
  const split = splitSharedPrefix(names);
  return { prefix: split?.prefix ?? null, display: split?.tails ?? names };
};

/** 组头上的共同前缀（只显示一次，中间截断 + tooltip）。 */
export const SharedPrefixLine = ({ prefix }: { prefix: string | null }) =>
  prefix ? (
    <p className="mt-1 flex min-w-0 items-baseline gap-1.5 text-xs text-[var(--v4-text-muted)] md:text-sm" data-shared-prefix>
      <span className="shrink-0">文件名前缀</span>
      <MiddleTruncate text={prefix} keepTail={12} className="font-mono text-[12px] text-[var(--ink-body)] md:text-[13px]" />
    </p>
  ) : null;

export const TrackUnit = ({
  keyName,
  name,
  displayName,
  title,
  accepted,
  note,
  languageLabels,
  onRemove,
}: {
  keyName: string;
  name: string;
  /** 列表里显示的名字（共同前缀折叠后的尾巴）；缺省 = name。 */
  displayName?: string;
  title?: string;
  accepted: boolean;
  note?: string;
  languageLabels: string[];
  onRemove?: () => void;
}) => (
  <div className={TRACK_GRID} data-track-unit>
    <FileFormatIcon name={name} size="md" />
    <div className="min-w-0">
      <p
        className={`text-[15px] font-medium leading-snug md:text-[16px] lg:text-[17px] ${accepted ? 'text-[var(--v4-text)]' : 'text-[var(--v4-danger)]'}`}
        data-track-name
      >
        <MiddleTruncate text={displayName ?? name} title={title || name} />
      </p>
      {note && !accepted && (
        <p className="mt-0.5 text-xs font-normal text-[var(--v4-danger)] md:text-sm">{note}</p>
      )}
    </div>
    {languageLabels.length > 0 ? (
      <span className="flex min-w-0 flex-wrap items-center justify-start gap-1 md:gap-1.5" data-lang-col>
        {languageLabels.map((label) => (
          <LanguageMark key={`${keyName}:${label}`} label={label} size="md" />
        ))}
      </span>
    ) : (
      <span aria-hidden="true" data-lang-col />
    )}
    {onRemove ? (
      <button
        type="button"
        onClick={onRemove}
        className="ui-action ui-action--quiet ui-action--danger ui-action--icon"
        aria-label={`移除 ${name}`}
      >
        <X className="h-4 w-4" strokeWidth={2} />
      </button>
    ) : (
      <span className="h-9 w-9" aria-hidden="true" />
    )}
  </div>
);

/** 压缩包子文件树（顶层与文件夹内嵌套共用）。 */
export const ArchiveSubtree = ({
  item,
  shouldReduceMotion,
}: {
  item: PreflightItem;
  shouldReduceMotion: boolean | null;
}) => {
  if (item.kind !== 'zip' && item.kind !== 'archive') return null;
  const { display } = groupDisplayNames((item.archiveEntries || []).map((entry) => entry.name));
  if (item.archivePeekStatus !== 'error' && !(item.archiveEntries && item.archiveEntries.length > 0)) return null;
  return (
    <div className="ingest-halo-tree mt-2.5 md:mt-3">
      {item.archivePeekStatus === 'error' && (
        <p className="mb-1.5 text-xs font-normal text-[var(--v4-danger)] md:text-sm">{item.archivePeekError || item.note}</p>
      )}
      {item.archiveEntries?.map((entry, entryIndex) => (
        <motion.div
          key={`${item.key}:${entry.name}`}
          initial={shouldReduceMotion ? false : { opacity: 0, x: -8 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{
            duration: shouldReduceMotion ? 0 : LEAF_S,
            delay: shouldReduceMotion ? 0 : leafDelayMs(entryIndex) / 1000,
            ease: EASE_OUT,
          }}
          className="ingest-halo-leaf min-w-0 py-1.5 md:py-2"
          style={{ '--leaf-delay': `${leafDelayMs(entryIndex)}ms` } as React.CSSProperties}
        >
          <TrackUnit
            keyName={`${item.key}:${entry.name}`}
            name={entry.name}
            displayName={display[entryIndex]}
            title={entry.name}
            accepted={true}
            languageLabels={[entry.languageLabel]}
          />
        </motion.div>
      ))}
    </div>
  );
};

/** 预检队列树：顶层条目 / 文件夹分组 → 子文件 → 压缩包内轨。 */
export const QueueTree = ({
  queuedItems,
  shouldReduceMotion,
  removeQueuedFile,
  removeFolderGroup,
}: {
  queuedItems: PreflightItem[];
  shouldReduceMotion: boolean | null;
  removeQueuedFile: (key: string) => void;
  removeFolderGroup: (folderName: string) => void;
}) => {
  const renderNodes = buildRenderNodes(queuedItems);

  return (
    <div className="max-h-[min(480px,56vh)] space-y-3 overflow-y-auto px-1 pb-1 md:max-h-[min(620px,62vh)] md:space-y-4">
      {renderNodes.map((node, nodeIndex) => {
        // 文件「落桌」：从上方轻降 + 微缩回位，像放到桌面上
        const landing = {
          initial: shouldReduceMotion ? false : { opacity: 0, y: -14, scale: 1.03 },
          animate: { opacity: 1, y: 0, scale: 1 },
          transition: {
            duration: shouldReduceMotion ? 0 : MOTION_S.slow,
            delay: shouldReduceMotion ? 0 : Math.min(nodeIndex * 0.05, 0.2),
            ease: EASE_OUT,
          },
        };

        if (node.type === 'folder') {
          const folderBytes = node.items.reduce((sum, row) => sum + row.file.size, 0);
          const folderSrt = node.items.filter((row) => row.kind === 'subtitle' && row.extension !== 'ass').length
            + node.items.reduce((sum, row) => sum + (row.archiveEntries || []).filter((entry) => !/\.ass$/i.test(entry.name)).length, 0);
          const folderAss = node.items.filter((row) => row.kind === 'subtitle' && row.extension === 'ass').length
            + node.items.reduce((sum, row) => sum + (row.archiveEntries || []).filter((entry) => /\.ass$/i.test(entry.name)).length, 0);
          const folderFormat = [
            folderSrt > 0 ? `${folderSrt} SRT` : null,
            folderAss > 0 ? `${folderAss} ASS` : null,
          ].filter(Boolean).join(' · ');
          // 去掉顶层目录名，保留剩余相对路径（如 S01/xx.srt）
          const subPaths = node.items.map((item) => (item.relativePath
            ? item.relativePath.split('/').slice(1).join('/')
            : item.name));
          const folderNames = groupDisplayNames(subPaths);
          return (
            <motion.div key={`folder:${node.folder}`} {...landing} className="min-w-0">
              <div className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3 md:gap-4">
                <div className="ingest-halo-root">
                  <FileFormatIcon format="folder" size="md" />
                </div>
                <div className="min-w-0">
                  <p className="truncate text-[16px] font-semibold leading-snug tracking-tight text-[var(--v4-text)] md:text-[17px] lg:text-[18px]" title={node.folder}>
                    {node.folder}
                  </p>
                  <p className="mt-1 text-xs font-medium text-[var(--v4-text-muted)] md:text-sm">
                    本地文件夹 · {node.items.length} 个文件
                    {folderFormat ? ` · ${folderFormat}` : ''} · {formatBytes(folderBytes)}
                  </p>
                  <SharedPrefixLine prefix={folderNames.prefix} />
                </div>
                <button
                  type="button"
                  onClick={() => removeFolderGroup(node.folder)}
                  className="ui-action ui-action--quiet ui-action--danger ui-action--icon"
                  aria-label={`移除文件夹 ${node.folder}`}
                >
                  <X className="h-4 w-4" strokeWidth={2} />
                </button>
              </div>

              <div className="ingest-halo-tree mt-2.5 md:mt-3">
                {node.items.map((item, leafIndex) => {
                  const langs = languagesForItem(item);
                  const subPath = subPaths[leafIndex];
                  return (
                    <motion.div
                      key={item.key}
                      initial={shouldReduceMotion ? false : { opacity: 0, x: -8 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{
                        duration: shouldReduceMotion ? 0 : LEAF_S,
                        delay: shouldReduceMotion ? 0 : leafDelayMs(leafIndex) / 1000,
                        ease: EASE_OUT,
                      }}
                      className="ingest-halo-leaf min-w-0 py-1.5 md:py-2"
                      style={{ '--leaf-delay': `${leafDelayMs(leafIndex)}ms` } as React.CSSProperties}
                    >
                      <TrackUnit
                        keyName={item.key}
                        name={subPath}
                        displayName={folderNames.display[leafIndex]}
                        title={item.relativePath || item.name}
                        accepted={item.accepted}
                        note={item.accepted ? undefined : item.note}
                        languageLabels={langs}
                        onRemove={() => removeQueuedFile(item.key)}
                      />
                      <ArchiveSubtree item={item} shouldReduceMotion={shouldReduceMotion} />
                    </motion.div>
                  );
                })}
              </div>
            </motion.div>
          );
        }

        const item = node.item;
        const langs = languagesForItem(item);
        const isArchive = item.kind === 'zip' || item.kind === 'archive';

        // 单独字幕文件：与包内轨同级的「轨单元」，不升格成壳
        if (!isArchive && item.kind === 'subtitle') {
          return (
            <motion.div key={item.key} {...landing} className="min-w-0 rounded-md px-0.5 py-1 md:py-1.5">
              <TrackUnit
                keyName={item.key}
                name={item.name}
                title={item.name}
                accepted={item.accepted}
                note={item.accepted ? undefined : item.note}
                languageLabels={langs}
                onRemove={() => removeQueuedFile(item.key)}
              />
            </motion.div>
          );
        }

        return (
          <motion.div key={item.key} {...landing} className="min-w-0">
            <div className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3 md:gap-4">
              <div className="ingest-halo-root">
                <FileFormatIcon format={resolveFileFormat(item.name)} size="md" />
              </div>
              <div className="min-w-0">
                <p className="text-[16px] font-semibold leading-snug tracking-tight text-[var(--v4-text)] md:text-[17px] lg:text-[18px]">
                  <MiddleTruncate text={item.name} />
                </p>
                {isArchive && item.archivePeekStatus === 'loading' && (
                  <p className="mt-1 text-xs font-medium text-[var(--v4-text-muted)] md:text-sm">
                    {item.note && item.note !== '正在查看包内字幕…'
                      ? item.note
                      : '正在读取包内字幕…'}
                  </p>
                )}
                {isArchive && item.archivePeekStatus === 'ready' && item.archiveEntries && (
                  <p className="mt-1 text-xs font-medium text-[var(--v4-text-muted)] md:text-sm">
                    {[
                      '压缩包',
                      (() => {
                        const srt = item.archiveEntries.filter((entry) => !/\.ass$/i.test(entry.name)).length;
                        const ass = item.archiveEntries.filter((entry) => /\.ass$/i.test(entry.name)).length;
                        return [srt > 0 ? `${srt} SRT` : null, ass > 0 ? `${ass} ASS` : null].filter(Boolean).join(' · ');
                      })(),
                      formatBytes(item.file.size),
                    ].filter(Boolean).join(' · ')}
                  </p>
                )}
                {isArchive && item.archivePeekStatus === 'ready' && item.archiveEntries && (
                  <SharedPrefixLine prefix={groupDisplayNames(item.archiveEntries.map((entry) => entry.name)).prefix} />
                )}
                {!item.accepted && (
                  <p className="mt-1 text-xs font-medium text-[var(--v4-danger)] md:text-sm">{item.note}</p>
                )}
              </div>
              <button
                type="button"
                onClick={() => removeQueuedFile(item.key)}
                className="ui-action ui-action--quiet ui-action--danger ui-action--icon"
                aria-label={`移除 ${item.name}`}
              >
                <X className="h-4 w-4" strokeWidth={2} />
              </button>
            </div>

            <ArchiveSubtree item={item} shouldReduceMotion={shouldReduceMotion} />
          </motion.div>
        );
      })}
    </div>
  );
};
