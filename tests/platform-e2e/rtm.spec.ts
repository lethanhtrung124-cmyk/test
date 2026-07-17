import { expect, test } from '@playwright/test';

test.describe('@project:KTKT @module:test-case @suite:smoke', () => {
  test('UC-TC-001 | TC-TC-001 | Ma trận truy vết lọc theo đợt kiểm thử', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('button', { name: 'Ma trận truy vết' }).click();

    await expect(page.getByRole('heading', { name: /UC \/ Tình huống \/ Giao dịch kiểm thử/ })).toBeVisible();
    await expect(page.getByText('TC-TC-001')).toBeVisible();
    await expect(page.getByText('UC-TC-001')).toBeVisible();
  });
});
