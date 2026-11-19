import { buildDayResultShareText, buildRoadResultShareText } from '../utils/pure/roadResultShare';
import type { ShareDayResultInput, ShareRoadResultInput, ShareRoadResultResponse } from '../utils/pure/roadResultShare';

export { buildDayResultShareText, buildRoadResultShareText } from '../utils/pure/roadResultShare';
export type { ShareDayModeResult, ShareDayResultInput, ShareRoadResultInput, ShareRoadResultResponse } from '../utils/pure/roadResultShare';

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
