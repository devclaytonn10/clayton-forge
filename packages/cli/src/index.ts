#!/usr/bin/env node
import { Command } from "commander";
import chalk from "chalk";
import inquirer from "inquirer";
import { getLang, saveConfig, translations, type Lang } from "./lang";
import { commandNew } from "./commands/new";
import { commandRun } from "./commands/run";
import { commandTest } from "./commands/test";

const pkg = require("../package.json");

// ─────────────────────────────────────────────
// ASCII art
// ─────────────────────────────────────────────

function printAscii() {
  const c = chalk.bold.cyan;
  const d = chalk.cyan;
  console.log("");
  console.log(c("   ██████╗██╗      █████╗ ██╗   ██╗████████╗ ██████╗ ███╗   ██╗"));
  console.log(c("  ██╔════╝██║     ██╔══██╗╚██╗ ██╔╝╚══██╔══╝██╔═══██╗████╗  ██║"));
  console.log(c("  ██║     ██║     ███████║ ╚████╔╝    ██║   ██║   ██║██╔██╗ ██║"));
  console.log(c("  ██║     ██║     ██╔══██║  ╚██╔╝     ██║   ██║   ██║██║╚██╗██║"));
  console.log(c("  ╚██████╗███████╗██║  ██║   ██║      ██║   ╚██████╔╝██║ ╚████║"));
  console.log(c("   ╚═════╝╚══════╝╚═╝  ╚═╝   ╚═╝      ╚═╝    ╚═════╝ ╚═╝  ╚═══╝"));
  console.log("");
  console.log(d("  ███████╗ ██████╗ ██████╗  ██████╗ ███████╗"));
  console.log(d("  ██╔════╝██╔═══██╗██╔══██╗██╔════╝ ██╔════╝"));
  console.log(d("  █████╗  ██║   ██║██████╔╝██║  ███╗█████╗  "));
  console.log(d("  ██╔══╝  ██║   ██║██╔══██╗██║   ██║██╔══╝  "));
  console.log(d("  ██║     ╚██████╔╝██║  ██║╚██████╔╝███████╗"));
  console.log(d("  ╚═╝      ╚═════╝ ╚═╝  ╚═╝ ╚═════╝ ╚══════╝"));
  console.log("");
  console.log(chalk.gray(`  v${pkg.version}`) + "  " + chalk.gray("https://github.com/devclaytonn10/clayton-forge"));
  console.log("");
}

// ─────────────────────────────────────────────
// Banner pequeno (usado nos subcomandos)
// ─────────────────────────────────────────────

function printBanner() {
  console.log("");
  console.log(chalk.bold.cyan("  CLAYTON FORGE") + chalk.gray(` v${pkg.version}`));
  console.log("");
}

// ─────────────────────────────────────────────
// Tela de boas-vindas com seleção de idioma
// ─────────────────────────────────────────────

async function showWelcome(): Promise<void> {
  printAscii();

  const currentLang = getLang();

  const { lang } = await inquirer.prompt<{ lang: Lang }>([
    {
      type: "list",
      name: "lang",
      message: "🌐 Language / Idioma:",
      choices: [
        { name: "English", value: "en" },
        { name: "Português", value: "pt" },
      ],
      default: currentLang,
    },
  ]);

  // Salva preferência
  saveConfig({ lang });

  const tr = translations[lang];

  console.log("");
  console.log(chalk.bold.white("  " + tr.tagline));
  console.log("");
  console.log(chalk.bold.cyan("  " + tr.commands));
  console.log(chalk.white("  cforge new       ") + chalk.gray(tr.cmdNew));
  console.log(chalk.white("  cforge run       ") + chalk.gray(tr.cmdRun));
  console.log(chalk.white("  cforge test      ") + chalk.gray(tr.cmdTest));
  console.log(chalk.white("  cforge validate  ") + chalk.gray(tr.cmdValidate));
  console.log("");
  console.log(chalk.gray("  " + tr.tip));
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

program
  .command("new [name]")
  .description("Create a new agent with an interactive wizard")
  .action(async (name?: string) => {
    printBanner();
    await commandNew(name ? undefined : undefined);
  });

program
  .command("run [agent-dir]")
  .description("Execute an agent")
  .option("-i, --input <text>", "Input text (skips interactive prompt)")
  .action(async (agentDir?: string, options?: { input?: string }) => {
    printBanner();
    await commandRun(agentDir, options?.input);
  });

program
  .command("test [agent-dir]")
  .description("Run the agent's test suite")
  .action(async (agentDir?: string) => {
    printBanner();
    await commandTest(agentDir);
  });

program
  .command("validate [agent-dir]")
  .description("Validate agent.yaml without running the agent")
  .action(async (agentDir?: string) => {
    printBanner();
    const { parseAgentFile, findAgentFile } = await import("clayton-forge-core");
    const pathMod = require("path");
    const fsMod = require("fs");
    const { t } = await import("./lang");
    const tr = t();

    const searchDir = agentDir ? pathMod.resolve(agentDir) : process.cwd();
    const agentPath = fsMod.existsSync(pathMod.join(searchDir, "agent.yaml"))
      ? pathMod.join(searchDir, "agent.yaml")
      : findAgentFile(searchDir);

    if (!agentPath) {
      console.error(chalk.red(tr.testNotFound));
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
// Entrada padrão: tela de boas-vindas
// ─────────────────────────────────────────────

program.addHelpCommand(true);

if (process.argv.length <= 2) {
  showWelcome().catch(console.error);
} else {
  program.parse(process.argv);
}
