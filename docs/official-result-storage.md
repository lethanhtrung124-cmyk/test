# Official Automation Result Storage

Use this setup when automation runs hundreds of UC/transactions and produces many evidence images.

## 1. Create Supabase tables

Run `supabase/automation-results.sql` in Supabase SQL Editor.

The app stores:

- `automation_run_summaries`: one row per test run.
- `automation_result_rows`: one row per transaction/test case.

Evidence images are stored as artifact/storage metadata, not as large base64 payloads in browser state.

## 2. Netlify environment variables

Set these variables in Netlify:

- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `RESULTS_INGEST_TOKEN`
- existing GitHub variables: `GITHUB_AUTOMATION_TOKEN`, `GITHUB_OWNER`, `GITHUB_REPO`

`SUPABASE_SERVICE_ROLE_KEY` must be secret and server-side only.

## 3. GitHub Actions secrets

Set these secrets in GitHub:

- `RESULTS_INGEST_URL`: `https://<your-netlify-site>/.netlify/functions/ingest-results`
- `RESULTS_INGEST_TOKEN`: same value as Netlify
- `TEST_USERNAME`
- `TEST_PASSWORD`

## 4. Runtime flow

1. App sends automation request.
2. GitHub Actions runs Playwright.
3. `scripts/generate-report.ts` creates `test-results/summary.json`.
4. `scripts/publish-results.ts` posts optimized summary data to Netlify.
5. Netlify writes summary and transaction rows to Supabase.
6. App polls `/.netlify/functions/automation-results?testRunId=...`.

This keeps the browser light and avoids Netlify response-size failures when evidence grows.
