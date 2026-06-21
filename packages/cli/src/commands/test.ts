import * as path from "path";
import * as fs from "fs";
import chalk from "chalk";
import ora from "ora";
import { t } from "../lang";

export async function commandTest(agentDir?: string): Promise<void> {
  const tr = t();
  const { parseAgentFile, parseTestFile, runTestSuite, findAgentFile } =
    await import("clayton-forge-core");

  const searchDir = agentDir ? path.resolve(agentDir) : process.cwd();
  const agentYamlPath = fs.existsSync(path.join(searchDir, "agent.yaml"))
    ? path.join(searchDir, "agent.yaml")
    : findAgentFile(searchDir);

  if (!agentYamlPath) {
    console.error(chalk.red(tr.testNotFound));
    process.exit(1);
  }

  let agent: Awaited<ReturnType<typeof parseAgentFile>>;
  try {
    agent = parseAgentFile(agentYamlPath);
  } catch (err) {
    console.error(chalk.red(tr.testInvalidYaml), err instanceof Error ? err.message : err);
    process.exit(1);
  }

  const agentDir2 = path.dirname(agentYamlPath);
  const testFiles = (agent.tests ?? []).map((t) => path.resolve(agentDir2, t.file));

  if (testFiles.length === 0) {
    const fallback = path.join(agentDir2, "agent.test.yaml");
    if (fs.existsSync(fallback)) testFiles.push(fallback);
  }

  if (testFiles.length === 0) {
    console.error(chalk.red(tr.testNoFiles));
    process.exit(1);
  }

  console.log("");
  console.log(chalk.bold.cyan(`  ⚗  ${tr.testTesting} ${agent.name}`) + chalk.gray(` v${agent.version}`));
  console.log(chalk.gray(`  ${tr.testProvider} ${agent.llm.provider}${agent.llm.model ? ` / ${agent.llm.model}` : ""}`));
  console.log("");

  let totalPassed = 0;
  let totalFailed = 0;

  for (const testFile of testFiles) {
    let suite: Awaited<ReturnType<typeof parseTestFile>>;
    try {
      suite = parseTestFile(testFile);
    } catch (err) {
      console.error(chalk.red(`✗ Invalid test file ${testFile}:`), err instanceof Error ? err.message : err);
      continue;
    }

    console.log(chalk.gray(`  ${tr.testFile} ${path.basename(testFile)}`));
    console.log(chalk.gray(`  ${tr.testCases} ${suite.cases.length}`));
    console.log("");

    const spinner = ora(tr.testRunning).start();
    const summary = await runTestSuite(agent, suite);
    spinner.stop();

    for (const result of summary.results) {
      if (result.passed) {
        console.log(
          chalk.green(`  ✓ ${tr.testPass}`) +
          chalk.white(` ${result.name}`) +
          chalk.gray(` (${result.duration_ms}ms)`)
        );
      } else {
        console.log(
          chalk.red(`  ✗ ${tr.testFail}`) +
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
    console.log(chalk.gray("  ─────────────────────────────────────"));

    const statusColor = summary.failed === 0 ? chalk.green : chalk.red;
    console.log(
      statusColor(`  ${summary.passed}/${summary.total} passed`) +
      chalk.gray(` · ${summary.duration_ms}ms`)
    );
  }

  console.log("");

  if (totalFailed > 0) {
    process.exit(1);
  }
}
