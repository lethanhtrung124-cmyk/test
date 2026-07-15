import { readFileSync } from 'node:fs';

const ingestUrl = process.env.RESULTS_INGEST_URL ?? process.env.VITE_RESULTS_INGEST_URL;
const serviceToken = process.env.RESULTS_INGEST_TOKEN;
const summaryPath = process.argv[2] ?? 'test-results/summary.json';

if (!ingestUrl) {
  console.log('RESULTS_INGEST_URL is not configured; summary was generated but not published.');
  process.exit(0);
}

const summary = JSON.parse(readFileSync(summaryPath, 'utf8'));
const response = await fetch(ingestUrl, {
  method: 'POST',
  headers: {
    'content-type': 'application/json',
    ...(serviceToken ? { authorization: `Bearer ${serviceToken}` } : {})
  },
  body: JSON.stringify({
    results: summary.results.map((result: Record<string, unknown>) => ({
      ...result,
      testRunId: summary.testRunId,
      actualResult: result.status === 'Pass' ? 'Assertion matched expected result.' : 'See Playwright evidence for details.'
    }))
  })
});

if (!response.ok) {
  throw new Error(`Publishing failed: ${response.status} ${await response.text()}`);
}

console.log(await response.text());
