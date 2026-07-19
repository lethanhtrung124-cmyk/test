import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { createHash } from 'node:crypto';

const resultsPath = process.argv[2] ?? 'test-results/results.json';
const outputPath = process.argv[3] ?? 'test-results/summary.json';

interface PlaywrightJsonReport {
  suites?: PlaywrightSuite[];
}

interface PlaywrightSuite {
  suites?: PlaywrightSuite[];
  specs?: PlaywrightSpec[];
}

interface PlaywrightSpec {
  title: string;
  tests?: PlaywrightTest[];
}

interface PlaywrightTest {
  results?: PlaywrightResult[];
}

interface PlaywrightResult {
  status: string;
  duration: number;
  retry: number;
  error?: {
    message?: string;
    value?: string;
  };
  attachments?: Array<{
    name?: string;
    contentType?: string;
    body?: string;
    path?: string;
  }>;
}

const report = JSON.parse(readFileSync(resultsPath, 'utf8')) as PlaywrightJsonReport;
const specs = collectSpecs(report.suites ?? []);
const results = specs.flatMap((spec) =>
  (spec.tests ?? [])
    .filter((testCase) => (testCase.results ?? []).length > 0)
    .map((testCase) => {
      const attempts = testCase.results ?? [];
      const latest = attempts[attempts.length - 1];
      const ids = extractIds(spec.title);
      const status = normalizeStatus(latest.status);
      return {
        title: spec.title,
        useCaseCode: ids.useCaseCode,
        testCaseCode: ids.testCaseCode,
        status,
        durationMs: latest.duration,
        retryCount: latest.retry,
        failureReason: status === 'Pass' ? '' : extractFailureReason(latest),
        errorMessage: status === 'Pass' ? '' : sanitizeErrorMessage(latest.error?.message ?? latest.error?.value ?? ''),
        evidencePaths: extractEvidencePaths(latest),
        evidenceImages: extractEvidenceImages(latest),
        commitSha: process.env.GITHUB_SHA ?? 'local-pilot'
      };
    })
);

const summary = {
  testRunId: process.env.TEST_RUN_ID ?? 'RUN-20260715-001',
  generatedAt: new Date().toISOString(),
  checksum: createHash('sha256').update(JSON.stringify(results)).digest('hex'),
  counts: {
    total: results.length,
    pass: results.filter((result) => result.status === 'Pass').length,
    fail: results.filter((result) => result.status === 'Fail').length,
    blocked: results.filter((result) => result.status === 'Blocked').length,
    infrastructureError: results.filter((result) => result.status === 'Infrastructure Error').length
  },
  results
};

mkdirSync('test-results', { recursive: true });
writeFileSync(outputPath, JSON.stringify(summary, null, 2));

function collectSpecs(suites: PlaywrightSuite[]): PlaywrightSpec[] {
  return suites.flatMap((suite) => [...(suite.specs ?? []), ...collectSpecs(suite.suites ?? [])]);
}

function normalizeStatus(status: string) {
  if (status === 'passed') return 'Pass';
  if (status === 'failed' || status === 'timedOut') return 'Fail';
  if (status === 'skipped') return 'Blocked';
  return 'Infrastructure Error';
}

function extractIds(title: string) {
  const transactionMatch = title.match(/(UC\.\d+)\s*\|\s*(UC\.\d+-\d+)/i);
  if (transactionMatch) {
    return {
      useCaseCode: transactionMatch[1].toUpperCase(),
      testCaseCode: transactionMatch[2].toUpperCase()
    };
  }

  const classicMatch = title.match(/(UC(?:[.-][A-Z0-9]+)+).*?((?:TC|GD)(?:[.-][A-Z0-9]+)+)/i);
  return {
    useCaseCode: classicMatch?.[1]?.toUpperCase(),
    testCaseCode: classicMatch?.[2]?.toUpperCase()
  };
}

function extractFailureReason(result: PlaywrightResult): string {
  const actualResult = decodeActualResultAttachment(result);
  const attachedReason = actualResult.match(/Failure reason:\s*(.+)/i)?.[1]?.trim();
  if (attachedReason) return attachedReason;

  const message = result.error?.message ?? result.error?.value ?? '';
  const messageReason = message.match(/Nguyen nhan:\s*(.+)/i)?.[1]?.trim();
  if (messageReason) return sanitizeErrorMessage(messageReason);

  const normalizedActual = normalizeVietnamese(actualResult || message);
  if (isDashboard(normalizedActual)) {
    return 'Runner da dang nhap nhung dang dung o trang tong quan/dashboard, chua mo dung chuc nang nghiep vu theo kich ban.';
  }

  if (/khong co du lieu|khong tim thay|no data|no results/.test(normalizedActual)) {
    return 'He thong tra ve khong co du lieu theo dieu kien da nhap.';
  }

  const normalizedMessage = normalizeVietnamese(message);
  if (normalizedMessage.includes('highcharts') || normalizedMessage.includes('outside of the viewport') || normalizedMessage.includes('intercepts pointer events')) {
    return 'Runner click nham chu/nhan trong bieu do Highcharts thay vi nut chuc nang.';
  }

  if (normalizedMessage.includes('timeout')) {
    return 'Runner het thoi gian cho khi thuc hien buoc tu dong.';
  }

  if (normalizedMessage.includes('expected') || normalizedMessage.includes('received')) {
    return 'Ket qua thuc te khong khop voi cot ket qua mong doi.';
  }

  return '';
}

function decodeActualResultAttachment(result: PlaywrightResult): string {
  const attachment = (result.attachments ?? []).find((item) => item.name?.includes('actual-result') && item.body);
  if (!attachment?.body) return '';
  try {
    return Buffer.from(attachment.body, 'base64').toString('utf8');
  } catch {
    return '';
  }
}

function sanitizeErrorMessage(message: string): string {
  return message
    .replace(/\u001b\[[0-9;]*m/g, '')
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .slice(0, 4)
    .join(' ');
}

function extractEvidencePaths(result: PlaywrightResult): string[] {
  return (result.attachments ?? [])
    .filter((attachment) => {
      const name = attachment.name ?? '';
      const contentType = attachment.contentType ?? '';
      return /screenshot|video|trace|image|png|webm|zip/i.test(`${name} ${contentType}`);
    })
    .map((attachment) => attachment.path || attachment.name || '')
    .filter(Boolean);
}

function extractEvidenceImages(result: PlaywrightResult): Array<{ name: string; contentType: string; body: string }> {
  return (result.attachments ?? [])
    .filter((attachment) => attachment.body && /^image\//i.test(attachment.contentType ?? ''))
    .slice(0, 1)
    .map((attachment, index) => ({
      name: attachment.name || `evidence-${index + 1}.png`,
      contentType: attachment.contentType || 'image/png',
      body: attachment.body || ''
    }));
}

function normalizeVietnamese(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D')
    .toLowerCase();
}

function isDashboard(normalizedText: string): boolean {
  return normalizedText.includes('tong so kiem toan vien') || normalizedText.includes('highcharts.com') || normalizedText.includes('co cau dnkt');
}
