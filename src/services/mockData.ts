import type {
  ApplicationVersion,
  AuditLog,
  AutomationScript,
  Defect,
  Environment,
  Evidence,
  Project,
  TestCase,
  TestResult,
  TestRun,
  TestScenario,
  UseCase
} from '../types/domain';

export const projects: Project[] = [
  { id: 'prj-1', code: 'PRJ-KTKT', name: 'Nền tảng kiểm thử UC', ownerUnit: 'Đơn vị quản lý hệ thống', status: 'Active' }
];

export const environments: Environment[] = [
  {
    id: 'env-uat',
    projectId: 'prj-1',
    code: 'UAT',
    name: 'UAT công khai',
    baseUrl: 'https://uat.example.test',
    runnerType: 'github-hosted',
    status: 'Ready'
  },
  {
    id: 'env-int',
    projectId: 'prj-1',
    code: 'INTERNAL',
    name: 'Mạng nội bộ',
    baseUrl: 'https://internal.example.test',
    runnerType: 'self-hosted',
    status: 'Degraded'
  }
];

export const applicationVersions: ApplicationVersion[] = [
  { id: 'app-v2', projectId: 'prj-1', version: 'v2.0.0', build: '20260715.1', deployedAt: '2026-07-15T03:30:00Z' }
];

export const useCases: UseCase[] = [
  { id: 'uc-1', projectId: 'prj-1', code: 'UC-USER-001', title: 'Quản lý người dùng và vai trò', module: 'user', approvedVersion: '1.0', status: 'Approved' },
  { id: 'uc-2', projectId: 'prj-1', code: 'UC-PROJ-001', title: 'Quản lý dự án kiểm thử', module: 'project', approvedVersion: '1.0', status: 'Approved' },
  { id: 'uc-3', projectId: 'prj-1', code: 'UC-TC-001', title: 'Quản lý Test Case và RTM', module: 'test-case', approvedVersion: '1.0', status: 'Approved' },
  { id: 'uc-4', projectId: 'prj-1', code: 'UC-RUN-001', title: 'Tạo và khóa Test Run', module: 'test-run', approvedVersion: '1.0', status: 'Locked' },
  { id: 'uc-5', projectId: 'prj-1', code: 'UC-AUTO-001', title: 'Kích hoạt Playwright và nhận kết quả', module: 'automation', approvedVersion: '1.0', status: 'Approved' },
  { id: 'uc-6', projectId: 'prj-1', code: 'UC-DEF-001', title: 'Quản lý defect từ kết quả Fail', module: 'defect', approvedVersion: '1.0', status: 'Approved' }
];

export const scenarios: TestScenario[] = [
  { id: 'ts-1', useCaseId: 'uc-1', code: 'TS-USER-001', title: 'Phân quyền theo vai trò dự án', type: 'permission' },
  { id: 'ts-2', useCaseId: 'uc-2', code: 'TS-PROJ-001', title: 'Tạo dự án với môi trường UAT', type: 'positive' },
  { id: 'ts-3', useCaseId: 'uc-3', code: 'TS-TC-001', title: 'Liên kết UC với Test Case', type: 'integration' },
  { id: 'ts-4', useCaseId: 'uc-4', code: 'TS-RUN-001', title: 'Khóa run ngăn sửa kết quả', type: 'negative' },
  { id: 'ts-5', useCaseId: 'uc-5', code: 'TS-AUTO-001', title: 'Nhận summary, JUnit và evidence', type: 'positive' },
  { id: 'ts-6', useCaseId: 'uc-6', code: 'TS-DEF-001', title: 'Tạo defect từ Fail', type: 'exception' }
];

