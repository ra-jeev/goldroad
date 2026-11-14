import type { HintResult } from '#shared/types/game';
import { UI_COPY } from '../content/uiCopy';

export function getHintMessage(kind: HintResult['kind'], highlightedCount: number) {
  if (kind === 'diverged') return UI_COPY.runtime.hintDiverged;
  if (kind === 'already-solved') return UI_COPY.runtime.hintAlreadySolved;
  if (highlightedCount === 0) return null;
  return highlightedCount === 1
    ? UI_COPY.runtime.hintNextStep
    : UI_COPY.boardFooter.followGuide;
}
