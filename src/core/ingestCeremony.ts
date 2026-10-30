/**
 * 导入整理仪式控制器（UI 无关，可被任何页面结构复用）。
 *
 * 放行规则（2026-10-30 决定）：
 * - 放行时刻 = max(CEREMONY_MIN_MS, TMDB 结果到本地)；没有强制放行。
 * - 等待期间停在「匹配影片」；TMDB 请求起跑 TMDB_PATIENCE_MS 后仍未返回，或请求失败，
 *   给出「重试 / 手动搜索」选择，用户选了才前进。
 * - 429：按 Retry-After 排队自动重试，状态仍是「匹配中」（到点照样给出选择）。
 * - 5xx（retryable 失败）：先静默自动重试 SERVER_ERROR_SILENT_RETRIES 次，仍失败才给出选择。
 * - 不走 TMDB 的文件名（skipped）：只守 CEREMONY_MIN_MS，保持旧行为。
 *
 * 8 s 计时（TMDB_PATIENCE_MS）按「每次请求」算：runMatch 起跑一次，用户点「重试」重新起跑；
 * 自动重试（429 排队、5xx 静默重试）不重置计时，所以用户最多等 8 s 就能看到选择。
 *
 * 时钟可注入，单元测试用假时钟；不依赖 React / store / DOM。
 */

export const CEREMONY_MIN_MS = 2400;
/** TMDB 起跑后等多久给出「重试 / 手动搜索」（可调）。 */
export const TMDB_PATIENCE_MS = 8000;
/** 5xx 时静默自动重试的次数（每次用户发起的请求内）。 */
export const SERVER_ERROR_SILENT_RETRIES = 1;
/** 5xx 静默重试前的间隔。 */
export const SERVER_ERROR_RETRY_DELAY_MS = 800;
/** 429 未带 Retry-After 时的排队间隔。 */
export const RATE_LIMIT_DEFAULT_RETRY_MS = 5000;
/** 单次排队上限（Worker 限流窗口为 60 s）。 */
export const RATE_LIMIT_MAX_RETRY_MS = 60_000;

export type MatchOutcome =
  /** TMDB 有答复（含「无结果」「需确认」），结果已在本地。 */
  | { kind: 'arrived' }
  /** 本次不走 TMDB（文件名不足 / 已有片源）。 */
  | { kind: 'skipped' }
  | { kind: 'rate_limited'; retryAfterMs?: number | null }
  /** retryable：服务端暂时故障（5xx），值得静默再试一次。 */
  | { kind: 'failed'; message?: string; retryable?: boolean };

export type MatchJob = () => Promise<MatchOutcome>;

export type CeremonyMatchStatus = 'idle' | 'pending' | 'rate_limited' | 'failed' | 'arrived' | 'skipped';
export type CeremonyReleaseReason = 'arrived' | 'skipped' | 'manual';
export type CeremonyChoiceReason = 'slow' | 'failed';

export type CeremonySnapshot = {
  phase: 'running' | 'released' | 'disposed';
  match: CeremonyMatchStatus;
  /** true → 显示「重试 / 手动搜索」。 */
  needsChoice: boolean;
  choiceReason: CeremonyChoiceReason | null;
  /** 第几次请求（含自动重试与手动重试），从 1 开始；未起跑为 0。 */
  attempt: number;
  /** 429 排队中的下一次自动重试时刻（clock.now() 基准），否则 null。 */
  retryAt: number | null;
  failureMessage: string | null;
  startedAt: number;
  releasedAt: number | null;
  releaseReason: CeremonyReleaseReason | null;
};

export type CeremonyRelease = {
  reason: CeremonyReleaseReason;
  at: number;
  elapsedMs: number;
};

export type CeremonyClock = {
  now: () => number;
  setTimeout: (fn: () => void, ms: number) => unknown;
  clearTimeout: (handle: unknown) => void;
};

export const systemCeremonyClock: CeremonyClock = {
  now: () => Date.now(),
  setTimeout: (fn, ms) => globalThis.setTimeout(fn, ms),
  clearTimeout: (handle) => globalThis.clearTimeout(handle as ReturnType<typeof globalThis.setTimeout>),
};

