/** Subtitle processing barrel — re-exports layered modules under ./subtitle/. */
export {
  type ParsedMediaFilename,
  type MediaIdentityLevel,
  type MediaIdentityAssessment,
  cleanFilename,
  parseMediaFilename,
  assessMediaIdentity,
  buildTmdbSearchQueries,
  smartDetectTitle,
} from './mediaIdentity';
export { OFFSET_DIAGNOSIS_POLICY, type GlobalOffsetDiagnosis } from './timeline/offsetDiagnosis';
export { decodeBuffer } from './textEncoding';

export type {
  CueKind,
  AuxiliaryCueCategory,
  AuxiliaryCueAction,
  AuxiliarySubtitleMode,
  CueSuspicionKind,
  CueSuspicion,
  AuxiliaryCueClassification,
  CueClassification,
  AlignmentSourceRef,
  AlignmentProvenance,
  SubRow,
  RawSub,
  DecodeResult,
  SubtitleLanguage,
  LatinSecondaryLanguage,
  SubtitleLanguagePair,
  MainPathSecondaryLanguage,
  SubtitleLanguageDetection,
  SubtitleAttributionRole,
  SubtitleAttribution,
  AssScriptMeta,
  StyleSettings,
} from './subtitle/model';

export {
  LATIN_SECONDARY_LANGUAGES,
  isLatinSecondaryLanguage,
  MAIN_PATH_SECONDARY_LANGUAGES,
  SPARSE_SECONDARY_CUE_RATIO,
  cleanSubtitleContent,
  timeToMs,
  msToTime,
  sortCuesByTime,
  dedupeIdenticalCues,
  normalizeParsedCues,
} from './subtitle/model';

export type { LineKind } from './subtitle/analysis';

export {
  stripMarkupForDetection,
  detectLanguageByContent,
  latinLanguageScores,
  isMainPathSecondaryLanguage,
  isEnglishSecondaryLanguage,
  isSdhOrCcSubtitleFilename,
  mainPathPrimaryRank,
  mainPathSecondaryRank,
  isSparseSecondaryTrack,
  detectLanguageByFilename,
  AUXILIARY_CLASSIFY_SCORES,
  describeAuxiliaryReason,
  classifyAuxiliaryCue,
  classifySubtitleCue,
  isLyricText,
  isSubtitleCreditText,
  extractSubtitleAttributions,
  classifyLineKind,
  splitSingleBilingualText,
  BILINGUAL_SECONDARY_SHARE,
  BILINGUAL_SECONDARY_SHARE_WITH_HINT,
  isSentenceLevelLatinLine,
} from './subtitle/analysis';

export {
  extractStylesFromAss,
  estimateSubtitleCueCount,
  enhancedSrtCleaner,
  parseSrt,
  stripAssDrawingCommands,
  parseSubtitle,
  detectSubtitleLanguage,
  checkIsBilingual,
  safeParseSubtitle,
  safeTimeToMs,
  detectSubtitleLanguagePair,
} from './subtitle/io';

export type { AlignmentFallbackInfo, AlignSubtitlesOptions } from './subtitle/engine';

export {
  calculateOverlapRatio,
  isCueMostlyCoveredBy,
  CUE_MATCH_POLICY,
  isTemporalCueMatch,
  mergeSubtitles,
  measureMergeOrphanRate,
  alignSubtitlesIndustrial,
  normalizeSingleBilingualRows,
} from './subtitle/engine';

export type { CreatorCreditPlacement, WrapReport, ExportRunOptions } from './subtitle/product';

export {
  smartLineWrap,
  appendCreatorCredit,
  CREDIT_ALIGN,
  isHiddenByPolicy,
  applyAuxiliarySubtitleMode,
  createWrapReport,
  detectSecondaryLatinLanguage,
  generateSrtContent,
  generateAssContent,
} from './subtitle/product';
