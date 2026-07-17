import { expect, test } from '@playwright/test';

test.describe('@project:KTKT @module:user @suite:platform', () => {
  test('UC-USER-001 | TC-USER-001 | Người dùng xem được điều hướng dự án và phạm vi', async ({ page }) => {
    await page.goto('/');

    await expect(page.getByText('Nền tảng kiểm thử UC')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Dự án & phạm vi' })).toBeVisible();
    await expect(page.getByText('Không lộ secret')).toHaveCount(0);
  });
});
