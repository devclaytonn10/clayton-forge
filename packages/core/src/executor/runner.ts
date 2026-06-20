import type { Agent, TestSuite, TestCase } from "../schema/agent.schema";
import { executeAgent } from "./executor";

// ─────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────

export interface TestResult {
  name: string;
  passed: boolean;
  output?: string;
  error?: string;
  duration_ms: number;
  failures: string[];
}

export interface TestRunSummary {
  total: number;
  passed: number;
  failed: number;
  duration_ms: number;
  results: TestResult[];
}

// ─────────────────────────────────────────────
// Runner
// ─────────────────────────────────────────────

export async function runTestSuite(
  agent: Agent,
  suite: TestSuite
): Promise<TestRunSummary> {
  const start = Date.now();
  const results: TestResult[] = [];

  for (const testCase of suite.cases) {
    const result = await runTestCase(agent, testCase);
    results.push(result);
  }

  const passed = results.filter((r) => r.passed).length;
  const failed = results.length - passed;

  return {
    total: results.length,
    passed,
    failed,
    duration_ms: Date.now() - start,
    results,
  };
}

async function runTestCase(agent: Agent, testCase: TestCase): Promise<TestResult> {
  const start = Date.now();
  const failures: string[] = [];

  try {
    const execution = await executeAgent(agent, { variables: testCase.input });

    if (!execution.success) {
      return {
        name: testCase.name,
        passed: false,
        error: execution.error,
        duration_ms: Date.now() - start,
        failures: [`Execution failed: ${execution.error}`],
      };
    }

    const output = execution.output;

    // Check expected_output (exact match)
    if (testCase.expected_output !== undefined) {
      if (output.trim() !== testCase.expected_output.trim()) {
        failures.push(
          `expected_output mismatch.\n  Expected: ${testCase.expected_output}\n  Got: ${output}`
        );
      }
    }

    // Check expected_contains
    if (testCase.expected_contains) {
      for (const phrase of testCase.expected_contains) {
        if (!output.includes(phrase)) {
          failures.push(`expected_contains: "${phrase}" not found in output`);
        }
      }
    }

    // Check expected_not_contains
    if (testCase.expected_not_contains) {
      for (const phrase of testCase.expected_not_contains) {
        if (output.includes(phrase)) {
          failures.push(`expected_not_contains: "${phrase}" found in output (should not be)`);
        }
      }
    }

    return {
      name: testCase.name,
      passed: failures.length === 0,
      output,
      duration_ms: Date.now() - start,
      failures,
    };
  } catch (error) {
    return {
      name: testCase.name,
      passed: false,
      error: error instanceof Error ? error.message : String(error),
      duration_ms: Date.now() - start,
      failures: [`Unexpected error: ${error}`],
    };
  }
}
