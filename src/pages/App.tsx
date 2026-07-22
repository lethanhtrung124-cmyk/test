import {
  Activity,
  Archive,
  Briefcase,
  Bug,
  CheckCircle2,
  Database,
  FileCheck2,
  GitBranch,
  ListChecks,
  PlayCircle,
  ShieldCheck
} from 'lucide-react';
import JSZip from 'jszip';
import { type ChangeEvent, type Dispatch, type FormEvent, type SetStateAction, useEffect, useMemo, useState } from 'react';
import { Badge, type BadgeTone } from '../components/Badge';
import { DataTable } from '../components/DataTable';
import { MetricCard } from '../components/MetricCard';
import {
  applicationVersions,
  auditLogs as initialAuditLogs,
  automationScripts,
  defects as initialDefects,
  environments,
  evidence,
  projects as initialProjects,
  scenarios as initialScenarios,
  testCases as initialTestCases,
  testResults as initialTestResults,
  testRuns as initialTestRuns,
  useCases as initialUseCases
} from '../services/mockData';
import { calculateMetrics, statusTone } from '../services/metrics';
import { dataMode } from '../services/supabaseClient';
import type { AuditLog, Defect, Evidence, Project, ResultStatus, TestCase, TestResult, TestRun, TestScenario, UseCase } from '../types/domain';

type Tab = 'overview' | 'rtm' | 'runs' | 'defects' | 'evidence' | 'entry';

interface ResultAttachment {
  id: string;
  projectId: string;
  runId: string;
  fileName: string;
  createdAt: string;
  sizeInBytes: number;
  dataUrl: string;
}

const tabs: { id: Tab; label: string }[] = [
  { id: 'overview', label: 'Dự án & phạm vi' },
  { id: 'runs', label: 'Kết quả kiểm thử' },
  { id: 'evidence', label: 'Minh chứng & nhật ký' },
  { id: 'entry', label: 'Nhập liệu kiểm thử' }
];

export function App() {
  const [activeTab, setActiveTab] = useState<Tab>('overview');
  const [projectRows, setProjectRows] = useStoredState('uc-platform-projects', initialProjects);
  const [useCaseRows, setUseCaseRows] = useStoredState('uc-platform-use-cases', initialUseCases);
  const [scenarioRows, setScenarioRows] = useStoredState('uc-platform-scenarios', initialScenarios);
  const [testCaseRows, setTestCaseRows] = useStoredState('uc-platform-test-cases', initialTestCases);
  const [testRunRows, setTestRunRows] = useStoredState('uc-platform-test-runs', normalizeRuns(initialTestRuns, initialUseCases));
  const [resultRows, setResultRows] = useStoredState('uc-platform-test-results', initialTestResults);
  const [resultFiles, setResultFiles] = useState<ResultAttachment[]>(() => {
    window.localStorage.removeItem('uc-platform-result-files');
    return [];
  });
  const [defectRows, setDefectRows] = useStoredState('uc-platform-defects', initialDefects);
  const [auditRows, setAuditRows] = useStoredState('uc-platform-audit-logs', initialAuditLogs);
  const [selectedProjectId, setSelectedProjectId] = useStoredState('uc-platform-selected-project', projectRows[0]?.id ?? '');
  const [selectedRunId, setSelectedRunId] = useStoredState('uc-platform-selected-run', testRunRows[0]?.id ?? '');

  const selectedProject = projectRows.find((project) => project.id === selectedProjectId) ?? projectRows[0];
  const projectRuns = testRunRows.filter((run) => run.projectId === selectedProject?.id);
  const selectedRun = projectRuns.find((run) => run.id === selectedRunId) ?? projectRuns[0];
  const projectUseCases = useCaseRows.filter((useCase) => useCase.projectId === selectedProject?.id);
  const scopedUseCases = selectedRun ? projectUseCases.filter((useCase) => getRunUseCaseIds(selectedRun, projectUseCases).includes(useCase.id)) : projectUseCases;
  const scopedTestCases = testCaseRows.filter((testCase) => testCase.useCaseIds.some((id) => scopedUseCases.some((useCase) => useCase.id === id)));
  const scopedResults = resultRows.filter((result) => (!selectedRun || result.testRunId === selectedRun.id) && scopedTestCases.some((testCase) => testCase.id === result.testCaseId));
  const scopedDefects = defectRows.filter((defect) => defect.projectId === selectedProject?.id);
  const metrics = useMemo(() => calculateMetrics(scopedUseCases, scopedTestCases, scopedResults), [scopedUseCases, scopedTestCases, scopedResults]);
  const environment = selectedRun ? environments.find((item) => item.id === selectedRun.environmentId) : environments[0];
  const version = selectedRun ? applicationVersions.find((item) => item.id === selectedRun.applicationVersionId) : applicationVersions[0];

  useEffect(() => {
    if (selectedProject && !projectRuns.some((run) => run.id === selectedRunId)) {
      setSelectedRunId(projectRuns[0]?.id ?? '');
    }
  }, [projectRuns, selectedProject, selectedRunId, setSelectedRunId]);

  function addAudit(action: string, entity: string, entityId: string) {
    setAuditRows((current) => [
      { id: createId('audit'), actor: 'local-demo-user', action, entity, entityId, createdAt: new Date().toISOString() },
      ...current
    ]);
  }

  return (
    <main className="app-shell">
      <aside className="sidebar">
        <div className="brand">
          <ShieldCheck aria-hidden size={28} />
          <div>
            <strong>Nền tảng kiểm thử UC</strong>
            <span>Quản lý theo dự án và đợt kiểm thử</span>
          </div>
        </div>
        <nav aria-label="Điều hướng chính">
          {tabs.map((tab) => (
            <button key={tab.id} className={activeTab === tab.id ? 'active' : ''} onClick={() => setActiveTab(tab.id)}>
              {tab.label}
            </button>
          ))}
        </nav>
        <div className="side-panel">
          <p>Nguồn dữ liệu</p>
          <strong>{dataMode === 'supabase' ? 'Supabase' : 'Dữ liệu trình duyệt'}</strong>
          <span>Mỗi đợt kiểm thử có phạm vi UC riêng</span>
        </div>
      </aside>

      <section className="content">
        <header className="topbar">
          <div>
            <p>{selectedProject?.code ?? 'Chưa có dự án'}</p>
            <h1>{selectedProject?.name ?? 'Tạo dự án mới để bắt đầu'}</h1>
          </div>
          <div className="run-summary">
            {environment && <Badge tone="info">{environment.code}</Badge>}
            {version && <Badge tone="success">{version.version}</Badge>}
            {selectedRun && <Badge tone="warning">{runStatusLabel(selectedRun.status)}</Badge>}
          </div>
        </header>

        <SelectorBar
          projects={projectRows}
          runs={projectRuns}
          selectedProjectId={selectedProject?.id ?? ''}
          selectedRunId={selectedRun?.id ?? ''}
          onProjectChange={setSelectedProjectId}
          onRunChange={setSelectedRunId}
        />

        {activeTab === 'overview' && (
          <OverviewView
            project={selectedProject}
            run={selectedRun}
            useCases={scopedUseCases}
            allProjectUseCases={projectUseCases}
            testCases={scopedTestCases}
            metrics={metrics}
          />
        )}
        {activeTab === 'rtm' && <RtmView useCases={scopedUseCases} scenarios={scenarioRows} testCases={scopedTestCases} results={scopedResults} />}
        {activeTab === 'runs' && (
          <RunsView
            project={selectedProject}
            run={selectedRun}
            runs={projectRuns}
            useCases={scopedUseCases}
            testCases={scopedTestCases}
            results={scopedResults}
            resultFiles={resultFiles.filter((file) => file.projectId === selectedProject?.id && (!selectedRun || file.runId === selectedRun.id))}
          />
        )}
        {activeTab === 'defects' && <DefectsView defects={scopedDefects} />}
        {activeTab === 'evidence' && <EvidenceView auditLogs={auditRows} />}
        {activeTab === 'entry' && (
          <EntryView
            selectedProject={selectedProject}
            selectedRun={selectedRun}
            projects={projectRows}
            useCases={projectUseCases}
            testCases={scopedTestCases}
            testRuns={projectRuns}
            results={scopedResults}
            onAddProject={(row) => {
              setProjectRows((current) => [row, ...current]);
              setSelectedProjectId(row.id);
              addAudit('CREATE_PROJECT', 'projects', row.id);
            }}
            onAddUseCase={(row) => {
              setUseCaseRows((current) => [row, ...current]);
              addAudit('CREATE_USE_CASE', 'use_cases', row.id);
            }}
            onAddTestCase={(testCase, scenario) => {
              setScenarioRows((current) => [scenario, ...current]);
              setTestCaseRows((current) => [testCase, ...current]);
              addAudit('CREATE_TEST_CASE', 'test_cases', testCase.id);
            }}
            onAddTestRun={(row) => {
              setTestRunRows((current) => [row, ...current]);
              setSelectedRunId(row.id);
              addAudit('CREATE_TEST_RUN', 'test_runs', row.id);
            }}
            onUpdateRunScope={(runId, useCaseIds) => {
              setTestRunRows((current) => current.map((run) => (run.id === runId ? { ...run, useCaseIds } : run)));
              addAudit('UPDATE_TEST_RUN_SCOPE', 'test_runs', runId);
            }}
            onAddResult={(row) => {
              setResultRows((current) => [row, ...current]);
              addAudit(row.runnerType === 'automation' ? 'CREATE_AUTOMATION_RESULT' : 'CREATE_MANUAL_RESULT', 'test_results', row.id);
            }}
            onSyncAutomationResults={(rows) => {
              setResultRows((current) => [
                ...rows,
                ...current.filter((row) => !rows.some((incoming) => incoming.testRunId === row.testRunId && incoming.testCaseId === row.testCaseId && row.runnerType === 'automation'))
              ]);
              if (selectedRun) addAudit('SYNC_AUTOMATION_RESULTS', 'test_runs', selectedRun.id);
            }}
            onSaveResultFile={(file) => {
              setResultFiles((current) => [file, ...current.filter((item) => item.id !== file.id)]);
              addAudit('SAVE_RESULT_FILE', 'test_runs', file.runId);
            }}
            onAddDefect={(row) => {
              setDefectRows((current) => [row, ...current]);
              addAudit('CREATE_DEFECT', 'defects', row.id);
            }}
            onReset={() => {
              setProjectRows(initialProjects);
              setUseCaseRows(initialUseCases);
              setScenarioRows(initialScenarios);
              setTestCaseRows(initialTestCases);
              setTestRunRows(normalizeRuns(initialTestRuns, initialUseCases));
              setResultRows(initialTestResults);
              setResultFiles([]);
              setDefectRows(initialDefects);
              setAuditRows(initialAuditLogs);
              setSelectedProjectId(initialProjects[0]?.id ?? '');
              setSelectedRunId(initialTestRuns[0]?.id ?? '');
            }}
          />
        )}
      </section>
    </main>
  );
}

function SelectorBar({ projects, runs, selectedProjectId, selectedRunId, onProjectChange, onRunChange }: {
  projects: Project[];
  runs: TestRun[];
  selectedProjectId: string;
  selectedRunId: string;
  onProjectChange: (id: string) => void;
  onRunChange: (id: string) => void;
}) {
  return (
    <section className="selector-bar">
      <label>
        Dự án
        <select value={selectedProjectId} onChange={(event) => onProjectChange(event.target.value)}>
          {projects.map((project) => <option key={project.id} value={project.id}>{project.code} - {project.name}</option>)}
        </select>
      </label>
      <label>
        Đợt kiểm thử
        <select value={selectedRunId} onChange={(event) => onRunChange(event.target.value)}>
          {runs.map((run) => <option key={run.id} value={run.id}>{run.code} - {run.suite}</option>)}
        </select>
      </label>
    </section>
  );
}

