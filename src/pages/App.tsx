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

const tabs: { id: Tab; label: string }[] = [
  { id: 'overview', label: 'Dự án & phạm vi' },
  { id: 'rtm', label: 'Ma trận truy vết' },
  { id: 'runs', label: 'Kết quả kiểm thử' },
  { id: 'defects', label: 'Lỗi' },
  { id: 'evidence', label: 'Minh chứng & nhật ký' },
  { id: 'entry', label: 'Nhập dữ liệu' }
];

export function App() {
  const [activeTab, setActiveTab] = useState<Tab>('overview');
  const [projectRows, setProjectRows] = useStoredState('uc-platform-projects', initialProjects);
  const [useCaseRows, setUseCaseRows] = useStoredState('uc-platform-use-cases', initialUseCases);
  const [scenarioRows, setScenarioRows] = useStoredState('uc-platform-scenarios', initialScenarios);
  const [testCaseRows, setTestCaseRows] = useStoredState('uc-platform-test-cases', initialTestCases);
  const [testRunRows, setTestRunRows] = useStoredState('uc-platform-test-runs', normalizeRuns(initialTestRuns, initialUseCases));
  const [resultRows, setResultRows] = useStoredState('uc-platform-test-results', initialTestResults);
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
        {activeTab === 'runs' && <RunsView testCases={scopedTestCases} results={scopedResults} />}
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

function RunsView({ testCases, results }: { testCases: TestCase[]; results: TestResult[] }) {
  return (
    <section className="panel">
      <div className="panel-heading">
        <div>
          <p>Kết quả kiểm thử</p>
          <h2>Kết quả chi tiết theo đợt đang chọn</h2>
        </div>
        <PlayCircle aria-hidden />
      </div>
      <DataTable
        columns={['Giao dịch kiểm thử', 'Trạng thái', 'Cách chạy', 'Kết quả thực tế', 'Commit', 'Số lần chạy lại']}
        rows={results}
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
  commitSha?: string;
}

function EntryView({ selectedProject, selectedRun, projects, useCases, testCases, testRuns, results, onAddProject, onAddUseCase, onAddTestCase, onAddTestRun, onUpdateRunScope, onAddResult, onAddDefect, onReset }: EntryViewProps) {
  const [entryMode, setEntryMode] = useState<'manual' | 'automation'>('manual');
  const [projectForm, setProjectForm] = useState({ code: nextCode('PRJ-NEW', projects.length + 1), name: '', ownerUnit: '' });
  const [useCaseForm, setUseCaseForm] = useState({ code: '', title: '', module: 'general' });
  const [testCaseForm, setTestCaseForm] = useState({ code: '', title: '', useCaseId: useCases[0]?.id ?? '', expectedResult: '', steps: '', priority: 'P1' as TestCase['priority'], suite: 'functional' as TestCase['suite'], automationStatus: 'Manual' as TestCase['automationStatus'] });
  const [runForm, setRunForm] = useState({ code: `RUN-${new Date().toISOString().slice(0, 10).replace(/-/g, '')}-${String(testRuns.length + 1).padStart(3, '0')}`, suite: 'functional', status: 'Planning' as TestRun['status'], useCaseIds: useCases.map((useCase) => useCase.id) });
  const [resultForm, setResultForm] = useState({ testRunId: selectedRun?.id ?? testRuns[0]?.id ?? '', testCaseId: testCases[0]?.id ?? '', status: 'Pass' as ResultStatus, actualResult: '' });
  const [defectForm, setDefectForm] = useState({ resultId: results.find((item) => item.status === 'Fail')?.id ?? results[0]?.id ?? '', title: '', severity: 'Medium' as Defect['severity'], priority: 'P1' as Defect['priority'] });
  const [automationForm, setAutomationForm] = useState({ baseUrl: '', accountRole: 'KTV', browser: 'chromium', suiteTag: '@suite:scenario', retryPolicy: '1', maxCases: '10', note: '' });
  const [automationMessage, setAutomationMessage] = useState('');
  const [automationRuns, setAutomationRuns] = useState<AutomationRunStatus[]>([]);
  const [automationStatusMessage, setAutomationStatusMessage] = useState('');
  const [importMessage, setImportMessage] = useState('');
  const scopedRunIds = getRunUseCaseIds(selectedRun, useCases);

  useEffect(() => {
    if (entryMode === 'automation' && automationRuns.length === 0) {
      void refreshAutomationStatus();
    }
  }, [entryMode]);

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
    const maxCases = Math.max(1, Math.min(Number.parseInt(automationForm.maxCases, 10) || 10, 50));
    const automatedCases = uniqueAutomatedCases.slice(0, maxCases);

    if (automatedCases.length === 0) {
      setAutomationMessage('Đợt kiểm thử đang chọn chưa có giao dịch kiểm thử để chạy tự động.');
      return;
    }

    setAutomationMessage('Đang gửi yêu cầu chạy Playwright lên GitHub Actions...');
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
          transactionCodes: automatedCases.map((testCase) => testCase.code)
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

      setAutomationMessage(`Đã gửi yêu cầu chạy thật cho ${automatedCases.length}/${uniqueAutomatedCases.length} giao dịch qua ${payload.dispatchMode ?? 'GitHub Actions'}. Theo dõi tại ${payload.workflowUrl}. Minh chứng sẽ nằm trong artifact "${payload.evidenceLocation}".`);
      setTimeout(() => {
        void refreshAutomationStatus();
      }, 3000);
    } catch (error) {
      setAutomationMessage(`Không gọi được automation runner: ${error instanceof Error ? error.message : 'lỗi không xác định'}`);
    }
  }

  async function refreshAutomationStatus() {
    setAutomationStatusMessage('Đang cập nhật kết quả từ GitHub Actions...');
    try {
      const response = await fetch('/.netlify/functions/automation-status');
      const payload = await response.json() as { runs?: AutomationRunStatus[]; error?: string; detail?: string; requiredEnv?: string[] };
      if (!response.ok) {
        const requiredEnv = payload.requiredEnv?.length ? ` Cần cấu hình Netlify env: ${payload.requiredEnv.join(', ')}.` : '';
        setAutomationStatusMessage(`Chưa đọc được kết quả automation: ${payload.error ?? response.statusText}. ${payload.detail ?? ''}${requiredEnv}`);
        return;
      }
      setAutomationRuns(payload.runs ?? []);
      setAutomationStatusMessage((payload.runs ?? []).length ? 'Đã cập nhật kết quả automation mới nhất.' : 'Chưa có lần chạy automation nào.');
    } catch (error) {
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
      const mammoth = await import('mammoth/mammoth.browser');
      const extracted = await mammoth.extractRawText({ arrayBuffer: await file.arrayBuffer() });
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
      if (selectedRun) onUpdateRunScope(selectedRun.id, [...new Set([...scopedRunIds, ...importedUseCaseIds])]);
      setRunForm((current) => ({ ...current, useCaseIds: [...new Set([...current.useCaseIds, ...importedUseCaseIds])] }));
      setImportMessage(`Đã import ${importedUseCaseIds.size} UC và ${importedCount} giao dịch kiểm thử từ file ${file.name}.`);
      event.target.value = '';
    } catch (error) {
      setImportMessage(`Không import được file Word: ${error instanceof Error ? error.message : 'lỗi không xác định'}`);
      event.target.value = '';
    }
  }

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

        {selectedRun && (
          <section className="entry-form">
            <h3>Cập nhật phạm vi UC của đợt đang chọn</h3>
            <fieldset className="checkbox-list">
              <legend>{selectedRun.code}</legend>
              {useCases.map((useCase) => (
                <label key={useCase.id}>
                  <input type="checkbox" checked={scopedRunIds.includes(useCase.id)} onChange={(event) => onUpdateRunScope(selectedRun.id, toggleValue(scopedRunIds, useCase.id, event.target.checked))} />
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
            <label>Số ca tối đa mỗi lượt<input type="number" min="1" max="50" value={automationForm.maxCases} onChange={(event) => setAutomationForm({ ...automationForm, maxCases: event.target.value })} /></label>
            <label>Bộ script tự động<select value={automationForm.suiteTag} onChange={(event) => setAutomationForm({ ...automationForm, suiteTag: event.target.value })}><option value="@suite:scenario">Kịch bản Word - chạy từng bước và đối chiếu mong đợi</option><option value="@suite:smoke">Smoke - kiểm tra URL hệ thống phản hồi</option><option value="">Tất cả script tự động đã cấu hình</option></select></label>
            <label>Ghi chú dữ liệu kiểm thử<textarea value={automationForm.note} onChange={(event) => setAutomationForm({ ...automationForm, note: event.target.value })} placeholder="Ví dụ: dùng dữ liệu test, không dùng dữ liệu thật" /></label>
            <button type="submit">Gửi yêu cầu chạy Playwright thật</button>
            {automationMessage && <p className="form-note">{automationMessage}</p>}
            <button className="secondary-action" type="button" onClick={refreshAutomationStatus}>Cập nhật kết quả mới nhất</button>
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
                              <span>{result.title}</span>
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
    const raw = window.localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : initialValue;
  });

  useEffect(() => {
    window.localStorage.setItem(key, JSON.stringify(value));
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
