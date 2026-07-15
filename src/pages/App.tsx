import {
  Activity,
  Archive,
  Bug,
  CheckCircle2,
  FileCheck2,
  GitBranch,
  LockKeyhole,
  PlayCircle,
  ShieldCheck
} from 'lucide-react';
import { useMemo, useState } from 'react';
import { Badge } from '../components/Badge';
import { DataTable } from '../components/DataTable';
import { MetricCard } from '../components/MetricCard';
import {
  applicationVersions,
  auditLogs,
  automationScripts,
  defects,
  environments,
  evidence,
  projects,
  scenarios,
  testCases,
  testResults,
  testRuns,
  useCases
} from '../services/mockData';
import { calculateMetrics, statusTone } from '../services/metrics';
import { dataMode } from '../services/supabaseClient';
import type { TestCase, TestResult } from '../types/domain';

type Tab = 'dashboard' | 'rtm' | 'runs' | 'defects' | 'evidence';

const tabs: { id: Tab; label: string }[] = [
  { id: 'dashboard', label: 'Dashboard' },
  { id: 'rtm', label: 'RTM' },
  { id: 'runs', label: 'Test Run' },
  { id: 'defects', label: 'Defect' },
  { id: 'evidence', label: 'Evidence & Audit' }
];

export function App() {
  const [activeTab, setActiveTab] = useState<Tab>('dashboard');
  const metrics = useMemo(() => calculateMetrics(useCases, testCases, testResults), []);
  const activeRun = testRuns[0];
  const activeProject = projects[0];
  const environment = environments.find((item) => item.id === activeRun.environmentId);
  const version = applicationVersions.find((item) => item.id === activeRun.applicationVersionId);

  return (
    <main className="app-shell">
      <aside className="sidebar">
        <div className="brand">
          <ShieldCheck aria-hidden size={28} />
          <div>
            <strong>UC Test Platform</strong>
            <span>Baseline v2.0.0</span>
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
          <strong>{dataMode === 'supabase' ? 'Supabase' : 'Mock pilot'}</strong>
          <span>RLS bắt buộc khi dùng Supabase thật</span>
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
            <Badge tone="warning">{activeRun.status}</Badge>
          </div>
        </header>

        {activeTab === 'dashboard' && <Dashboard metrics={metrics} />}
        {activeTab === 'rtm' && <RtmView />}
        {activeTab === 'runs' && <RunsView />}
        {activeTab === 'defects' && <DefectsView />}
        {activeTab === 'evidence' && <EvidenceView />}
      </section>
    </main>
  );
}