function OverviewView({ project, run, useCases, allProjectUseCases, testCases, metrics }: {
  project?: Project;
  run?: TestRun;
  useCases: UseCase[];
  allProjectUseCases: UseCase[];
  testCases: TestCase[];
  metrics: ReturnType<typeof calculateMetrics>;
}) {
  return (
    <div className="stack">
      <div className="metrics-grid">
        <MetricCard label="UC trong đợt" value={`${useCases.length}`} hint={`${allProjectUseCases.length} UC của dự án`} icon={<ListChecks size={22} />} />
        <MetricCard label="Giao dịch kiểm thử" value={`${testCases.length}`} hint="Theo phạm vi UC đã chọn" icon={<FileCheck2 size={22} />} />
        <MetricCard label="Độ phủ UC" value={`${metrics.ucCoverage}%`} hint="UC có giao dịch liên kết" icon={<CheckCircle2 size={22} />} />
        <MetricCard label="Tỷ lệ đạt" value={`${metrics.passRate}%`} hint="Trong đợt đang chọn" icon={<PlayCircle size={22} />} />
      </div>

      <section className="panel">
        <div className="panel-heading">
          <div>
            <p>Thông tin quản lý</p>
            <h2>{project?.name ?? 'Chưa có dự án'}</h2>
          </div>
          <Briefcase aria-hidden />
        </div>
        <div className="management-grid">
          <div>
            <span>Mã dự án</span>
            <strong>{project?.code}</strong>
          </div>
          <div>
            <span>Đơn vị quản lý</span>
            <strong>{project?.ownerUnit}</strong>
          </div>
          <div>
            <span>Đợt kiểm thử</span>
            <strong>{run?.code ?? 'Chưa có đợt kiểm thử'}</strong>
          </div>
          <div>
            <span>Trạng thái đợt</span>
            <strong>{run ? runStatusLabel(run.status) : '-'}</strong>
          </div>
        </div>
      </section>

      <section className="panel">
        <div className="panel-heading">
          <div>
            <p>Phạm vi UC của đợt kiểm thử</p>
            <h2>Danh sách UC sẽ được kiểm thử trong đợt này</h2>
          </div>
          <Activity aria-hidden />
        </div>
        <DataTable
          columns={['Mã UC', 'Tên UC', 'Phân hệ', 'Phiên bản duyệt']}
          rows={useCases}
          renderRow={(useCase) => (
            <tr key={useCase.id}>
              <td><strong>{useCase.code}</strong></td>
              <td>{useCase.title}</td>
              <td>{useCase.module}</td>
              <td>{useCase.approvedVersion}</td>
            </tr>
          )}
          emptyText="Đợt kiểm thử này chưa chọn UC nào"
        />
      </section>
    </div>
  );
}

function RtmView({ useCases, scenarios, testCases, results }: { useCases: UseCase[]; scenarios: TestScenario[]; testCases: TestCase[]; results: TestResult[] }) {
  return (
    <section className="panel">
      <div className="panel-heading">
        <div>
          <p>Ma trận truy vết yêu cầu</p>
          <h2>UC / Tình huống / Giao dịch kiểm thử / Kết quả trong đợt</h2>
        </div>
        <FileCheck2 aria-hidden />
      </div>
      <DataTable
        columns={['UC', 'Tình huống', 'Giao dịch', 'Tự động hóa', 'Kết quả mới nhất']}
        rows={testCases}
        renderRow={(testCase) => {
          const useCaseCodes = testCase.useCaseIds.map((id) => useCases.find((item) => item.id === id)?.code).filter(Boolean).join(', ');
          const scenario = scenarios.find((item) => item.id === testCase.scenarioId);
          const script = automationScripts.find((item) => item.testCaseId === testCase.id);
          const result = latestResultFor(testCase, results);
          return (
            <tr key={testCase.id}>
              <td>{useCaseCodes}</td>
              <td>{scenario?.code}</td>
              <td>
                <strong>{testCase.code}</strong>
                <span>{testCase.title}</span>
              </td>
              <td>
                <Badge tone={script ? 'success' : 'neutral'}>{automationStatusLabel(testCase.automationStatus)}</Badge>
                <span>{script?.path ?? 'Chỉ kiểm thử thủ công'}</span>
              </td>
              <td>{result ? <Badge tone={statusTone(result.status)}>{resultStatusLabel(result.status)}</Badge> : <Badge>Chưa chạy</Badge>}</td>
            </tr>
          );
        }}
      />
    </section>
  );
}

function RunsView({ project, run, runs, useCases, testCases, results, resultFiles }: {
  project?: Project;
  run?: TestRun;
  runs: TestRun[];
  useCases: UseCase[];
  testCases: TestCase[];
  results: TestResult[];
  resultFiles: ResultAttachment[];
}) {
  const passCount = results.filter((result) => result.status === 'Pass').length;
  const failCount = results.filter((result) => result.status === 'Fail').length;
  const blockedCount = results.filter((result) => result.status === 'Blocked' || result.status === 'Infrastructure Error').length;
  const passRate = results.length ? Math.round((passCount / results.length) * 100) : 0;

  return (
    <div className="stack">
      <div className="metrics-grid">
        <MetricCard label="Dự án" value={project?.code ?? '-'} hint={project?.name ?? 'Chưa chọn dự án'} icon={<Briefcase size={22} />} />
        <MetricCard label="Đợt kiểm thử" value={run?.code ?? '-'} hint={`${runs.length} đợt của dự án`} icon={<PlayCircle size={22} />} />
        <MetricCard label="Tỷ lệ đạt" value={`${passRate}%`} hint={`${passCount}/${results.length || 0} giao dịch đạt`} icon={<CheckCircle2 size={22} />} />
        <MetricCard label="File kết quả" value={`${resultFiles.length}`} hint="File kịch bản đã cập nhật" icon={<Archive size={22} />} />
      </div>

      <section className="panel">
        <div className="panel-heading">
          <div>
            <p>Tổng quan kết quả</p>
            <h2>{run ? `Kết quả đợt ${run.code}` : 'Chưa chọn đợt kiểm thử'}</h2>
          </div>
          <PlayCircle aria-hidden />
        </div>
        <div className="summary-counts result-overview">
          <span>Tổng UC: <strong>{useCases.length}</strong></span>
          <span>Tổng giao dịch: <strong>{testCases.length}</strong></span>
          <span>Đã có kết quả: <strong>{results.length}</strong></span>
          <span>Đạt: <strong>{passCount}</strong></span>
          <span>Không đạt: <strong>{failCount}</strong></span>
          <span>Bị chặn/lỗi: <strong>{blockedCount}</strong></span>
        </div>
      </section>

      <section className="panel">
        <div className="panel-heading">
          <div>
            <p>File kết quả kiểm thử</p>
            <h2>File kịch bản đã điền kết quả và minh chứng</h2>
          </div>
          <Archive aria-hidden />
        </div>
        {resultFiles.length ? (
          <div className="attachment-list">
            {resultFiles.map((file) => (
              <div className="attachment-row" key={file.id}>
                <FileCheck2 size={18} />
                <span>{file.fileName}<small>{formatBytes(file.sizeInBytes)} - {new Date(file.createdAt).toLocaleString('vi-VN')}</small></span>
                <a className="download-link" href={file.dataUrl} download={file.fileName}>Tải về</a>
              </div>
            ))}
          </div>
        ) : (
          <p className="plain-text">Chưa có file kết quả cho đợt này. Hãy chạy kiểm thử và tải file ở chức năng Nhập liệu kiểm thử.</p>
        )}
      </section>

      <section className="panel">
        <div className="panel-heading">
          <div>
            <p>Chi tiết giao dịch</p>
            <h2>Kết quả kiểm thử theo từng giao dịch của đợt đang chọn</h2>
          </div>
          <ListChecks aria-hidden />
        </div>
        <DataTable
          columns={['Giao dịch kiểm thử', 'Trạng thái', 'Cách chạy', 'Kết quả thực tế', 'Commit', 'Số lần chạy lại']}
          rows={results}
          emptyText="Đợt kiểm thử này chưa có kết quả. Khi kiểm thử tự động hoàn thành, dữ liệu sẽ được đồng bộ vào đây."
          renderRow={(result) => {
            const testCase = testCases.find((item) => item.id === result.testCaseId);
            return (
              <tr key={result.id}>
                <td>
                  <strong>{testCase?.code}</strong>
                  <span>{testCase?.title}</span>
                </td>
                <td><Badge tone={statusTone(result.status)}>{resultStatusLabel(result.status)}</Badge></td>
                <td>{runnerTypeLabel(result.runnerType)}</td>
                <td>{result.actualResult}</td>
                <td>{result.commitSha}</td>
                <td>{result.retryCount}</td>
              </tr>
            );
          }}
        />
      </section>
    </div>
  );
}

function DefectsView({ defects }: { defects: Defect[] }) {
  return (
    <section className="panel">
      <div className="panel-heading">
        <div>
          <p>Quản lý lỗi</p>
          <h2>Lỗi của dự án đang chọn</h2>
        </div>
        <Bug aria-hidden />
      </div>
      <DataTable
        columns={['Mã lỗi', 'Tiêu đề', 'Mức độ', 'Ưu tiên', 'Trạng thái', 'Kết quả liên kết']}
        rows={defects}
        renderRow={(defect) => (
          <tr key={defect.id}>
            <td><strong>{defect.code}</strong></td>
            <td>{defect.title}</td>
            <td><Badge tone="danger">{severityLabel(defect.severity)}</Badge></td>
            <td>{defect.priority}</td>
            <td><Badge tone="warning">{defectStatusLabel(defect.status)}</Badge></td>
            <td>{defect.linkedResultIds.join(', ')}</td>
          </tr>
        )}
      />
    </section>
  );
}

function EvidenceView({ auditLogs }: { auditLogs: AuditLog[] }) {
  return (
    <div className="stack">
      <section className="panel">
        <div className="panel-heading">
          <div>
            <p>Minh chứng kỹ thuật</p>
            <h2>Mã kiểm tra, đường dẫn lưu trữ và loại hiện vật</h2>
          </div>
          <Archive aria-hidden />
        </div>
        <DataTable
          columns={['Tệp', 'Loại', 'Mã kiểm tra', 'Đường dẫn lưu trữ']}
          rows={evidence}
          renderRow={(item) => (
            <tr key={item.id}>
              <td><strong>{item.fileName}</strong></td>
              <td>{evidenceTypeLabel(item.type)}</td>
              <td>{item.checksum}</td>
              <td>{item.storagePath}</td>
            </tr>
          )}
        />
      </section>

      <section className="panel">
        <div className="panel-heading">
          <div>
            <p>Nhật ký kiểm toán</p>
            <h2>Truy nguyên thay đổi quan trọng</h2>
          </div>
          <ShieldCheck aria-hidden />
        </div>
        <DataTable
          columns={['Thời điểm', 'Người/nguồn thực hiện', 'Hành động', 'Đối tượng']}
          rows={auditLogs}
          renderRow={(log) => (
            <tr key={log.id}>
              <td>{new Date(log.createdAt).toLocaleString('vi-VN')}</td>
              <td>{log.actor}</td>
              <td><Badge tone="info">{auditActionLabel(log.action)}</Badge></td>
              <td>{log.entity}:{log.entityId}</td>
            </tr>
          )}
        />
      </section>
    </div>
  );
}

interface EntryViewProps {
  selectedProject?: Project;
  selectedRun?: TestRun;
  projects: Project[];
  useCases: UseCase[];
  testCases: TestCase[];
  testRuns: TestRun[];
  results: TestResult[];
  onAddProject: (row: Project) => void;
  onAddUseCase: (row: UseCase) => void;
  onAddTestCase: (testCase: TestCase, scenario: TestScenario) => void;
  onAddTestRun: (row: TestRun) => void;
  onUpdateRunScope: (runId: string, useCaseIds: string[]) => void;
  onAddResult: (row: TestResult) => void;
  onSyncAutomationResults: (rows: TestResult[]) => void;
  onSaveResultFile: (file: ResultAttachment) => void;
  onAddDefect: (row: Defect) => void;
  onReset: () => void;
}

interface AutomationRunStatus {
  id: number;
  status: string;
  conclusion: string | null;
  title: string;
  url: string;
  createdAt: string;
  updatedAt: string;
  summary: AutomationRunSummary | null;
  artifacts: Array<{ id: number; name: string; sizeInBytes: number; url: string; summary?: AutomationRunSummary | { error: string } | null }>;
}

