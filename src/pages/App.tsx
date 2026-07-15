import {
  Activity,
  Archive,
  Bug,
  CheckCircle2,
  Database,
  FileCheck2,
  GitBranch,
  LockKeyhole,
  PlayCircle,
  ShieldCheck
} from 'lucide-react';
import { type Dispatch, type FormEvent, type SetStateAction, useEffect, useMemo, useState } from 'react';
import { Badge } from '../components/Badge';
import { DataTable } from '../components/DataTable';
import { MetricCard } from '../components/MetricCard';
import {
  applicationVersions,
  auditLogs as initialAuditLogs,
  automationScripts,
  defects as initialDefects,
  environments,
  evidence,
  projects,
  scenarios as initialScenarios,
  testCases as initialTestCases,
  testResults as initialTestResults,
  testRuns as initialTestRuns,
  useCases as initialUseCases
} from '../services/mockData';
import { calculateMetrics, statusTone } from '../services/metrics';
import { dataMode } from '../services/supabaseClient';
import type { AuditLog, Defect, Evidence, ResultStatus, TestCase, TestResult, TestRun, TestScenario, UseCase } from '../types/domain';

type Tab = 'dashboard' | 'rtm' | 'runs' | 'defects' | 'evidence' | 'entry';

const tabs: { id: Tab; label: string }[] = [
  { id: 'dashboard', label: 'Bảng điều khiển' },
  { id: 'rtm', label: 'Ma trận truy vết' },
  { id: 'runs', label: 'Đợt kiểm thử' },
  { id: 'defects', label: 'Lỗi' },
  { id: 'evidence', label: 'Minh chứng & nhật ký' },
  { id: 'entry', label: 'Nhập dữ liệu' }
];

export function App() {
  const [activeTab, setActiveTab] = useState<Tab>('dashboard');
  const [useCaseRows, setUseCaseRows] = useStoredState('uc-platform-use-cases', initialUseCases);
  const [scenarioRows, setScenarioRows] = useStoredState('uc-platform-scenarios', initialScenarios);
  const [testCaseRows, setTestCaseRows] = useStoredState('uc-platform-test-cases', initialTestCases);
  const [testRunRows, setTestRunRows] = useStoredState('uc-platform-test-runs', initialTestRuns);
  const [resultRows, setResultRows] = useStoredState('uc-platform-test-results', initialTestResults);
  const [defectRows, setDefectRows] = useStoredState('uc-platform-defects', initialDefects);
  const [auditRows, setAuditRows] = useStoredState('uc-platform-audit-logs', initialAuditLogs);

  const metrics = useMemo(() => calculateMetrics(useCaseRows, testCaseRows, resultRows), [useCaseRows, testCaseRows, resultRows]);
  const activeRun = testRunRows[0];
  const activeProject = projects[0];
  const environment = activeRun ? environments.find((item) => item.id === activeRun.environmentId) : environments[0];
  const version = activeRun ? applicationVersions.find((item) => item.id === activeRun.applicationVersionId) : applicationVersions[0];

  function addAudit(action: string, entity: string, entityId: string) {
    setAuditRows((current) => [
      {
        id: createId('audit'),
        actor: 'local-demo-user',
        action,
        entity,
        entityId,
        createdAt: new Date().toISOString()
      },
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
            <span>Bản nền v2.0.0</span>
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
          <span>Dữ liệu nhập hiện lưu trong localStorage cho bản demo</span>
        </div>
      </aside>

      <section className="content">
        <header className="topbar">
          <div>
            <p>{activeProject.code}</p>
            <h1>{activeProject.name}</h1>
          </div>
          <div className="run-summary">
            <Badge tone="info">{environment?.code}</Badge>
            <Badge tone="success">{version?.version}</Badge>
            {activeRun && <Badge tone="warning">{runStatusLabel(activeRun.status)}</Badge>}
          </div>
        </header>

        {activeTab === 'dashboard' && <Dashboard metrics={metrics} useCases={useCaseRows} testCases={testCaseRows} />}
        {activeTab === 'rtm' && <RtmView useCases={useCaseRows} scenarios={scenarioRows} testCases={testCaseRows} results={resultRows} />}
        {activeTab === 'runs' && <RunsView testCases={testCaseRows} results={resultRows} />}
        {activeTab === 'defects' && <DefectsView defects={defectRows} />}
        {activeTab === 'evidence' && <EvidenceView auditLogs={auditRows} />}
        {activeTab === 'entry' && (
          <EntryView
            useCases={useCaseRows}
            testCases={testCaseRows}
            testRuns={testRunRows}
            results={resultRows}
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
              addAudit('CREATE_TEST_RUN', 'test_runs', row.id);
            }}
            onAddResult={(row) => {
              setResultRows((current) => [row, ...current]);
              addAudit('CREATE_MANUAL_RESULT', 'test_results', row.id);
            }}
            onAddDefect={(row) => {
              setDefectRows((current) => [row, ...current]);
              addAudit('CREATE_DEFECT', 'defects', row.id);
            }}
            onReset={() => {
              setUseCaseRows(initialUseCases);
              setScenarioRows(initialScenarios);
              setTestCaseRows(initialTestCases);
              setTestRunRows(initialTestRuns);
              setResultRows(initialTestResults);
              setDefectRows(initialDefects);
              setAuditRows(initialAuditLogs);
            }}
          />
        )}
      </section>
    </main>
  );
}

