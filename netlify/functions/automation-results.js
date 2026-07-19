const { isConfigured, json, supabaseRequest } = require('./_result-db');

exports.handler = async (event) => {
  if (event.httpMethod !== 'GET') return json(405, { error: 'Method not allowed' });
  if (!isConfigured()) {
    return json(501, {
      error: 'Result database is not configured',
      requiredEnv: ['SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY']
    });
  }

  const testRunId = text(event.queryStringParameters?.testRunId);
  if (!testRunId) return json(400, { error: 'testRunId is required' });

  const since = event.queryStringParameters?.since ? Date.parse(event.queryStringParameters.since) - 15000 : 0;
  const summaryRows = await supabaseRequest(
    `automation_run_summaries?test_run_id=eq.${encodeURIComponent(testRunId)}&select=*&limit=1`
  );
  const run = Array.isArray(summaryRows) ? summaryRows[0] : null;
  if (!run) return json(200, { found: false });
  if (since && Date.parse(run.generated_at || run.updated_at || '') < since) {
    return json(200, { found: false, stale: true });
  }

  const resultRows = await supabaseRequest(
    `automation_result_rows?test_run_id=eq.${encodeURIComponent(testRunId)}&select=*&order=test_case_code.asc`
  );
  const results = (Array.isArray(resultRows) ? resultRows : []).map((row) => ({
    title: row.title || '',
    useCaseCode: row.use_case_code || '',
    testCaseCode: row.test_case_code || '',
    status: row.status || 'Infrastructure Error',
    durationMs: Number(row.duration_ms) || 0,
    retryCount: Number(row.retry_count) || 0,
    failureReason: row.failure_reason || '',
    errorMessage: row.error_message || '',
    commitSha: row.commit_sha || '',
    evidencePaths: row.evidence?.paths || [],
    evidenceImages: row.evidence?.images || []
  }));

  const summary = {
    testRunId,
    generatedAt: run.generated_at || run.updated_at || '',
    checksum: run.summary?.checksum || '',
    counts: run.counts || countResults(results),
    results
  };

  return json(200, {
    found: true,
    run: {
      id: Date.parse(summary.generatedAt) || Date.now(),
      status: 'completed',
      conclusion: summary.counts.fail || summary.counts.blocked || summary.counts.infrastructureError ? 'failure' : 'success',
      title: `DB results ${testRunId}`,
      url: run.workflow_url || '',
      createdAt: summary.generatedAt,
      updatedAt: run.updated_at || summary.generatedAt,
      summary,
      artifacts: run.artifact_url ? [{
        id: Date.parse(summary.generatedAt) || Date.now(),
        name: 'automation-evidence',
        sizeInBytes: 0,
        url: run.artifact_url,
        summary: null
      }] : []
    }
  });
};

function countResults(results) {
  return {
    total: results.length,
    pass: results.filter((result) => result.status === 'Pass').length,
    fail: results.filter((result) => result.status === 'Fail').length,
    blocked: results.filter((result) => result.status === 'Blocked').length,
    infrastructureError: results.filter((result) => result.status === 'Infrastructure Error').length
  };
}

function text(value) {
  return typeof value === 'string' ? value.trim() : '';
}