interface AutomationRunSummary {
  testRunId: string;
  generatedAt: string;
  checksum?: string;
  counts: {
    total: number;
    pass: number;
    fail: number;
    blocked: number;
    infrastructureError: number;
  };
  results: AutomationRunResult[];
}

interface AutomationRunResult {
  title: string;
  useCaseCode?: string;
  testCaseCode?: string;
  status: ResultStatus;
  durationMs: number;
  retryCount: number;
  failureReason?: string;
  errorMessage?: string;
  commitSha?: string;
  evidencePaths?: string[];
  evidenceImages?: Array<{ name: string; contentType: string; body: string; omittedReason?: string }>;
  expectedType?: string;
  actualEvidence?: string;
}

interface AttachedScriptFile {
  id: string;
  name: string;
  size: number;
  importedAt: string;
  buffer: ArrayBuffer;
}

function EntryView({ selectedProject, selectedRun, projects, useCases, testCases, testRuns, results, onAddProject, onAddUseCase, onAddTestCase, onAddTestRun, onUpdateRunScope, onAddResult, onSyncAutomationResults, onSaveResultFile, onAddDefect, onReset }: EntryViewProps) {
  const [entryMode, setEntryMode] = useState<'manual' | 'automation'>('automation');
  const [projectForm, setProjectForm] = useState({ code: nextCode('PRJ-NEW', projects.length + 1), name: '', ownerUnit: '' });
  const [useCaseForm, setUseCaseForm] = useState({ code: '', title: '', module: 'general' });
  const [testCaseForm, setTestCaseForm] = useState({ code: '', title: '', useCaseId: useCases[0]?.id ?? '', expectedResult: '', steps: '', priority: 'P1' as TestCase['priority'], suite: 'functional' as TestCase['suite'], automationStatus: 'Manual' as TestCase['automationStatus'] });
  const [runForm, setRunForm] = useState({ code: `RUN-${new Date().toISOString().slice(0, 10).replace(/-/g, '')}-${String(testRuns.length + 1).padStart(3, '0')}`, suite: 'functional', status: 'Planning' as TestRun['status'], useCaseIds: useCases.map((useCase) => useCase.id) });
  const [resultForm, setResultForm] = useState({ testRunId: selectedRun?.id ?? testRuns[0]?.id ?? '', testCaseId: testCases[0]?.id ?? '', status: 'Pass' as ResultStatus, actualResult: '' });
  const [defectForm, setDefectForm] = useState({ resultId: results.find((item) => item.status === 'Fail')?.id ?? results[0]?.id ?? '', title: '', severity: 'Medium' as Defect['severity'], priority: 'P1' as Defect['priority'] });
  const [automationForm, setAutomationForm] = useState({ baseUrl: '', accountRole: 'KTV', browser: 'chromium', suiteTag: '@suite:scenario', retryPolicy: '1', maxCases: '100', note: '' });
  const [automationMessage, setAutomationMessage] = useState('');
  const [automationRuns, setAutomationRuns] = useState<AutomationRunStatus[]>([]);
  const [selectedAutomationRunId, setSelectedAutomationRunId] = useState<number | null>(null);
  const [automationStatusMessage, setAutomationStatusMessage] = useState('');
  const [automationPolling, setAutomationPolling] = useState(false);
  const [automationRequestedAt, setAutomationRequestedAt] = useState('');
  const [importMessage, setImportMessage] = useState('');
  const [attachedFiles, setAttachedFiles] = useState<AttachedScriptFile[]>([]);
  const [resultFileMessage, setResultFileMessage] = useState('');
  const [savedResultFileKeys, setSavedResultFileKeys] = useState<string[]>([]);
  const scopedRunIds = getRunUseCaseIds(selectedRun, useCases);

  useEffect(() => {
    if (entryMode === 'automation' && automationRuns.length === 0) {
      void refreshAutomationStatus();
    }
  }, [entryMode]);

  useEffect(() => {
    if (!automationPolling) return;
    const timer = window.setInterval(() => {
      void refreshAutomationStatus({ silent: true });
    }, 8000);
    return () => window.clearInterval(timer);
  }, [automationPolling, automationRequestedAt]);

  function submitProject(event: FormEvent) {
    event.preventDefault();
    onAddProject({ id: createId('prj'), code: projectForm.code.trim(), name: projectForm.name.trim(), ownerUnit: projectForm.ownerUnit.trim(), status: 'Active' });
    setProjectForm({ code: nextCode('PRJ-NEW', projects.length + 2), name: '', ownerUnit: '' });
  }

  function submitUseCase(event: FormEvent) {
    event.preventDefault();
    if (!selectedProject) return;
    const nextUseCaseCode = useCaseForm.code.trim() || nextCode('UC-NEW', useCases.length + 1);
    const row = {
      id: createId('uc'),
      projectId: selectedProject.id,
      code: nextUseCaseCode,
      title: useCaseForm.title.trim(),
      module: useCaseForm.module.trim(),
      approvedVersion: '1.0',
      status: 'Approved' as const
    };
    onAddUseCase(row);
    if (selectedRun) onUpdateRunScope(selectedRun.id, [...new Set([...scopedRunIds, row.id])]);
    setUseCaseForm({ code: '', title: '', module: 'general' });
  }

  function submitTestCase(event: FormEvent) {
    event.preventDefault();
    const nextTransactionCode = testCaseForm.code.trim() || nextCode('GD-NEW', testCases.length + 1);
    const scenario = { id: createId('ts'), useCaseId: testCaseForm.useCaseId, code: nextCode('TS-NEW', Date.now() % 1000), title: `Tình huống cho ${nextTransactionCode}`, type: 'positive' as const };
    onAddTestCase({
      id: createId('tc'),
      code: nextTransactionCode,
      scenarioId: scenario.id,
      useCaseIds: [testCaseForm.useCaseId],
      title: testCaseForm.title.trim(),
      priority: testCaseForm.priority,
      suite: testCaseForm.suite,
      automationStatus: testCaseForm.automationStatus,
      expectedResult: testCaseForm.expectedResult.trim(),
      steps: testCaseForm.steps.split('\n').map((step) => step.trim()).filter(Boolean)
    }, scenario);
    setTestCaseForm((current) => ({ ...current, code: '', title: '', expectedResult: '', steps: '' }));
  }

  function submitRun(event: FormEvent) {
    event.preventDefault();
    if (!selectedProject) return;
    onAddTestRun({
      id: createId('run'),
      code: runForm.code.trim(),
      projectId: selectedProject.id,
      environmentId: environments.find((environment) => environment.projectId === selectedProject.id)?.id ?? environments[0].id,
      applicationVersionId: applicationVersions.find((version) => version.projectId === selectedProject.id)?.id ?? applicationVersions[0].id,
      useCaseIds: runForm.useCaseIds,
      suite: runForm.suite.trim(),
      status: runForm.status,
      startedAt: new Date().toISOString(),
      lockedAt: runForm.status === 'Locked' ? new Date().toISOString() : undefined
    });
    setRunForm((current) => ({ ...current, code: `RUN-${new Date().toISOString().slice(0, 10).replace(/-/g, '')}-${String(testRuns.length + 2).padStart(3, '0')}` }));
  }

  function submitResult(event: FormEvent) {
    event.preventDefault();
    onAddResult({ id: createId('res'), testRunId: resultForm.testRunId, testCaseId: resultForm.testCaseId, status: resultForm.status, actualResult: resultForm.actualResult.trim(), runnerType: 'manual', commitSha: 'manual-local', durationMs: 0, executedAt: new Date().toISOString(), retryCount: 0 });
    setResultForm((current) => ({ ...current, actualResult: '' }));
  }

  function submitDefect(event: FormEvent) {
    event.preventDefault();
    if (!selectedProject) return;
    onAddDefect({ id: createId('def'), code: `DEF-${selectedProject.code.replace(/^PRJ-/, '')}-${String(Date.now()).slice(-4)}`, projectId: selectedProject.id, title: defectForm.title.trim(), severity: defectForm.severity, priority: defectForm.priority, status: 'Open', linkedResultIds: [defectForm.resultId], foundInVersion: applicationVersions[0].version });
    setDefectForm((current) => ({ ...current, title: '' }));
  }

  async function submitAutomation(event: FormEvent) {
    event.preventDefault();
    if (!selectedProject || !selectedRun) {
      setAutomationMessage('Cần tạo/chọn dự án và đợt kiểm thử trước khi chạy tự động.');
      return;
    }

    const runCaseIds = getRunUseCaseIds(selectedRun, useCases);
    const uniqueAutomatedCases = uniqueByCode(testCases.filter((testCase) =>
      testCase.useCaseIds.some((useCaseId) => runCaseIds.includes(useCaseId))
    ));
    const maxCases = Math.max(1, Math.min(Number.parseInt(automationForm.maxCases, 10) || 100, 500));
    const automatedCases = uniqueAutomatedCases.slice(0, maxCases);
    const automationScenarios = buildAutomationScenarios(automatedCases, useCases);

    if (automatedCases.length === 0) {
      setAutomationMessage('Đợt kiểm thử đang chọn chưa có giao dịch kiểm thử để chạy tự động.');
      return;
    }

    setAutomationMessage('Đang gửi yêu cầu chạy kiểm thử tự động...');
    try {
      const response = await fetch('/.netlify/functions/run-automation', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          projectCode: selectedProject.code,
          testRunId: selectedRun.id,
          testRunCode: selectedRun.code,
          baseUrl: automationForm.baseUrl,
          accountRole: automationForm.accountRole,
          browser: automationForm.browser,
          suiteTag: automationForm.suiteTag,
          retryPolicy: automationForm.retryPolicy,
          maxCases: automationForm.maxCases,
          transactionCodes: automatedCases.map((testCase) => testCase.code),
          scenarios: automationScenarios
        })
      });
      const payload = await response.json() as { workflowUrl?: string; evidenceLocation?: string; dispatchMode?: string; error?: string; detail?: string; requiredEnv?: string[]; repository?: string; workflow?: string; ref?: string; requiredPermission?: string };

      if (!response.ok) {
        const requiredEnv = payload.requiredEnv?.length ? ` Cần cấu hình Netlify env: ${payload.requiredEnv.join(', ')}.` : '';
        const detail = payload.detail ? ` Chi tiết GitHub: ${payload.detail}.` : '';
        const target = payload.repository ? ` Đích gọi: ${payload.repository}/${payload.workflow ?? 'automation.yml'}@${payload.ref ?? 'main'}.` : '';
        const permission = payload.requiredPermission ? ` Quyền cần có: ${payload.requiredPermission}.` : '';
        setAutomationMessage(`Chưa gửi được yêu cầu chạy thật: ${payload.error ?? response.statusText}.${detail}${target}${permission}${requiredEnv}`);
        return;
      }

      const requestedAt = new Date().toISOString();
      setAutomationRequestedAt(requestedAt);
      setSelectedAutomationRunId(null);
      setAutomationPolling(true);
      setAutomationStatusMessage(`Đang chạy kiểm thử tự động cho ${automatedCases.length}/${uniqueAutomatedCases.length} giao dịch...`);
      setAutomationMessage('Đã gửi yêu cầu chạy thật. Hệ thống đang chạy kiểm thử tự động, vui lòng chờ kết quả.');
      setTimeout(() => {
        void refreshAutomationStatus({ silent: true, requestedAt });
      }, 3000);
    } catch (error) {
      setAutomationMessage(`Không gọi được automation runner: ${error instanceof Error ? error.message : 'lỗi không xác định'}`);
    }
  }

  async function refreshAutomationStatus(options: { silent?: boolean; requestedAt?: string } = {}) {
    if (!options.silent) setAutomationStatusMessage('Đang cập nhật kết quả kiểm thử tự động...');
    try {
      const activeRequestedAt = options.requestedAt ?? automationRequestedAt;
      const query = activeRequestedAt ? `?since=${encodeURIComponent(activeRequestedAt)}` : '';
      const response = await fetch(`/.netlify/functions/automation-status${query}`);
      const payload = await readJsonResponse(response) as { runs?: AutomationRunStatus[]; error?: string; detail?: string; requiredEnv?: string[] };
      if (!response.ok) {
        const requiredEnv = payload.requiredEnv?.length ? ` Cần cấu hình Netlify env: ${payload.requiredEnv.join(', ')}.` : '';
        setAutomationStatusMessage(`Chưa đọc được kết quả kiểm thử tự động: ${payload.error ?? response.statusText}. ${payload.detail ?? ''}${requiredEnv}`);
        return;
      }
      const runs = payload.runs ?? [];
      setAutomationRuns(runs);
      const persistedRun = await loadPersistedAutomationRun(activeRequestedAt);
      if (persistedRun?.summary) {
        setAutomationRuns([persistedRun, ...runs.filter((run) => run.id !== persistedRun.id)]);
        setSelectedAutomationRunId(persistedRun.id);
        setAutomationPolling(false);
        if (selectedRun) onSyncAutomationResults(buildAutomationResultRows(persistedRun.summary, selectedRun.id, testCases));
        setAutomationStatusMessage('Hoàn thành kiểm thử. Kết quả đã được đồng bộ từ DB.');
        return;
      }
      const matchingRun = findRunForRequest(runs, activeRequestedAt);
      const completedRunWithSummary = matchingRun?.summary ? matchingRun : runs.find((run) => run.status === 'completed' && run.summary);

      if (automationPolling || activeRequestedAt) {
        if (!matchingRun && !completedRunWithSummary) {
          setAutomationStatusMessage('Đang chạy kiểm thử tự động: chờ runner khởi tạo lần chạy mới...');
          return;
        }
        const targetRun = completedRunWithSummary ?? matchingRun;
        if (!targetRun || targetRun.status !== 'completed') {
          setAutomationStatusMessage('Đang chạy kiểm thử tự động: runner đang thực hiện kịch bản...');
          return;
        }

        if (!targetRun.summary) {
          const completedAt = new Date(targetRun.updatedAt).getTime();
          const artifactWaitExpired = Number.isFinite(completedAt) && Date.now() - completedAt > 120000;
          if (!artifactWaitExpired) {
            setAutomationStatusMessage('GitHub đã hoàn thành, đang chờ artifact kết quả sẵn sàng...');
            return;
          }
        }

        setAutomationPolling(false);
        if (targetRun.summary) {
          setSelectedAutomationRunId(targetRun.id);
          if (selectedRun) onSyncAutomationResults(buildAutomationResultRows(targetRun.summary, selectedRun.id, testCases));
          await saveResultScriptFromSummary(targetRun.summary, targetRun);
          setAutomationStatusMessage('Hoàn thành kiểm thử. Bạn có thể tải file kịch bản đã cập nhật kết quả.');
        } else {
          const reason = targetRun.conclusion ? automationConclusionReason(targetRun.conclusion) : 'Không có summary kết quả trong lần chạy.';
          setAutomationStatusMessage(`Quy trình kiểm thử bị lỗi: ${reason}`);
        }
        return;
      }

      const displayRun = findRunForRequest(runs, activeRequestedAt);
      setSelectedAutomationRunId(displayRun?.summary ? displayRun.id : null);
      setAutomationStatusMessage(runs.length ? 'Đã có kết quả kiểm thử tự động mới nhất.' : 'Chưa có lần chạy kiểm thử tự động nào.');
    } catch (error) {
      if (automationPolling) setAutomationPolling(false);
      setAutomationStatusMessage(`Không gọi được trạng thái automation: ${error instanceof Error ? error.message : 'lỗi không xác định'}`);
    }
  }

  async function importDocx(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    if (!selectedProject) {
      setImportMessage('Cần tạo hoặc chọn dự án trước khi đính kèm kịch bản.');
      event.target.value = '';
      return;
    }

    try {
      const sourceBuffer = await file.arrayBuffer();
      const mammoth = await import('mammoth/mammoth.browser');
      const extracted = await mammoth.extractRawText({ arrayBuffer: sourceBuffer.slice(0) });
      const importedCases = parseImportedTestCases(extracted.value);
      if (importedCases.length === 0) {
        setImportMessage('Không tìm thấy UC/giao dịch trong file Word. Hệ thống nhận dạng các mã như UC.016, [UC.016-1] hoặc TCs_001.');
        event.target.value = '';
        return;
      }

      const useCaseCache = [...useCases];
      const importedUseCaseIds = new Set<string>();
      let importedCount = 0;
      for (const importedCase of importedCases) {
        const targetUseCase = findOrCreateUseCaseForImport(useCaseCache, selectedProject.id, importedCase.moduleTitle, onAddUseCase, importedCase.useCaseCode);
        importedUseCaseIds.add(targetUseCase.id);
        const scenario = { id: createId('ts'), useCaseId: targetUseCase.id, code: nextCode('TS-IMP', Date.now() % 1000), title: importedCase.title, type: 'positive' as const };
        onAddTestCase({ id: createId('tc'), code: importedCase.id, scenarioId: scenario.id, useCaseIds: [targetUseCase.id], title: importedCase.title, priority: 'P1', suite: 'functional', automationStatus: 'Manual', expectedResult: importedCase.expectedResult, steps: importedCase.steps }, scenario);
        importedCount += 1;
      }
      const importedScope = [...importedUseCaseIds];
      if (selectedRun) onUpdateRunScope(selectedRun.id, importedScope);
      setRunForm((current) => ({ ...current, useCaseIds: importedScope }));
      setAttachedFiles((current) => [...current, { id: createId('file'), name: file.name, size: file.size, importedAt: new Date().toISOString(), buffer: sourceBuffer }]);
      setImportMessage(`Đã import ${importedUseCaseIds.size} UC và ${importedCount} giao dịch kiểm thử từ file ${file.name}.`);
      event.target.value = '';
    } catch (error) {
      setImportMessage(`Không import được file Word: ${error instanceof Error ? error.message : 'lỗi không xác định'}`);
      event.target.value = '';
    }
  }

  async function downloadResultScript() {
    const scriptFile = attachedFiles[attachedFiles.length - 1];
    if (!scriptFile) {
      setResultFileMessage('Chưa có file kịch bản gốc để cập nhật kết quả.');
      return;
    }
    if (!latestSummary) {
      setResultFileMessage('Chưa có kết quả kiểm thử tự động để ghi vào file kịch bản.');
      return;
    }

    setResultFileMessage('Đang tạo file kịch bản đã cập nhật kết quả...');
    try {
      const hydratedRun = latestAutomationRun && !summaryHasEmbeddedEvidence(latestSummary)
        ? await loadAutomationRunWithEvidence(latestAutomationRun)
        : undefined;
      const summaryForFile = hydratedRun?.summary ?? latestSummary;
      const runForFile = hydratedRun ?? latestAutomationRun;
      if (selectedRun) {
        onSyncAutomationResults(buildAutomationResultRows(summaryForFile, selectedRun.id, testCases));
      }
      const resultFile = await createResultScriptFile(summaryForFile, runForFile);
      const url = URL.createObjectURL(resultFile.blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = resultFile.fileName;
      document.body.appendChild(link);
      link.click();
      link.remove();
      if (selectedProject && selectedRun) {
        onSaveResultFile(resultFile.attachment);
        setSavedResultFileKeys((current) => [...new Set([...current, resultFile.attachment.id])]);
      }
      URL.revokeObjectURL(url);
      setResultFileMessage('Đã tạo file kịch bản kết quả. Kiểm tra thư mục Downloads của trình duyệt.');
    } catch (error) {
      setResultFileMessage(`Không tạo được file kết quả: ${error instanceof Error ? error.message : 'lỗi không xác định'}`);
    }
  }

  async function loadAutomationRunWithEvidence(run: AutomationRunStatus): Promise<AutomationRunStatus | undefined> {
    const since = run.createdAt || automationRequestedAt;
    const query = since ? `?since=${encodeURIComponent(since)}` : '';
    const response = await fetch(`/.netlify/functions/automation-status${query}`);
    const payload = await readJsonResponse(response) as { runs?: AutomationRunStatus[]; error?: string; detail?: string };
    if (!response.ok) throw new Error(payload.detail || payload.error || response.statusText);
    const runs = payload.runs ?? [];
    const hydratedRun = runs.find((item) => item.id === run.id && item.summary) ?? runs.find((item) => item.summary);
    if (hydratedRun?.summary) {
      setAutomationRuns((current) => [hydratedRun, ...current.filter((item) => item.id !== hydratedRun.id)]);
      setSelectedAutomationRunId(hydratedRun.id);
    }
    return hydratedRun;
  }

  async function loadPersistedAutomationRun(requestedAt: string): Promise<AutomationRunStatus | undefined> {
    if (!selectedRun?.code) return undefined;
    const params = new URLSearchParams({ testRunId: selectedRun.code });
    if (requestedAt) params.set('since', requestedAt);
    try {
      const response = await fetch(`/.netlify/functions/automation-results?${params.toString()}`);
      if (response.status === 501 || response.status === 404) return undefined;
      const payload = await readJsonResponse(response) as { found?: boolean; run?: AutomationRunStatus; error?: string };
      if (!response.ok || !payload.found || !payload.run?.summary) return undefined;
      return payload.run;
    } catch {
      return undefined;
    }
  }

  async function saveResultScriptFromSummary(summary: AutomationRunSummary, run: AutomationRunStatus) {
    if (!selectedProject || !selectedRun || !attachedFiles.length) {
      setResultFileMessage('Đã có kết quả kiểm thử nhưng chưa có file kịch bản Word để tạo file kết quả.');
      return;
    }
    const fileKey = resultFileKey(selectedRun.id, summary, run);
    if (savedResultFileKeys.includes(fileKey)) return;
    try {
      const resultFile = await createResultScriptFile(summary, run);
      onSaveResultFile(resultFile.attachment);
      setSavedResultFileKeys((current) => [...new Set([...current, resultFile.attachment.id])]);
      setResultFileMessage('Đã tự tạo file Word kết quả và lưu vào tab Kết quả kiểm thử.');
    } catch (error) {
      setResultFileMessage(`Đã có kết quả nhưng chưa tạo được file Word: ${error instanceof Error ? error.message : 'lỗi không xác định'}`);
    }
  }

  async function createResultScriptFile(summary: AutomationRunSummary, run?: AutomationRunStatus) {
    const scriptFile = attachedFiles[attachedFiles.length - 1];
    if (!scriptFile) throw new Error('Chưa có file kịch bản gốc để cập nhật kết quả.');
    if (!selectedProject || !selectedRun) throw new Error('Chưa có dự án hoặc đợt kiểm thử đang chọn.');

    const output = await buildResultDocx(scriptFile.buffer, summary, run);
    const baseName = scriptFile.name.replace(/\.docx$/i, '');
    const outputBuffer = output.buffer.slice(output.byteOffset, output.byteOffset + output.byteLength) as ArrayBuffer;
    const blob = new Blob([outputBuffer], { type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' });
    const fileName = `${baseName}_KET_QUA_${summary.testRunId || 'automation'}.docx`;
    const attachment = {
      id: resultFileKey(selectedRun.id, summary, run),
      projectId: selectedProject.id,
      runId: selectedRun.id,
      fileName,
      createdAt: new Date().toISOString(),
      sizeInBytes: output.byteLength,
      dataUrl: await blobToDataUrl(blob)
    };
    return { blob, fileName, attachment };
  }

  const currentRunUseCaseIds = getRunUseCaseIds(selectedRun, useCases);
  const currentRunCases = uniqueByCode(testCases.filter((testCase) => testCase.useCaseIds.some((useCaseId) => currentRunUseCaseIds.includes(useCaseId))));
  const currentRunUseCaseCount = new Set(currentRunCases.flatMap((testCase) => testCase.useCaseIds)).size;
  const latestAutomationRun = useMemo(
    () => {
      const selectedDisplayRun = automationRuns.find((run) => run.id === selectedAutomationRunId)
        ?? findRunForRequest(automationRuns, automationRequestedAt);
      if (selectedDisplayRun) return selectedDisplayRun;
      if (automationPolling && automationRequestedAt) return undefined;
      return automationRuns.find((run) => run.summary) ?? automationRuns[0];
    },
    [automationPolling, automationRuns, automationRequestedAt, selectedAutomationRunId]
  );
  const latestSummary = latestAutomationRun?.summary;
  const latestUcStats = summarizeAutomationUseCases(latestSummary?.results ?? []);
  const selectedRunId = selectedRun?.id;

  return (
    <div className="entry-workflow">
      <section className="panel workflow-hero">
        <div className="panel-heading">
          <div>
            <p>Nhập liệu kiểm thử</p>
            <h2>Quy trình triển khai kiểm thử tự động chính thức</h2>
          </div>
          <Database aria-hidden />
        </div>
        <div className="workflow-steps" aria-label="Quy trình nhập liệu kiểm thử">
          <span>Chọn dự án</span>
          <span>Đợt kiểm thử</span>
          <span>Kịch bản kiểm thử</span>
          <span>Chạy kiểm thử</span>
          <span>Kết quả</span>
        </div>
      </section>

      <section className="workflow-node">
        <div className="node-marker">1</div>
        <div className="node-body">
          <div className="node-heading">
            <div>
              <p>Chọn dự án</p>
              <h3>{selectedProject ? `${selectedProject.code} - ${selectedProject.name}` : 'Chưa chọn dự án'}</h3>
            </div>
            <Badge tone={selectedProject ? 'success' : 'warning'}>{selectedProject ? 'Đã chọn' : 'Cần chọn'}</Badge>
          </div>
          <div className="compact-grid">
            <div className="info-tile">
              <span>Dự án hiện tại</span>
              <strong>{selectedProject?.name ?? '-'}</strong>
            </div>
            <form className="inline-create" onSubmit={submitProject}>
              <label>Mã dự án<input value={projectForm.code} onChange={(event) => setProjectForm({ ...projectForm, code: event.target.value })} required /></label>
              <label>Tên dự án<input value={projectForm.name} onChange={(event) => setProjectForm({ ...projectForm, name: event.target.value })} required /></label>
              <label>Đơn vị quản lý<input value={projectForm.ownerUnit} onChange={(event) => setProjectForm({ ...projectForm, ownerUnit: event.target.value })} required /></label>
              <button type="submit">Tạo dự án</button>
            </form>
          </div>
        </div>
      </section>

      <section className="workflow-node">
        <div className="node-marker">2</div>
        <div className="node-body">
          <div className="node-heading">
            <div>
              <p>Đợt kiểm thử</p>
              <h3>{selectedRun ? selectedRun.code : 'Tạo hoặc chọn đợt kiểm thử'}</h3>
            </div>
            <Badge tone={selectedRun ? 'info' : 'warning'}>{selectedRun ? runStatusLabel(selectedRun.status) : 'Chưa có đợt'}</Badge>
          </div>
          <form className="inline-create run-create" onSubmit={submitRun}>
            <label>Mã đợt kiểm thử<input value={runForm.code} onChange={(event) => setRunForm({ ...runForm, code: event.target.value })} required /></label>
            <button type="submit">Tạo đợt kiểm thử</button>
          </form>
          <p className="plain-text">Phạm vi UC của đợt kiểm thử được tự động lấy từ file kịch bản Word ở bước 3.</p>
        </div>
      </section>

      <section className="workflow-node">
        <div className="node-marker">3</div>
        <div className="node-body">
          <div className="node-heading">
            <div>
              <p>Chuẩn bị kịch bản kiểm thử</p>
              <h3>Đính kèm file kịch bản Word chứa UC và giao dịch</h3>
            </div>
            <Badge tone={currentRunCases.length ? 'success' : 'warning'}>{currentRunCases.length} giao dịch</Badge>
          </div>
          <div className="script-import-panel">
            <label className="file-import official">
              <span>Đính kèm hoặc bổ sung file .docx</span>
              <input type="file" accept=".docx,application/vnd.openxmlformats-officedocument.wordprocessingml.document" onChange={importDocx} />
            </label>
            {importMessage && <p className="form-note">{importMessage}</p>}
            <div className="script-summary">
              <div><span>UC trong phạm vi</span><strong>{currentRunUseCaseCount}</strong></div>
              <div><span>Giao dịch đã nhập</span><strong>{currentRunCases.length}</strong></div>
              <div><span>Nguồn dữ liệu</span><strong>File kịch bản</strong></div>
            </div>
            <div className="attachment-list">
              {attachedFiles.length ? (
                attachedFiles.map((file) => (
                  <div className="attachment-row" key={file.id}>
                    <FileCheck2 size={18} />
                    <span>{file.name}<small>{formatBytes(file.size)} - {new Date(file.importedAt).toLocaleString('vi-VN')}</small></span>
                    <button type="button" onClick={() => setAttachedFiles((current) => current.filter((item) => item.id !== file.id))}>Xóa</button>
                  </div>
                ))
              ) : (
                <span className="empty-attachment">Chưa có file kịch bản được import cho đợt này.</span>
              )}
            </div>
          </div>
        </div>
      </section>

      <section className="workflow-node">
        <div className="node-marker">4</div>
        <div className="node-body">
          <div className="node-heading">
            <div>
              <p>Kiểm thử tự động</p>
              <h3>Nhập môi trường và tài khoản kiểm thử</h3>
            </div>
            <PlayCircle aria-hidden />
          </div>
          <form className="automation-official-form" onSubmit={submitAutomation}>
            <label>Link ứng dụng cần kiểm thử<input value={automationForm.baseUrl} onChange={(event) => setAutomationForm({ ...automationForm, baseUrl: event.target.value })} placeholder="http://113.160.48.101:8080/" required /></label>
            <label>Tài khoản kiểm thử<input value={automationForm.accountRole} onChange={(event) => setAutomationForm({ ...automationForm, accountRole: event.target.value })} placeholder="Vai trò hoặc ghi chú tài khoản" /></label>
            <div className="inline-fields">
              <label>Trình duyệt<select value={automationForm.browser} onChange={(event) => setAutomationForm({ ...automationForm, browser: event.target.value })}><option value="chromium">Chromium</option><option value="firefox">Firefox</option><option value="webkit">WebKit</option></select></label>
              <label>Số giao dịch tối đa<input type="number" min="1" max="500" value={automationForm.maxCases} onChange={(event) => setAutomationForm({ ...automationForm, maxCases: event.target.value })} /></label>
            </div>
            <button type="submit" disabled={automationPolling}>{automationPolling ? 'Đang chạy kiểm thử...' : 'Chạy kiểm thử'}</button>
            {automationMessage && <p className="form-note">{automationMessage}</p>}
          </form>
        </div>
      </section>

      <section className="workflow-node">
        <div className="node-marker">5</div>
        <div className="node-body">
          <div className="node-heading">
            <div>
              <p>Kết quả kiểm thử</p>
              <h3>Tổng quan UC, giao dịch và file kịch bản kết quả</h3>
            </div>
            <Badge tone={automationPolling ? 'warning' : latestSummary ? 'success' : 'neutral'}>{automationPolling ? 'Đang chạy' : latestSummary ? 'Hoàn thành' : 'Chưa có kết quả'}</Badge>
          </div>
          {automationStatusMessage && <p className="form-note">{automationStatusMessage}</p>}
          {latestSummary ? (
            <div className="official-results">
              <div className="summary-counts result-overview">
                <span>Tổng UC: <strong>{latestUcStats.total}</strong></span>
                <span>UC đạt: <strong>{latestUcStats.pass}</strong></span>
                <span>UC không đạt: <strong>{latestUcStats.fail}</strong></span>
                <span>Tổng giao dịch: <strong>{latestSummary.counts?.total ?? latestSummary.results?.length ?? 0}</strong></span>
                <span>Giao dịch đạt: <strong>{latestSummary.counts?.pass ?? countAutomationResults(latestSummary.results, 'Pass')}</strong></span>
                <span>Giao dịch không đạt: <strong>{latestSummary.counts?.fail ?? countAutomationResults(latestSummary.results, 'Fail')}</strong></span>
              </div>
              <div className="automation-result-list official">
                {(latestSummary.results ?? []).map((result, index) => (
                  <div className="automation-result-row" key={`${latestAutomationRun?.id}-${result.testCaseCode ?? index}`}>
                    <Badge tone={automationResultTone(result.status)}>{automationResultLabel(result.status)}</Badge>
                    <span>{result.useCaseCode ?? 'UC'} / {result.testCaseCode ?? 'Giao dịch'}</span>
                    <div className="automation-result-detail">
                      <span>{result.title}</span>
                      {result.status !== 'Pass' && result.failureReason ? <small>Nguyên nhân: {result.failureReason}</small> : null}
                      {result.status !== 'Pass' && !result.failureReason && result.errorMessage ? <small>Lỗi: {result.errorMessage}</small> : null}
                    </div>
                    <span>{result.durationMs} ms</span>
                  </div>
                ))}
              </div>
              <div className="artifact-actions">
                <button type="button" onClick={downloadResultScript}>Tải file kết quả kiểm thử</button>
                <span>File tải về sẽ điền cột Kết quả kiểm tra và Chú thích trong kịch bản Word đã đính kèm.</span>
              </div>
              {resultFileMessage && <p className="form-note">{resultFileMessage}</p>}
            </div>
          ) : (
            <p className="plain-text">
              {automationPolling
                ? 'Đang chạy kiểm thử tự động. Hệ thống sẽ tự hiển thị kết quả và file Word sau khi GitHub hoàn thành và artifact sẵn sàng.'
                : 'Chưa có kết quả cho đợt kiểm thử này. Bấm “Chạy kiểm thử” để bắt đầu.'}
            </p>
          )}
        </div>
      </section>

      <button className="secondary-action" type="button" onClick={onReset}>Khôi phục dữ liệu mẫu</button>
    </div>
  );

  return (
    <div className="stack">
      <section className="panel">
        <div className="panel-heading">
          <div>
            <p>Quy trình nhập dữ liệu</p>
            <h2>1. Dự án → 2. Đợt kiểm thử/DS UC → 3. Kịch bản/giao dịch → 4. Thực hiện</h2>
          </div>
          <Database aria-hidden />
        </div>
        <div className="callout">
          <strong>Lưu ý:</strong>
          <span>Hãy tạo hoặc chọn dự án trước, sau đó tạo đợt kiểm thử và gắn danh sách UC/kịch bản cho đợt đó.</span>
        </div>
        <button className="secondary-action" type="button" onClick={onReset}>Khôi phục dữ liệu mẫu</button>
      </section>

      <div className="form-grid">
        <form className="entry-form" onSubmit={submitProject}>
          <h3>Bước 1 - Thêm dự án</h3>
          <label>Mã dự án<input value={projectForm.code} onChange={(event) => setProjectForm({ ...projectForm, code: event.target.value })} required /></label>
          <label>Tên dự án<input value={projectForm.name} onChange={(event) => setProjectForm({ ...projectForm, name: event.target.value })} required /></label>
          <label>Đơn vị quản lý<input value={projectForm.ownerUnit} onChange={(event) => setProjectForm({ ...projectForm, ownerUnit: event.target.value })} required /></label>
          <button type="submit">Lưu dự án</button>
        </form>

        <form className="entry-form" onSubmit={submitRun}>
          <h3>Bước 2 - Tạo đợt kiểm thử</h3>
          <label>Mã đợt kiểm thử<input value={runForm.code} onChange={(event) => setRunForm({ ...runForm, code: event.target.value })} required /></label>
          <label>Bộ kiểm thử<input value={runForm.suite} onChange={(event) => setRunForm({ ...runForm, suite: event.target.value })} required /></label>
          <label>Trạng thái<select value={runForm.status} onChange={(event) => setRunForm({ ...runForm, status: event.target.value as TestRun['status'] })}><option value="Planning">Đang lập kế hoạch</option><option value="Running">Đang chạy</option><option value="Completed">Hoàn tất</option><option value="Locked">Đã khóa</option></select></label>
          <fieldset className="checkbox-list">
            <legend>Danh sách UC thuộc đợt kiểm thử</legend>
            {useCases.map((useCase) => (
              <label key={useCase.id}>
                <input type="checkbox" checked={runForm.useCaseIds.includes(useCase.id)} onChange={(event) => setRunForm({ ...runForm, useCaseIds: toggleValue(runForm.useCaseIds, useCase.id, event.target.checked) })} />
                <span>{useCase.code} - {useCase.title}</span>
              </label>
            ))}
          </fieldset>
          <label className="file-import compact">
            <span>Đính kèm danh sách UC/kịch bản Word cho đợt này</span>
            <input type="file" accept=".docx,application/vnd.openxmlformats-officedocument.wordprocessingml.document" onChange={importDocx} />
          </label>
          {importMessage && <p className="form-note">{importMessage}</p>}
          <button type="submit">Tạo đợt kiểm thử</button>
        </form>

        {selectedRunId && (
          <section className="entry-form">
            <h3>Cập nhật phạm vi UC của đợt đang chọn</h3>
            <fieldset className="checkbox-list">
              <legend>{selectedRun?.code}</legend>
              {useCases.map((useCase) => (
                <label key={useCase.id}>
                    <input type="checkbox" checked={scopedRunIds.includes(useCase.id)} onChange={(event) => onUpdateRunScope(selectedRunId!, toggleValue(scopedRunIds, useCase.id, event.target.checked))} />
                  <span>{useCase.code} - {useCase.title}</span>
                </label>
              ))}
            </fieldset>
          </section>
        )}
      </div>

      <section className="panel">
        <div className="panel-heading">
          <div>
            <p>Bước 3 - Chuẩn bị kịch bản/giao dịch</p>
            <h2>Import kịch bản Word hoặc nhập giao dịch kiểm thử tùy chọn</h2>
          </div>
          <FileCheck2 aria-hidden />
        </div>
        <label className="file-import">
          <span>Import file .docx có cấu trúc UC.016, [UC.016-1], bước thực hiện và kết quả mong đợi</span>
          <input type="file" accept=".docx,application/vnd.openxmlformats-officedocument.wordprocessingml.document" onChange={importDocx} />
        </label>
        {importMessage && <p className="form-note">{importMessage}</p>}
      </section>

      <div className="form-grid">
        <form className="entry-form" onSubmit={submitUseCase}>
          <h3>Thêm UC tùy chọn</h3>
          <label>Mã UC (tùy chọn)<input value={useCaseForm.code} onChange={(event) => setUseCaseForm({ ...useCaseForm, code: event.target.value })} placeholder="Để trống nếu mã đã có trong file kịch bản" /></label>
          <label>Tên UC<input value={useCaseForm.title} onChange={(event) => setUseCaseForm({ ...useCaseForm, title: event.target.value })} required /></label>
          <label>Phân hệ<input value={useCaseForm.module} onChange={(event) => setUseCaseForm({ ...useCaseForm, module: event.target.value })} required /></label>
          <button type="submit">Lưu UC</button>
        </form>

        <form className="entry-form" onSubmit={submitTestCase}>
          <h3>Thêm giao dịch kiểm thử tùy chọn</h3>
          <label>Mã giao dịch (tùy chọn)<input value={testCaseForm.code} onChange={(event) => setTestCaseForm({ ...testCaseForm, code: event.target.value })} placeholder="Ví dụ: UC.016-1, có thể để trống" /></label>
          <label>Tên giao dịch<input value={testCaseForm.title} onChange={(event) => setTestCaseForm({ ...testCaseForm, title: event.target.value })} required /></label>
          <label>UC liên kết<select value={testCaseForm.useCaseId} onChange={(event) => setTestCaseForm({ ...testCaseForm, useCaseId: event.target.value })} required>{useCases.map((useCase) => <option key={useCase.id} value={useCase.id}>{useCase.code} - {useCase.title}</option>)}</select></label>
          <label>Kết quả mong đợi (tùy chọn)<textarea value={testCaseForm.expectedResult} onChange={(event) => setTestCaseForm({ ...testCaseForm, expectedResult: event.target.value })} /></label>
          <label>Các bước thực hiện<textarea value={testCaseForm.steps} onChange={(event) => setTestCaseForm({ ...testCaseForm, steps: event.target.value })} placeholder="Mỗi dòng là một bước" /></label>
          <button type="submit">Lưu giao dịch</button>
        </form>
      </div>

      <section className="panel">
        <div className="panel-heading">
          <div>
            <p>Bước 4 - Chọn phương thức thực hiện</p>
            <h2>Kiểm thử thủ công hoặc kiểm thử tự động</h2>
          </div>
          <PlayCircle aria-hidden />
        </div>
        <div className="mode-switch" role="tablist" aria-label="Phương thức kiểm thử">
          <button type="button" className={entryMode === 'manual' ? 'active' : ''} onClick={() => setEntryMode('manual')}>Kiểm thử thủ công</button>
          <button type="button" className={entryMode === 'automation' ? 'active' : ''} onClick={() => setEntryMode('automation')}>Kiểm thử tự động</button>
        </div>
      </section>

      {entryMode === 'manual' && (
        <div className="form-grid">
        <form className="entry-form" onSubmit={submitResult}>
          <h3>Ghi kết quả thủ công</h3>
          <label>Đợt kiểm thử<select value={resultForm.testRunId} onChange={(event) => setResultForm({ ...resultForm, testRunId: event.target.value })} required>{testRuns.map((run) => <option key={run.id} value={run.id}>{run.code}</option>)}</select></label>
          <label>Giao dịch kiểm thử<select value={resultForm.testCaseId} onChange={(event) => setResultForm({ ...resultForm, testCaseId: event.target.value })} required>{testCases.map((testCase) => <option key={testCase.id} value={testCase.id}>{testCase.code} - {testCase.title}</option>)}</select></label>
          <label>Trạng thái<select value={resultForm.status} onChange={(event) => setResultForm({ ...resultForm, status: event.target.value as ResultStatus })}><option value="Pass">Đạt</option><option value="Fail">Không đạt</option><option value="Blocked">Bị chặn</option><option value="Not Run">Chưa chạy</option><option value="Flaky">Không ổn định</option><option value="Infrastructure Error">Lỗi hạ tầng</option></select></label>
          <label>Kết quả thực tế<textarea value={resultForm.actualResult} onChange={(event) => setResultForm({ ...resultForm, actualResult: event.target.value })} required /></label>
          <button type="submit">Lưu kết quả</button>
        </form>

        <form className="entry-form" onSubmit={submitDefect}>
          <h3>Tạo lỗi</h3>
          <label>Kết quả liên kết<select value={defectForm.resultId} onChange={(event) => setDefectForm({ ...defectForm, resultId: event.target.value })} required>{results.map((result) => <option key={result.id} value={result.id}>{resultStatusLabel(result.status)} - {result.actualResult}</option>)}</select></label>
          <label>Tiêu đề lỗi<input value={defectForm.title} onChange={(event) => setDefectForm({ ...defectForm, title: event.target.value })} required /></label>
          <button type="submit">Tạo lỗi</button>
        </form>
        </div>
      )}

      {entryMode === 'automation' && (
        <div className="form-grid">
          <form className="entry-form" onSubmit={submitAutomation}>
            <h3>Yêu cầu chạy kiểm thử tự động</h3>
            <label>URL hệ thống cần kiểm thử<input value={automationForm.baseUrl} onChange={(event) => setAutomationForm({ ...automationForm, baseUrl: event.target.value })} placeholder="https://uat.example.vn" required /></label>
            <label>Vai trò/tài khoản dùng để kiểm thử<input value={automationForm.accountRole} onChange={(event) => setAutomationForm({ ...automationForm, accountRole: event.target.value })} /></label>
            <p className="form-note">Tài khoản và mật khẩu chạy thật được lấy từ GitHub Secrets TEST_USERNAME và TEST_PASSWORD để không lộ trong log.</p>
            <div className="inline-fields">
              <label>Trình duyệt<select value={automationForm.browser} onChange={(event) => setAutomationForm({ ...automationForm, browser: event.target.value })}><option value="chromium">Chromium</option><option value="firefox">Firefox</option><option value="webkit">WebKit</option></select></label>
              <label>Số lần chạy lại<input type="number" min="0" max="3" value={automationForm.retryPolicy} onChange={(event) => setAutomationForm({ ...automationForm, retryPolicy: event.target.value })} /></label>
            </div>
            <label>Số ca tối đa mỗi lượt<input type="number" min="1" max="500" value={automationForm.maxCases} onChange={(event) => setAutomationForm({ ...automationForm, maxCases: event.target.value })} /></label>
            <label>Bộ script tự động<select value={automationForm.suiteTag} onChange={(event) => setAutomationForm({ ...automationForm, suiteTag: event.target.value })}><option value="@suite:scenario">Kịch bản Word - chạy từng bước và đối chiếu mong đợi</option><option value="@suite:smoke">Smoke - kiểm tra URL hệ thống phản hồi</option><option value="">Tất cả script tự động đã cấu hình</option></select></label>
            <label>Ghi chú dữ liệu kiểm thử<textarea value={automationForm.note} onChange={(event) => setAutomationForm({ ...automationForm, note: event.target.value })} placeholder="Ví dụ: dùng dữ liệu test, không dùng dữ liệu thật" /></label>
            <button type="submit">Gửi yêu cầu chạy Playwright thật</button>
            {automationMessage && <p className="form-note">{automationMessage}</p>}
            <button className="secondary-action" type="button" onClick={() => refreshAutomationStatus()}>Cập nhật kết quả mới nhất</button>
            {automationStatusMessage && <p className="form-note">{automationStatusMessage}</p>}
          </form>

          <section className="entry-form">
            <h3>Kết quả tự động mới nhất</h3>
            {automationRuns.length === 0 ? (
              <>
                <p className="plain-text">Bấm cập nhật để lấy trạng thái GitHub Actions và artifact minh chứng mới nhất.</p>
                <div className="automation-flow">
                  <span>Dự án</span>
                  <span>Đợt kiểm thử</span>
                  <span>UC trong phạm vi</span>
                  <span>Script Playwright</span>
                  <span>Kết quả & minh chứng</span>
                </div>
              </>
            ) : (
              <div className="automation-results">
                {automationRuns.map((run) => (
                  <div className="automation-result" key={run.id}>
                    <strong>{automationRunLabel(run)}</strong>
                    <span>{new Date(run.createdAt).toLocaleString('vi-VN')}</span>
                    {run.summary ? (
                      <div className="automation-summary">
                        <div className="summary-counts">
                          <span>Tổng: <strong>{run.summary.counts?.total ?? run.summary.results?.length ?? 0}</strong></span>
                          <span>Đạt: <strong>{run.summary.counts?.pass ?? countAutomationResults(run.summary.results, 'Pass')}</strong></span>
                          <span>Không đạt: <strong>{run.summary.counts?.fail ?? countAutomationResults(run.summary.results, 'Fail')}</strong></span>
                          <span>Bị chặn: <strong>{run.summary.counts?.blocked ?? countAutomationResults(run.summary.results, 'Blocked')}</strong></span>
                          <span>Lỗi hạ tầng: <strong>{run.summary.counts?.infrastructureError ?? countAutomationResults(run.summary.results, 'Infrastructure Error')}</strong></span>
                        </div>
                        <div className="automation-result-list">
                          {(run.summary.results ?? []).map((result, index) => (
                            <div className="automation-result-row" key={`${run.id}-${result.testCaseCode ?? index}`}>
                              <Badge tone={automationResultTone(result.status)}>{automationResultLabel(result.status)}</Badge>
                              <span>{result.useCaseCode ?? 'UC'} / {result.testCaseCode ?? 'Giao dịch'}</span>
                              <div className="automation-result-detail">
                                <span>{result.title}</span>
                                {result.status !== 'Pass' && result.failureReason ? <small>Nguyên nhân: {result.failureReason}</small> : null}
                                {result.status !== 'Pass' && !result.failureReason && result.errorMessage ? <small>Lỗi: {result.errorMessage}</small> : null}
                              </div>
                              <span>{result.durationMs} ms</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    ) : (
                      <span>Chưa có summary trong artifact hoặc workflow vẫn đang chạy.</span>
                    )}
                    <a href={run.url} target="_blank" rel="noreferrer">Mở workflow run</a>
                    {run.artifacts.map((artifact) => (
                      <a key={artifact.id} href={artifact.url} target="_blank" rel="noreferrer">Tải {artifact.name}</a>
                    ))}
                  </div>
                ))}
              </div>
            )}
          </section>
        </div>
      )}

    </div>
  );
}

function useStoredState<T>(key: string, initialValue: T): [T, Dispatch<SetStateAction<T>>] {
  const [value, setValue] = useState<T>(() => {
    try {
      const raw = window.localStorage.getItem(key);
      return raw ? (JSON.parse(raw) as T) : initialValue;
    } catch {
      window.localStorage.removeItem(key);
      return initialValue;
    }
  });

  useEffect(() => {
    try {
      window.localStorage.setItem(key, JSON.stringify(value));
    } catch (error) {
      console.warn(`Không lưu được dữ liệu cục bộ cho ${key}`, error);
    }
  }, [key, value]);

  return [value, setValue];
}

function normalizeRuns(runs: TestRun[], useCases: UseCase[]): TestRun[] {
  return runs.map((run) => ({ ...run, useCaseIds: run.useCaseIds?.length ? run.useCaseIds : useCases.filter((useCase) => useCase.projectId === run.projectId).map((useCase) => useCase.id) }));
}

function getRunUseCaseIds(run: TestRun | undefined, useCases: UseCase[]): string[] {
  return run?.useCaseIds?.length ? run.useCaseIds : useCases.map((useCase) => useCase.id);
}

function toggleValue(values: string[], value: string, checked: boolean): string[] {
  return checked ? [...new Set([...values, value])] : values.filter((item) => item !== value);
}

function createId(prefix: string): string {
  return `${prefix}-${crypto.randomUUID ? crypto.randomUUID() : Date.now().toString(36)}`;
}

function nextCode(prefix: string, value: number): string {
  return `${prefix}-${String(value).padStart(3, '0')}`;
}

function uniqueByCode<T extends { code: string }>(rows: T[]): T[] {
  const seen = new Set<string>();
  return rows.filter((row) => {
    const code = row.code.trim().toUpperCase();
    if (seen.has(code)) return false;
    seen.add(code);
    return true;
  });
}

function buildAutomationScenarios(testCases: TestCase[], useCases: UseCase[]) {
  return testCases.map((testCase) => {
    const useCase = testCase.useCaseIds.map((id) => useCases.find((item) => item.id === id)).find(Boolean);
    return {
      id: testCase.code,
      useCaseCode: useCase?.code ?? testCase.code.match(/^(UC\.\d+)/i)?.[1]?.toUpperCase() ?? '',
      title: testCase.title,
      steps: testCase.steps,
      expectedResult: testCase.expectedResult,
      precondition: 'Người dùng đã được cấp tài khoản và phân quyền chức năng',
      source: 'app-import'
    };
  });
}

interface ImportedTestCase {
  id: string;
  useCaseCode?: string;
  moduleTitle: string;
  title: string;
  steps: string[];
  expectedResult: string;
}

function parseImportedTestCases(rawText: string): ImportedTestCase[] {
  const lines = rawText.replace(/\r/g, '\n').split('\n').map((line) => line.trim()).filter(Boolean);
  const cases: ImportedTestCase[] = [];
  let currentModule = 'Kịch bản import từ Word';
  let currentUseCaseCode = '';

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index];
    const useCaseMatch = line.match(/^(UC\.\d+)\s*[-–]\s*(.+)$/i);
    if (useCaseMatch) {
      currentUseCaseCode = useCaseMatch[1].toUpperCase();
      currentModule = cleanCell(useCaseMatch[2]);
      continue;
    }
    if (/^(I|II|III|IV|V|\d+)\./.test(line) && !/^TCs?[_-]/i.test(line)) {
      currentModule = cleanCell(line);
      continue;
    }
    const bracketMatch = line.match(/^\[(UC\.\d+\s*[-–]?\s*\d+)\]$/i);
    const tcMatch = line.match(/^(TCs?[_-]?\d+)\b/i);
    if (!bracketMatch && !tcMatch) continue;

    const rawId = bracketMatch?.[1] ?? tcMatch?.[1] ?? '';
    const bracketUseCaseCode = bracketMatch ? bracketMatch[1].match(/^(UC\.\d+)/i)?.[1].toUpperCase() : '';
    const useCaseCode = bracketUseCaseCode || currentUseCaseCode;
    cases.push({
      id: normalizeImportedCaseId(rawId),
      useCaseCode,
      moduleTitle: currentModule,
      title: cleanCell(lines[index + 1] ?? rawId),
      steps: splitNumberedSteps(cleanCell(lines[index + 2] ?? '')),
      expectedResult: cleanCell(lines[index + 3] ?? '')
    });
  }
  return cases;
}

function findOrCreateUseCaseForImport(cache: UseCase[], projectId: string, moduleTitle: string, onAddUseCase: (row: UseCase) => void, useCaseCode?: string): UseCase {
  const normalizedCode = useCaseCode?.replace(/\s+/g, '').toUpperCase();
  const existing = cache.find((row) => row.projectId === projectId && (row.title === moduleTitle || (normalizedCode && row.code === normalizedCode)));
  if (existing) return existing;
  const row = { id: createId('uc-import'), projectId, code: normalizedCode || nextCode('UC-IMP', cache.filter((item) => item.projectId === projectId).length + 1), title: moduleTitle, module: 'import-word', approvedVersion: '1.0', status: 'Approved' as const };
  cache.push(row);
  onAddUseCase(row);
  return row;
}

function normalizeImportedCaseId(value: string): string {
  return value.replace(/^TCs?/i, 'TC').replace(/\s+/g, '').replace(/_/g, '-').toUpperCase();
}

function cleanCell(value: string): string {
  return value.replace(/\s*\|\s*$/g, '').replace(/\s+/g, ' ').trim();
}

function splitNumberedSteps(value: string): string[] {
  const normalized = value.replace(/\s+/g, ' ').replace(/(?<!\d)([2-9])\./g, '\n$1.').trim();
  const parts = normalized.split('\n').map((part) => part.trim()).filter(Boolean);
  return parts.length > 0 ? parts : [value];
}

function latestResultFor(testCase: TestCase, results: TestResult[]): TestResult | undefined {
  return results.filter((result) => result.testCaseId === testCase.id).sort((left, right) => new Date(right.executedAt).getTime() - new Date(left.executedAt).getTime())[0];
}

function resultStatusLabel(status: ResultStatus): string {
  return { Pass: 'Đạt', Fail: 'Không đạt', Blocked: 'Bị chặn', 'Not Run': 'Chưa chạy', Flaky: 'Không ổn định', 'Infrastructure Error': 'Lỗi hạ tầng' }[status];
}

function automationStatusLabel(status: TestCase['automationStatus']): string {
  return { Automated: 'Đã tự động hóa', Manual: 'Thủ công', Candidate: 'Ứng viên tự động hóa', Blocked: 'Bị chặn' }[status];
}

function runnerTypeLabel(type: TestResult['runnerType']): string {
  return type === 'automation' ? 'Tự động' : 'Thủ công';
}

function automationRunLabel(run: AutomationRunStatus): string {
  if (run.status !== 'completed') return 'Đang chạy';
  if (run.conclusion === 'success') return 'Đã chạy xong';
  if (run.conclusion === 'failure') return 'Có ca không đạt';
  if (run.conclusion === 'cancelled') return 'Đã hủy';
  return run.conclusion ?? run.status;
}

function automationResultLabel(status: ResultStatus): string {
  return resultStatusLabel(status);
}

function automationResultTone(status: ResultStatus): BadgeTone {
  if (status === 'Pass') return 'success';
  if (status === 'Fail' || status === 'Infrastructure Error') return 'danger';
  if (status === 'Blocked' || status === 'Flaky') return 'warning';
  return 'neutral';
}

function countAutomationResults(results: AutomationRunResult[] | undefined, status: ResultStatus): number {
  return (results ?? []).filter((result) => result.status === status).length;
}

function summaryHasEmbeddedEvidence(summary: AutomationRunSummary | undefined): boolean {
  return (summary?.results ?? []).some((result) => result.evidenceImages?.some((image) => image.body));
}

function findRunForRequest(runs: AutomationRunStatus[], requestedAt: string): AutomationRunStatus | undefined {
  if (!requestedAt) return runs.find((run) => run.status === 'completed' && run.summary) ?? runs[0];
  const requestedTime = new Date(requestedAt).getTime() - 15000;
  const afterRequest = runs.filter((run) => new Date(run.createdAt).getTime() >= requestedTime);
  return afterRequest.find((run) => run.status === 'completed' && run.summary)
    ?? afterRequest.find((run) => run.status !== 'completed')
    ?? afterRequest[0];
}

function resultFileKey(runId: string, summary: AutomationRunSummary, run?: AutomationRunStatus): string {
  return `result-file-${runId}-${summary.checksum || summary.generatedAt || run?.id || Date.now()}`;
}

function automationConclusionReason(conclusion: string): string {
  const reasons: Record<string, string> = {
    failure: 'Có giao dịch không đạt hoặc runner gặp lỗi trong quá trình thực hiện. Xem nguyên nhân chi tiết ở danh sách kết quả và file kịch bản tải về.',
    cancelled: 'Lần chạy đã bị hủy trước khi hoàn tất.',
    timed_out: 'Lần chạy vượt quá thời gian cho phép.',
    action_required: 'GitHub Actions cần thao tác xác nhận hoặc cấu hình bổ sung.',
    startup_failure: 'Runner không khởi tạo được môi trường kiểm thử.'
  };
  return reasons[conclusion] ?? `GitHub Actions trả về trạng thái ${conclusion}.`;
}

function automationExpectedTypeLabel(value: string): string {
  const labels: Record<string, string> = {
    search_result: 'Tra cứu/hiển thị danh sách',
    detail_view: 'Xem chi tiết',
    download: 'Kết xuất/tải file',
    save_success: 'Lưu/cập nhật thành công',
    delete_success: 'Xóa/hủy thành công',
    send_success: 'Gửi/tiếp nhận dữ liệu',
    validation_message: 'Cảnh báo/kiểm tra hợp lệ',
    permission: 'Phân quyền',
    generic: 'Đối chiếu nội dung chung'
  };
  return labels[value] ?? value;
}

function buildAutomationResultRows(summary: AutomationRunSummary, runId: string, testCases: TestCase[]): TestResult[] {
  return (summary.results ?? []).map((item, index) => {
    const testCase = findTestCaseForAutomationResult(item, testCases);
    return {
      id: `auto-${runId}-${testCase?.id ?? (normalizeTransactionCode(item.testCaseCode) || String(index))}-${summary.checksum ?? summary.generatedAt}`,
      testRunId: runId,
      testCaseId: testCase?.id ?? '',
      status: item.status,
      actualResult: item.status === 'Pass'
        ? 'Kết quả thực tế phù hợp với kết quả mong đợi.'
        : item.failureReason || item.errorMessage || 'Kết quả thực tế không đáp ứng kết quả mong đợi.',
      runnerType: 'automation' as const,
      commitSha: item.commitSha ?? '',
      durationMs: item.durationMs ?? 0,
      executedAt: summary.generatedAt || new Date().toISOString(),
      retryCount: item.retryCount ?? 0
    };
  }).filter((row) => row.testCaseId);
}

function findTestCaseForAutomationResult(result: AutomationRunResult, testCases: TestCase[]): TestCase | undefined {
  const resultCode = normalizeTransactionCode(result.testCaseCode);
  if (resultCode) {
    return testCases.find((testCase) => normalizeTransactionCode(testCase.code) === resultCode);
  }
  return testCases.find((testCase) => testCase.title === result.title);
}

function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error ?? new Error('Không đọc được file kết quả.'));
    reader.readAsDataURL(blob);
  });
}

