import type { Page } from '@playwright/test';

export class TargetLoginPage {
  constructor(private readonly page: Page) {}

  async goto() {
    await this.page.goto(process.env.TEST_BASE_URL ?? '/');
  }

  async loginAsViewer() {
    const username = process.env.TEST_USERNAME;
    const password = process.env.TEST_PASSWORD;

    if (!username || !password) {
      testCredentialsMissing();
    }

    await this.page.getByLabel(/user|email|tài khoản/i).fill(username);
    await this.page.getByLabel(/password|mật khẩu/i).fill(password);
    await this.page.getByRole('button', { name: /sign in|login|đăng nhập/i }).click();
  }
}

function testCredentialsMissing(): never {
  throw new Error('TEST_USERNAME and TEST_PASSWORD must be provided by GitHub Secrets or runner environment.');
}
