import { expect, test } from '@playwright/test';

test.describe('@project:KTKT @module:test-case @suite:smoke', () => {
  test('UC-TC-001 | TC-TC-001 | Test Case bắt buộc liên kết tối thiểu một UC', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('button', { name: 'RTM' }).click();

    await expect(page.getByRole('heading', { name: /UC \/ Scenario \/ Test Case/ })).toBeVisible();
    await expect(page.getByText('TC-TC-001')).toBeVisible();
    await expect(page.getByText('UC-TC-001')).toBeVisible();
  });
});
