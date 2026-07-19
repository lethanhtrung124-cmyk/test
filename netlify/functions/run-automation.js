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

  const scenarios = normalizeScenarios(payload.scenarios);
  const scenarioCodes = scenarios.map((scenario) => scenario.id);
  const requestedCodes = scenarioCodes.length > 0 ? scenarioCodes : normalizeCodes(payload.transactionCodes, payload.maxCases);
  const isScenarioSuite = text(payload.suiteTag || '@suite:scenario').includes('@suite:scenario');

  if (isScenarioSuite && scenarios.length === 0) {
    return json(400, {
      error: 'Scenario payload is required for Word-script automation',
      detail: 'APP chua gui noi dung kich ban kiem thu. Hay tai lai APP bang Ctrl+F5, import lai file kich ban vao dung dot kiem thu, roi chay lai.'
    });
  }

  const inputs = {
    test_run_id: text(payload.testRunCode || payload.testRunId),
    base_url: text(payload.baseUrl),
    suite: text(payload.suiteTag),
    browser: text(payload.browser || 'chromium'),
    account_role: text(payload.accountRole),
    project_code: text(payload.projectCode),
    transaction_codes: requestedCodes.join(','),
    max_cases: String(Math.max(requestedCodes.length, clampMaxCases(payload.maxCases))),
    scenarios
  };

  if (!inputs.test_run_id || !inputs.base_url) {
    return json(400, { error: 'testRunId/testRunCode and baseUrl are required' });
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

function normalizeCodes(value, maxCases) {
  if (!Array.isArray(value)) return [];
  const seen = new Set();
  for (const item of value) {
    const code = text(item).replace(/\s+/g, '').toUpperCase();
    if (code) seen.add(code);
  }
  return [...seen].slice(0, clampMaxCases(maxCases));
}

function clampMaxCases(value) {
  const parsed = Number.parseInt(String(value || '10'), 10);
  if (!Number.isFinite(parsed)) return 10;
  return Math.max(1, Math.min(parsed, 500));
}

function normalizeScenarios(value) {
  if (!Array.isArray(value)) return [];
  return value.slice(0, 500).map((item) => ({
    id: text(item.id),
    useCaseCode: text(item.useCaseCode),
    title: text(item.title),
    steps: Array.isArray(item.steps) ? item.steps.map(text).filter(Boolean) : [],
    expectedResult: text(item.expectedResult),
    precondition: text(item.precondition)
  })).filter((item) => item.id && item.steps.length > 0);
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
