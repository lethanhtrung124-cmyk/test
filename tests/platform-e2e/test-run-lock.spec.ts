import { expect, test } from '@playwright/test';

test.describe('@project:KTKT @module:test-run @suite:regression', () => {
  test('UC-RUN-001 | TC-RUN-001 | Run đã khóa hiển thị chính sách chống sửa trực tiếp', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('button', { name: 'Test Run' }).click();

    await expect(page.getByText('Run đã khóa chỉ được điều chỉnh')).toBeVisible();
    await expect(page.getByText('TC-RUN-001')).toBeVisible();
    await expect(page.getByText('Fail')).toBeVisible();
  });
});
