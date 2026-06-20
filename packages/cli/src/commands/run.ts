import * as readline from "readline";
import chalk from "chalk";
import ora from "ora";

// ─────────────────────────────────────────────
// cforge run [agent-dir]
// ─────────────────────────────────────────────

export async function commandRun(agentDir?: string, inputArg?: string): Promise<void> {
  const { parseAgentFile, findAgentFile, executeAgent } = await import("@clayton-forge/core");

  // 1. Find agent.yaml
  const searchDir = agentDir ? require("path").resolve(agentDir) : process.cwd();
  const agentPath =
    require("fs").existsSync(require("path").join(searchDir, "agent.yaml"))
      ? require("path").join(searchDir, "agent.yaml")
      : findAgentFile(searchDir);

  if (!agentPath) {
    console.error(chalk.red("✗ No agent.yaml found. Run this command inside an agent directory."));
    process.exit(1);
  }

  // 2. Parse
  let agent: Awaited<ReturnType<typeof parseAgentFile>>;
  try {
    agent = parseAgentFile(agentPath);
  } catch (err) {
    console.error(chalk.red("✗ Invalid agent.yaml:"), err instanceof Error ? err.message : err);
    process.exit(1);
  }

  console.log("");
  console.log(chalk.bold.cyan(`  ▶ ${agent.name}`) + chalk.gray(` v${agent.version}`));
  console.log(chalk.gray(`  ${agent.description ?? ""}`));
  console.log(chalk.gray(`  Provider: ${agent.llm.provider}${agent.llm.model ? ` / ${agent.llm.model}` : ""}`));
  console.log("");

  // 3. Collect input
  const requiredVars = agent.prompt.variables.filter((v) => v.required);
  const variables: Record<string, string> = {};

  if (inputArg && requiredVars.length <= 1) {
    // Se só tem uma variável obrigatória, usa o argumento direto
    const varName = requiredVars[0]?.name ?? "input";
    variables[varName] = inputArg;
  } else {
    // Interactive input
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

  // 4. Execute
  const spinner = ora("Running agent...").start();
  const result = await executeAgent(agent, { variables });

  if (result.success) {
    spinner.succeed(chalk.green(`Done`) + chalk.gray(` (${result.duration_ms}ms)`));
    console.log("");
    console.log(chalk.bold("  Output:"));
    console.log("");

    // Format output based on type
    const lines = result.output.split("\n");
    for (const line of lines) {
      console.log("  " + line);
    }

    if (result.llm_response?.usage) {
      const { input_tokens, output_tokens } = result.llm_response.usage;
      console.log("");
      console.log(
        chalk.gray(`  Tokens: ${input_tokens ?? "?"} in / ${output_tokens ?? "?"} out`)
      );
    }
  } else {
    spinner.fail(chalk.red("Execution failed"));
    console.log("");
    console.error(chalk.red("  Error:"), result.error);
    process.exit(1);
  }

  console.log("");
}
