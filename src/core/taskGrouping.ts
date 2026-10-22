/**
 * processFiles grouping + track-binding (pure).
 * Returns tasks/uploadedFiles/notices — no setTimeout / store I/O here.
 */

import { parseEpisodeRef, episodeKeyOf } from './episode';
import { cueTimesFromRows } from './timelineAgreement';
import { decideSameEpisode, type EpisodeCandidate } from './sameEpisode';
import { mintTaskId, workIdentityFromFileName } from './identity';
import { titleKeyOf } from './recognition';
import type { StatusNotice } from './noticeChannel';
import type { Subfile, TaskPair } from '../store/types';
import {
  assessMediaIdentity,
  cleanFilename,
  estimateSubtitleCueCount,
  isEnglishSecondaryLanguage,
  isLatinSecondaryLanguage,
  isMainPathSecondaryLanguage,
  isSdhOrCcSubtitleFilename,
  isSparseSecondaryTrack,
  mainPathPrimaryRank,
  mainPathSecondaryRank,
  parseMediaFilename,
  parseSubtitle,
} from '../utils/subtitleCore';

export type GroupingNotice = Pick<StatusNotice, 'id' | 'tone' | 'title' | 'message'>;

export type GroupAndBindResult = {
  uploadedFiles: Subfile[];
  tasks: TaskPair[];
  notices: GroupingNotice[];
};

const episodeCandidateCache = new WeakMap<Subfile, EpisodeCandidate>();

/** Reuses the parsed timeline per file (first few dozen cues only). */
export const episodeCandidateOf = (file: Subfile): EpisodeCandidate => {
  const hit = episodeCandidateCache.get(file);
  if (hit) return hit;
  const cand: EpisodeCandidate = {
    ep: parseEpisodeRef(file.name),
    titleKey: titleKeyOf(file.name),
    times: cueTimesFromRows(parseSubtitle(file.text).slice(0, 160)),
  };
  episodeCandidateCache.set(file, cand);
  return cand;
};

