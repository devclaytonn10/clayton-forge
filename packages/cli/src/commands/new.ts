import inquirer from "inquirer";
import * as fs from "fs";
import * as path from "path";
import chalk from "chalk";
import ora from "ora";
import { execSync } from "child_process";

// ─────────────────────────────────────────────
// Tipos locais (para evitar import circular durante build inicial)
// ─────────────────────────────────────────────

interface WizardAnswers {
  name: string;
  description: string;
  type: string;
  llm_provider: string;
  llm_model: string;
  api_key_method: string;
  api_key_value: string;
  output_format: string;
  trust_level: number;
}

// ─────────────────────────────────────────────
// Helpers de display
// ─────────────────────────────────────────────

function header() {
  console.log("");
  console.log(chalk.bold.white("  ╔═══════════════════════════════════╗"));
  console.log(chalk.bold.white("  ║") + chalk.bold.cyan("       CLAYTON FORGE — new        ") + chalk.bold.white("║"));
  console.log(chalk.bold.white("  ╚═══════════════════════════════════╝"));
  console.log("");
  console.log(chalk.gray("  Let's create your agent. Answer a few questions."));
  console.log(chalk.gray("  Press Ctrl+C at any time to cancel.\n"));
}

// ─────────────────────────────────────────────
// Wizard
// ─────────────────────────────────────────────

