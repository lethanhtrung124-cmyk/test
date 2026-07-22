import { expect, type Locator, type Page, type TestInfo } from '@playwright/test';
import type { TargetScenario } from './scenarioLoader';

type ExpectedType = 'search_result' | 'detail_view' | 'download' | 'save_success' | 'delete_success' | 'send_success' | 'validation_message' | 'permission' | 'generic';

interface Evaluation {
  matched: boolean;
  expectedType: ExpectedType;
  failureReason: string;
  actualEvidence: string;
}

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
  let actualResultAttached = false;

  try {
    for (const [index, step] of scenario.steps.entries()) {
      await executeScenarioStep(page, scenario, step, index + 1, evidenceNotes);
      const screenshot = await page.screenshot({ fullPage: true });
      await testInfo.attach(`${scenario.id}-step-${index + 1}.png`, { body: screenshot, contentType: 'image/png' });
    }

    const actualResult = await readVisibleText(page);
    const evaluation = await evaluateScenarioOutcome(page, actualResult, scenario);
    await attachActualResult(testInfo, scenario, evaluation, evidenceNotes, actualResult);
    await attachConclusionScreenshot(page, testInfo, scenario, evaluation.matched ? 'pass' : 'fail');
    actualResultAttached = true;

    expect(
      evaluation.matched,
      `Ket qua thuc te phai phu hop cot mong doi: ${scenario.expectedResult}\nLoai ky vong: ${evaluation.expectedType}\nNguyen nhan: ${evaluation.failureReason}`
    ).toBeTruthy();
  } catch (error) {
    if (!actualResultAttached) {
      const actualResult = await readVisibleText(page);
      const failureReason = explainExecutionFailure(error, actualResult);
      await attachActualResult(testInfo, scenario, {
        matched: false,
        expectedType: classifyExpectedType(scenario),
        failureReason,
        actualEvidence: summarizeActualEvidence(actualResult)
      }, evidenceNotes, actualResult);
      await attachConclusionScreenshot(page, testInfo, scenario, 'error');
    }
    throw error;
  }
}

async function attachConclusionScreenshot(page: Page, testInfo: TestInfo, scenario: TargetScenario, outcome: 'pass' | 'fail' | 'error') {
  const screenshot = await page.screenshot({ type: 'jpeg', quality: 45, fullPage: false }).catch(() => null);
  if (!screenshot) return;
  await testInfo.attach(`${scenario.id}-final-${outcome}.jpg`, { body: screenshot, contentType: 'image/jpeg' });
}

async function attachActualResult(
  testInfo: TestInfo,
  scenario: TargetScenario,
  evaluation: Evaluation,
  evidenceNotes: string[],
  actualResult: string
) {
  await testInfo.attach(`${scenario.id}-actual-result.txt`, {
    body: [
      `Scenario: ${scenario.id}`,
      `Title: ${scenario.title}`,
      `Expected: ${scenario.expectedResult}`,
      `Precondition: ${scenario.precondition}`,
      `Expected type: ${evaluation.expectedType}`,
      `Evaluation: ${evaluation.matched ? 'Pass' : 'Fail'}`,
      evaluation.failureReason ? `Failure reason: ${evaluation.failureReason}` : '',
      `Actual evidence: ${evaluation.actualEvidence}`,
      '',
      'Execution notes:',
      ...evidenceNotes,
      '',
      'Visible page text:',
      actualResult.slice(0, 8000)
    ].join('\n'),
    contentType: 'text/plain'
  });
}

