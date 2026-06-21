import inquirer from "inquirer";
import * as fs from "fs";
import * as path from "path";
import chalk from "chalk";
import ora from "ora";
import { execSync } from "child_process";
import { t } from "../lang";

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

function header() {
  const tr = t();
  console.log("");
  console.log(chalk.bold.white("  ╔═══════════════════════════════════╗"));
  console.log(chalk.bold.white("  ║") + chalk.bold.cyan("       CLAYTON FORGE — new        ") + chalk.bold.white("║"));
  console.log(chalk.bold.white("  ╚═══════════════════════════════════╝"));
  console.log("");
  console.log(chalk.gray("  " + tr.newHeader));
  console.log(chalk.gray("  " + tr.newCancel + "\n"));
}

export async function commandNew(targetDir?: string): Promise<void> {
  const tr = t();
  header();

  const answers = await inquirer.prompt<WizardAnswers>([
    {
      type: "input",
      name: "name",
      message: chalk.white(tr.newAgentName) + chalk.gray(" " + tr.newAgentNameHint),
      validate: (v: string) =>
        /^[a-z][a-z0-9-]*$/.test(v) || tr.newAgentNameError,
    },
    {
      type: "input",
      name: "description",
      message: chalk.white(tr.newDescription),
      validate: (v: string) => v.trim().length > 5 || tr.newDescriptionError,
    },
    {
      type: "list",
      name: "type",
      message: chalk.white(tr.newAgentType),
      choices: [
        { name: tr.newTypeReactive, value: "reactive" },
        { name: tr.newTypeProactive, value: "proactive" },
        { name: tr.newTypePipeline, value: "pipeline" },
        { name: tr.newTypeOrchestrator, value: "orchestrator" },
        { name: tr.newTypeWorker, value: "worker" },
      ],
    },
    {
      type: "list",
      name: "llm_provider",
      message: chalk.white(tr.newLLMProvider),
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
      message: chalk.white(tr.newModelName),
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
      message: chalk.white(tr.newAuthMethod),
      when: (a: WizardAnswers) => a.llm_provider === "anthropic" || a.llm_provider === "openai",
      choices: (a: WizardAnswers) => {
        const envVar = a.llm_provider === "anthropic" ? "ANTHROPIC_API_KEY" : "OPENAI_API_KEY";
        return [
          { name: tr.newAuthEnv.replace("$KEY", `$${envVar}`), value: "env" },
          { name: tr.newAuthPaste, value: "paste" },
          { name: tr.newAuthBrowser, value: "browser" },
        ];
      },
    },
    {
      type: "password",
      name: "api_key_value",
      message: chalk.white(tr.newPasteKey),
      mask: "*",
      when: (a: WizardAnswers) => a.api_key_method === "paste",
      validate: (v: string) => v.trim().length > 10 || tr.newKeyTooShort,
    },
    {
      type: "list",
      name: "output_format",
      message: chalk.white(tr.newOutputFormat),
      choices: [
        { name: tr.newOutputText, value: "text" },
        { name: tr.newOutputJson, value: "json" },
        { name: tr.newOutputMarkdown, value: "markdown" },
      ],
    },
    {
      type: "list",
      name: "trust_level",
      message: chalk.white(tr.newTrustLevel),
      choices: [
        { name: tr.newTrust0, value: 0 },
        { name: tr.newTrust1, value: 1 },
        { name: tr.newTrust2, value: 2 },
        { name: tr.newTrust3, value: 3 },
      ],
    },
  ]);

  // Browser login flow
  if (answers.api_key_method === "browser") {
    const url = answers.llm_provider === "anthropic"
      ? "https://console.anthropic.com/settings/keys"
      : "https://platform.openai.com/api-keys";

    console.log("");
    console.log(chalk.cyan("  " + tr.newBrowserOpening));
    console.log(chalk.gray(`  URL: ${url}`));
    console.log("");

    try {
      const openCmd = process.platform === "win32" ? `start ${url}`
        : process.platform === "darwin" ? `open ${url}`
        : `xdg-open ${url}`;
      execSync(openCmd);
    } catch {
      console.log(chalk.yellow("  " + tr.newBrowserFallback));
    }

    const { key } = await inquirer.prompt<{ key: string }>([{
      type: "password",
      name: "key",
      message: chalk.white(tr.newPasteBrowserKey),
      mask: "*",
      validate: (v: string) => v.trim().length > 10 || tr.newKeyTooShort,
    }]);
    answers.api_key_value = key;
    answers.api_key_method = "paste";
  }

  const projectName = answers.name;
  const dest = targetDir ? path.resolve(targetDir, projectName) : path.resolve(process.cwd(), projectName);

  if (fs.existsSync(dest)) {
    console.log(chalk.red(`\n✗ ${tr.newDirExists} ${dest}`));
    process.exit(1);
  }

  const spinner = ora(tr.newCreating).start();

  try {
    fs.mkdirSync(dest, { recursive: true });

    const apiKeyVar = getApiKeyVar(answers.llm_provider);
    fs.writeFileSync(path.join(dest, "agent.yaml"), buildAgentYaml(answers, apiKeyVar));
    fs.writeFileSync(path.join(dest, "agent.test.yaml"), buildTestYaml(answers.name));
    fs.writeFileSync(path.join(dest, "README.md"), buildReadme(answers));

    if (apiKeyVar && answers.api_key_method !== "paste") {
      fs.writeFileSync(path.join(dest, ".env.example"), `${apiKeyVar}=your-api-key-here\n`);
    }

    spinner.succeed(chalk.green(tr.newCreated));

    console.log("");
    console.log(chalk.bold("  📁 " + dest));
    console.log(chalk.gray("  ├── agent.yaml"));
    console.log(chalk.gray("  ├── agent.test.yaml"));
    console.log(chalk.gray("  ├── README.md"));
    if (apiKeyVar && answers.api_key_method !== "paste") {
      console.log(chalk.gray("  └── .env.example"));
    }
    console.log("");
    console.log(chalk.bold.cyan("  " + tr.newNextSteps));
    console.log(chalk.white(`  $ cd ${projectName}`));
    if (apiKeyVar && answers.api_key_method !== "paste") {
      console.log(chalk.white(`  $ cp .env.example .env   # ${tr.newEnvHint}`));
    }
    console.log(chalk.white(`  $ cforge run`));
    console.log(chalk.white(`  $ cforge test`));
    console.log("");
  } catch (err) {
    spinner.fail(tr.newFailed);
    console.error(err);
    process.exit(1);
  }
}

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
      lines.push(`  api_key: "${answers.api_key_value.trim()}"`);
    } else if (apiKeyVar) {
      lines.push(`  api_key: "\${${apiKeyVar}}"`);
    }
    lines.push(`  temperature: 0.1`);
    lines.push(`  max_tokens: 1000`);
  }

  lines.push(``, `prompt:`, `  system: |`, `    You are ${answers.description}.`,
    `    Be concise, accurate, and helpful.`,
    `  user_template: "{{input}}"`, `  variables:`,
    `    - name: input`, `      required: true`, `      description: "The user's input"`,
    ``, `output:`, `  format: ${answers.output_format}`, ``, `tests:`, `  - file: agent.test.yaml`, ``);

  return lines.join("\n");
}

