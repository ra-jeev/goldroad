import { calcMedalForAttempt } from '../../lib/gameTiers';
import type { PuzzleType } from '#shared/types/game';

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

function isAbortError(error: unknown): boolean {
  return error instanceof DOMException && error.name === 'AbortError';
}

async function copyText(text: string): Promise<boolean> {
  if (!import.meta.client) return false;

  if (window.navigator.clipboard) {
    try {
      await window.navigator.clipboard.writeText(text);
      return true;
    } catch {
      // Fall through to the textarea fallback below.
    }
  }

  const textarea = document.createElement('textarea');
  textarea.style.position = 'fixed';
  textarea.style.width = '1px';
  textarea.style.height = '1px';
  textarea.style.padding = '0';
  textarea.style.border = 'none';
  textarea.style.outline = 'none';
  textarea.style.boxShadow = 'none';
  textarea.style.background = 'transparent';
  textarea.style.opacity = '0';
  textarea.value = text;
  document.body.appendChild(textarea);
  textarea.focus();
  textarea.select();

  const copied = document.execCommand('copy');
  textarea.remove();
  return copied;
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

  return `${label}: ${formatResultLine(result)}${timeSuffix}`;
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

async function deliverShare(payload: {
  title: string;
  text: string;
  url: string;
}): Promise<ShareRoadResultResponse> {
  if (!import.meta.client) {
    return {
      outcome: 'unavailable',
      message: 'Sharing is only available in the browser.',
    };
  }

  if (typeof navigator !== 'undefined' && 'share' in navigator) {
    try {
      await navigator.share({
        title: payload.title,
        text: payload.text,
      });

      return {
        outcome: 'shared',
        message: 'Result shared.',
      };
    } catch (error) {
      if (isAbortError(error)) {
        return {
          outcome: 'cancelled',
          message: null,
        };
      }
    }
  }

  if (await copyText(payload.text)) {
    return {
      outcome: 'copied',
      message: 'Result copied to your clipboard.',
    };
  }

  return {
    outcome: 'unavailable',
    message: 'Unable to share this result right now.',
  };
}

export function useRoadResultShare() {
  const config = useRuntimeConfig();
  const canonicalOrigin = String(
    config.public?.siteUrl || 'https://playgoldroad.com',
  );

  async function shareRoadResult(
    input: ShareRoadResultInput,
  ): Promise<ShareRoadResultResponse> {
    return deliverShare(buildRoadResultShareText(input, canonicalOrigin));
  }

  async function shareDayResult(
    input: ShareDayResultInput,
  ): Promise<ShareRoadResultResponse> {
    return deliverShare(buildDayResultShareText(input, canonicalOrigin));
  }

  return {
    shareRoadResult,
    shareDayResult,
  };
}
