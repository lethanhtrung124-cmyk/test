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
  results?: Array<{ status: string; duration: number; retry: number }>;
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
      return {
        title: spec.title,
        useCaseCode: ids.useCaseCode,
        testCaseCode: ids.testCaseCode,
        status: normalizeStatus(latest.status),
        durationMs: latest.duration,
        retryCount: latest.retry,
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