async function readJsonResponse(response: Response): Promise<unknown> {
  const text = await response.text();
  if (!text.trim()) {
    throw new Error(`Netlify function trả về rỗng với HTTP ${response.status}. Có thể function bị timeout hoặc response vượt giới hạn.`);
  }
  try {
    return JSON.parse(text);
  } catch {
    throw new Error(`Netlify function không trả JSON hợp lệ với HTTP ${response.status}: ${text.slice(0, 240)}`);
  }
}

async function buildResultDocx(sourceBuffer: ArrayBuffer, summary: AutomationRunSummary, run?: AutomationRunStatus): Promise<Uint8Array> {
  const zip = await JSZip.loadAsync(sourceBuffer);
  const documentFile = zip.file('word/document.xml');
  if (!documentFile) throw new Error('File Word không có word/document.xml hợp lệ.');

  const documentXml = await documentFile.async('text');
  const parser = new DOMParser();
  const doc = parser.parseFromString(documentXml, 'application/xml');
  const parseError = doc.getElementsByTagName('parsererror')[0];
  if (parseError) throw new Error('Không đọc được cấu trúc XML của file Word.');

  const results = new Map<string, AutomationRunResult>();
  for (const result of summary.results ?? []) {
    const code = normalizeTransactionCode(result.testCaseCode);
    if (code) results.set(code, result);
  }

  const relsDoc = await readXmlFromZip(zip, 'word/_rels/document.xml.rels');
  const contentTypesDoc = await readXmlFromZip(zip, '[Content_Types].xml');
  let imageIndex = 1;
  const tables = Array.from(doc.getElementsByTagNameNS(wordNamespace, 'tbl'));
  for (const table of tables) {
    const rows = Array.from(table.getElementsByTagNameNS(wordNamespace, 'tr'));
    for (const row of rows.slice(1)) {
      const cells = Array.from(row.getElementsByTagNameNS(wordNamespace, 'tc'));
      if (cells.length < 7) continue;

      const transactionCode = normalizeTransactionCode(cellText(cells[0]));
      if (!transactionCode) continue;

      const result = results.get(transactionCode);
      fillWordCell(doc, cells[5], result ? documentResultLabel(result.status) : 'Chưa có kết quả');
      const image = result?.evidenceImages?.find((item) => item.body);
      const imageRelId = image ? addEvidenceImage(zip, relsDoc, contentTypesDoc, image, imageIndex++) : undefined;
      fillWordCell(doc, cells[6], buildEvidenceNote(result, run, summary), imageRelId);
    }
  }

  zip.file('word/document.xml', new XMLSerializer().serializeToString(doc));
  zip.file('word/_rels/document.xml.rels', new XMLSerializer().serializeToString(relsDoc));
  zip.file('[Content_Types].xml', new XMLSerializer().serializeToString(contentTypesDoc));
  return zip.generateAsync({ type: 'uint8array' });
}