export const testCases: TestCase[] = [
  {
    id: 'tc-1',
    code: 'TC-USER-001',
    scenarioId: 'ts-1',
    useCaseIds: ['uc-1'],
    title: 'Viewer chỉ xem dashboard được phân quyền',
    priority: 'P1',
    suite: 'smoke',
    automationStatus: 'Automated',
    expectedResult: 'Viewer không thấy thao tác quản trị hoặc cấu hình secret.',
    steps: ['Đăng nhập bằng Viewer', 'Mở dashboard', 'Kiểm tra menu quản trị']
  },
  {
    id: 'tc-2',
    code: 'TC-PROJ-001',
    scenarioId: 'ts-2',
    useCaseIds: ['uc-2'],
    title: 'Project Admin tạo dự án và môi trường',
    priority: 'P1',
    suite: 'functional',
    automationStatus: 'Manual',
    expectedResult: 'Dự án và môi trường xuất hiện trong danh sách, có audit log.',
    steps: ['Tạo dự án', 'Thêm UAT URL', 'Kiểm tra audit log']
  },
  {
    id: 'tc-3',
    code: 'TC-TC-001',
    scenarioId: 'ts-3',
    useCaseIds: ['uc-3'],
    title: 'Test Case bắt buộc liên kết ít nhất một UC',
    priority: 'P0',
    suite: 'smoke',
    automationStatus: 'Automated',
    expectedResult: 'Test Case không có UC bị từ chối.',
    steps: ['Mở form Test Case', 'Bỏ trống UC', 'Lưu']
  },
  {
    id: 'tc-4',
    code: 'TC-RUN-001',
    scenarioId: 'ts-4',
    useCaseIds: ['uc-4'],
    title: 'Run đã khóa không cho sửa result trực tiếp',
    priority: 'P0',
    suite: 'regression',
    automationStatus: 'Automated',
    expectedResult: 'Hệ thống chặn sửa và ghi audit log yêu cầu phiên bản mới.',
    steps: ['Khóa Test Run', 'Thử đổi Pass thành Fail', 'Kiểm tra thông báo']
  },
  {
    id: 'tc-5',
    code: 'TC-AUTO-001',
    scenarioId: 'ts-5',
    useCaseIds: ['uc-5'],
    title: 'Automation result ánh xạ đúng Test Case ID',
    priority: 'P1',
    suite: 'regression',
    automationStatus: 'Automated',
    expectedResult: 'Result có commit SHA, status và evidence checksum.',
    steps: ['Chạy Playwright', 'Gửi JSON summary', 'Xem result trên dashboard']
  },
  {
    id: 'tc-6',
    code: 'TC-DEF-001',
    scenarioId: 'ts-6',
    useCaseIds: ['uc-6'],
    title: 'Fail tạo defect với severity và phiên bản phát hiện',
    priority: 'P2',
    suite: 'functional',
    automationStatus: 'Candidate',
    expectedResult: 'Defect liên kết result, UC và Test Case liên quan.',
    steps: ['Ghi result Fail', 'Tạo defect', 'Mở RTM']
  }
];

export const automationScripts: AutomationScript[] = [
  { id: 'as-1', testCaseId: 'tc-1', path: 'tests/target-app/specs/user-permission.spec.ts', tags: ['@project:KTKT', '@module:user', '@suite:smoke'], commitSha: 'local-pilot', reviewStatus: 'Approved' },
  { id: 'as-2', testCaseId: 'tc-3', path: 'tests/platform-e2e/rtm.spec.ts', tags: ['@project:KTKT', '@module:test-case', '@suite:smoke'], commitSha: 'local-pilot', reviewStatus: 'Approved' },
  { id: 'as-3', testCaseId: 'tc-4', path: 'tests/platform-e2e/test-run-lock.spec.ts', tags: ['@project:KTKT', '@module:test-run', '@suite:regression'], commitSha: 'local-pilot', reviewStatus: 'Needs Review' },
  { id: 'as-4', testCaseId: 'tc-5', path: 'tests/target-app/specs/result-ingest.spec.ts', tags: ['@project:KTKT', '@module:automation', '@suite:regression'], commitSha: 'local-pilot', reviewStatus: 'Approved' }
];

export const testRuns: TestRun[] = [
  {
    id: 'run-1',
    code: 'RUN-20260715-001',
    projectId: 'prj-1',
    environmentId: 'env-uat',
    applicationVersionId: 'app-v2',
    suite: 'smoke + regression pilot',
    status: 'Locked',
    startedAt: '2026-07-15T04:00:00Z',
    lockedAt: '2026-07-15T05:10:00Z'
  }
];

