import { describe, expect, it } from 'vitest';
import { TUTORIAL_LESSONS } from '../app/content/tutorialContent';

describe('tutorial lesson 1 start-state content (RP1-9)', () => {
  it('has an "icons" lesson as the first lesson', () => {
    expect(TUTORIAL_LESSONS[0]?.id).toBe('icons');
  });

  it('renders the real pre-run start state: current-tile occupied plus a legal neighbor move', () => {
    expect(TUTORIAL_LESSONS[0]?.visual.showStartState).toBe(true);
    expect(TUTORIAL_LESSONS[0]?.visual.isStart).toBe(true);
    expect(TUTORIAL_LESSONS[0]?.visual.isEnd).toBe(true);
  });

  it('is the only lesson that renders the start state', () => {
    const startStateLessons = TUTORIAL_LESSONS.filter(
      (lesson) => lesson.visual.showStartState,
    );
    expect(startStateLessons).toHaveLength(1);
    expect(startStateLessons[0]?.id).toBe('icons');
  });

  it('names footprints/finish and explains the target without "exact target score" wording', () => {
    const body = TUTORIAL_LESSONS[0]?.body ?? '';
    expect(body).toMatch(/footprints/i);
    expect(body).toMatch(/finish/i);
    expect(body.toLowerCase()).not.toContain('exact target score');
  });
});