async function executeScenarioStep(page: Page, scenario: TargetScenario, step: string, stepNumber: number, evidenceNotes: string[]) {
  if (/truy c[aậ]p h[ệe] th[ốo]ng|http:\/\//i.test(step)) {
    const stepUrl = step.match(/https?:\/\/\S+/)?.[0]?.replace(/[;,.]$/, '');
    await page.goto(process.env.TEST_BASE_URL || stepUrl || '/', { waitUntil: 'domcontentloaded' });
    await page.waitForLoadState('networkidle').catch(() => undefined);
    evidenceNotes.push(`${stepNumber}. Da truy cap he thong.`);
    return;
  }

  if (/[đd][aă]ng nh[aậ]p|login|user/i.test(step)) {
    await login(page);
    evidenceNotes.push(`${stepNumber}. Da dang nhap bang tai khoan TEST_USERNAME/TEST_PASSWORD.`);
    return;
  }

  if (/ch[oọ]n ch[ứu]c n[aă]ng/i.test(step)) {
    await chooseFunction(page, scenario);
    evidenceNotes.push(`${stepNumber}. Da thu chon chuc nang theo mo ta giao dich kiem thu.`);
    return;
  }

  await performBusinessAction(page, scenario, step);
  evidenceNotes.push(`${stepNumber}. Da thuc hien thao tac nghiep vu: ${step}`);
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

  await expect(usernameField, 'Khong tim thay o tai khoan tren man hinh dang nhap').toBeVisible();
  await usernameField.fill(username);
  await expect(passwordField, 'Khong tim thay o mat khau tren man hinh dang nhap').toBeVisible();
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
      throw new Error('Dang nhap chua hoan tat: nut dang nhap van o trang thai dang xu ly sau 30 giay.');
    });
  }

  await page.waitForLoadState('networkidle', { timeout: 30000 }).catch(() => undefined);

  const loginHeading = page.getByRole('heading', { name: /đăng nhập hệ thống|login/i }).first();
  if ((await loginHeading.count()) && (await loginHeading.isVisible().catch(() => false))) {
    throw new Error('Dang nhap chua hoan tat: he thong van o man hinh dang nhap sau khi gui thong tin.');
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
    const clickable = findActionableText(page, candidate);
    if (await clickIfUsable(clickable)) {
      await page.waitForLoadState('networkidle').catch(() => undefined);
      return;
    }
  }
}

async function performBusinessAction(page: Page, scenario: TargetScenario, step: string) {
  const actionText = normalizeVietnamese(`${scenario.title} ${step}`);

  if (/ket xuat|excel|tai ve|trich xuat/.test(actionText)) {
    await clickFirstAvailable(page, [/kết xuất/i, /xuất excel/i, /excel/i, /tải/i, /download/i]);
    return;
  }

  if (/chi tiet|xem noi dung|xem chi tiet/.test(actionText)) {
    await clickFirstAvailable(page, [/chi tiết/i, /xem/i, /view/i]);
    return;
  }

  if (/nhap|tra cuu|tim kiem|truy van/.test(actionText)) {
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
    if (await clickIfUsable(button)) {
      await page.waitForLoadState('networkidle').catch(() => undefined);
      return;
    }

    const actionableText = findActionableText(page, pattern);
    if (await clickIfUsable(actionableText)) {
      await page.waitForLoadState('networkidle').catch(() => undefined);
      return;
    }
  }
}

function buildFunctionCandidates(scenario: TargetScenario): string[] {
  const text = scenario.title.replace(/^Kiểm tra\s+/i, '');
  const afterAction = text.replace(/^(nhập|chọn|thực hiện|truy vấn|kết xuất|thiết lập|gửi)\s+/i, '');
  return unique([
    ...inferMainMenuCandidates(scenario.title),
    afterAction,
    afterAction.replace(/^(các|một)\s+/i, ''),
    scenario.useCaseCode,
    ...afterAction.split(/\s+/).filter((word) => word.length > 6).slice(0, 8)
  ]).filter((value) => value.length >= 3);
}

function inferMainMenuCandidates(title: string): string[] {
  const normalized = normalizeVietnamese(title);
  if (normalized.includes('doanh nghiep')) return ['Doanh nghiệp kế toán - kiểm toán'];
  if (normalized.includes('ktv') || normalized.includes('kiem toan vien')) return ['Kế toán viên - Kiểm toán viên'];
  if (normalized.includes('bao cao')) return ['Báo cáo kế toán'];
  return [];
}

function findActionableText(page: Page, text: string | RegExp): Locator {
  return page
    .locator('button, a, [role="button"], [role="link"], [role="menuitem"], [tabindex]:not([tabindex="-1"]), li, .cursor-pointer')
    .filter({ hasText: text })
    .first();
}

async function clickIfUsable(locator: Locator) {
  if (!(await locator.count())) return false;
  if (!(await locator.isVisible().catch(() => false))) return false;
  await locator.click({ timeout: 5000 });
  return true;
}

