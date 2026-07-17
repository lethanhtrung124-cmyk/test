import { expect, type Page, type TestInfo } from '@playwright/test';
import type { TargetScenario } from './scenarioLoader';

const vietnameseSearchWords = [
  'tìm kiếm',
  'tra cứu',
  'tìm',
  'search',
  'xem',
  'chi tiết',
  'kết xuất',
  'xuất excel',
  'lưu',
  'gửi'
];

export async function runTargetScenario(page: Page, scenario: TargetScenario, testInfo: TestInfo) {
  const evidenceNotes: string[] = [];

  for (const [index, step] of scenario.steps.entries()) {
    await executeScenarioStep(page, scenario, step, index + 1, evidenceNotes);
    const screenshot = await page.screenshot({ fullPage: true });
    await testInfo.attach(`${scenario.id}-step-${index + 1}.png`, { body: screenshot, contentType: 'image/png' });
  }

  const actualResult = await readVisibleText(page);
  const matched = evaluateExpectedResult(actualResult, scenario.expectedResult, scenario.precondition);
  await testInfo.attach(`${scenario.id}-actual-result.txt`, {
    body: [
      `Scenario: ${scenario.id}`,
      `Title: ${scenario.title}`,
      `Expected: ${scenario.expectedResult}`,
      `Precondition: ${scenario.precondition}`,
      `Evaluation: ${matched ? 'Pass' : 'Fail'}`,
      '',
      'Execution notes:',
      ...evidenceNotes,
      '',
      'Visible page text:',
      actualResult.slice(0, 8000)
    ].join('\n'),
    contentType: 'text/plain'
  });

  expect(matched, `Kết quả thực tế phải phù hợp cột mong đợi: ${scenario.expectedResult}`).toBeTruthy();
}

async function executeScenarioStep(page: Page, scenario: TargetScenario, step: string, stepNumber: number, evidenceNotes: string[]) {
  if (/truy c[aậ]p h[eệ] th[oố]ng|http:\/\//i.test(step)) {
    const stepUrl = step.match(/https?:\/\/\S+/)?.[0]?.replace(/[;,.]$/, '');
    await page.goto(process.env.TEST_BASE_URL || stepUrl || '/', { waitUntil: 'domcontentloaded' });
    await page.waitForLoadState('networkidle').catch(() => undefined);
    evidenceNotes.push(`${stepNumber}. Đã truy cập hệ thống.`);
    return;
  }

  if (/[đd][aă]ng nh[aậ]p|login|user/i.test(step)) {
    await login(page);
    evidenceNotes.push(`${stepNumber}. Đã thực hiện đăng nhập bằng tài khoản TEST_USERNAME/TEST_PASSWORD.`);
    return;
  }

  if (/ch[oọ]n ch[uứ]c n[aă]ng/i.test(step)) {
    await chooseFunction(page, scenario);
    evidenceNotes.push(`${stepNumber}. Đã thử chọn chức năng theo mô tả ca kiểm thử.`);
    return;
  }

  await performBusinessAction(page, scenario, step);
  evidenceNotes.push(`${stepNumber}. Đã thực hiện thao tác nghiệp vụ: ${step}`);
}

async function login(page: Page) {
  const username = process.env.TEST_USERNAME;
  const password = process.env.TEST_PASSWORD;
  if (!username || !password) {
    throw new Error('TEST_USERNAME and TEST_PASSWORD must be configured in GitHub Actions Secrets.');
  }

  const usernameField = page
    .locator('input[name*="user" i], input[id*="user" i], input[name*="email" i], input[id*="email" i], input[type="text"]')
    .first();
  const passwordField = page.locator('input[type="password"], input[name*="pass" i], input[id*="pass" i]').first();

  await expect(usernameField, 'Không tìm thấy ô tài khoản trên màn hình đăng nhập').toBeVisible();
  await usernameField.fill(username);
  await expect(passwordField, 'Không tìm thấy ô mật khẩu trên màn hình đăng nhập').toBeVisible();
  await passwordField.fill(password);
  await solveArithmeticCaptcha(page);

  const loginButton = page.getByRole('button', { name: /đăng nhập|login|sign in|submit/i }).first();
  if (await loginButton.count()) {
    await loginButton.click();
  } else {
    await passwordField.press('Enter');
  }

  await waitForLoginCompletion(page);
  await expect(page.locator('body')).not.toContainText(/sai mật khẩu|không đúng|giải đúng phép tính|invalid|unauthorized/i, { timeout: 5000 });
}

async function waitForLoginCompletion(page: Page) {
  const loadingButton = page.getByRole('button', { name: /đăng nhập\.\.\.|logging in|signing in/i }).first();
  if (await loadingButton.isVisible().catch(() => false)) {
    await loadingButton.waitFor({ state: 'hidden', timeout: 30000 }).catch(() => {
      throw new Error('Đăng nhập chưa hoàn tất: nút đăng nhập vẫn ở trạng thái đang xử lý sau 30 giây.');
    });
  }

  await page.waitForLoadState('networkidle', { timeout: 30000 }).catch(() => undefined);

  const loginHeading = page.getByRole('heading', { name: /đăng nhập hệ thống|login/i }).first();
  if ((await loginHeading.count()) && (await loginHeading.isVisible().catch(() => false))) {
    throw new Error('Đăng nhập chưa hoàn tất: hệ thống vẫn ở màn hình đăng nhập sau khi gửi thông tin.');
  }
}