export async function commandNew(targetDir?: string): Promise<void> {
  header();

  const answers = await inquirer.prompt<WizardAnswers>([
    {
      type: "input",
      name: "name",
      message: chalk.white("Agent name") + chalk.gray(" (kebab-case, e.g. invoice-classifier):"),
      validate: (v: string) =>
        /^[a-z][a-z0-9-]*$/.test(v) || "Use lowercase letters, numbers, and hyphens only",
    },
    {
      type: "input",
      name: "description",
      message: chalk.white("What does this agent do?"),
      validate: (v: string) => v.trim().length > 5 || "Please write a short description",
    },
    {
      type: "list",
      name: "type",
      message: chalk.white("Agent type:"),
      choices: [
        { name: "reactive    — receives input → processes → responds", value: "reactive" },
        { name: "proactive   — acts on triggers without waiting for input", value: "proactive" },
        { name: "pipeline    — sequential steps, each feeding the next", value: "pipeline" },
        { name: "orchestrator— coordinates other agents", value: "orchestrator" },
        { name: "worker      — executed by an orchestrator", value: "worker" },
      ],
    },
    {
      type: "list",
      name: "llm_provider",
      message: chalk.white("LLM provider:"),
      choices: [
        { name: "anthropic       (Claude — requires ANTHROPIC_API_KEY)", value: "anthropic" },
        { name: "openai          (GPT — requires OPENAI_API_KEY)", value: "openai" },
        { name: "ollama          (local — requires Ollama running)", value: "ollama" },
        { name: "lmstudio        (local — requires LM Studio running)", value: "lmstudio" },
        { name: "openai-compatible (any OpenAI-compatible API)", value: "openai-compatible" },
        { name: "none            (rule-based, no LLM)", value: "none" },
      ],
    },
    {
      type: "input",
      name: "llm_model",
      message: chalk.white("Model name:"),
      when: (a: WizardAnswers) => a.llm_provider !== "none",
      default: (a: WizardAnswers) => {
        const defaults: Record<string, string> = {
          anthropic: "claude-sonnet-4-6",
          openai: "gpt-4o-mini",
          ollama: "llama3",
          lmstudio: "local-model",
          "openai-compatible": "default",
        };
        return defaults[a.llm_provider] ?? "";
      },
    },
    {
      type: "list",
      name: "api_key_method",
      message: chalk.white("How do you want to authenticate?"),
      when: (a: WizardAnswers) => a.llm_provider === "anthropic" || a.llm_provider === "openai",
      choices: (a: WizardAnswers) => {
        const envVar = a.llm_provider === "anthropic" ? "ANTHROPIC_API_KEY" : "OPENAI_API_KEY";
        return [
          { name: `env var        — use $${envVar} (already set in your environment)`, value: "env" },
          { name: "paste key      — type or paste your API key now", value: "paste" },
          { name: "browser login  — open claude.ai to generate a key automatically", value: "browser" },
        ];
      },
    },
    {
      type: "password",
      name: "api_key_value",
      message: chalk.white("Paste your API key:"),
      mask: "*",
      when: (a: WizardAnswers) => a.api_key_method === "paste",
      validate: (v: string) => v.trim().length > 10 || "Key seems too short",
    },
    {
      type: "list",
      name: "output_format",
      message: chalk.white("Output format:"),
      choices: [
        { name: "text     — plain text response", value: "text" },
        { name: "json     — structured JSON (add output schema)", value: "json" },
        { name: "markdown — formatted markdown", value: "markdown" },
      ],
    },
    {
      type: "list",
      name: "trust_level",
      message: chalk.white("Trust level:"),
      choices: [
        { name: "0 — sandboxed  (no external access)", value: 0 },
        { name: "1 — read-only  (reads data, no writes)", value: 1 },
        { name: "2 — write      (reads and writes)", value: 2 },
        { name: "3 — admin      (full control)", value: 3 },
      ],
    },
  ]);

  // Browser login flow
  if (answers.api_key_method === "browser") {
    const url = answers.llm_provider === "anthropic"
      ? "https://console.anthropic.com/settings/keys"
      : "https://platform.openai.com/api-keys";

    console.log("");
    console.log(chalk.cyan("  Opening your browser to generate an API key..."));
    console.log(chalk.gray(`  URL: ${url}`));
    console.log("");

    try {
      const openCmd = process.platform === "win32" ? `start ${url}`
        : process.platform === "darwin" ? `open ${url}`
        : `xdg-open ${url}`;
      execSync(openCmd);
    } catch {
      console.log(chalk.yellow("  Could not open browser automatically. Please open the URL above manually."));
    }

    const { key } = await inquirer.prompt<{ key: string }>([{
      type: "password",
      name: "key",
      message: chalk.white("Paste the key you just created:"),
      mask: "*",
      validate: (v: string) => v.trim().length > 10 || "Key seems too short",
    }]);
    answers.api_key_value = key;
    answers.api_key_method = "paste"; // treat as paste from here on
  }

  // Destino
  const projectName = answers.name;
  const dest = targetDir ? path.resolve(targetDir, projectName) : path.resolve(process.cwd(), projectName);

  // Verificar se pasta já existe
  if (fs.existsSync(dest)) {
    console.log(chalk.red(`\n✗ Directory already exists: ${dest}`));
    process.exit(1);
  }

  const spinner = ora("Creating your agent...").start();

  try {
    // Criar pasta
    fs.mkdirSync(dest, { recursive: true });

    // Gerar agent.yaml
    const apiKeyVar = getApiKeyVar(answers.llm_provider);
    const agentYaml = buildAgentYaml(answers, apiKeyVar);
    fs.writeFileSync(path.join(dest, "agent.yaml"), agentYaml);

    // Gerar agent.test.yaml
    const testYaml = buildTestYaml(answers.name);
    fs.writeFileSync(path.join(dest, "agent.test.yaml"), testYaml);

    // Gerar README.md
    const readme = buildReadme(answers);
    fs.writeFileSync(path.join(dest, "README.md"), readme);

    // Gerar .env.example apenas se usar env var
    if (apiKeyVar && answers.api_key_method !== "paste") {
      fs.writeFileSync(path.join(dest, ".env.example"), `${apiKeyVar}=your-api-key-here\n`);
    }

    spinner.succeed(chalk.green("Agent created!"));

    // Summary
    console.log("");
    console.log(chalk.bold("  📁 " + dest));
    console.log(chalk.gray("  ├── agent.yaml"));
    console.log(chalk.gray("  ├── agent.test.yaml"));
    console.log(chalk.gray("  ├── README.md"));
    if (apiKeyVar) console.log(chalk.gray("  └── .env.example"));
    console.log("");
    console.log(chalk.bold.cyan("  Next steps:"));
    console.log(chalk.white(`  $ cd ${projectName}`));
    if (apiKeyVar && answers.api_key_method !== "paste") {
      console.log(chalk.white(`  $ cp .env.example .env   # add your API key`));
    }
    console.log(chalk.white(`  $ cforge run              # execute the agent`));
    console.log(chalk.white(`  $ cforge test             # run tests`));
    console.log("");
  } catch (err) {
    spinner.fail("Failed to create agent");
    console.error(err);
    process.exit(1);
  }
}