export const testResults: TestResult[] = [
  { id: 'res-1', testRunId: 'run-1', testCaseId: 'tc-1', status: 'Pass', actualResult: 'Viewer không thấy cấu hình tích hợp.', runnerType: 'automation', commitSha: 'local-pilot', durationMs: 8200, executedAt: '2026-07-15T04:05:00Z', retryCount: 0 },
  { id: 'res-2', testRunId: 'run-1', testCaseId: 'tc-2', status: 'Blocked', actualResult: 'Chờ tài khoản Project Admin được cấp.', runnerType: 'manual', commitSha: 'manual', durationMs: 0, executedAt: '2026-07-15T04:08:00Z', retryCount: 0 },
  { id: 'res-3', testRunId: 'run-1', testCaseId: 'tc-3', status: 'Pass', actualResult: 'Validation yêu cầu tối thiểu một UC.', runnerType: 'automation', commitSha: 'local-pilot', durationMs: 5500, executedAt: '2026-07-15T04:11:00Z', retryCount: 0 },
  { id: 'res-4', testRunId: 'run-1', testCaseId: 'tc-4', status: 'Fail', actualResult: 'Một endpoint mock vẫn cho sửa result đã khóa.', runnerType: 'automation', commitSha: 'local-pilot', durationMs: 11900, executedAt: '2026-07-15T04:15:00Z', retryCount: 1 },
  { id: 'res-5', testRunId: 'run-1', testCaseId: 'tc-5', status: 'Flaky', actualResult: 'Retry lần 2 nhận đủ evidence, lần 1 thiếu trace.', runnerType: 'automation', commitSha: 'local-pilot', durationMs: 17300, executedAt: '2026-07-15T04:20:00Z', retryCount: 2 },
  { id: 'res-6', testRunId: 'run-1', testCaseId: 'tc-6', status: 'Not Run', actualResult: 'Chưa chạy trong pilot.', runnerType: 'manual', commitSha: 'manual', durationMs: 0, executedAt: '2026-07-15T04:25:00Z', retryCount: 0 }
];

export const evidence: Evidence[] = [
  { id: 'ev-1', resultId: 'res-4', type: 'screenshot', fileName: 'TC-RUN-001-failure.png', checksum: 'sha256:0d0f-pilot', storagePath: 'evidence/RUN-20260715-001/TC-RUN-001/failure.png' },
  { id: 'ev-2', resultId: 'res-4', type: 'trace', fileName: 'trace.zip', checksum: 'sha256:7b2a-pilot', storagePath: 'evidence/RUN-20260715-001/TC-RUN-001/trace.zip' },
  { id: 'ev-3', resultId: 'res-5', type: 'junit', fileName: 'junit.xml', checksum: 'sha256:9f1c-pilot', storagePath: 'reports/RUN-20260715-001/junit.xml' }
];

export const defects: Defect[] = [
  {
    id: 'def-1',
    code: 'DEF-KTKT-0001',
    projectId: 'prj-1',
    title: 'API mock cho phép sửa kết quả sau khi Test Run đã khóa',
    severity: 'High',
    priority: 'P0',
    status: 'Open',
    linkedResultIds: ['res-4'],
    foundInVersion: 'v2.0.0'
  }
];

export const auditLogs: AuditLog[] = [
  { id: 'al-1', actor: 'test.manager@example.test', action: 'LOCK_TEST_RUN', entity: 'test_runs', entityId: 'run-1', createdAt: '2026-07-15T05:10:00Z' },
  { id: 'al-2', actor: 'runner:github-actions', action: 'INGEST_AUTOMATION_RESULT', entity: 'test_results', entityId: 'res-5', createdAt: '2026-07-15T04:20:10Z' },
  { id: 'al-3', actor: 'tester@example.test', action: 'CREATE_DEFECT', entity: 'defects', entityId: 'def-1', createdAt: '2026-07-15T04:32:00Z' }
];
