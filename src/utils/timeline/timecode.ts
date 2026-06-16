export const parseTimecodeToMs = (value: string): number => {
  const match = value.trim().match(/(?:(\d{1,2}):)?(\d{1,2}):(\d{1,2})[,.](\d{1,3})/);
  if (!match) return 0;

  const hours = parseInt(match[1] || '0', 10);
  const minutes = parseInt(match[2] || '0', 10);
  const seconds = parseInt(match[3] || '0', 10);
  const millis = parseInt(match[4].padEnd(3, '0').slice(0, 3), 10);

  return (((hours * 60) + minutes) * 60 + seconds) * 1000 + millis;
};

export const formatMsClock = (ms: number): string => {
  const safeMs = Math.max(0, Math.round(ms));
  const totalSeconds = Math.floor(safeMs / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  if (hours > 0) {
    return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
  }
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
};

export const parseSubtitleRange = (range: string): { startMs: number; endMs: number } => {
  const [start, end] = range.split(/\s*-->\s*/);
  const startMs = parseTimecodeToMs(start || '');
  const endMs = parseTimecodeToMs(end || '');
  return {
    startMs,
    endMs: Math.max(startMs, endMs),
  };
};
