export type Role =
  | 'System Admin'
  | 'Project Admin'
  | 'Test Manager'
  | 'Test Analyst'
  | 'Manual Tester'
  | 'Automation Engineer'
  | 'Viewer/Auditor';

export type ResultStatus = 'Pass' | 'Fail' | 'Blocked' | 'Not Run' | 'Flaky' | 'Infrastructure Error';
export type Priority = 'P0' | 'P1' | 'P2' | 'P3';
export type Severity = 'Critical' | 'High' | 'Medium' | 'Low';

export interface Project {
  id: string;
  code: string;
  name: string;
  ownerUnit: string;
  status: 'Active' | 'Paused' | 'Closed';
}

export interface Environment {
  id: string;
  projectId: string;
  code: string;
  name: string;
  baseUrl: string;
  runnerType: 'github-hosted' | 'self-hosted';
  status: 'Ready' | 'Degraded' | 'Offline';
}

export interface ApplicationVersion {
  id: string;
  projectId: string;
  version: string;
  build: string;
  deployedAt: string;
}

export interface UseCase {
  id: string;
  projectId: string;
  code: string;
  title: string;
  module: string;
  approvedVersion: string;
  status: 'Approved' | 'Draft' | 'Locked';
}

export interface TestScenario {
  id: string;
  useCaseId: string;
  code: string;
  title: string;
  type: 'positive' | 'negative' | 'boundary' | 'permission' | 'integration' | 'exception';
}

export interface TestCase {
  id: string;
  code: string;
  scenarioId: string;
  useCaseIds: string[];
  title: string;
  priority: Priority;
  suite: 'smoke' | 'regression' | 'functional';
  automationStatus: 'Automated' | 'Manual' | 'Candidate' | 'Blocked';
  expectedResult: string;
  steps: string[];
}

export interface AutomationScript {
  id: string;
  testCaseId: string;
  path: string;
  tags: string[];
  commitSha: string;
  reviewStatus: 'Approved' | 'Needs Review' | 'Draft';
}

export interface TestRun {
  id: string;
  code: string;
  projectId: string;
  environmentId: string;
  applicationVersionId: string;
  useCaseIds: string[];
  suite: string;
  status: 'Planning' | 'Running' | 'Completed' | 'Locked';
  startedAt: string;
  lockedAt?: string;
}

export interface TestResult {
  id: string;
  testRunId: string;
  testCaseId: string;
  status: ResultStatus;
  actualResult: string;
  runnerType: 'manual' | 'automation';
  commitSha: string;
  durationMs: number;
  executedAt: string;
  retryCount: number;
}

export interface Evidence {
  id: string;
  resultId: string;
  type: 'screenshot' | 'video' | 'trace' | 'log' | 'html-report' | 'junit';
  fileName: string;
  checksum: string;
  storagePath: string;
}

export interface Defect {
  id: string;
  code: string;
  projectId: string;
  title: string;
  severity: Severity;
  priority: Priority;
  status: 'Open' | 'In Progress' | 'Fixed' | 'Retest' | 'Closed' | 'Accepted Risk';
  linkedResultIds: string[];
  foundInVersion: string;
}

export interface AuditLog {
  id: string;
  actor: string;
  action: string;
  entity: string;
  entityId: string;
  createdAt: string;
}
