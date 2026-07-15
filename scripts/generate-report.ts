import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { createHash } from 'node:crypto';

const resultsPath = process.argv[2] ?? 'test-results/results.json';
const outputPath = process.argv[3] ?? 'test-results/summary.json';

interface PlaywrightJsonReport {
  suites: Array<{ specs: Array<{ title: string; tests: Array<{ results: Array<{ status: string; duration: number; retry: number }> }> }> }>;
}

const report = JSON.parse(readFileSync(resultsPath, 'utf8')) as PlaywrightJsonReport;
const results = report.suites.flatMap((suite) =>
  suite.specs.flatMap((spec) =>
    spec.tests.map((testCase) => {
      const latest = testCase.results[testCase.results.length - 1];
      const ids = spec.title.match(/(UC-[A-Z]+-\d+).*(TC-[A-Z]+-\d+)/);
      return {
        title: spec.title,
        useCaseCode: ids?.[1],
        testCaseCode: ids?.[2],
        status: normalizeStatus(latest.status),
        durationMs: latest.duration,
        retryCount: latest.retry,
        commitSha: process.env.GITHUB_SHA ?? 'local-pilot'
      };
    })
  )
);

const summary = {
  testRunId: process.env.TEST_RUN_ID ?? 'RUN-20260715-001',
  generatedAt: new Date().toISOString(),
  checksum: createHash('sha256').update(JSON.stringify(results)).digest('hex'),
  results
};

mkdirSync('test-results', { recursive: true });
writeFileSync(outputPath, JSON.stringify(summary, null, 2));

function normalizeStatus(status: string) {
  if (status === 'passed') return 'Pass';
  if (status === 'failed' || status === 'timedOut') return 'Fail';
  if (status === 'skipped') return 'Blocked';
  return 'Infrastructure Error';
}