export type IngestCeremonyOptions = {
  clock?: CeremonyClock;
  minMs?: number;
  patienceMs?: number;
  rateLimitDefaultMs?: number;
  rateLimitMaxMs?: number;
  serverErrorRetries?: number;
  serverErrorRetryDelayMs?: number;
};

export type IngestCeremony = {
  getSnapshot: () => CeremonySnapshot;
  subscribe: (listener: (snapshot: CeremonySnapshot) => void) => () => void;
  /** 开始匹配；job 会被保存，供自动 / 手动重试复用。 */
  runMatch: (job: MatchJob) => void;
  /** 不走 TMDB：只守最短仪式。 */
  skipMatch: () => void;
  /** 用户点「重试」（也可在 429 排队时立即重试）。 */
  retry: () => void;
  /** 用户点「手动搜索」：立即放行，调用方负责打开手动检索。 */
  chooseManual: () => void;
  dispose: () => void;
  /** 放行时 resolve 一次。 */
  released: Promise<CeremonyRelease>;
};

const clampRetry = (ms: number | null | undefined, fallback: number, max: number) => {
  if (typeof ms !== 'number' || !Number.isFinite(ms) || ms <= 0) return fallback;
  return Math.min(Math.max(ms, 250), max);
};

export const createIngestCeremony = (options: IngestCeremonyOptions = {}): IngestCeremony => {
  const clock = options.clock ?? systemCeremonyClock;
  const minMs = options.minMs ?? CEREMONY_MIN_MS;
  const patienceMs = options.patienceMs ?? TMDB_PATIENCE_MS;
  const rateLimitDefaultMs = options.rateLimitDefaultMs ?? RATE_LIMIT_DEFAULT_RETRY_MS;
  const rateLimitMaxMs = options.rateLimitMaxMs ?? RATE_LIMIT_MAX_RETRY_MS;
  const serverErrorRetries = options.serverErrorRetries ?? SERVER_ERROR_SILENT_RETRIES;
  const serverErrorRetryDelayMs = options.serverErrorRetryDelayMs ?? SERVER_ERROR_RETRY_DELAY_MS;
  /** 本轮（runMatch / 用户重试）已用掉的 5xx 静默重试次数。 */
  let silentRetriesUsed = 0;

  let snapshot: CeremonySnapshot = {
    phase: 'running',
    match: 'idle',
    needsChoice: false,
    choiceReason: null,
    attempt: 0,
    retryAt: null,
    failureMessage: null,
    startedAt: clock.now(),
    releasedAt: null,
    releaseReason: null,
  };
  const listeners = new Set<(s: CeremonySnapshot) => void>();
  let job: MatchJob | null = null;
  /** Bumped on every attempt / retry / release so late answers are ignored. */
  let token = 0;
  let patienceTimer: unknown = null;
  let retryTimer: unknown = null;
  let releaseTimer: unknown = null;
  let resolveReleased: (r: CeremonyRelease) => void = () => {};
  const released = new Promise<CeremonyRelease>((resolve) => { resolveReleased = resolve; });

  const update = (patch: Partial<CeremonySnapshot>) => {
    snapshot = { ...snapshot, ...patch };
    listeners.forEach((listener) => listener(snapshot));
  };
  const clear = (handle: unknown) => {
    if (handle !== null) clock.clearTimeout(handle);
    return null;
  };
  const clearAll = () => {
    patienceTimer = clear(patienceTimer);
    retryTimer = clear(retryTimer);
    releaseTimer = clear(releaseTimer);
  };
  const isRunning = () => snapshot.phase === 'running';

  const release = (reason: CeremonyReleaseReason) => {
    if (!isRunning()) return;
    clearAll();
    token += 1;
    const at = clock.now();
    update({ phase: 'released', needsChoice: false, retryAt: null, releasedAt: at, releaseReason: reason });
    resolveReleased({ reason, at, elapsedMs: at - snapshot.startedAt });
  };

  const releaseAfterFloor = (reason: 'arrived' | 'skipped') => {
    patienceTimer = clear(patienceTimer);
    retryTimer = clear(retryTimer);
    const wait = snapshot.startedAt + minMs - clock.now();
    if (wait <= 0) {
      release(reason);
      return;
    }
    releaseTimer = clear(releaseTimer);
    releaseTimer = clock.setTimeout(() => { releaseTimer = null; release(reason); }, wait);
  };

  const startPatience = () => {
    patienceTimer = clear(patienceTimer);
    patienceTimer = clock.setTimeout(() => {
      patienceTimer = null;
      if (!isRunning() || snapshot.needsChoice) return;
      if (snapshot.match === 'pending' || snapshot.match === 'rate_limited') {
        update({ needsChoice: true, choiceReason: 'slow' });
      }
    }, patienceMs);
  };

  const handleOutcome = (myToken: number, outcome: MatchOutcome) => {
    if (myToken !== token || !isRunning()) return;
    switch (outcome.kind) {
      case 'arrived':
      case 'skipped':
        update({ match: outcome.kind, needsChoice: false, choiceReason: null, retryAt: null, failureMessage: null });
        releaseAfterFloor(outcome.kind);
        return;
      case 'rate_limited': {
        const delay = clampRetry(outcome.retryAfterMs, rateLimitDefaultMs, rateLimitMaxMs);
        retryTimer = clear(retryTimer);
        update({ match: 'rate_limited', retryAt: clock.now() + delay });
        retryTimer = clock.setTimeout(() => {
          retryTimer = null;
          if (myToken !== token || !isRunning()) return;
          attempt({ keepChoice: true });
        }, delay);
        return;
      }
      case 'failed':
      default:
        if (outcome.kind === 'failed' && outcome.retryable && silentRetriesUsed < serverErrorRetries) {
          silentRetriesUsed += 1;
          retryTimer = clear(retryTimer);
          // 仍是「匹配中」：不出选择，不重置 8 s 计时。
          retryTimer = clock.setTimeout(() => {
            retryTimer = null;
            if (myToken !== token || !isRunning()) return;
            attempt({ keepChoice: true });
          }, serverErrorRetryDelayMs);
          return;
        }
        patienceTimer = clear(patienceTimer);
        update({
          match: 'failed',
          needsChoice: true,
          choiceReason: 'failed',
          retryAt: null,
          failureMessage: outcome.kind === 'failed' ? outcome.message ?? null : null,
        });
    }
  };

  const attempt = ({ keepChoice }: { keepChoice: boolean }) => {
    if (!job || !isRunning()) return;
    token += 1;
    const myToken = token;
    const current = job;
    update({
      match: 'pending',
      attempt: snapshot.attempt + 1,
      retryAt: null,
      failureMessage: null,
      ...(keepChoice ? {} : { needsChoice: false, choiceReason: null }),
    });
    let promise: Promise<MatchOutcome>;
    try {
      promise = current();
    } catch (error) {
      promise = Promise.reject(error);
    }
    promise.then(
      (outcome) => handleOutcome(myToken, outcome),
      (error: unknown) => handleOutcome(myToken, {
        kind: 'failed',
        message: error instanceof Error ? error.message : String(error),
      }),
    );
  };

  return {
    getSnapshot: () => snapshot,
    subscribe: (listener) => {
      listeners.add(listener);
      return () => { listeners.delete(listener); };
    },
    runMatch: (nextJob) => {
      if (!isRunning() || job) return;
      job = nextJob;
      silentRetriesUsed = 0;
      startPatience();
      attempt({ keepChoice: false });
    },
    skipMatch: () => {
      if (!isRunning() || job) return;
      job = async () => ({ kind: 'skipped' });
      update({ match: 'skipped' });
      releaseAfterFloor('skipped');
    },
    retry: () => {
      if (!isRunning() || !job) return;
      retryTimer = clear(retryTimer);
      silentRetriesUsed = 0;
      startPatience();
      attempt({ keepChoice: false });
    },
    chooseManual: () => release('manual'),
    dispose: () => {
      if (snapshot.phase === 'disposed') return;
      clearAll();
      token += 1;
      update({ phase: 'disposed', needsChoice: false });
      listeners.clear();
    },
    released,
  };
};
