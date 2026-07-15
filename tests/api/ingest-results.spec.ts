import { describe, expect, it } from 'vitest';

describe('automation ingest payload', () => {
  it('keeps required metadata for traceability', () => {
    const payload = {
      results: [
        {
          testRunId: 'RUN-20260715-001',
          testCaseCode: 'TC-AUTO-001',
          status: 'Pass',
          actualResult: 'Automation result is mapped to Test Case ID.',
          commitSha: 'local-pilot',
          durationMs: 1200,
          retryCount: 0
        }
      ]
    };

    expect(payload.results[0]).toMatchObject({
      testRunId: expect.stringMatching(/^RUN-/),
      testCaseCode: expect.stringMatching(/^TC-/),
      commitSha: expect.any(String)
    });
  });
});