function evaluateExpectedResult(actualText: string, expectedResult: string, precondition: string): boolean {
  const normalizedActual = normalizeVietnamese(actualText);
  const expectedTokens = importantTokens(`${expectedResult} ${precondition}`);
  if (expectedTokens.length === 0) return normalizedActual.length > 0;
  const matchedTokens = expectedTokens.filter((token) => normalizedActual.includes(token));
  return matchedTokens.length >= Math.max(1, Math.ceil(expectedTokens.length * 0.45));
}

async function evaluateScenarioOutcome(page: Page, actualText: string, scenario: TargetScenario): Promise<Evaluation> {
  const expectedType = classifyExpectedType(scenario);
  const actual = normalizeVietnamese(actualText);
  const expected = normalizeVietnamese(scenario.expectedResult);

  const blockingReason = detectBlockingState(actual, expected);
  if (blockingReason) {
    return fail(expectedType, blockingReason, actualText);
  }

  switch (expectedType) {
    case 'search_result':
      return (await hasResultList(page, actual))
        ? pass(expectedType, 'He thong hien thi danh sach/ket qua sau khi tra cuu.')
        : fail(expectedType, 'Khong ghi nhan duoc bang, danh sach hoac ket qua theo dieu kien tra cuu.', actualText);
    case 'detail_view':
      return hasDetailView(actual)
        ? pass(expectedType, 'He thong da mo giao dien/noi dung chi tiet.')
        : fail(expectedType, 'Khong mo duoc man hinh chi tiet hoac noi dung chi tiet cua ban ghi.', actualText);
    case 'download':
      return hasDownloadEvidence(actual)
        ? pass(expectedType, 'He thong co dau hieu ket xuat/tai file thanh cong.')
        : fail(expectedType, 'Khong ghi nhan duoc file tai xuong hoac thong bao ket xuat thanh cong.', actualText);
    case 'save_success':
      return hasSuccessEvidence(actual)
        ? pass(expectedType, 'He thong hien thi thong bao/trang thai luu hoac cap nhat thanh cong.')
        : fail(expectedType, 'Khong ghi nhan thong bao thanh cong sau thao tac luu/cap nhat.', actualText);
    case 'delete_success':
      return hasDeleteEvidence(actual)
        ? pass(expectedType, 'He thong ghi nhan thao tac xoa/huy thanh cong.')
        : fail(expectedType, 'Khong ghi nhan thong bao hoac trang thai xoa/huy thanh cong.', actualText);
    case 'send_success':
      return hasSuccessEvidence(actual) || /da gui|gui thanh cong|tiep nhan|ghi log/.test(actual)
        ? pass(expectedType, 'He thong ghi nhan thao tac gui/tiep nhan du lieu.')
        : fail(expectedType, 'Khong ghi nhan thong bao gui/tiep nhan du lieu thanh cong.', actualText);
    case 'validation_message':
      return hasValidationEvidence(actual, expected)
        ? pass(expectedType, 'He thong hien thi canh bao/kiem tra tinh hop le phu hop.')
        : fail(expectedType, 'Khong ghi nhan canh bao hoac thong bao kiem tra tinh hop le phu hop.', actualText);
    case 'permission':
      return hasPermissionEvidence(actual)
        ? pass(expectedType, 'Tai khoan co dau hieu da duoc phan quyen hoac he thong hien thi dung thong bao phan quyen.')
        : fail(expectedType, 'Khong xac dinh duoc trang thai phan quyen cua tai khoan kiem thu.', actualText);
    case 'generic':
    default: {
      const matched = evaluateExpectedResult(actualText, scenario.expectedResult, '');
      return matched
        ? pass(expectedType, 'Ket qua thuc te khop noi dung mong doi theo tu khoa bat buoc.')
        : fail(expectedType, explainBusinessMismatch(actualText, scenario), actualText);
    }
  }
}

