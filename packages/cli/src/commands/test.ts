import * as path from "path";
import * as fs from "fs";
import chalk from "chalk";
import ora from "ora";

// ─────────────────────────────────────────────
// cforge test [agent-dir]
// ─────────────────────────────────────────────

export async function commandTest(agentDir?: string): Promise<void> {
  const { parseAgentFile, parseTestFile, runTestSuite, findAgentFile } =
    await import("@clayton-forge/core");

  // 1. Find agent.yaml
  const searchDir = agentDir ? path.resolve(agentDir) : process.cwd();
  const agentYamlPath = fs.existsSync(path.join(searchDir, "agent.yaml"))
    ? path.join(searchDir, "agent.yaml")
    : findAgentFile(searchDir);

  if (!agentYamlPath) {
    console.error(chalk.red("✗ No agent.yaml found."));
    process.exit(1);
  }

  // 2. Parse agent
  let agent: Awaited<ReturnType<typeof parseAgentFile>>;
  try {
    agent = parseAgentFile(agentYamlPath);
  } catch (err) {
    console.error(chalk.red("✗ Invalid agent.yaml:"), err instanceof Error ? err.message : err);
    process.exit(1);
  }

  // 3. Find test files
  const agentDir2 = path.dirname(agentYamlPath);
  const testFiles = (agent.tests ?? []).map((t) => path.resolve(agentDir2, t.file));

  // Fallback: tenta agent.test.yaml se não há tests declarados
  if (testFiles.length === 0) {
    const fallback = path.join(agentDir2, "agent.test.yaml");
    if (fs.existsSync(fallback)) testFiles.push(fallback);
  }

  if (testFiles.length === 0) {
    console.error(chalk.red("✗ No test files found. Create agent.test.yaml first."));
    process.exit(1);
  }

  console.log("");
  console.log(chalk.bold.cyan(`  ⚗  Testing: ${agent.name}`) + chalk.gray(` v${agent.version}`));
  console.log(chalk.gray(`  Provider: ${agent.llm.provider}${agent.llm.model ? ` / ${agent.llm.model}` : ""}`));
  console.log("");

  let totalPassed = 0;
  let totalFailed = 0;

  for (const testFile of testFiles) {
    // 4. Parse test suite
    let suite: Awaited<ReturnType<typeof parseTestFile>>;
    try {
      suite = parseTestFile(testFile);
    } catch (err) {
      console.error(chalk.red(`✗ Invalid test file ${testFile}:`), err instanceof Error ? err.message : err);
      continue;
    }

    console.log(chalk.gray(`  File: ${path.basename(testFile)}`));
    console.log(chalk.gray(`  Cases: ${suite.cases.length}`));
    console.log("");

    // 5. Run
    const spinner = ora("Running tests...").start();
    const summary = await runTestSuite(agent, suite);
    spinner.stop();

    // 6. Display results
    for (const result of summary.results) {
      if (result.passed) {
        console.log(
          chalk.green("  ✓ PASS") +
            chalk.white(` ${result.name}`) +
            chalk.gray(` (${result.duration_ms}ms)`)
        );
      } else {
        console.log(
          chalk.red("  ✗ FAIL") +
            chalk.white(` ${result.name}`) +
            chalk.gray(` (${result.duration_ms}ms)`)
        );
        for (const failure of result.failures) {
          console.log(chalk.red("       ↳ " + failure));
        }
        if (result.error) {
          console.log(chalk.red("       Error: " + result.error));
        }
      }
    }

    totalPassed += summary.passed;
    totalFailed += summary.failed;

    console.log("");
    console.log(
      chalk.gray("  ─────────────────────────────────────")
    );

    const statusColor = summary.failed === 0 ? chalk.green : chalk.red;
    console.log(
      statusColor(
        `  ${summary.passed}/${summary.total} passed`
      ) +
        chalk.gray(` · ${summary.duration_ms}ms`)
    );
  }

  console.log("");

  // Final exit code
  if (totalFailed > 0) {
    process.exit(1);
  }
}