const wordNamespace = 'http://schemas.openxmlformats.org/wordprocessingml/2006/main';
const relationshipsNamespace = 'http://schemas.openxmlformats.org/package/2006/relationships';
const relationshipNamespace = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships';
const contentTypesNamespace = 'http://schemas.openxmlformats.org/package/2006/content-types';

function cellText(cell: Element): string {
  return Array.from(cell.getElementsByTagNameNS(wordNamespace, 't')).map((node) => node.textContent ?? '').join('');
}

async function readXmlFromZip(zip: JSZip, path: string): Promise<XMLDocument> {
  const file = zip.file(path);
  if (!file) throw new Error(`File Word thiếu ${path}.`);
  const xml = await file.async('text');
  return new DOMParser().parseFromString(xml, 'application/xml');
}

function addEvidenceImage(zip: JSZip, relsDoc: XMLDocument, contentTypesDoc: XMLDocument, image: { name: string; contentType: string; body: string }, index: number): string {
  const extension = image.contentType.includes('jpeg') || image.contentType.includes('jpg') ? 'jpg' : 'png';
  const mediaName = `evidence-${index}.${extension}`;
  const relationshipId = `rIdEvidence${Date.now()}${index}`;
  zip.file(`word/media/${mediaName}`, image.body, { base64: true });

  const relationship = relsDoc.createElementNS(relationshipsNamespace, 'Relationship');
  relationship.setAttribute('Id', relationshipId);
  relationship.setAttribute('Type', 'http://schemas.openxmlformats.org/officeDocument/2006/relationships/image');
  relationship.setAttribute('Target', `media/${mediaName}`);
  relsDoc.documentElement.appendChild(relationship);
  ensureContentType(contentTypesDoc, extension, image.contentType);
  return relationshipId;
}

