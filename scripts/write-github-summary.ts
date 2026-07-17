import { appendFileSync, existsSync, readFileSync } from 'node:fs';

const summaryPath = process.argv[2] ?? 'test-results/summary.json';
const githubSummaryPath = process.env.GITHUB_STEP_SUMMARY;

if (!githubSummaryPath || !existsSync(summaryPath)) {
  process.exit(0);
}

interface Summary {
  testRunId: string;
  generatedAt: string;
  counts: {
    total: number;
    pass: number;
    fail: number;
    blocked: number;
    infrastructureError: number;
  };
  results: Array<{
    title: string;
    useCaseCode?: string;
    testCaseCode?: string;
    status: string;
    durationMs: number;
  }>;
}

const summary = JSON.parse(readFileSync(summaryPath, 'utf8')) as Summary;
const lines = [
  '## Kết quả kiểm thử tự động',
  '',
  `- Đợt kiểm thử: ${summary.testRunId}`,
  `- Tổng số ca: ${summary.counts.total}`,
  `- Đạt: ${summary.counts.pass}`,
  `- Không đạt: ${summary.counts.fail}`,
  `- Bị chặn: ${summary.counts.blocked}`,
  `- Lỗi hạ tầng: ${summary.counts.infrastructureError}`,
  '',
  '| Mã UC | Mã ca/giao dịch | Trạng thái | Thời gian |',
  '| --- | --- | --- | ---: |',
  ...summary.results.map((result) => `| ${result.useCaseCode ?? ''} | ${result.testCaseCode ?? ''} | ${statusLabel(result.status)} | ${result.durationMs} ms |`)
];

appendFileSync(githubSummaryPath, `${lines.join('\n')}\n`, 'utf8');

function statusLabel(status: string): string {
  if (status === 'Pass') return 'Đạt';
  if (status === 'Fail') return 'Không đạt';
  if (status === 'Blocked') return 'Bị chặn';
  return 'Lỗi hạ tầng';
}
