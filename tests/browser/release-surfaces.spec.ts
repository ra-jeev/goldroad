import { expect, test, type Page } from '@playwright/test';
import type { CurrentGamesResponse } from '../../shared/types/game';

function captureRuntimeErrors(page: Page) {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(message.text());
  });
  return errors;
}

async function expectNoHorizontalOverflow(page: Page) {
  const hasOverflow = await page.evaluate(
    () => document.documentElement.scrollWidth > window.innerWidth + 1,
  );
  expect(hasOverflow).toBe(false);
}

test('live board and tutorial are usable', async ({ page }) => {
  const runtimeErrors = captureRuntimeErrors(page);
  await page.goto('/');

  await expect(
    page.getByRole('heading', { name: 'Learn the road' }),
  ).toBeVisible();
  await expect(page.getByRole('tab', { name: '1. Guide' })).toHaveAttribute(
    'aria-selected',
    'true',
  );

  await page.getByRole('tab', { name: '2. Practice Road' }).click();
  await expect(page.locator('#tutorial-practice-panel')).toBeVisible();
  await expect(
    page.locator('#tutorial-practice-panel').getByRole('button', { name: 'Hint' }),
  ).toBeVisible();

  await page.getByRole('button', { name: 'Close' }).click();
  await expect(page.getByRole('region', { name: 'Road controls' })).toBeVisible();
  // The seed board is freshly generated, so the start tile's coin value
  // varies from run to run. Match the marker, not the number.
  await expect(
    page.getByRole('button', { name: /Start: footprints$/ }),
  ).toBeVisible();
  await expect(page.getByRole('button', { name: 'Play the new road' })).toBeVisible();

  await expectNoHorizontalOverflow(page);
  expect(runtimeErrors).toEqual([]);
});

test('Play the new road replaces the expired board without navigation', async ({ page }) => {
  const runtimeErrors = captureRuntimeErrors(page);
  let currentRoadRequests = 0;

  await page.route('**/api/games/current', async (route) => {
    const response = await route.fetch();
    const roadDay = (await response.json()) as CurrentGamesResponse;
    currentRoadRequests += 1;

    if (currentRoadRequests > 1) {
      const nextGameAt = new Date(Date.now() + 86_400_000).toISOString();
      const promote = (game: NonNullable<CurrentGamesResponse['classic']>) => ({
        ...game,
        gameNo: game.gameNo + 1,
        playableAt: new Date().toISOString(),
        nextGameAt,
      });
      roadDay.classic = roadDay.classic ? promote(roadDay.classic) : null;
      roadDay.expedition = roadDay.expedition
        ? promote(roadDay.expedition)
        : null;
    }

    await route.fulfill({ response, json: roadDay });
  });

  await page.goto('/');
  await expect(
    page.getByRole('heading', { name: 'Learn the road' }),
  ).toBeVisible();
  await page.getByRole('button', { name: 'Close' }).click();

  await expect(page.getByText('Day #3')).toBeVisible();
  await page.getByRole('button', { name: 'Play the new road' }).click();

  await expect(page.getByText('Day #4')).toBeVisible();
  await expect(
    page.getByRole('button', { name: 'Play the new road' }),
  ).toBeHidden();
  await expect(
    page.getByRole('tab', { name: 'Classic Not solved' }),
  ).toBeEnabled();
  expect(runtimeErrors).toEqual([]);
});

test('stats surface loads its core sections', async ({ page }) => {
  const runtimeErrors = captureRuntimeErrors(page);
  await page.goto('/stats');

  await expect(
    page.getByRole('heading', { name: 'Stats', exact: true }),
  ).toBeVisible();
  await expect(page.getByRole('region', { name: 'Medals earned' })).toBeVisible();
  await expect(
    page.getByRole('region', {
      name: /Yesterday’s roads, Day #\d+, global stats for Classic/,
    }),
  ).toBeVisible();
  // Today's card, before the day has been walked.
  await expect(
    page.getByRole('heading', { name: 'Waiting to be walked.' }),
  ).toBeVisible();

  // Each mode-scoped panel carries its own switch, and the panel relabels
  // itself when the mode changes.
  const record = page.getByRole('region', { name: 'Classic stats' });
  await expect(record).toBeVisible();
  await record.getByRole('button', { name: 'View Expedition stats' }).click();
  await expect(
    page.getByRole('region', { name: 'Expedition stats' }),
  ).toBeVisible();

  await expectNoHorizontalOverflow(page);
  expect(runtimeErrors).toEqual([]);
});