function ensureContentType(doc: XMLDocument, extension: string, contentType: string) {
  const hasDefault = Array.from(doc.getElementsByTagNameNS(contentTypesNamespace, 'Default')).some((node) => node.getAttribute('Extension') === extension);
  if (hasDefault) return;
  const item = doc.createElementNS(contentTypesNamespace, 'Default');
  item.setAttribute('Extension', extension);
  item.setAttribute('ContentType', contentType);
  doc.documentElement.appendChild(item);
}

function fillWordCell(doc: XMLDocument, cell: Element, value: string, imageRelationshipId?: string) {
  const tcPr = Array.from(cell.childNodes).find((node) => node.nodeType === Node.ELEMENT_NODE && (node as Element).localName === 'tcPr')?.cloneNode(true);
  while (cell.firstChild) cell.removeChild(cell.firstChild);
  if (tcPr) cell.appendChild(tcPr);

  const lines = value.split('\n').filter(Boolean);
  for (const line of lines.length ? lines : ['']) {
    const paragraph = doc.createElementNS(wordNamespace, 'w:p');
    const run = doc.createElementNS(wordNamespace, 'w:r');
    const text = doc.createElementNS(wordNamespace, 'w:t');
    text.setAttribute('xml:space', 'preserve');
    text.textContent = line;
    run.appendChild(text);
    paragraph.appendChild(run);
    cell.appendChild(paragraph);
  }

  if (imageRelationshipId) {
    const imageParagraph = createImageParagraph(doc, imageRelationshipId);
    cell.appendChild(imageParagraph);
  }
}

