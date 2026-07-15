import { expect, test } from '@playwright/test';

test.describe('@project:KTKT @module:automation @suite:regression', () => {
  test('UC-AUTO-001 | TC-AUTO-001 | Bảng điều khiển hiển thị trạng thái tự động hóa và minh chứng', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('button', { name: 'Minh chứng & nhật ký' }).click();

    await expect(page.getByText('junit.xml')).toBeVisible();
    await expect(page.getByText('sha256:9f1c-pilot')).toBeVisible();
  });
});
