const { isConfigured, json, requireIngestToken, supabaseRequest } = require('./_result-db');

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') return json(405, { error: 'Method not allowed' });
  if (!requireIngestToken(event)) return json(401, { error: 'Unauthorized result ingest request' });
  if (!isConfigured()) {
    return json(501, {
      error: 'Result database is not configured',
      requiredEnv: ['SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY']
    });
  }

  let payload;
  try {
    payload = JSON.parse(event.body || '{}');
  } catch {
    return json(400, { error: 'Invalid JSON body' });
  }

  const summary = payload.summary || {};
  const testRunId = text(summary.testRunId || payload.testRunId);
  if (!testRunId) return json(400, { error: 'summary.testRunId is required' });

  const results = Array.isArray(summary.results) ? summary.results : [];
  const counts = normalizeCounts(summary.counts, results);
  const generatedAt = text(summary.generatedAt) || new Date().toISOString();
  const workflowUrl = text(payload.workflowUrl);

  const runRow = {
    test_run_id: testRunId,
    project_code: text(payload.projectCode),
    run_code: testRunId,
    generated_at: generatedAt,
    workflow_url: workflowUrl,
    artifact_url: text(payload.artifactUrl) || workflowUrl,
    status: counts.fail || counts.blocked || counts.infrastructureError ? 'failed' : 'passed',
    counts,
    summary: {
      testRunId,
      generatedAt,
      checksum: text(summary.checksum),
      counts
    },
    updated_at: new Date().toISOString()
  };

  await supabaseRequest('automation_run_summaries?on_conflict=test_run_id', {
    method: 'POST',
    body: JSON.stringify(runRow)
  });

  if (results.length) {
    await supabaseRequest(`automation_result_rows?test_run_id=eq.${encodeURIComponent(testRunId)}`, {
      method: 'DELETE',
      headers: { prefer: 'return=minimal' }
    });
    await insertResultRows(testRunId, generatedAt, workflowUrl, results);
  }

  return json(200, {
    ok: true,
    testRunId,
    total: counts.total,
    storedRows: results.length
  });
};

async function insertResultRows(testRunId, generatedAt, workflowUrl, results) {
  const chunkSize = 200;
  for (let index = 0; index < results.length; index += chunkSize) {
    const chunk = results.slice(index, index + chunkSize).map((result, offset) => ({
      id: `${testRunId}-${normalizeCode(result.testCaseCode) || index + offset + 1}`,
      test_run_id: testRunId,
      use_case_code: text(result.useCaseCode),
      test_case_code: text(result.testCaseCode),
      title: text(result.title),
      status: text(result.status || 'Infrastructure Error'),
      duration_ms: Number(result.durationMs) || 0,
      retry_count: Number(result.retryCount) || 0,
      failure_reason: text(result.failureReason),
      error_message: text(result.errorMessage),
      commit_sha: text(result.commitSha || process.env.GITHUB_SHA),
      workflow_url: workflowUrl,
      generated_at: generatedAt,
      evidence: normalizeEvidence(result)
    }));

    await supabaseRequest('automation_result_rows', {
      method: 'POST',
      body: JSON.stringify(chunk)
    });
  }
}

function normalizeCounts(counts, results) {
  const source = counts || {};
  return {
    total: Number(source.total) || results.length,
    pass: Number(source.pass) || results.filter((result) => result.status === 'Pass').length,
    fail: Number(source.fail) || results.filter((result) => result.status === 'Fail').length,
    blocked: Number(source.blocked) || results.filter((result) => result.status === 'Blocked').length,
    infrastructureError: Number(source.infrastructureError) || results.filter((result) => result.status === 'Infrastructure Error').length
  };
}

function normalizeEvidence(result) {
  return {
    paths: Array.isArray(result.evidencePaths) ? result.evidencePaths.filter(Boolean) : [],
    images: Array.isArray(result.evidenceImages)
      ? result.evidenceImages.map((image) => ({
        name: text(image.name),
        contentType: text(image.contentType),
        storagePath: text(image.storagePath),
        artifactPath: text(image.artifactPath || image.name)
      }))
      : []
  };
}

function normalizeCode(value) {
  return text(value).replace(/\s+/g, '').replace(/[^A-Z0-9.-]/gi, '_').toUpperCase();
}

function text(value) {
  return typeof value === 'string' ? value.trim() : '';
}
