import { expect, test } from '@playwright/test';

test.describe('@project:KTKT @module:test-run @suite:regression', () => {
  test('UC-RUN-001 | TC-RUN-001 | Đợt kiểm thử hiển thị kết quả trong phạm vi đang chọn', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('button', { name: 'Kết quả kiểm thử' }).click();

    await expect(page.getByText('TC-RUN-001')).toBeVisible();
    await expect(page.getByText('Không đạt')).toBeVisible();
  });
});