// ─────────────────────────────────────────────
// Builders
// ─────────────────────────────────────────────

function getApiKeyVar(provider: string): string | null {
  const map: Record<string, string> = {
    anthropic: "ANTHROPIC_API_KEY",
    openai: "OPENAI_API_KEY",
  };
  return map[provider] ?? null;
}

function buildAgentYaml(answers: WizardAnswers, apiKeyVar: string | null): string {
  const lines = [
    `name: "${answers.name}"`,
    `version: "1.0.0"`,
    `description: "${answers.description}"`,
    `type: ${answers.type}`,
    `trust_level: ${answers.trust_level}`,
    ``,
    `llm:`,
    `  provider: ${answers.llm_provider}`,
  ];

  if (answers.llm_provider !== "none") {
    lines.push(`  model: ${answers.llm_model}`);

    if (answers.api_key_method === "paste" && answers.api_key_value?.trim()) {
      // Key colada diretamente — salva no yaml
      lines.push(`  api_key: "${answers.api_key_value.trim()}"`);
    } else if (apiKeyVar) {
      // Usa env var
      lines.push(`  api_key: "\${${apiKeyVar}}"`);
    }

    lines.push(`  temperature: 0.1`);
    lines.push(`  max_tokens: 1000`);
  }

  lines.push(``);
  lines.push(`prompt:`);
  lines.push(`  system: |`);
  lines.push(`    You are ${answers.description}.`);
  lines.push(`    Be concise, accurate, and helpful.`);
  lines.push(`  user_template: "{{input}}"`);
  lines.push(`  variables:`);
  lines.push(`    - name: input`);
  lines.push(`      required: true`);
  lines.push(`      description: "The user's input"`);
  lines.push(``);
  lines.push(`output:`);
  lines.push(`  format: ${answers.output_format}`);
  lines.push(``);
  lines.push(`tests:`);
  lines.push(`  - file: agent.test.yaml`);
  lines.push(``);

  return lines.join("\n");
}

function buildTestYaml(agentName: string): string {
  return [
    `agent: "${agentName}"`,
    ``,
    `cases:`,
    `  - name: "basic test"`,
    `    input:`,
    `      input: "Hello, world!"`,
    `    expected_contains:`,
    `      - "Hello"    # adjust to match your agent's expected output`,
    `    timeout_ms: 30000`,
    ``,
  ].join("\n");
}

function buildReadme(answers: WizardAnswers): string {
  return [
    `# ${answers.name}`,
    ``,
    `> ${answers.description}`,
    ``,
    `## Overview`,
    ``,
    `| Field | Value |`,
    `|-------|-------|`,
    `| **Type** | ${answers.type} |`,
    `| **LLM** | ${answers.llm_provider}${answers.llm_model ? ` / ${answers.llm_model}` : ""} |`,
    `| **Output** | ${answers.output_format} |`,
    `| **Trust Level** | ${answers.trust_level} |`,
    ``,
    `## Usage`,
    ``,
    `\`\`\`bash`,
    `cforge run    # execute the agent`,
    `cforge test   # run test suite`,
    `\`\`\``,
    ``,
    `## Configuration`,
    ``,
    `Edit \`agent.yaml\` to customize the agent's behavior.`,
    ``,
    `## Tests`,
    ``,
    `Edit \`agent.test.yaml\` to add test cases.`,
    ``,
    `---`,
    ``,
    `Built with [Clayton Forge](https://github.com/devclaytonn10/clayton-forge)`,
    ``,
  ].join("\n");
}