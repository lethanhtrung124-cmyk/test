const workflowFile = process.env.GITHUB_AUTOMATION_WORKFLOW || 'automation.yml';

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return json(405, { error: 'Method not allowed' });
  }

  const token = process.env.GITHUB_AUTOMATION_TOKEN;
  const owner = process.env.GITHUB_OWNER;
  const repo = process.env.GITHUB_REPO;
  const ref = process.env.GITHUB_REF_NAME || 'main';

  if (!token || !owner || !repo) {
    return json(501, {
      error: 'Automation runner is not configured',
      requiredEnv: ['GITHUB_AUTOMATION_TOKEN', 'GITHUB_OWNER', 'GITHUB_REPO']
    });
  }

  let payload;
  try {
    payload = JSON.parse(event.body || '{}');
  } catch {
    return json(400, { error: 'Invalid JSON body' });
  }

  const inputs = {
    test_run_id: text(payload.testRunCode || payload.testRunId),
    base_url: text(payload.baseUrl),
    suite: text(payload.suiteTag),
    browser: text(payload.browser || 'chromium'),
    account_role: text(payload.accountRole),
    password: text(payload.password),
    project_code: text(payload.projectCode),
    transaction_codes: Array.isArray(payload.transactionCodes) ? payload.transactionCodes.join(',') : ''
  };

  if (!inputs.test_run_id || !inputs.base_url) {
    return json(400, { error: 'testRunId/testRunCode and baseUrl are required' });
  }

  const response = await fetch(`https://api.github.com/repos/${owner}/${repo}/actions/workflows/${workflowFile}/dispatches`, {
    method: 'POST',
    headers: {
      accept: 'application/vnd.github+json',
      authorization: `Bearer ${token}`,
      'content-type': 'application/json',
      'user-agent': 'uc-test-platform-netlify-function',
      'x-github-api-version': '2022-11-28'
    },
    body: JSON.stringify({ ref, inputs })
  });

  if (!response.ok) {
    const detail = await safeResponseBody(response);
    return json(response.status, {
      error: 'Could not dispatch GitHub Actions workflow',
      detail,
      repository: `${owner}/${repo}`,
      workflow: workflowFile,
      ref
    });
  }

  return json(202, {
    status: 'queued',
    workflowUrl: `https://github.com/${owner}/${repo}/actions/workflows/${workflowFile}`,
    evidenceLocation: 'GitHub Actions artifact: playwright-evidence'
  });
};

function text(value) {
  return typeof value === 'string' ? value.trim() : '';
}

async function safeResponseBody(response) {
  const raw = await response.text();
  try {
    const parsed = JSON.parse(raw);
    return parsed.message || raw;
  } catch {
    return raw;
  }
}

function json(statusCode, body) {
  return {
    statusCode,
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body)
  };
}
