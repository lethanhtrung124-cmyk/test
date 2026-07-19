import { readFileSync } from 'node:fs';

const ingestUrl = process.env.RESULTS_INGEST_URL ?? process.env.VITE_RESULTS_INGEST_URL;
const serviceToken = process.env.RESULTS_INGEST_TOKEN;
const summaryPath = process.argv[2] ?? 'test-results/summary.json';

if (!ingestUrl) {
  console.log('RESULTS_INGEST_URL is not configured; summary was generated but not published.');
  process.exit(0);
}

const summary = JSON.parse(readFileSync(summaryPath, 'utf8'));
const workflowUrl = process.env.GITHUB_SERVER_URL && process.env.GITHUB_REPOSITORY && process.env.GITHUB_RUN_ID
  ? `${process.env.GITHUB_SERVER_URL}/${process.env.GITHUB_REPOSITORY}/actions/runs/${process.env.GITHUB_RUN_ID}`
  : '';
const response = await fetch(ingestUrl, {
  method: 'POST',
  headers: {
    'content-type': 'application/json',
    ...(serviceToken ? { authorization: `Bearer ${serviceToken}` } : {})
  },
  body: JSON.stringify({
    projectCode: process.env.PROJECT_CODE ?? '',
    workflowUrl,
    artifactUrl: workflowUrl,
    summary: stripImageBodies(summary)
  })
});

if (!response.ok) {
  throw new Error(`Publishing failed: ${response.status} ${await response.text()}`);
}

console.log(await response.text());

function stripImageBodies(summary: Record<string, unknown>) {
  const results = Array.isArray(summary.results) ? summary.results : [];
  return {
    ...summary,
    results: results.map((result) => {
      if (!result || typeof result !== 'object') return result;
      const row = result as Record<string, unknown>;
      const evidenceImages = Array.isArray(row.evidenceImages)
        ? row.evidenceImages.map((image) => {
          if (!image || typeof image !== 'object') return image;
          const { body: _body, ...metadata } = image as Record<string, unknown>;
          return metadata;
        })
        : [];
      return {
        ...row,
        evidenceImages
      };
    })
  };
}
