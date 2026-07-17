import { expect, test } from '@playwright/test';

test.describe('@project:KTKT @module:target @suite:smoke', () => {
  test('UC-TARGET-001 | GD-TARGET-001 | Hệ thống đích phản hồi khi truy cập URL kiểm thử', async ({ page }) => {
    const response = await page.goto('/');

    expect(response, 'URL hệ thống đích phải phản hồi').not.toBeNull();
    expect(response?.status(), 'URL hệ thống đích không được trả lỗi máy chủ').toBeLessThan(500);
    await expect(page.locator('body')).toBeVisible();
  });
});