const optimizeTaskBindings = (task: TaskPair, notices: GroupingNotice[]): void => {
  const files = task.files;
  const commentaryFiles = files.filter((f) =>
    f.isCommentary
    || f.lang === 'commentary'
    || /(commentary|comment|director|解说|导轨)/i.test(f.name),
  );
  const normalFiles = files.filter((f) => !commentaryFiles.includes(f));

  // Main path: primary = 简中优先 / 繁中回退；
  // secondary = 真实英语对白优先（普通 eng 优于 SDH）；英语缺失或明显非对白时回退：
  // 西语 > 法语 > 葡/德/意 > 日 > 韩（Derek：拉丁字母语言可作第二语言，西语优先）。
  const zhFiles = normalFiles.filter((f) => f.lang === 'zh' || f.lang === 'zh-CN' || f.lang === 'zh-TW');
  const enFiles = normalFiles.filter((f) => isEnglishSecondaryLanguage(f.lang));
  const sourceLangFiles = normalFiles.filter((f) => f.lang === 'ja' || f.lang === 'ko' || isLatinSecondaryLanguage(f.lang));
  const bilingualFiles = normalFiles.filter((f) => f.lang === 'bilingual');

  const getBestFile = (list: Subfile[]): Subfile | null => {
    if (list.length === 0) return null;
    return [...list].sort((a, b) => {
      const aAss = a.name.toLowerCase().endsWith('.ass') ? 1 : 0;
      const bAss = b.name.toLowerCase().endsWith('.ass') ? 1 : 0;
      if (aAss !== bAss) return bAss - aAss;
      return b.size - a.size;
    })[0];
  };

  const getBestPrimary = (list: Subfile[]): Subfile | null => {
    if (list.length === 0) return null;
    return [...list].sort((a, b) => {
      const rankDiff = mainPathPrimaryRank(b.lang) - mainPathPrimaryRank(a.lang);
      if (rankDiff !== 0) return rankDiff;
      const aAss = a.name.toLowerCase().endsWith('.ass') ? 1 : 0;
      const bAss = b.name.toLowerCase().endsWith('.ass') ? 1 : 0;
      if (aAss !== bAss) return bAss - aAss;
      return b.size - a.size;
    })[0];
  };

  // 原文轨：普通 en 优先于 SDH/CC（后者常更大，旧逻辑会误绑）。勿改回纯体积优先。
  const bestZh = getBestPrimary(zhFiles);
  const primaryCueCount = bestZh ? estimateSubtitleCueCount(bestZh.text) : 0;

  const pickDialogueEnglish = (): Subfile | null => {
    if (enFiles.length === 0) return null;
    const ranked = [...enFiles].sort((a, b) => {
      const rankDiff = mainPathSecondaryRank(b.name, b.lang) - mainPathSecondaryRank(a.name, a.lang);
      if (rankDiff !== 0) return rankDiff;
      const aAss = a.name.toLowerCase().endsWith('.ass') ? 1 : 0;
      const bAss = b.name.toLowerCase().endsWith('.ass') ? 1 : 0;
      if (aAss !== bAss) return bAss - aAss;
      return b.size - a.size;
    });
    // Prefer a non-SDH English track whose cue count looks like dialogue vs primary.
    const nonSdh = ranked.filter((file) => !isSdhOrCcSubtitleFilename(file.name) && !file.isSdh);
    const dialoguePool = (nonSdh.length > 0 ? nonSdh : ranked).filter((file) => {
      if (primaryCueCount <= 0) return true;
      return !isSparseSecondaryTrack(primaryCueCount, estimateSubtitleCueCount(file.text));
    });
    if (dialoguePool.length > 0) return dialoguePool[0];
    // Only SDH remains and is not sparse → still usable (Stuart-only-SDH case).
    const sdhFallback = ranked.find((file) => {
      if (primaryCueCount <= 0) return true;
      return !isSparseSecondaryTrack(primaryCueCount, estimateSubtitleCueCount(file.text));
    });
    return sdhFallback || null;
  };

  const pickSourceLanguageFallback = (): Subfile | null => {
    if (sourceLangFiles.length === 0) return null;
    return [...sourceLangFiles].sort((a, b) => {
      const rankDiff = mainPathSecondaryRank(b.name, b.lang) - mainPathSecondaryRank(a.name, a.lang);
      if (rankDiff !== 0) return rankDiff;
      if (primaryCueCount > 0) {
        const aCount = estimateSubtitleCueCount(a.text);
        const bCount = estimateSubtitleCueCount(b.text);
        const aSparse = isSparseSecondaryTrack(primaryCueCount, aCount) ? 1 : 0;
        const bSparse = isSparseSecondaryTrack(primaryCueCount, bCount) ? 1 : 0;
        if (aSparse !== bSparse) return aSparse - bSparse;
        const aDelta = Math.abs(aCount - primaryCueCount);
        const bDelta = Math.abs(bCount - primaryCueCount);
        if (aDelta !== bDelta) return aDelta - bDelta;
      }
      return b.size - a.size;
    })[0];
  };

  const bestEnDialogue = pickDialogueEnglish();
  const bestSourceFallback = !bestEnDialogue ? pickSourceLanguageFallback() : null;
  const bestSecondary = bestEnDialogue || bestSourceFallback;
  const bestBilingual = getBestFile(bilingualFiles);
  const bestCommentary = getBestFile(commentaryFiles);

  task.commentary = bestCommentary;

  if (bestZh && bestSecondary) {
    task.zh = bestZh;
    task.en = bestSecondary;
    task.isBilingualSingle = false;
    if (!bestEnDialogue && bestSourceFallback) {
      notices.push({
        id: 'secondary-source-fallback',
        tone: 'notice',
        title: isLatinSecondaryLanguage(bestSourceFallback.lang) ? '第二语言已绑定' : '副字幕已回退到源语言轨',
        message: `未找到可用的英语对白轨（缺失或行数过少），已绑定「${bestSourceFallback.name}」。可手动改绑。`,
      });
    }
  } else if (bestBilingual) {
    task.zh = bestBilingual;
    task.en = null;
    task.isBilingualSingle = true;
  } else if (bestZh) {
    task.zh = bestZh;
    task.en = null;
    task.isBilingualSingle = false;
    if (enFiles.length > 0 && !bestEnDialogue) {
      notices.push({
        id: 'secondary-en-sparse',
        tone: 'notice',
        title: '英语轨未自动绑定',
        message: '检测到的英语文件行数远少于主字幕，更像屏显/稀疏字幕；可手动指定副字幕，或改用西语、法语、日语等其他语言轨。',
      });
    }
  } else if (bestSecondary) {
    task.zh = null;
    task.en = bestSecondary;
    task.isBilingualSingle = false;
  } else {
    const bestAny = getBestFile(normalFiles);
    if (bestAny) {
      if (bestAny.lang === 'bilingual') {
        task.zh = bestAny;
        task.en = null;
        task.isBilingualSingle = true;
      } else if (isMainPathSecondaryLanguage(bestAny.lang)) {
        task.zh = null;
        task.en = bestAny;
        task.isBilingualSingle = false;
      } else if (mainPathPrimaryRank(bestAny.lang) > 0) {
        task.zh = bestAny;
        task.en = null;
        task.isBilingualSingle = false;
      } else {
        // 未识别出具体语种的拉丁文字（'latin'）等：不自动进原文槽；用户可手动绑定。
        task.zh = null;
        task.en = null;
        task.isBilingualSingle = false;
      }
    } else {
      task.zh = null;
      task.en = null;
      task.isBilingualSingle = false;
    }
  }

  task.status = task.isBilingualSingle || (task.zh && task.en) ? 'paired' : 'unpaired';
};

