'use client';

import React from 'react';
import { X } from 'lucide-react';
import { motion } from 'motion/react';
import { FileFormatIcon, LanguageMark, resolveFileFormat } from '@/components/ui/FileFormatIcon';
import {
  buildRenderNodes,
  formatBytes,
  languagesForItem,
  leafDelayMs,
  type PreflightItem,
} from '@/components/Ingest/dragzone/preflight';

/**
 * 生产线「轨单元」：单独字幕 / 包内字幕 / 文件夹内字幕共用同一视觉规格。
 * 壳（7z、文件夹）用更大的根行；轨用 lg 图标 + 语种标，桌面再加一档字号。
 */
export const TrackUnit = ({
  keyName,
  name,
  title,
  accepted,
  note,
  languageLabels,
  onRemove,
}: {
  keyName: string;
  name: string;
  title?: string;
  accepted: boolean;
  note?: string;
  languageLabels: string[];
  onRemove?: () => void;
}) => (
  <div className="grid grid-cols-[auto_minmax(0,1fr)_auto_auto] items-center gap-2.5 md:gap-3.5">
    <FileFormatIcon name={name} size="md" />
    <div className="min-w-0">
      <p
        className={`truncate text-[15px] font-medium leading-snug md:text-[16px] lg:text-[17px] ${accepted ? 'text-[var(--v4-text)]' : 'text-[var(--v4-danger)]'}`}
        title={title || name}
      >
        {name}
      </p>
      {note && !accepted && (
        <p className="mt-0.5 text-xs font-normal text-[var(--v4-danger)] md:text-sm">{note}</p>
      )}
    </div>
    {languageLabels.length > 0 ? (
      <span className="inline-flex flex-wrap items-center justify-end gap-1 md:gap-1.5">
        {languageLabels.map((label) => (
          <LanguageMark key={`${keyName}:${label}`} label={label} size="md" />
        ))}
      </span>
    ) : (
      <span aria-hidden="true" />
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
            duration: shouldReduceMotion ? 0 : 0.26,
            delay: shouldReduceMotion ? 0 : leafDelayMs(entryIndex) / 1000,
            ease: [0.16, 1, 0.3, 1],
          }}
          className="ingest-halo-leaf min-w-0 py-1.5 md:py-2"
          style={{ '--leaf-delay': `${leafDelayMs(entryIndex)}ms` } as React.CSSProperties}
        >
          <TrackUnit
            keyName={`${item.key}:${entry.name}`}
            name={entry.name}
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
            duration: shouldReduceMotion ? 0 : 0.34,
            delay: shouldReduceMotion ? 0 : Math.min(nodeIndex * 0.05, 0.2),
            ease: [0.16, 1, 0.3, 1] as const,
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
                  // 去掉顶层目录名，保留剩余相对路径（如 S01/xx.srt）
                  const subPath = item.relativePath
                    ? item.relativePath.split('/').slice(1).join('/')
                    : item.name;
                  return (
                    <motion.div
                      key={item.key}
                      initial={shouldReduceMotion ? false : { opacity: 0, x: -8 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{
                        duration: shouldReduceMotion ? 0 : 0.26,
                        delay: shouldReduceMotion ? 0 : leafDelayMs(leafIndex) / 1000,
                        ease: [0.16, 1, 0.3, 1],
                      }}
                      className="ingest-halo-leaf min-w-0 py-1.5 md:py-2"
                      style={{ '--leaf-delay': `${leafDelayMs(leafIndex)}ms` } as React.CSSProperties}
                    >
                      <TrackUnit
                        keyName={item.key}
                        name={subPath}
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
                <p className="truncate text-[16px] font-semibold leading-snug tracking-tight text-[var(--v4-text)] md:text-[17px] lg:text-[18px]" title={item.name}>
                  {item.name}
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
