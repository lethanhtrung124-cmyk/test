import type { ResultStatus, TestCase, TestResult, UseCase } from '../types/domain';
import type { BadgeTone } from '../components/Badge';

export interface CoverageMetrics {
  ucCoverage: number;
  executedRate: number;
  automationRate: number;
  passRate: number;
  statusCounts: Record<ResultStatus, number>;
}

const statuses: ResultStatus[] = ['Pass', 'Fail', 'Blocked', 'Not Run', 'Flaky', 'Infrastructure Error'];

export function calculateMetrics(useCases: UseCase[], testCases: TestCase[], results: TestResult[]): CoverageMetrics {
  const coveredUcIds = new Set(testCases.flatMap((testCase) => testCase.useCaseIds));
  const executedResults = results.filter((result) => result.status !== 'Not Run');
  const automatedCases = testCases.filter((testCase) => testCase.automationStatus === 'Automated');
  const statusCounts = statuses.reduce(
    (accumulator, status) => ({ ...accumulator, [status]: results.filter((result) => result.status === status).length }),
    {} as Record<ResultStatus, number>
  );

  return {
    ucCoverage: ratio(coveredUcIds.size, useCases.length),
    executedRate: ratio(executedResults.length, testCases.length),
    automationRate: ratio(automatedCases.length, testCases.length),
    passRate: ratio(statusCounts.Pass, Math.max(executedResults.length, 1)),
    statusCounts
  };
}

export function ratio(part: number, whole: number): number {
  if (whole === 0) return 0;
  return Math.round((part / whole) * 100);
}

export function statusTone(status: ResultStatus): BadgeTone {
  return {
    Pass: 'success',
    Fail: 'danger',
    Blocked: 'warning',
    'Not Run': 'neutral',
    Flaky: 'info',
    'Infrastructure Error': 'danger'
  }[status];
}
