import { expect, test } from '@playwright/test';

test.describe('@project:KTKT @module:user @suite:smoke', () => {
  test('UC-USER-001 | TC-USER-001 | Viewer chỉ xem bảng điều khiển được phân quyền', async ({ page }) => {
    await page.goto('/');

    await expect(page.getByText('Nền tảng kiểm thử UC')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Bảng điều khiển' })).toBeVisible();
    await expect(page.getByText('Không lộ secret')).toHaveCount(0);
  });
});
