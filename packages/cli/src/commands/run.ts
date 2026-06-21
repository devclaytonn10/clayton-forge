import * as readline from "readline";
import chalk from "chalk";
import ora from "ora";
import { t } from "../lang";

export async function commandRun(agentDir?: string, inputArg?: string): Promise<void> {
  const tr = t();
  const { parseAgentFile, findAgentFile, executeAgent } = await import("clayton-forge-core");

  const searchDir = agentDir ? require("path").resolve(agentDir) : process.cwd();
  const agentPath =
    require("fs").existsSync(require("path").join(searchDir, "agent.yaml"))
      ? require("path").join(searchDir, "agent.yaml")
      : findAgentFile(searchDir);

  if (!agentPath) {
    console.error(chalk.red(tr.runNotFound));
    process.exit(1);
  }

  let agent: Awaited<ReturnType<typeof parseAgentFile>>;
  try {
    agent = parseAgentFile(agentPath);
  } catch (err) {
    console.error(chalk.red(tr.runInvalidYaml), err instanceof Error ? err.message : err);
    process.exit(1);
  }

  console.log("");
  console.log(chalk.bold.cyan(`  ▶ ${agent.name}`) + chalk.gray(` v${agent.version}`));
  console.log(chalk.gray(`  ${agent.description ?? ""}`));
  console.log(chalk.gray(`  ${tr.testProvider} ${agent.llm.provider}${agent.llm.model ? ` / ${agent.llm.model}` : ""}`));
  console.log("");

  const requiredVars = agent.prompt.variables.filter((v) => v.required);
  const variables: Record<string, string> = {};

  if (inputArg && requiredVars.length <= 1) {
    const varName = requiredVars[0]?.name ?? "input";
    variables[varName] = inputArg;
  } else {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    const question = (prompt: string): Promise<string> =>
      new Promise((resolve) => rl.question(prompt, resolve));

    for (const variable of agent.prompt.variables) {
      if (variable.required || !variable.default) {
        const defaultHint = variable.default ? chalk.gray(` (default: ${variable.default})`) : "";
        const descHint = variable.description ? chalk.gray(` — ${variable.description}`) : "";
        const value = await question(`  ${chalk.white(variable.name)}${descHint}${defaultHint}: `);
        variables[variable.name] = value || variable.default || "";
      }
    }
    rl.close();
  }

  console.log("");

  const spinner = ora(tr.runRunning).start();
  const result = await executeAgent(agent, { variables });

  if (result.success) {
    spinner.succeed(chalk.green(tr.runDone) + chalk.gray(` (${result.duration_ms}ms)`));
    console.log("");
    console.log(chalk.bold("  " + tr.runOutput));
    console.log("");

    const lines = result.output.split("\n");
    for (const line of lines) {
      console.log("  " + line);
    }

    if (result.llm_response?.usage) {
      const { input_tokens, output_tokens } = result.llm_response.usage;
      console.log("");
      console.log(chalk.gray(`  ${tr.runTokens} ${input_tokens ?? "?"} in / ${output_tokens ?? "?"} out`));
    }
  } else {
    spinner.fail(chalk.red(tr.runFailed));
    console.log("");
    console.error(chalk.red("  " + tr.runError), result.error);
    process.exit(1);
  }

  console.log("");
}