function Dashboard({ metrics, useCases, testCases }: { metrics: ReturnType<typeof calculateMetrics>; useCases: UseCase[]; testCases: TestCase[] }) {
  return (
    <div className="stack">
      <div className="metrics-grid">
        <MetricCard label="Độ phủ UC" value={`${metrics.ucCoverage}%`} hint={`${useCases.length} UC, ${testCases.length} ca kiểm thử`} icon={<FileCheck2 size={22} />} />
        <MetricCard label="Đã thực hiện" value={`${metrics.executedRate}%`} hint="Không tính trạng thái chưa chạy" icon={<PlayCircle size={22} />} />
        <MetricCard label="Tỷ lệ đạt" value={`${metrics.passRate}%`} hint="Đạt trên kết quả đã thực hiện" icon={<CheckCircle2 size={22} />} />
        <MetricCard label="Tự động hóa" value={`${metrics.automationRate}%`} hint="Ca kiểm thử đã có script duyệt" icon={<GitBranch size={22} />} />
      </div>

      <section className="panel">
        <div className="panel-heading">
          <div>
            <p>Tình trạng kết quả</p>
            <h2>Thống kê toàn bộ dữ liệu hiện có</h2>
          </div>
          <Activity aria-hidden />
        </div>
        <div className="status-grid">
          {Object.entries(metrics.statusCounts).map(([status, count]) => (
            <div key={status} className="status-cell">
              <span>{resultStatusLabel(status as ResultStatus)}</span>
              <strong>{count}</strong>
            </div>
          ))}
        </div>
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
          <h2>UC / Tình huống / Ca kiểm thử / Script / Kết quả</h2>
        </div>
        <FileCheck2 aria-hidden />
      </div>
      <DataTable
        columns={['UC', 'Tình huống', 'Ca kiểm thử', 'Tự động hóa', 'Kết quả mới nhất']}
        rows={testCases}
        renderRow={(testCase) => {
          const useCaseCodes = testCase.useCaseIds.map((id) => useCases.find((item) => item.id === id)?.code).join(', ');
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
          <p>Điều phối kiểm thử</p>
          <h2>Đợt kiểm thử và kết quả chi tiết</h2>
        </div>
        <LockKeyhole aria-hidden />
      </div>
      <div className="callout">
        <strong>Chính sách khóa đợt kiểm thử:</strong>
        <span>Đợt kiểm thử đã khóa chỉ được điều chỉnh bằng biên bản/phiên bản mới và phải ghi nhật ký kiểm toán.</span>
      </div>
      <DataTable
        columns={['Ca kiểm thử', 'Trạng thái', 'Cách chạy', 'Kết quả thực tế', 'Commit', 'Số lần chạy lại']}
        rows={results}
        renderRow={(result) => {
          const testCase = testCases.find((item) => item.id === result.testCaseId);
          return (
            <tr key={result.id}>
              <td>
                <strong>{testCase?.code}</strong>
                <span>{testCase?.title}</span>
              </td>
              <td>
                <Badge tone={statusTone(result.status)}>{resultStatusLabel(result.status)}</Badge>
              </td>
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
          <h2>Lỗi liên kết với kết quả không đạt</h2>
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
  useCases: UseCase[];
  testCases: TestCase[];
  testRuns: TestRun[];
  results: TestResult[];
  onAddUseCase: (row: UseCase) => void;
  onAddTestCase: (testCase: TestCase, scenario: TestScenario) => void;
  onAddTestRun: (row: TestRun) => void;
  onAddResult: (row: TestResult) => void;
  onAddDefect: (row: Defect) => void;
  onReset: () => void;
}

function EntryView({ useCases, testCases, testRuns, results, onAddUseCase, onAddTestCase, onAddTestRun, onAddResult, onAddDefect, onReset }: EntryViewProps) {
  const [useCaseForm, setUseCaseForm] = useState({ code: nextCode('UC-NEW', useCases.length + 1), title: '', module: 'general' });
  const [testCaseForm, setTestCaseForm] = useState({ code: nextCode('TC-NEW', testCases.length + 1), title: '', useCaseId: useCases[0]?.id ?? '', expectedResult: '', steps: '', priority: 'P1' as TestCase['priority'], suite: 'functional' as TestCase['suite'], automationStatus: 'Manual' as TestCase['automationStatus'] });
  const [runForm, setRunForm] = useState({ code: `RUN-${new Date().toISOString().slice(0, 10).replace(/-/g, '')}-${String(testRuns.length + 1).padStart(3, '0')}`, suite: 'functional', status: 'Planning' as TestRun['status'] });
  const [resultForm, setResultForm] = useState({ testRunId: testRuns[0]?.id ?? '', testCaseId: testCases[0]?.id ?? '', status: 'Pass' as ResultStatus, actualResult: '' });
  const [defectForm, setDefectForm] = useState({ resultId: results.find((item) => item.status === 'Fail')?.id ?? results[0]?.id ?? '', title: '', severity: 'Medium' as Defect['severity'], priority: 'P1' as Defect['priority'] });

  function submitUseCase(event: FormEvent) {
    event.preventDefault();
    const id = createId('uc');
    onAddUseCase({
      id,
      projectId: projects[0].id,
      code: useCaseForm.code.trim(),
      title: useCaseForm.title.trim(),
      module: useCaseForm.module.trim(),
      approvedVersion: '1.0',
      status: 'Approved'
    });
    setUseCaseForm({ code: nextCode('UC-NEW', useCases.length + 2), title: '', module: 'general' });
  }

  function submitTestCase(event: FormEvent) {
    event.preventDefault();
    const testCaseId = createId('tc');
    const scenario: TestScenario = {
      id: createId('ts'),
      useCaseId: testCaseForm.useCaseId,
      code: nextCode('TS-NEW', Date.now() % 1000),
      title: `Tình huống cho ${testCaseForm.code}`,
      type: 'positive'
    };
    onAddTestCase(
      {
        id: testCaseId,
        code: testCaseForm.code.trim(),
        scenarioId: scenario.id,
        useCaseIds: [testCaseForm.useCaseId],
        title: testCaseForm.title.trim(),
        priority: testCaseForm.priority,
        suite: testCaseForm.suite,
        automationStatus: testCaseForm.automationStatus,
        expectedResult: testCaseForm.expectedResult.trim(),
        steps: testCaseForm.steps.split('\n').map((step) => step.trim()).filter(Boolean)
      },
      scenario
    );
    setTestCaseForm((current) => ({ ...current, code: nextCode('TC-NEW', testCases.length + 2), title: '', expectedResult: '', steps: '' }));
  }

  function submitRun(event: FormEvent) {
    event.preventDefault();
    onAddTestRun({
      id: createId('run'),
      code: runForm.code.trim(),
      projectId: projects[0].id,
      environmentId: environments[0].id,
      applicationVersionId: applicationVersions[0].id,
      suite: runForm.suite.trim(),
      status: runForm.status,
      startedAt: new Date().toISOString(),
      lockedAt: runForm.status === 'Locked' ? new Date().toISOString() : undefined
    });
    setRunForm((current) => ({ ...current, code: `RUN-${new Date().toISOString().slice(0, 10).replace(/-/g, '')}-${String(testRuns.length + 2).padStart(3, '0')}` }));
  }

  function submitResult(event: FormEvent) {
    event.preventDefault();
    onAddResult({
      id: createId('res'),
      testRunId: resultForm.testRunId,
      testCaseId: resultForm.testCaseId,
      status: resultForm.status,
      actualResult: resultForm.actualResult.trim(),
      runnerType: 'manual',
      commitSha: 'manual-local',
      durationMs: 0,
      executedAt: new Date().toISOString(),
      retryCount: 0
    });
    setResultForm((current) => ({ ...current, actualResult: '' }));
  }

  function submitDefect(event: FormEvent) {
    event.preventDefault();
    onAddDefect({
      id: createId('def'),
      code: `DEF-KTKT-${String(Date.now()).slice(-4)}`,
      projectId: projects[0].id,
      title: defectForm.title.trim(),
      severity: defectForm.severity,
      priority: defectForm.priority,
      status: 'Open',
      linkedResultIds: [defectForm.resultId],
      foundInVersion: applicationVersions[0].version
    });
    setDefectForm((current) => ({ ...current, title: '' }));
  }

  return (
    <div className="stack">
      <section className="panel">
        <div className="panel-heading">
          <div>
            <p>Nhập dữ liệu vận hành</p>
            <h2>Tạo UC, ca kiểm thử, đợt chạy, kết quả và lỗi</h2>
          </div>
          <Database aria-hidden />
        </div>
        <div className="callout">
          <strong>Lưu ý:</strong>
          <span>Dữ liệu nhập ở bản demo được lưu trong trình duyệt của bạn. Khi nối Supabase, các form này sẽ ghi vào cơ sở dữ liệu thật.</span>
        </div>
        <button className="secondary-action" type="button" onClick={onReset}>Khôi phục dữ liệu mẫu</button>
      </section>

      <div className="form-grid">
        <form className="entry-form" onSubmit={submitUseCase}>
          <h3>Thêm Use Case</h3>
          <label>Mã UC<input value={useCaseForm.code} onChange={(event) => setUseCaseForm({ ...useCaseForm, code: event.target.value })} required /></label>
          <label>Tên UC<input value={useCaseForm.title} onChange={(event) => setUseCaseForm({ ...useCaseForm, title: event.target.value })} required /></label>
          <label>Phân hệ<input value={useCaseForm.module} onChange={(event) => setUseCaseForm({ ...useCaseForm, module: event.target.value })} required /></label>
          <button type="submit">Lưu UC</button>
        </form>

        <form className="entry-form" onSubmit={submitTestCase}>
          <h3>Thêm ca kiểm thử</h3>
          <label>Mã ca kiểm thử<input value={testCaseForm.code} onChange={(event) => setTestCaseForm({ ...testCaseForm, code: event.target.value })} required /></label>
          <label>Tên ca kiểm thử<input value={testCaseForm.title} onChange={(event) => setTestCaseForm({ ...testCaseForm, title: event.target.value })} required /></label>
          <label>UC liên kết<select value={testCaseForm.useCaseId} onChange={(event) => setTestCaseForm({ ...testCaseForm, useCaseId: event.target.value })} required>{useCases.map((useCase) => <option key={useCase.id} value={useCase.id}>{useCase.code} - {useCase.title}</option>)}</select></label>
          <label>Kết quả mong đợi<textarea value={testCaseForm.expectedResult} onChange={(event) => setTestCaseForm({ ...testCaseForm, expectedResult: event.target.value })} required /></label>
          <label>Các bước thực hiện<textarea value={testCaseForm.steps} onChange={(event) => setTestCaseForm({ ...testCaseForm, steps: event.target.value })} placeholder="Mỗi dòng là một bước" /></label>
          <div className="inline-fields">
            <label>Ưu tiên<select value={testCaseForm.priority} onChange={(event) => setTestCaseForm({ ...testCaseForm, priority: event.target.value as TestCase['priority'] })}><option>P0</option><option>P1</option><option>P2</option><option>P3</option></select></label>
            <label>Bộ kiểm thử<select value={testCaseForm.suite} onChange={(event) => setTestCaseForm({ ...testCaseForm, suite: event.target.value as TestCase['suite'] })}><option value="smoke">Smoke</option><option value="functional">Functional</option><option value="regression">Regression</option></select></label>
          </div>
          <label>Trạng thái tự động hóa<select value={testCaseForm.automationStatus} onChange={(event) => setTestCaseForm({ ...testCaseForm, automationStatus: event.target.value as TestCase['automationStatus'] })}><option value="Manual">Thủ công</option><option value="Candidate">Ứng viên tự động hóa</option><option value="Automated">Đã tự động hóa</option><option value="Blocked">Bị chặn</option></select></label>
          <button type="submit">Lưu ca kiểm thử</button>
        </form>

        <form className="entry-form" onSubmit={submitRun}>
          <h3>Tạo đợt kiểm thử</h3>
          <label>Mã đợt kiểm thử<input value={runForm.code} onChange={(event) => setRunForm({ ...runForm, code: event.target.value })} required /></label>
          <label>Bộ kiểm thử<input value={runForm.suite} onChange={(event) => setRunForm({ ...runForm, suite: event.target.value })} required /></label>
          <label>Trạng thái<select value={runForm.status} onChange={(event) => setRunForm({ ...runForm, status: event.target.value as TestRun['status'] })}><option value="Planning">Đang lập kế hoạch</option><option value="Running">Đang chạy</option><option value="Completed">Hoàn tất</option><option value="Locked">Đã khóa</option></select></label>
          <button type="submit">Tạo đợt kiểm thử</button>
        </form>

        <form className="entry-form" onSubmit={submitResult}>
          <h3>Ghi kết quả thủ công</h3>
          <label>Đợt kiểm thử<select value={resultForm.testRunId} onChange={(event) => setResultForm({ ...resultForm, testRunId: event.target.value })} required>{testRuns.map((run) => <option key={run.id} value={run.id}>{run.code}</option>)}</select></label>
          <label>Ca kiểm thử<select value={resultForm.testCaseId} onChange={(event) => setResultForm({ ...resultForm, testCaseId: event.target.value })} required>{testCases.map((testCase) => <option key={testCase.id} value={testCase.id}>{testCase.code} - {testCase.title}</option>)}</select></label>
          <label>Trạng thái<select value={resultForm.status} onChange={(event) => setResultForm({ ...resultForm, status: event.target.value as ResultStatus })}><option value="Pass">Đạt</option><option value="Fail">Không đạt</option><option value="Blocked">Bị chặn</option><option value="Not Run">Chưa chạy</option><option value="Flaky">Không ổn định</option><option value="Infrastructure Error">Lỗi hạ tầng</option></select></label>
          <label>Kết quả thực tế<textarea value={resultForm.actualResult} onChange={(event) => setResultForm({ ...resultForm, actualResult: event.target.value })} required /></label>
          <button type="submit">Lưu kết quả</button>
        </form>

        <form className="entry-form" onSubmit={submitDefect}>
          <h3>Tạo lỗi</h3>
          <label>Kết quả liên kết<select value={defectForm.resultId} onChange={(event) => setDefectForm({ ...defectForm, resultId: event.target.value })} required>{results.map((result) => <option key={result.id} value={result.id}>{resultStatusLabel(result.status)} - {result.actualResult}</option>)}</select></label>
          <label>Tiêu đề lỗi<input value={defectForm.title} onChange={(event) => setDefectForm({ ...defectForm, title: event.target.value })} required /></label>
          <div className="inline-fields">
            <label>Mức độ<select value={defectForm.severity} onChange={(event) => setDefectForm({ ...defectForm, severity: event.target.value as Defect['severity'] })}><option value="Critical">Nghiêm trọng</option><option value="High">Cao</option><option value="Medium">Trung bình</option><option value="Low">Thấp</option></select></label>
            <label>Ưu tiên<select value={defectForm.priority} onChange={(event) => setDefectForm({ ...defectForm, priority: event.target.value as Defect['priority'] })}><option>P0</option><option>P1</option><option>P2</option><option>P3</option></select></label>
          </div>
          <button type="submit">Tạo lỗi</button>
        </form>
      </div>
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

function createId(prefix: string): string {
  return `${prefix}-${crypto.randomUUID ? crypto.randomUUID() : Date.now().toString(36)}`;
}

function nextCode(prefix: string, value: number): string {
  return `${prefix}-${String(value).padStart(3, '0')}`;
}

function latestResultFor(testCase: TestCase, results: TestResult[]): TestResult | undefined {
  return results
    .filter((result) => result.testCaseId === testCase.id)
    .sort((left, right) => new Date(right.executedAt).getTime() - new Date(left.executedAt).getTime())[0];
}

function resultStatusLabel(status: ResultStatus): string {
  const labels: Record<ResultStatus, string> = {
    Pass: 'Đạt',
    Fail: 'Không đạt',
    Blocked: 'Bị chặn',
    'Not Run': 'Chưa chạy',
    Flaky: 'Không ổn định',
    'Infrastructure Error': 'Lỗi hạ tầng'
  };
  return labels[status];
}

function automationStatusLabel(status: TestCase['automationStatus']): string {
  const labels: Record<TestCase['automationStatus'], string> = {
    Automated: 'Đã tự động hóa',
    Manual: 'Thủ công',
    Candidate: 'Ứng viên tự động hóa',
    Blocked: 'Bị chặn'
  };
  return labels[status];
}

function runnerTypeLabel(type: TestResult['runnerType']): string {
  return type === 'automation' ? 'Tự động' : 'Thủ công';
}

function runStatusLabel(status: TestRun['status']): string {
  const labels: Record<TestRun['status'], string> = {
    Planning: 'Đang lập kế hoạch',
    Running: 'Đang chạy',
    Completed: 'Hoàn tất',
    Locked: 'Đã khóa'
  };
  return labels[status];
}

function severityLabel(severity: Defect['severity']): string {
  const labels: Record<Defect['severity'], string> = {
    Critical: 'Nghiêm trọng',
    High: 'Cao',
    Medium: 'Trung bình',
    Low: 'Thấp'
  };
  return labels[severity];
}

function defectStatusLabel(status: Defect['status']): string {
  const labels: Record<Defect['status'], string> = {
    Open: 'Mở',
    'In Progress': 'Đang xử lý',
    Fixed: 'Đã sửa',
    Retest: 'Kiểm thử lại',
    Closed: 'Đã đóng',
    'Accepted Risk': 'Chấp nhận rủi ro'
  };
  return labels[status];
}

function evidenceTypeLabel(type: Evidence['type']): string {
  const labels: Record<Evidence['type'], string> = {
    screenshot: 'Ảnh chụp',
    video: 'Video',
    trace: 'Trace',
    log: 'Log',
    'html-report': 'Báo cáo HTML',
    junit: 'JUnit'
  };
  return labels[type];
}

function auditActionLabel(action: string): string {
  const labels: Record<string, string> = {
    CREATE_USE_CASE: 'Tạo UC',
    CREATE_TEST_CASE: 'Tạo ca kiểm thử',
    CREATE_TEST_RUN: 'Tạo đợt kiểm thử',
    CREATE_MANUAL_RESULT: 'Ghi kết quả thủ công',
    LOCK_TEST_RUN: 'Khóa đợt kiểm thử',
    INGEST_AUTOMATION_RESULT: 'Nhận kết quả tự động',
    CREATE_DEFECT: 'Tạo lỗi'
  };
  return labels[action] ?? action;
}
