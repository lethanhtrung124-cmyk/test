export function getRunMetadata() {
  return {
    testRunId: process.env.TEST_RUN_ID ?? 'RUN-20260715-001',
    projectCode: process.env.PROJECT_CODE ?? 'KTKT',
    environmentCode: process.env.ENVIRONMENT_CODE ?? 'UAT',
    applicationVersion: process.env.APPLICATION_VERSION ?? 'v2.0.0',
    commitSha: process.env.GITHUB_SHA ?? 'local-pilot',
    runnerType: process.env.RUNNER_TYPE ?? 'local'
  };
}
