import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

export interface TargetScenario {
  id: string;
  useCaseCode: string;
  title: string;
  steps: string[];
  expectedResult: string;
  precondition: string;
  source?: string;
}

interface ScenarioBundle {
  scenarios: TargetScenario[];
}

const defaultScenarioPath = resolve(process.cwd(), 'tests/target-app/scenarios/ktkt-scenarios.json');

export function loadTargetScenarios(): TargetScenario[] {
  const payloadScenarios = readPayloadScenarios();
  const fileScenarios = readScenarioFile();
  const scenarioById = new Map<string, TargetScenario>();

  for (const scenario of [...fileScenarios, ...payloadScenarios]) {
    scenarioById.set(normalizeScenarioId(scenario.id), {
      ...scenario,
      id: normalizeScenarioId(scenario.id),
      useCaseCode: normalizeScenarioId(scenario.useCaseCode)
    });
  }

  const requestedCodes = new Set(
    (process.env.TEST_TRANSACTION_CODES ?? '')
      .split(',')
      .map(normalizeScenarioId)
      .filter(Boolean)
  );
  const maxCases = clampMaxCases(process.env.TEST_MAX_CASES);

  const scenarios = [...scenarioById.values()];
  const selected = requestedCodes.size > 0 ? scenarios.filter((scenario) => requestedCodes.has(scenario.id)) : scenarios;
  return selected.slice(0, maxCases);
}

export function normalizeScenarioId(value: string): string {
  return value.trim().replace(/^\[/, '').replace(/\]$/, '').replace(/\s+/g, '').toUpperCase();
}

function readScenarioFile(): TargetScenario[] {
  const scenarioPath = process.env.TEST_SCENARIO_FILE ? resolve(process.cwd(), process.env.TEST_SCENARIO_FILE) : defaultScenarioPath;
  if (!existsSync(scenarioPath)) return [];
  const bundle = JSON.parse(readFileSync(scenarioPath, 'utf8')) as ScenarioBundle;
  return Array.isArray(bundle.scenarios) ? bundle.scenarios : [];
}

function readPayloadScenarios(): TargetScenario[] {
  if (!process.env.TEST_SCENARIOS_JSON) return [];
  try {
    const parsed = JSON.parse(process.env.TEST_SCENARIOS_JSON) as TargetScenario[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function clampMaxCases(value: string | undefined): number {
  const parsed = Number.parseInt(value || '10', 10);
  if (!Number.isFinite(parsed)) return 10;
  return Math.max(1, Math.min(parsed, 500));
}
