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
import type { Defect, Evidence, ResultStatus, TestCase, TestResult, TestRun } from '../types/domain';

type Tab = 'dashboard' | 'rtm' | 'runs' | 'defects' | 'evidence';

const tabs: { id: Tab; label: string }[] = [
  { id: 'dashboard', label: 'Bảng điều khiển' },
  { id: 'rtm', label: 'Ma trận truy vết' },
  { id: 'runs', label: 'Đợt kiểm thử' },
  { id: 'defects', label: 'Lỗi' },
  { id: 'evidence', label: 'Minh chứng & nhật ký' }
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
          <strong>{dataMode === 'supabase' ? 'Supabase' : 'Dữ liệu mẫu'}</strong>
          <span>Bắt buộc bật RLS khi dùng Supabase thật</span>
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
            <Badge tone="warning">{runStatusLabel(activeRun.status)}</Badge>
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
        <MetricCard label="Độ phủ UC" value={`${metrics.ucCoverage}%`} hint={`${useCases.length} UC, ${testCases.length} ca kiểm thử`} icon={<FileCheck2 size={22} />} />
        <MetricCard label="Đã thực hiện" value={`${metrics.executedRate}%`} hint="Không tính trạng thái chưa chạy" icon={<PlayCircle size={22} />} />
        <MetricCard label="Tỷ lệ đạt" value={`${metrics.passRate}%`} hint="Đạt trên kết quả đã thực hiện" icon={<CheckCircle2 size={22} />} />
        <MetricCard label="Tự động hóa" value={`${metrics.automationRate}%`} hint="Ca kiểm thử đã có script duyệt" icon={<GitBranch size={22} />} />
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
              <span>{resultStatusLabel(status as ResultStatus)}</span>
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

function RunsView() {
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

function DefectsView() {
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

function EvidenceView() {
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

function latestResultFor(testCase: TestCase): TestResult | undefined {
  return testResults
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
    LOCK_TEST_RUN: 'Khóa đợt kiểm thử',
    INGEST_AUTOMATION_RESULT: 'Nhận kết quả tự động',
    CREATE_DEFECT: 'Tạo lỗi'
  };
  return labels[action] ?? action;
}
