const { inflateRawSync } = require('node:zlib');

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
    const artifacts = await Promise.all((artifactsPayload.artifacts || []).map(async (artifact) => {
      const summary = await readArtifactSummary({ token, artifact }).catch((error) => ({
        error: error instanceof Error ? error.message : 'Không đọc được summary.json trong artifact.'
      }));

      return {
        id: artifact.id,
        name: artifact.name,
        sizeInBytes: artifact.size_in_bytes,
        url: `https://github.com/${owner}/${repo}/actions/runs/${run.id}/artifacts/${artifact.id}`,
        summary
      };
    }));

    const summary = artifacts.find((artifact) => artifact.summary && !artifact.summary.error)?.summary ?? null;

    return {
      id: run.id,
      status: run.status,
      conclusion: run.conclusion,
      title: run.display_title,
      url: run.html_url,
      createdAt: run.created_at,
      updatedAt: run.updated_at,
      summary,
      artifacts
    };
  }));

  return json(200, { workflowUrl: `https://github.com/${owner}/${repo}/actions/workflows/${workflowFile}`, runs });
};

async function readArtifactSummary({ token, artifact }) {
  if (!artifact.archive_download_url || artifact.expired) return null;

  const artifactResponse = await fetch(artifact.archive_download_url, {
    headers: githubHeaders(token),
    redirect: 'follow'
  });

  if (!artifactResponse.ok) {
    throw new Error(`GitHub artifact download failed: ${artifactResponse.status}`);
  }

  const zip = Buffer.from(await artifactResponse.arrayBuffer());
  const summaryText = readZipTextFile(zip, 'test-results/summary.json');
  if (!summaryText) return null;

  return JSON.parse(summaryText);
}

function readZipTextFile(zip, targetPath) {
  const normalizedTarget = normalizeZipPath(targetPath);
  const eocdOffset = findEndOfCentralDirectory(zip);
  if (eocdOffset < 0) return null;

  const centralDirectorySize = zip.readUInt32LE(eocdOffset + 12);
  const centralDirectoryOffset = zip.readUInt32LE(eocdOffset + 16);
  let cursor = centralDirectoryOffset;
  const end = centralDirectoryOffset + centralDirectorySize;

  while (cursor < end && zip.readUInt32LE(cursor) === 0x02014b50) {
    const compressionMethod = zip.readUInt16LE(cursor + 10);
    const compressedSize = zip.readUInt32LE(cursor + 20);
    const fileNameLength = zip.readUInt16LE(cursor + 28);
    const extraLength = zip.readUInt16LE(cursor + 30);
    const commentLength = zip.readUInt16LE(cursor + 32);
    const localHeaderOffset = zip.readUInt32LE(cursor + 42);
    const fileName = normalizeZipPath(zip.subarray(cursor + 46, cursor + 46 + fileNameLength).toString('utf8'));

    if (fileName === normalizedTarget || fileName.endsWith(`/${normalizedTarget}`)) {
      return readLocalFile(zip, localHeaderOffset, compressionMethod, compressedSize).toString('utf8');
    }

    cursor += 46 + fileNameLength + extraLength + commentLength;
  }

  return null;
}

function readLocalFile(zip, localHeaderOffset, compressionMethod, compressedSize) {
  if (zip.readUInt32LE(localHeaderOffset) !== 0x04034b50) {
    throw new Error('Artifact ZIP local header is invalid.');
  }

  const fileNameLength = zip.readUInt16LE(localHeaderOffset + 26);
  const extraLength = zip.readUInt16LE(localHeaderOffset + 28);
  const dataStart = localHeaderOffset + 30 + fileNameLength + extraLength;
  const compressed = zip.subarray(dataStart, dataStart + compressedSize);

  if (compressionMethod === 0) return compressed;
  if (compressionMethod === 8) return inflateRawSync(compressed);
  throw new Error(`Unsupported ZIP compression method: ${compressionMethod}`);
}

function findEndOfCentralDirectory(zip) {
  const minimumOffset = Math.max(0, zip.length - 65557);
  for (let offset = zip.length - 22; offset >= minimumOffset; offset -= 1) {
    if (zip.readUInt32LE(offset) === 0x06054b50) return offset;
  }
  return -1;
}

function normalizeZipPath(value) {
  return value.replace(/\\/g, '/').replace(/^\/+/, '');
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