function createImageParagraph(doc: XMLDocument, relationshipId: string): Element {
  const imageWidth = 2600000;
  const imageHeight = 1462500;
  const drawingXml = `
    <w:p xmlns:w="${wordNamespace}" xmlns:r="${relationshipNamespace}" xmlns:wp="http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing" xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:pic="http://schemas.openxmlformats.org/drawingml/2006/picture">
      <w:pPr><w:jc w:val="center"/></w:pPr>
      <w:r>
        <w:drawing>
          <wp:inline distT="0" distB="0" distL="0" distR="0">
            <wp:extent cx="${imageWidth}" cy="${imageHeight}"/>
            <wp:effectExtent l="0" t="0" r="0" b="0"/>
            <wp:docPr id="${Math.floor(Math.random() * 100000) + 1}" name="Minh chứng kiểm thử"/>
            <wp:cNvGraphicFramePr><a:graphicFrameLocks noChangeAspect="1"/></wp:cNvGraphicFramePr>
            <a:graphic>
              <a:graphicData uri="http://schemas.openxmlformats.org/drawingml/2006/picture">
                <pic:pic>
                  <pic:nvPicPr><pic:cNvPr id="0" name="Minh chứng kiểm thử"/><pic:cNvPicPr/></pic:nvPicPr>
                  <pic:blipFill><a:blip r:embed="${relationshipId}"/><a:stretch><a:fillRect/></a:stretch></pic:blipFill>
                  <pic:spPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="${imageWidth}" cy="${imageHeight}"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom></pic:spPr>
                </pic:pic>
              </a:graphicData>
            </a:graphic>
          </wp:inline>
        </w:drawing>
      </w:r>
    </w:p>`;
  return doc.importNode(new DOMParser().parseFromString(drawingXml, 'application/xml').documentElement, true);
}

