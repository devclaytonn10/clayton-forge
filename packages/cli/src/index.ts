#!/usr/bin/env node
import { Command } from "commander";
import chalk from "chalk";
import { commandNew } from "./commands/new";
import { commandRun } from "./commands/run";
import { commandTest } from "./commands/test";

const pkg = require("../package.json");

// ─────────────────────────────────────────────
// Banner
// ─────────────────────────────────────────────

function printBanner() {
  console.log("");
  console.log(chalk.bold.cyan("  CLAYTON FORGE") + chalk.gray(` v${pkg.version}`));
  console.log(chalk.gray("  Build AI agents with confidence."));
  console.log(chalk.gray("  https://github.com/devclaytonn10/clayton-forge"));
  console.log("");
}

// ─────────────────────────────────────────────
// CLI
// ─────────────────────────────────────────────

const program = new Command();

program
  .name("cforge")
  .description("Clayton Forge — AI agent platform CLI")
  .version(pkg.version, "-v, --version", "Output the current version")
  .addHelpText("before", "\n  CLAYTON FORGE — Build AI agents with confidence.\n");

// ─────────────────────────────────────────────
// cforge new [name]
// ─────────────────────────────────────────────

program
  .command("new [name]")
  .description("Create a new agent with an interactive wizard")
  .action(async (name?: string) => {
    await commandNew(name ? undefined : undefined);
  });

// ─────────────────────────────────────────────
// cforge run [agent-dir] [input]
// ─────────────────────────────────────────────

program
  .command("run [agent-dir]")
  .description("Execute an agent")
  .option("-i, --input <text>", "Input text (skips interactive prompt for single-variable agents)")
  .action(async (agentDir?: string, options?: { input?: string }) => {
    await commandRun(agentDir, options?.input);
  });

// ─────────────────────────────────────────────
// cforge test [agent-dir]
// ─────────────────────────────────────────────

program
  .command("test [agent-dir]")
  .description("Run the agent's test suite")
  .action(async (agentDir?: string) => {
    await commandTest(agentDir);
  });

// ─────────────────────────────────────────────
// cforge validate
// ─────────────────────────────────────────────

program
  .command("validate [agent-dir]")
  .description("Validate agent.yaml without running the agent")
  .action(async (agentDir?: string) => {
    const { parseAgentFile, findAgentFile } = await import("@clayton-forge/core");
    const path = require("path");
    const fs = require("fs");

    const searchDir = agentDir ? path.resolve(agentDir) : process.cwd();
    const agentPath = fs.existsSync(path.join(searchDir, "agent.yaml"))
      ? path.join(searchDir, "agent.yaml")
      : findAgentFile(searchDir);

    if (!agentPath) {
      console.error(chalk.red("✗ No agent.yaml found."));
      process.exit(1);
    }

    try {
      const agent = parseAgentFile(agentPath);
      console.log(chalk.green(`\n  ✓ Valid agent.yaml`));
      console.log(chalk.gray(`  Name: ${agent.name} v${agent.version}`));
      console.log(chalk.gray(`  Type: ${agent.type}`));
      console.log(chalk.gray(`  LLM:  ${agent.llm.provider}${agent.llm.model ? ` / ${agent.llm.model}` : ""}`));
      console.log("");
    } catch (err) {
      console.error(chalk.red(`\n  ✗ ${err instanceof Error ? err.message : err}`));
      console.log("");
      process.exit(1);
    }
  });

// ─────────────────────────────────────────────
// Default: banner + help
// ─────────────────────────────────────────────

program.addHelpCommand(true);

if (process.argv.length <= 2) {
  printBanner();
  program.help();
}

program.parse(process.argv);
