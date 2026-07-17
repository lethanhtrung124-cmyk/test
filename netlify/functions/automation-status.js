const workflowFile = process.env.GITHUB_AUTOMATION_WORKFLOW || 'automation.yml';

exports.handler = async (event) => {
  if (event.httpMethod !== 'GET') {
    return json(405, { error: 'Method not allowed' });
  }

  const token = process.env.GITHUB_AUTOMATION_TOKEN;
  const owner = process.env.GITHUB_OWNER;
  const repo = process.env.GITHUB_REPO;

  if (!token || !owner || !repo) {
    return json(501, {
      error: 'Automation runner is not configured',
      requiredEnv: ['GITHUB_AUTOMATION_TOKEN', 'GITHUB_OWNER', 'GITHUB_REPO']
    });
  }

  const runsResponse = await fetch(`https://api.github.com/repos/${owner}/${repo}/actions/workflows/${workflowFile}/runs?event=repository_dispatch&per_page=5`, {
    headers: githubHeaders(token)
  });

  if (!runsResponse.ok) {
    return json(runsResponse.status, {
      error: 'Could not read GitHub Actions runs',
      detail: await safeResponseBody(runsResponse)
    });
  }

  const runsPayload = await runsResponse.json();
  const runs = await Promise.all((runsPayload.workflow_runs || []).map(async (run) => {
    const artifactsResponse = await fetch(`https://api.github.com/repos/${owner}/${repo}/actions/runs/${run.id}/artifacts`, {
      headers: githubHeaders(token)
    });
    const artifactsPayload = artifactsResponse.ok ? await artifactsResponse.json() : { artifacts: [] };
    const artifacts = (artifactsPayload.artifacts || []).map((artifact) => ({
      id: artifact.id,
      name: artifact.name,
      sizeInBytes: artifact.size_in_bytes,
      url: `https://github.com/${owner}/${repo}/actions/runs/${run.id}/artifacts/${artifact.id}`
    }));

    return {
      id: run.id,
      status: run.status,
      conclusion: run.conclusion,
      title: run.display_title,
      url: run.html_url,
      createdAt: run.created_at,
      updatedAt: run.updated_at,
      artifacts
    };
  }));

  return json(200, { workflowUrl: `https://github.com/${owner}/${repo}/actions/workflows/${workflowFile}`, runs });
};

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