function normalizeTransactionCode(value?: string): string {
  const match = (value ?? '').match(/UC\.\s*\d+\s*-\s*\d+/i);
  return match ? match[0].replace(/\s+/g, '').toUpperCase() : '';
}

function documentResultLabel(status: ResultStatus): string {
  if (status === 'Pass') return 'Đạt';
  if (status === 'Fail') return 'Không đạt';
  if (status === 'Blocked') return 'Bị chặn';
  if (status === 'Infrastructure Error') return 'Lỗi hạ tầng';
  return resultStatusLabel(status);
}

function buildEvidenceNote(result: AutomationRunResult | undefined, _run: AutomationRunStatus | undefined, _summary: AutomationRunSummary): string {
  if (!result) return 'Chưa có kết quả kiểm thử tự động tương ứng trong lần chạy mới nhất.';

  const hasMinimalEvidenceImage = result.evidenceImages?.some((image) => image.body || image.omittedReason) || result.evidencePaths?.some(Boolean);
  if (result.status === 'Pass') {
    return hasMinimalEvidenceImage
      ? 'Ảnh minh chứng kết quả đạt:'
      : 'Đạt. Chưa có ảnh minh chứng trong dữ liệu kết quả.';
  }

  const minimalReason = result.failureReason || result.errorMessage || 'Kết quả thực tế không đáp ứng kết quả mong đợi.';
  return `Nguyên nhân không đạt: ${minimalReason}\n${hasMinimalEvidenceImage ? 'Ảnh minh chứng kết quả không đạt:' : 'Chưa có ảnh minh chứng trong dữ liệu kết quả.'}`;
}

function formatBytes(value: number): string {
  if (!Number.isFinite(value) || value <= 0) return '0 KB';
  if (value < 1024 * 1024) return `${Math.max(1, Math.round(value / 1024))} KB`;
  return `${(value / (1024 * 1024)).toFixed(1)} MB`;
}

function summarizeAutomationUseCases(results: AutomationRunResult[]) {
  const byUseCase = new Map<string, AutomationRunResult[]>();
  for (const result of results) {
    const key = result.useCaseCode || result.testCaseCode?.match(/^(UC\.\d+)/i)?.[1] || 'UC';
    byUseCase.set(key, [...(byUseCase.get(key) ?? []), result]);
  }

  const groups = [...byUseCase.values()];
  const failedStatuses: ResultStatus[] = ['Fail', 'Blocked', 'Infrastructure Error'];
  const fail = groups.filter((group) => group.some((result) => failedStatuses.includes(result.status))).length;
  const pass = groups.filter((group) => group.length > 0 && group.every((result) => result.status === 'Pass')).length;
  return { total: groups.length, pass, fail };
}

function runStatusLabel(status: TestRun['status']): string {
  return { Planning: 'Đang lập kế hoạch', Running: 'Đang chạy', Completed: 'Hoàn tất', Locked: 'Đã khóa' }[status];
}

function severityLabel(severity: Defect['severity']): string {
  return { Critical: 'Nghiêm trọng', High: 'Cao', Medium: 'Trung bình', Low: 'Thấp' }[severity];
}

function defectStatusLabel(status: Defect['status']): string {
  return { Open: 'Mở', 'In Progress': 'Đang xử lý', Fixed: 'Đã sửa', Retest: 'Kiểm thử lại', Closed: 'Đã đóng', 'Accepted Risk': 'Chấp nhận rủi ro' }[status];
}

function evidenceTypeLabel(type: Evidence['type']): string {
  return { screenshot: 'Ảnh chụp', video: 'Video', trace: 'Trace', log: 'Log', 'html-report': 'Báo cáo HTML', junit: 'JUnit' }[type];
}

function auditActionLabel(action: string): string {
  const labels: Record<string, string> = {
    CREATE_PROJECT: 'Tạo dự án',
    CREATE_USE_CASE: 'Tạo UC',
    CREATE_TEST_CASE: 'Tạo giao dịch kiểm thử',
    CREATE_TEST_RUN: 'Tạo đợt kiểm thử',
    UPDATE_TEST_RUN_SCOPE: 'Cập nhật phạm vi UC',
    CREATE_MANUAL_RESULT: 'Ghi kết quả thủ công',
    CREATE_AUTOMATION_RESULT: 'Ghi kết quả tự động',
    LOCK_TEST_RUN: 'Khóa đợt kiểm thử',
    INGEST_AUTOMATION_RESULT: 'Nhận kết quả tự động',
    CREATE_DEFECT: 'Tạo lỗi'
  };
  return labels[action] ?? action;
}