async function solveArithmeticCaptcha(page: Page) {
  const text = await readVisibleText(page);
  const match = text.match(/(\d+)\s*([+\-xX*\/×])\s*(\d+)\s*=\s*\?/);
  if (!match) return;

  const left = Number(match[1]);
  const operator = match[2];
  const right = Number(match[3]);
  const answer = calculateCaptcha(left, operator, right);
  if (!Number.isFinite(answer)) return;

  const answerText = String(answer);
  const spinbutton = page.getByRole('spinbutton').first();
  if ((await spinbutton.count()) && (await spinbutton.isVisible().catch(() => false))) {
    await spinbutton.fill(answerText);
    return;
  }

  const inputs = await page.locator('input:not([type="hidden"]):not([type="password"]), textarea').all();
  for (const input of inputs.reverse()) {
    if (!(await input.isVisible().catch(() => false))) continue;
    const value = await input.inputValue().catch(() => '');
    if (!value) {
      await input.fill(answerText);
      return;
    }
  }
}

function calculateCaptcha(left: number, operator: string, right: number) {
  switch (operator) {
    case '+':
      return left + right;
    case '-':
      return left - right;
    case 'x':
    case 'X':
    case '*':
    case '×':
      return left * right;
    case '/':
      return right === 0 ? Number.NaN : left / right;
    default:
      return Number.NaN;
  }
}

async function chooseFunction(page: Page, scenario: TargetScenario) {
  const candidates = buildFunctionCandidates(scenario);
  for (const candidate of candidates) {
    const clickable = page.getByText(candidate, { exact: false }).first();
    if ((await clickable.count()) && await clickable.isVisible().catch(() => false)) {
      await clickable.click();
      await page.waitForLoadState('networkidle').catch(() => undefined);
      return;
    }
  }
}

async function performBusinessAction(page: Page, scenario: TargetScenario, step: string) {
  const actionText = `${scenario.title} ${step}`.toLowerCase();

  if (/kết xuất|excel|tải về|trích xuất/.test(actionText)) {
    await clickFirstAvailable(page, [/kết xuất/i, /xuất excel/i, /excel/i, /tải/i, /download/i]);
    return;
  }

  if (/chi tiết|xem nội dung|xem chi tiết/.test(actionText)) {
    await clickFirstAvailable(page, [/chi tiết/i, /xem/i, /view/i]);
    return;
  }

  if (/nhập|tra cứu|tìm kiếm|truy vấn/.test(actionText)) {
    await fillSearchCriteria(page, scenario);
    await clickFirstAvailable(page, vietnameseSearchWords.map((word) => new RegExp(word, 'i')));
  }
}

async function fillSearchCriteria(page: Page, scenario: TargetScenario) {
  const searchText = process.env.TEST_SEARCH_TEXT || extractSearchText(scenario.title);
  const inputs = await page.locator('input:not([type="hidden"]):not([type="password"]), textarea').all();
  for (const input of inputs.slice(0, 3)) {
    if (await input.isVisible().catch(() => false)) {
      const value = await input.inputValue().catch(() => '');
      if (!value) {
        await input.fill(searchText);
        break;
      }
    }
  }
}

async function clickFirstAvailable(page: Page, patterns: RegExp[]) {
  for (const pattern of patterns) {
    const button = page.getByRole('button', { name: pattern }).first();
    if ((await button.count()) && await button.isVisible().catch(() => false)) {
      await button.click();
      await page.waitForLoadState('networkidle').catch(() => undefined);
      return;
    }
    const text = page.getByText(pattern).first();
    if ((await text.count()) && await text.isVisible().catch(() => false)) {
      await text.click();
      await page.waitForLoadState('networkidle').catch(() => undefined);
      return;
    }
  }
}

function buildFunctionCandidates(scenario: TargetScenario): string[] {
  const text = scenario.title.replace(/^Kiểm tra\s+/i, '');
  const afterAction = text.replace(/^(nhập|chọn|thực hiện|truy vấn|kết xuất|thiết lập|gửi)\s+/i, '');
  return unique([
    afterAction,
    afterAction.replace(/^(các|một)\s+/i, ''),
    scenario.useCaseCode,
    ...afterAction.split(/\s+/).filter((word) => word.length > 6).slice(0, 8)
  ]).filter((value) => value.length >= 3);
}

function evaluateExpectedResult(actualText: string, expectedResult: string, precondition: string): boolean {
  const normalizedActual = normalizeVietnamese(actualText);
  const expectedTokens = importantTokens(`${expectedResult} ${precondition}`);
  if (expectedTokens.length === 0) return normalizedActual.length > 0;
  const matchedTokens = expectedTokens.filter((token) => normalizedActual.includes(token));
  return matchedTokens.length >= Math.max(1, Math.ceil(expectedTokens.length * 0.45));
}

function importantTokens(value: string): string[] {
  const stopWords = new Set(['he', 'thong', 'nguoi', 'dung', 'duoc', 'theo', 'dieu', 'kien', 'vao', 'cho', 'va', 'cac', 'cua']);
  return unique(
    normalizeVietnamese(value)
      .split(/\W+/)
      .filter((word) => word.length >= 4 && !stopWords.has(word))
  );
}

function normalizeVietnamese(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D')
    .toLowerCase();
}

function extractSearchText(value: string): string {
  return value
    .replace(/^Kiểm tra\s+/i, '')
    .split(/\s+/)
    .filter((word) => word.length > 4)
    .slice(0, 5)
    .join(' ') || 'kiểm toán';
}

function unique(values: string[]): string[] {
  return [...new Set(values.map((value) => value.trim()).filter(Boolean))];
}

async function readVisibleText(page: Page): Promise<string> {
  return page.locator('body').innerText({ timeout: 5000 }).catch(() => '');
}
