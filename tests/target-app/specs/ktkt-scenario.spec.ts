import { test } from '@playwright/test';
import { loadTargetScenarios } from '../utils/scenarioLoader';
import { runTargetScenario } from '../utils/targetScenarioRunner';

const scenarios = loadTargetScenarios();

test.describe('@project:KTKT @module:scenario @suite:scenario', () => {
  for (const scenario of scenarios) {
    test(`${scenario.useCaseCode} | ${scenario.id} | ${scenario.title}`, async ({ page }, testInfo) => {
      await runTargetScenario(page, scenario, testInfo);
    });
  }
});