function classifyExpectedType(scenario: TargetScenario): ExpectedType {
  const text = normalizeVietnamese(`${scenario.title} ${scenario.expectedResult} ${scenario.steps.join(' ')}`);
  const expectedOnly = normalizeVietnamese(`${scenario.title} ${scenario.expectedResult}`);
  if (/phan quyen|khong co quyen|duoc cap quyen|tu choi truy cap/.test(expectedOnly)) return 'permission';
  if (/ket xuat|xuat excel|excel|tai file|tai ve|tep tin|download|trich xuat/.test(text)) return 'download';
  if (/chi tiet|xem noi dung|xem chi tiet|toan bo noi dung/.test(text)) return 'detail_view';
  if (/xoa|huy/.test(text)) return 'delete_success';
  if (/gui|tiep nhan|truyen nhan|ghi log/.test(text)) return 'send_success';
  if (/canh bao|khong hop le|kiem tra tinh hop le|validate|rang buoc|trung ma/.test(text)) return 'validation_message';
  if (/luu|cap nhat|ghi nhan|thanh cong|nhap khau/.test(text)) return 'save_success';
  if (/tra cuu|tim kiem|truy van|hien thi ket qua|danh sach|ban ghi tuong ung/.test(text)) return 'search_result';
  return 'generic';
}

function pass(expectedType: ExpectedType, actualEvidence: string): Evaluation {
  return { matched: true, expectedType, failureReason: '', actualEvidence };
}

function fail(expectedType: ExpectedType, failureReason: string, actualText: string): Evaluation {
  return { matched: false, expectedType, failureReason, actualEvidence: summarizeActualEvidence(actualText) };
}

function detectBlockingState(actual: string, expected: string): string {
  if (/dang nhap|login/.test(actual)) return 'He thong van o man hinh dang nhap hoac phien dang nhap chua hoan tat.';
  if (/khong co quyen|khong duoc phep|unauthorized|forbidden|access denied/.test(actual) && !/khong co quyen|khong duoc phep|tu choi/.test(expected)) {
    return 'Tai khoan kiem thu khong co quyen vao chuc nang theo kich ban.';
  }
  if (isDashboard(actual) && !containsExpectedOutcome(actual, expected)) {
    return 'Runner da dang nhap nhung dang dung o trang tong quan/dashboard, chua mo dung chuc nang nghiep vu theo kich ban.';
  }
  if (/loi he thong|exception|stack trace|internal server error|server error|404|500/.test(actual)) {
    return 'He thong dich hien thi loi ky thuat trong qua trinh thuc hien giao dich.';
  }
  return '';
}

async function hasResultList(page: Page, actual: string): Promise<boolean> {
  if (/khong co du lieu|khong tim thay|no data|no results/.test(actual)) return false;
  if (/tong so|ket qua|danh sach|ban ghi|tim thay|hien thi/.test(actual) && !isDashboard(actual)) return true;
  const rowCount = await page.locator('table tbody tr, [role="row"], .ant-table-row, .MuiDataGrid-row').count().catch(() => 0);
  return rowCount > 0;
}

function hasDetailView(actual: string): boolean {
  return /chi tiet|thong tin chi tiet|noi dung chi tiet|ma ho so|ngay cap|trang thai|thong tin chung/.test(actual)
    && !/khong co du lieu|khong tim thay/.test(actual)
    && !isDashboard(actual);
}

function hasDownloadEvidence(actual: string): boolean {
  return /tai xuong|tai ve|download|ket xuat thanh cong|xuat excel thanh cong|da tao file|tep tin|file excel|xlsx|xls/.test(actual);
}

function hasSuccessEvidence(actual: string): boolean {
  return /thanh cong|da luu|luu thanh cong|cap nhat thanh cong|ghi nhan|hoan tat|da cap nhat|da nhap khau/.test(actual);
}

function hasDeleteEvidence(actual: string): boolean {
  return /xoa thanh cong|da xoa|huy thanh cong|da huy|khong con ban ghi|thanh cong/.test(actual);
}

function hasValidationEvidence(actual: string, expected: string): boolean {
  if (/canh bao|khong hop le|bat buoc|trung|vuot qua|khong duoc|kiem tra/.test(actual)) return true;
  return importantTokens(expected).some((token) => actual.includes(token));
}

function hasPermissionEvidence(actual: string): boolean {
  if (/khong co quyen|khong duoc phep|unauthorized|forbidden|access denied/.test(actual)) return true;
  return !/dang nhap|login/.test(actual) && actual.length > 0;
}

