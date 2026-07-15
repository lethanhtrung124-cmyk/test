import { expect, test } from '@playwright/test';

test.describe('@project:KTKT @module:test-run @suite:regression', () => {
  test('UC-RUN-001 | TC-RUN-001 | Đợt kiểm thử đã khóa hiển thị chính sách chống sửa trực tiếp', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('button', { name: 'Đợt kiểm thử' }).click();

    await expect(page.getByText('Đợt kiểm thử đã khóa chỉ được điều chỉnh')).toBeVisible();
    await expect(page.getByText('TC-RUN-001')).toBeVisible();
    await expect(page.getByText('Không đạt')).toBeVisible();
  });
});