export const groupAndBindFiles = (opts: {
  existingUploadedFiles: Subfile[];
  existingTasks: TaskPair[];
  newFiles: Subfile[];
}): GroupAndBindResult => {
  const { newFiles } = opts;
  const notices: GroupingNotice[] = [];

  const updatedUploadedFiles = [...opts.existingUploadedFiles];
  newFiles.forEach((nf) => {
    const idx = updatedUploadedFiles.findIndex((u) => u.name === nf.name);
    if (idx !== -1) {
      updatedUploadedFiles[idx] = nf;
    } else {
      updatedUploadedFiles.push(nf);
    }
  });

  const parsedByName = new Map(newFiles.map((file) => [file.name, parseMediaFilename(file.name)]));
  const identityByName = new Map(newFiles.map((file) => [file.name, assessMediaIdentity(file.name)]));
  const fallbackBatchTitle = [...identityByName.values()]
    .filter((item) => item.shouldAutoSearchTmdb)
    .sort((a, b) => b.title.length - a.title.length)[0]?.title || '';

  const parseEpisodeKey = (name: string): string | undefined => {
    const legacy = parsedByName.get(name)?.episodeKey || parseMediaFilename(name).episodeKey;
    // Legacy parser misses #02 / 1x01; E-only keys get season 1 so naming never falls back to S01E01.
    if (legacy && /^S\d+E\d+$/i.test(legacy)) return legacy;
    return episodeKeyOf(parseEpisodeRef(name), 1) || legacy;
  };
  const getBaseTitle = (name: string): string => {
    // Prefer cleanFilename so trailing lang tags (简中/繁中/eng) do not split one episode into multiple tasks.
    const cleaned = cleanFilename(name);
    if (cleaned) return cleaned;
    const identity = identityByName.get(name) || assessMediaIdentity(name);
    return identity.shouldAutoSearchTmdb ? identity.title : fallbackBatchTitle;
  };

  const currentTasks = opts.existingTasks.map((task) => ({
    ...task,
    files: [...task.files],
  }));
  newFiles.forEach((file) => {
    const fileEpKey = parseEpisodeKey(file.name);
    const fileBase = getBaseTitle(file.name).toLowerCase();
    const work = workIdentityFromFileName(file.name, fileEpKey);
    const taskId = mintTaskId(work);

    // Same-episode grouping (core/sameEpisode): episode number + timeline agreement.
    // Never merges differing episodes; uncertain pairs become a suggestion, not a merge.
    let suggestion: TaskPair['mergeSuggestion'];
    const fileCand = episodeCandidateOf(file);
    const matchedTask = currentTasks.find((t) => t.id === taskId) || currentTasks.find((t) => {
      const sameBase = fileBase
        ? t.files.some((f) => getBaseTitle(f.name).toLowerCase() === fileBase)
        : true;
      if (sameBase && (fileEpKey || t.epKey) && fileEpKey === t.epKey) return true;
      if (sameBase && !fileEpKey && !t.epKey) return true;
      const decisions = t.files.map((f) => decideSameEpisode(fileCand, episodeCandidateOf(f)));
      if (decisions.some((d) => d.kind === 'separate' && d.reason === 'episode-different')) return false;
      if (decisions.some((d) => d.kind === 'merge')) return true;
      const hint = decisions.find((d) => d.kind === 'suggest');
      if (hint && !suggestion) suggestion = { otherTaskId: t.id, score: hint.score, reason: hint.reason };
      return false;
    });

    if (matchedTask) {
      const fileExists = matchedTask.files.some((f) => f.name === file.name);
      if (!fileExists) {
        matchedTask.files = [...matchedTask.files, file];
      } else {
        matchedTask.files = matchedTask.files.map((f) => (f.name === file.name ? file : f));
      }
    } else {
      const baseName = getBaseTitle(file.name);
      currentTasks.push({
        id: taskId,
        title: fileEpKey ? `${baseName || '待补充片名'} ${fileEpKey}` : (baseName || '待补充片名'),
        epKey: fileEpKey,
        zh: null,
        en: null,
        commentary: null,
        files: [file],
        status: 'unpaired',
        ...(suggestion ? { mergeSuggestion: suggestion } : {}),
      });
    }
  });

  currentTasks.forEach((task) => optimizeTaskBindings(task, notices));

  return {
    uploadedFiles: updatedUploadedFiles,
    tasks: currentTasks,
    notices,
  };
};