function Dashboard({ metrics }: { metrics: ReturnType<typeof calculateMetrics> }) {
  return (
    <div className="stack">
      <div className="metrics-grid">
        <MetricCard label="Coverage UC" value={`${metrics.ucCoverage}%`} hint={`${useCases.length} UC, ${testCases.length} Test Case`} icon={<FileCheck2 size={22} />} />
        <MetricCard label="Đã chạy" value={`${metrics.executedRate}%`} hint="Không tính Not Run" icon={<PlayCircle size={22} />} />
        <MetricCard label="Pass rate" value={`${metrics.passRate}%`} hint="Pass trên kết quả đã thực hiện" icon={<CheckCircle2 size={22} />} />
        <MetricCard label="Tự động hóa" value={`${metrics.automationRate}%`} hint="Test Case đã có script duyệt" icon={<GitBranch size={22} />} />
      </div>

      <section className="panel">
        <div className="panel-heading">
          <div>
            <p>Tình trạng kết quả</p>
            <h2>RUN-20260715-001</h2>
          </div>
          <Activity aria-hidden />
        </div>
        <div className="status-grid">
          {Object.entries(metrics.statusCounts).map(([status, count]) => (
            <div key={status} className="status-cell">
              <span>{status}</span>
              <strong>{count}</strong>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

function RtmView() {
  return (
    <section className="panel">
      <div className="panel-heading">
        <div>
          <p>Requirement Traceability Matrix</p>
          <h2>UC -> Scenario -> Test Case -> Script -> Result</h2>
        </div>
        <FileCheck2 aria-hidden />
      </div>
      <DataTable
        columns={['UC', 'Scenario', 'Test Case', 'Automation', 'Latest Result']}
        rows={testCases}
        renderRow={(testCase) => {
          const useCaseCodes = testCase.useCaseIds.map((id) => useCases.find((item) => item.id === id)?.code).join(', ');
          const scenario = scenarios.find((item) => item.id === testCase.scenarioId);
          const script = automationScripts.find((item) => item.testCaseId === testCase.id);
          const result = latestResultFor(testCase);
          return (
            <tr key={testCase.id}>
              <td>{useCaseCodes}</td>
              <td>{scenario?.code}</td>
              <td>
                <strong>{testCase.code}</strong>
                <span>{testCase.title}</span>
              </td>
              <td>
                <Badge tone={script ? 'success' : 'neutral'}>{testCase.automationStatus}</Badge>
                <span>{script?.path ?? 'Manual only'}</span>
              </td>
              <td>{result ? <Badge tone={statusTone(result.status)}>{result.status}</Badge> : <Badge>Not Run</Badge>}</td>
            </tr>
          );
        }}
      />
    </section>
  );
}

function RunsView() {
  return (
    <section className="panel">
      <div className="panel-heading">
        <div>
          <p>Điều phối kiểm thử</p>
          <h2>Test Run và kết quả chi tiết</h2>
        </div>
        <LockKeyhole aria-hidden />
      </div>
      <div className="callout">
        <strong>Chính sách khóa run:</strong>
        <span>Run đã khóa chỉ được điều chỉnh bằng biên bản/version mới và phải ghi audit log.</span>
      </div>
      <DataTable
        columns={['Test Case', 'Status', 'Runner', 'Actual Result', 'Commit', 'Retry']}
        rows={testResults}
        renderRow={(result) => {
          const testCase = testCases.find((item) => item.id === result.testCaseId);
          return (
            <tr key={result.id}>
              <td>
                <strong>{testCase?.code}</strong>
                <span>{testCase?.title}</span>
              </td>
              <td>
                <Badge tone={statusTone(result.status)}>{result.status}</Badge>
              </td>
              <td>{result.runnerType}</td>
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

function DefectsView() {
  return (
    <section className="panel">
      <div className="panel-heading">
        <div>
          <p>Quản lý lỗi</p>
          <h2>Defect liên kết với kết quả Fail</h2>
        </div>
        <Bug aria-hidden />
      </div>
      <DataTable
        columns={['Mã lỗi', 'Tiêu đề', 'Severity', 'Priority', 'Status', 'Result']}
        rows={defects}
        renderRow={(defect) => (
          <tr key={defect.id}>
            <td><strong>{defect.code}</strong></td>
            <td>{defect.title}</td>
            <td><Badge tone="danger">{defect.severity}</Badge></td>
            <td>{defect.priority}</td>
            <td><Badge tone="warning">{defect.status}</Badge></td>
            <td>{defect.linkedResultIds.join(', ')}</td>
          </tr>
        )}
      />
    </section>
  );
}

function EvidenceView() {
  return (
    <div className="stack">
      <section className="panel">
        <div className="panel-heading">
          <div>
            <p>Minh chứng kỹ thuật</p>
            <h2>Checksum, storage path và loại hiện vật</h2>
          </div>
          <Archive aria-hidden />
        </div>
        <DataTable
          columns={['File', 'Loại', 'Checksum', 'Storage path']}
          rows={evidence}
          renderRow={(item) => (
            <tr key={item.id}>
              <td><strong>{item.fileName}</strong></td>
              <td>{item.type}</td>
              <td>{item.checksum}</td>
              <td>{item.storagePath}</td>
            </tr>
          )}
        />
      </section>

      <section className="panel">
        <div className="panel-heading">
          <div>
            <p>Audit log</p>
            <h2>Truy nguyên thay đổi quan trọng</h2>
          </div>
          <ShieldCheck aria-hidden />
        </div>
        <DataTable
          columns={['Thời điểm', 'Actor', 'Action', 'Entity']}
          rows={auditLogs}
          renderRow={(log) => (
            <tr key={log.id}>
              <td>{new Date(log.createdAt).toLocaleString('vi-VN')}</td>
              <td>{log.actor}</td>
              <td><Badge tone="info">{log.action}</Badge></td>
              <td>{log.entity}:{log.entityId}</td>
            </tr>
          )}
        />
      </section>
    </div>
  );
}

function latestResultFor(testCase: TestCase): TestResult | undefined {
  return testResults
    .filter((result) => result.testCaseId === testCase.id)
    .sort((left, right) => new Date(right.executedAt).getTime() - new Date(left.executedAt).getTime())[0];
}
