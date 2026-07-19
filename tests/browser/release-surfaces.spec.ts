import { expect, test, type Page } from '@playwright/test';

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
  await expect(
    page.getByRole('button', { name: '5 Start: footprints' }),
  ).toBeVisible();
  await expect(page.getByRole('button', { name: 'Play the new road' })).toBeVisible();

  await expectNoHorizontalOverflow(page);
  expect(runtimeErrors).toEqual([]);
});

test('stats surface loads its core sections', async ({ page }) => {
  const runtimeErrors = captureRuntimeErrors(page);
  await page.goto('/stats');

  await expect(page.getByRole('heading', { name: 'Stats' })).toBeVisible();
  await expect(page.getByRole('region', { name: 'Medals earned' })).toBeVisible();
  await expect(page.getByRole('region', { name: 'Streaks' })).toBeVisible();
  await expect(page.getByRole('tablist', { name: 'Choose a mode' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Road 3 is waiting' })).toBeVisible();

  await expectNoHorizontalOverflow(page);
  expect(runtimeErrors).toEqual([]);
});

test('Past roads calendar exposes playable road days', async ({ page }) => {
  const runtimeErrors = captureRuntimeErrors(page);
  await page.goto('/games');

  await expect(page.getByRole('heading', { name: 'Past roads' })).toBeVisible();
  await expect(page.getByRole('link', { name: /Road 1,/ })).toBeVisible();
  await expect(page.getByRole('link', { name: /Road 2,/ })).toBeVisible();

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
