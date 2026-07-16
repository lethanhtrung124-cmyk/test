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

  const dispatchResponse = await fetch(`https://api.github.com/repos/${owner}/${repo}/actions/workflows/${workflowFile}/dispatches`, {
    method: 'POST',
    headers: githubHeaders(token),
    body: JSON.stringify({ ref, inputs })
  });

  if (dispatchResponse.ok) {
    return json(202, {
      status: 'queued',
      dispatchMode: 'workflow_dispatch',
      workflowUrl: `https://github.com/${owner}/${repo}/actions/workflows/${workflowFile}`,
      evidenceLocation: 'GitHub Actions artifact: playwright-evidence'
    });
  }

  const dispatchDetail = await safeResponseBody(dispatchResponse);
  const shouldFallback = dispatchDetail.toLowerCase().includes('workflow_dispatch');
  if (!shouldFallback) {
    return json(dispatchResponse.status, {
      error: 'Could not dispatch GitHub Actions workflow',
      detail: dispatchDetail,
      repository: `${owner}/${repo}`,
      workflow: workflowFile,
      ref
    });
  }

  const repositoryDispatchResponse = await fetch(`https://api.github.com/repos/${owner}/${repo}/dispatches`, {
    method: 'POST',
    headers: githubHeaders(token),
    body: JSON.stringify({
      event_type: 'automation-run',
      client_payload: inputs
    })
  });

  if (!repositoryDispatchResponse.ok) {
    return json(repositoryDispatchResponse.status, {
      error: 'Could not dispatch GitHub repository event',
      detail: await safeResponseBody(repositoryDispatchResponse),
      firstAttempt: dispatchDetail,
      repository: `${owner}/${repo}`,
      workflow: workflowFile,
      ref,
      requiredPermission: 'Fine-grained token needs Contents: Read and write for repository_dispatch fallback'
    });
  }

  return json(202, {
    status: 'queued',
    dispatchMode: 'repository_dispatch',
    workflowUrl: `https://github.com/${owner}/${repo}/actions/workflows/${workflowFile}`,
    evidenceLocation: 'GitHub Actions artifact: playwright-evidence'
  });
};

function text(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function githubHeaders(token) {
  return {
    accept: 'application/vnd.github+json',
    authorization: `Bearer ${token}`,
    'content-type': 'application/json',
    'user-agent': 'uc-test-platform-netlify-function',
    'x-github-api-version': '2022-11-28'
  };
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
