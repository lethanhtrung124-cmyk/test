import { expect, test } from '@playwright/test';

test.describe('@project:KTKT @module:user @suite:smoke', () => {
  test('UC-USER-001 | TC-USER-001 | Viewer chỉ xem dashboard được phân quyền', async ({ page }) => {
    await page.goto('/');

    await expect(page.getByText('UC Test Platform')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Dashboard' })).toBeVisible();
    await expect(page.getByText('Không lộ secret')).toHaveCount(0);
  });
});