function buildTestYaml(agentName: string): string {
  return [
    `agent: "${agentName}"`, ``, `cases:`,
    `  - name: "basic test"`, `    input:`, `      input: "Hello, world!"`,
    `    expected_contains:`, `      - "Hello"    # adjust to match your agent's expected output`,
    `    timeout_ms: 30000`, ``,
  ].join("\n");
}

function buildReadme(answers: WizardAnswers): string {
  return [
    `# ${answers.name}`, ``, `> ${answers.description}`, ``, `## Overview`, ``,
    `| Field | Value |`, `|-------|-------|`,
    `| **Type** | ${answers.type} |`,
    `| **LLM** | ${answers.llm_provider}${answers.llm_model ? ` / ${answers.llm_model}` : ""} |`,
    `| **Output** | ${answers.output_format} |`,
    `| **Trust Level** | ${answers.trust_level} |`, ``,
    `## Usage`, ``, "```bash", `cforge run    # execute the agent`,
    `cforge test   # run test suite`, "```", ``,
    `## Configuration`, ``, "Edit `agent.yaml` to customize the agent's behavior.", ``,
    `## Tests`, ``, "Edit `agent.test.yaml` to add test cases.", ``, `---`, ``,
    `Built with [Clayton Forge](https://github.com/devclaytonn10/clayton-forge)`, ``,
  ].join("\n");
}