test('today stats share grows from Classic to the full day', async ({ page }) => {
  const runtimeErrors = captureRuntimeErrors(page);
  await page.addInitScript(() => {
    if (sessionStorage.getItem('stats-share-seeded')) return;
    sessionStorage.setItem('stats-share-seeded', 'true');
    const day = new Date().toISOString().split('T')[0]!;
    localStorage.setItem(
      'goldroad-state-v2',
      JSON.stringify({
        version: 2,
        playerUUID: '00000000-0000-4000-8000-000000000003',
        settings: { muted: false },
        currentRoadContext: {
          currentGameNo: 3,
          currentDay: day,
          selectedMode: 'classic',
        },
        puzzleProgressByKey: {},
        historyByDay: {
          [day]: {
            day,
            gameNo: 3,
            modes: {
              classic: {
                attempts: 1,
                solved: true,
                hintsUsed: 0,
                solveTimeMs: 64_000,
                updatedAt: new Date().toISOString(),
              },
            },
          },
        },
        archiveCompletionByGame: {},
        tutorialState: { completed: true, lastSeenAt: null },
        celebratedSolveKeys: [],
        v1NoticeDismissed: true,
        lastAcknowledgedUpdateId: null,
      }),
    );
  });

  await page.goto('/stats');
  await expect(page.getByRole('heading', { name: 'Classic conquered.' })).toBeVisible();
  await expect(page.getByText('1 try · 1m 04s')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Share Classic' })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Play Expedition' })).toBeVisible();

  await page.evaluate(() => {
    const state = JSON.parse(localStorage.getItem('goldroad-state-v2')!);
    const day = state.currentRoadContext.currentDay;
    state.historyByDay[day].modes.expedition = {
      attempts: 2,
      solved: true,
      hintsUsed: 1,
      solveTimeMs: 125_000,
      updatedAt: new Date().toISOString(),
    };
    localStorage.setItem('goldroad-state-v2', JSON.stringify(state));
  });
  await page.reload();

  await expect(page.getByRole('heading', { name: 'Both roads conquered.' })).toBeVisible();
  await expect(page.getByText('2 tries · 2m 05s · 1 hint')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Share the day' })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Play Expedition' })).toBeHidden();

  // Defensive state: the product unlock gate makes Expedition-only
  // unreachable today, but presentation should remain correct if that rule
  // changes or local data is repaired independently in the future.
  await page.evaluate(() => {
    const state = JSON.parse(localStorage.getItem('goldroad-state-v2')!);
    const day = state.currentRoadContext.currentDay;
    delete state.historyByDay[day].modes.classic;
    localStorage.setItem('goldroad-state-v2', JSON.stringify(state));
  });
  await page.reload();

  await expect(
    page.getByRole('heading', { name: 'Expedition conquered.' }),
  ).toBeVisible();
  await expect(
    page.getByRole('button', { name: 'Share Expedition' }),
  ).toBeVisible();
  await expect(page.getByRole('link', { name: 'Play Classic' })).toBeVisible();

  await expectNoHorizontalOverflow(page);
  expect(runtimeErrors).toEqual([]);
});

test('Past roads calendar exposes playable road days', async ({ page }) => {
  const runtimeErrors = captureRuntimeErrors(page);
  await page.goto('/games');

  await expect(page.getByRole('heading', { name: 'Past roads' })).toBeVisible();
  await expect(page.getByRole('link', { name: /Day #1,/ })).toBeVisible();
  await expect(page.getByRole('link', { name: /Day #2,/ })).toBeVisible();

  await expectNoHorizontalOverflow(page);
  expect(runtimeErrors).toEqual([]);
});

test('archived-road replay loads the production board', async ({ page }) => {
  const runtimeErrors = captureRuntimeErrors(page);
  await page.goto('/games/1');

  await expect(page.getByRole('region', { name: 'Road controls' })).toBeVisible();
  await expect(page.getByRole('tab', { name: 'Classic Not solved' })).toBeVisible();
  await expect(
    page.getByRole('button', { name: /Start: footprints/ }),
  ).toBeVisible();

  await expectNoHorizontalOverflow(page);
  expect(runtimeErrors).toEqual([]);
});