function summarizeActualEvidence(actualText: string): string {
  const actual = actualText
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .slice(0, 6)
    .join(' | ');
  return actual || 'Khong doc duoc noi dung hien thi tren man hinh.';
}

function importantTokens(value: string): string[] {
  const stopWords = new Set(['he', 'thong', 'nguoi', 'dung', 'duoc', 'theo', 'dieu', 'kien', 'vao', 'cho', 'va', 'cac', 'cua']);
  return unique(
    normalizeVietnamese(value)
      .split(/\W+/)
      .filter((word) => word.length >= 4 && !stopWords.has(word))
  );
}

function explainBusinessMismatch(actualText: string, scenario: TargetScenario): string {
  const actual = normalizeVietnamese(actualText);
  const expected = normalizeVietnamese(scenario.expectedResult);

  if (/dang nhap|login/.test(actual)) {
    return 'He thong van o man hinh dang nhap hoac phien dang nhap chua hoan tat.';
  }

  if (isDashboard(actual) && !containsExpectedOutcome(actual, expected)) {
    return 'Runner da dang nhap nhung dang dung o trang tong quan/dashboard, chua mo dung chuc nang nghiep vu theo kich ban.';
  }

  if (/khong co du lieu|khong tim thay|no data|no results/.test(actual)) {
    return 'He thong tra ve khong co du lieu theo dieu kien da nhap, khong khop cot ket qua mong doi.';
  }

  if (/excel|ket xuat|download|tai/.test(expected)) {
    return 'Khong ghi nhan duoc thong bao hoac tep ket xuat Excel sau khi thuc hien thao tac.';
  }

  if (/chi tiet|giao dien chi tiet/.test(expected)) {
    return 'Khong mo duoc man hinh chi tiet ho so sau thao tac chon/xem.';
  }

  return 'Ket qua thuc te khong chua du noi dung bat buoc theo cot ket qua mong doi va dieu kien tien de.';
}

function explainExecutionFailure(error: unknown, actualText: string): string {
  const message = error instanceof Error ? error.message : String(error);
  const normalizedMessage = normalizeVietnamese(message);
  const normalizedActual = normalizeVietnamese(actualText);

  if (normalizedMessage.includes('highcharts') || normalizedMessage.includes('outside of the viewport') || normalizedMessage.includes('intercepts pointer events')) {
    return 'Runner click nham chu/nhan trong bieu do Highcharts thay vi nut chuc nang, nen buoc thao tac bi loi ky thuat.';
  }

  if (normalizedMessage.includes('timeout')) {
    if (isDashboard(normalizedActual)) {
      return 'Runner het thoi gian cho khi van o trang tong quan/dashboard, chua vao dung chuc nang nghiep vu.';
    }
    return 'Runner het thoi gian cho khi thuc hien buoc tu dong, can kiem tra selector/chuc nang tren he thong dich.';
  }

  if (normalizedMessage.includes('test_username') || normalizedMessage.includes('test_password')) {
    return 'Thieu cau hinh tai khoan dang nhap trong GitHub Actions Secrets.';
  }

  return 'Buoc tu dong gap loi ky thuat truoc khi hoan tat viec doi chieu ket qua mong doi.';
}

function isDashboard(normalizedText: string): boolean {
  return normalizedText.includes('tong so kiem toan vien') || normalizedText.includes('highcharts.com') || normalizedText.includes('co cau dnkt');
}

function containsExpectedOutcome(normalizedActual: string, normalizedExpected: string): boolean {
  return importantTokens(normalizedExpected).some((token) => normalizedActual.includes(token));
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
  return (
    value
      .replace(/^Kiểm tra\s+/i, '')
      .split(/\s+/)
      .filter((word) => word.length > 4)
      .slice(0, 5)
      .join(' ') || 'kiểm toán'
  );
}

function unique(values: string[]): string[] {
  return [...new Set(values.map((value) => value.trim()).filter(Boolean))];
}

async function readVisibleText(page: Page): Promise<string> {
  return page.locator('body').innerText({ timeout: 5000 }).catch(() => '');
}
