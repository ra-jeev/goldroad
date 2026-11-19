import { calcMedalForAttempt } from '../../../lib/gameTiers';
import type { PuzzleType } from '../../../shared/types/game';

export type ShareRoadResultInput = {
  gameNo: number;
  puzzleType: PuzzleType;
  attempts: number;
  solved: boolean;
  solveTimeMs: number | null;
  hintsUsed: number;
};

export type ShareRoadResultResponse = {
  outcome: 'shared' | 'copied' | 'cancelled' | 'unavailable';
  message: string | null;
};

export type ShareDayModeResult = {
  attempts: number;
  solved: boolean;
  solveTimeMs: number | null;
};

export type ShareDayResultInput = {
  gameNo: number;
  classic: ShareDayModeResult | null;
  expedition: ShareDayModeResult | null;
};

function formatModeLabel(mode: PuzzleType): string {
  return mode === 'classic' ? 'Classic' : 'Expedition';
}

function formatDurationMs(value: number | null): string {
  if (value === null) return '–';

  const totalSeconds = Math.max(0, Math.round(value / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;

  return minutes > 0
    ? `${minutes}m ${String(seconds).padStart(2, '0')}s`
    : `${seconds}s`;
}

function formatAttemptLabel(attempts: number): string {
  return `${attempts} ${attempts === 1 ? 'try' : 'tries'}`;
}

/** Spoiler-free picture of the attempt journey: every square is a try. */
function formatAttemptTrail(attempts: number, solved: boolean): string {
  const visibleAttempts = Math.min(Math.max(attempts, 1), 8);
  const misses = solved ? visibleAttempts - 1 : visibleAttempts;
  const trail = `${'🟫'.repeat(misses)}${solved ? '🟩' : ''}`;
  return attempts > visibleAttempts ? `${trail} +${attempts - visibleAttempts}` : trail;
}

function formatResultLine(input: {
  attempts: number;
  solved: boolean;
}): string {
  const medal = calcMedalForAttempt(input.attempts, input.solved);

  if (input.solved && medal === 'gold') {
    return `🥇 Gold in ${formatAttemptLabel(input.attempts)}`;
  }

  if (input.solved && medal === 'silver') {
    return `🥈 Silver in ${formatAttemptLabel(input.attempts)}`;
  }

  if (input.solved && medal === 'bronze') {
    return `🥉 Bronze in ${formatAttemptLabel(input.attempts)}`;
  }

  if (input.solved) {
    return `😅 Solved in ${formatAttemptLabel(input.attempts)}`;
  }

  return `Still chasing the solve after ${formatAttemptLabel(input.attempts)}`;
}

function canonicalHomepage(origin: string): string {
  return new URL('/', origin).toString();
}

export function buildRoadResultShareText(
  input: ShareRoadResultInput,
  canonicalOrigin = 'https://playgoldroad.com',
): {
  title: string;
  text: string;
  url: string;
} {
  const title = `GoldRoad Day #${input.gameNo} · ${formatModeLabel(input.puzzleType)}`;
  const resultLine = formatResultLine(input);
  const timeLine =
    input.solved && input.solveTimeMs !== null
      ? `Solve time: ${formatDurationMs(input.solveTimeMs)}`
      : null;
  const hintLine =
    input.hintsUsed > 0 ? `Hints used: ${input.hintsUsed}` : null;

  return {
    title,
    text: [
      `GoldRoad Day #${input.gameNo} · ${formatModeLabel(input.puzzleType)}`,
      formatAttemptTrail(input.attempts, input.solved),
      resultLine,
      timeLine,
      hintLine,
      'Walk today’s road:',
      canonicalHomepage(canonicalOrigin),
    ]
      .filter((line): line is string => Boolean(line))
      .join('\n'),
    url: canonicalHomepage(canonicalOrigin),
  };
}

function formatDayModeLine(
  mode: PuzzleType,
  result: ShareDayModeResult | null,
): string {
  const label = formatModeLabel(mode);

  if (!result) {
    return `${label}: not played`;
  }

  const timeSuffix =
    result.solved && result.solveTimeMs !== null
      ? ` · ${formatDurationMs(result.solveTimeMs)}`
      : '';

  return `${label}: ${formatAttemptTrail(result.attempts, result.solved)} ${formatResultLine(result)}${timeSuffix}`;
}

export function buildDayResultShareText(
  input: ShareDayResultInput,
  canonicalOrigin = 'https://playgoldroad.com',
): {
  title: string;
  text: string;
  url: string;
} {
  const title = `GoldRoad Day #${input.gameNo} · Full day`;

  return {
    title,
    text: [
      `GoldRoad Day #${input.gameNo} · Full day`,
      formatDayModeLine('classic', input.classic),
      formatDayModeLine('expedition', input.expedition),
      'Walk today’s road:',
      canonicalHomepage(canonicalOrigin),
    ].join('\n'),
    url: canonicalHomepage(canonicalOrigin),
  };
}
