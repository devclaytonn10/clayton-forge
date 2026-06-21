import inquirer from "inquirer";
import * as fs from "fs";
import * as path from "path";
import * as os from "os";
import chalk from "chalk";
import ora from "ora";
import { execSync } from "child_process";
import { t } from "../lang";

// ─────────────────────────────────────────────
// Types
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

interface ClaudeCredentials {
  claudeAiOauth?: {
    accessToken: string;
    refreshToken: string;
    expiresAt: number;
    subscriptionType: string;
  };
}

// ─────────────────────────────────────────────
// Claude Code credentials reader
// ─────────────────────────────────────────────

function readClaudeCredentials(): ClaudeCredentials | null {
  const credPath = path.join(os.homedir(), ".claude", "credentials.json");
  try {
    if (!fs.existsSync(credPath)) return null;
    const raw = fs.readFileSync(credPath, "utf-8");
    return JSON.parse(raw) as ClaudeCredentials;
  } catch {
    return null;
  }
}

function getClaudeToken(): { token: string; expired: boolean } | null {
  const creds = readClaudeCredentials();
  if (!creds?.claudeAiOauth?.accessToken) return null;
  const expired = Date.now() > creds.claudeAiOauth.expiresAt;
  return { token: creds.claudeAiOauth.accessToken, expired };
}

// ─────────────────────────────────────────────
// Model fetchers
// ─────────────────────────────────────────────

async function fetchAnthropicModels(apiKey: string): Promise<string[]> {
  try {
    const res = await fetch("https://api.anthropic.com/v1/models", {
      headers: {
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
    });
    if (!res.ok) return defaultModels("anthropic");
    const data = await res.json() as { data: Array<{ id: string }> };
    return data.data.map((m) => m.id).filter((id) => id.startsWith("claude-"));
  } catch {
    return defaultModels("anthropic");
  }
}

async function fetchOpenAIModels(apiKey: string, baseUrl = "https://api.openai.com/v1"): Promise<string[]> {
  try {
    const res = await fetch(`${baseUrl}/models`, {
      headers: { Authorization: `Bearer ${apiKey}` },
    });
    if (!res.ok) return defaultModels("openai");
    const data = await res.json() as { data: Array<{ id: string }> };
    return data.data
      .map((m) => m.id)
      .filter((id) => id.startsWith("gpt-") || id.startsWith("o1") || id.startsWith("o3"))
      .sort();
  } catch {
    return defaultModels("openai");
  }
}

async function fetchOllamaModels(baseUrl = "http://localhost:11434"): Promise<string[]> {
  try {
    const res = await fetch(`${baseUrl}/api/tags`);
    if (!res.ok) return defaultModels("ollama");
    const data = await res.json() as { models: Array<{ name: string }> };
    return data.models.map((m) => m.name);
  } catch {
    return defaultModels("ollama");
  }
}

async function fetchLMStudioModels(baseUrl = "http://localhost:1234/v1"): Promise<string[]> {
  try {
    const res = await fetch(`${baseUrl}/models`);
    if (!res.ok) return defaultModels("lmstudio");
    const data = await res.json() as { data: Array<{ id: string }> };
    return data.data.map((m) => m.id);
  } catch {
    return defaultModels("lmstudio");
  }
}

function defaultModels(provider: string): string[] {
  const defaults: Record<string, string[]> = {
    anthropic: ["claude-opus-4-6", "claude-sonnet-4-6", "claude-haiku-4-5"],
    openai: ["gpt-4o", "gpt-4o-mini", "o1", "o3-mini"],
    ollama: ["llama3.2", "llama3.1", "mistral", "phi3"],
    lmstudio: ["local-model"],
    "openai-compatible": ["default"],
  };
  return defaults[provider] ?? ["default"];
}

// ─────────────────────────────────────────────
// Header
// ─────────────────────────────────────────────

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

// ─────────────────────────────────────────────
// Main wizard
// ─────────────────────────────────────────────

export async function commandNew(targetDir?: string): Promise<void> {
  const tr = t();
  header();

  // Step 1 — name, description, type, provider
  const step1 = await inquirer.prompt<Pick<WizardAnswers, "name" | "description" | "type" | "llm_provider">>([
    {
      type: "input",
      name: "name",
      message: chalk.white(tr.newAgentName) + chalk.gray(" " + tr.newAgentNameHint),
      validate: (v: string) => /^[a-z][a-z0-9-]*$/.test(v) || tr.newAgentNameError,
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
        { name: "anthropic        (Claude)", value: "anthropic" },
        { name: "openai           (GPT)", value: "openai" },
        { name: "ollama           (local — requires Ollama running)", value: "ollama" },
        { name: "lmstudio         (local — requires LM Studio running)", value: "lmstudio" },
        { name: "openai-compatible (any OpenAI-compatible API)", value: "openai-compatible" },
        { name: "none             (rule-based, no LLM)", value: "none" },
      ],
    },
  ]);

  // Step 2 — authentication (resolve API key before listing models)
  let resolvedApiKey: string | null = null;
  let apiKeyMethod = "env";

  if (step1.llm_provider === "anthropic" || step1.llm_provider === "openai") {
    const claudeToken = step1.llm_provider === "anthropic" ? getClaudeToken() : null;

    const authChoices = [];

    // Claude Code login option (only for anthropic)
    if (claudeToken && step1.llm_provider === "anthropic") {
      const status = claudeToken.expired
        ? chalk.yellow("(token expirado — faça claude login)")
        : chalk.green("(conectado)");
      authChoices.push({
        name: `claude.ai       — usar sua conta Claude ${status}`,
        value: "claude_code",
      });
    }

    const envVar = step1.llm_provider === "anthropic" ? "ANTHROPIC_API_KEY" : "OPENAI_API_KEY";
    authChoices.push(
      { name: tr.newAuthEnv.replace("$KEY", `$${envVar}`), value: "env" },
      { name: tr.newAuthPaste, value: "paste" },
      { name: tr.newAuthBrowser, value: "browser" },
    );

    const { method } = await inquirer.prompt<{ method: string }>([{
      type: "list",
      name: "method",
      message: chalk.white(tr.newAuthMethod),
      choices: authChoices,
      default: claudeToken && !claudeToken.expired ? "claude_code" : "env",
    }]);

    apiKeyMethod = method;

    if (method === "claude_code") {
      if (claudeToken!.expired) {
        console.log(chalk.yellow("\n  Token expirado. Rodando claude login..."));
        try {
          execSync("claude login", { stdio: "inherit" });
          const refreshed = getClaudeToken();
          resolvedApiKey = refreshed?.token ?? null;
        } catch {
          console.log(chalk.red("  Falha ao renovar token. Use outra opção de autenticação."));
          process.exit(1);
        }
      } else {
        resolvedApiKey = claudeToken!.token;
        console.log(chalk.green("\n  ✓ Usando token do Claude Code"));
      }
    } else if (method === "paste") {
      const { key } = await inquirer.prompt<{ key: string }>([{
        type: "password",
        name: "key",
        message: chalk.white(tr.newPasteKey),
        mask: "*",
        validate: (v: string) => v.trim().length > 10 || tr.newKeyTooShort,
      }]);
      resolvedApiKey = key.trim();
    } else if (method === "browser") {
      const url = step1.llm_provider === "anthropic"
        ? "https://console.anthropic.com/settings/keys"
        : "https://platform.openai.com/api-keys";
      console.log("");
      console.log(chalk.cyan("  " + tr.newBrowserOpening));
      console.log(chalk.gray(`  URL: ${url}`));
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
      resolvedApiKey = key.trim();
      apiKeyMethod = "paste";
    }
    // env → resolvedApiKey remains null (uses env var at runtime)
  }

  // Step 3 — fetch and list models
  let modelChoices: string[] = [];

  if (step1.llm_provider !== "none") {
    const spinner = ora(tr.newFetchingModels).start();
    try {
      if (step1.llm_provider === "anthropic") {
        const key = resolvedApiKey ?? process.env.ANTHROPIC_API_KEY ?? "";
        modelChoices = await fetchAnthropicModels(key);
      } else if (step1.llm_provider === "openai") {
        const key = resolvedApiKey ?? process.env.OPENAI_API_KEY ?? "";
        modelChoices = await fetchOpenAIModels(key);
      } else if (step1.llm_provider === "ollama") {
        modelChoices = await fetchOllamaModels();
      } else if (step1.llm_provider === "lmstudio") {
        modelChoices = await fetchLMStudioModels();
      } else {
        modelChoices = defaultModels(step1.llm_provider);
      }
      spinner.succeed(chalk.green(tr.newModelsLoaded + ` (${modelChoices.length})`));
    } catch {
      spinner.warn(chalk.yellow(tr.newModelsFallback));
      modelChoices = defaultModels(step1.llm_provider);
    }
  }

  // Step 4 — model selection + output + trust
  const step4 = await inquirer.prompt<Pick<WizardAnswers, "llm_model" | "output_format" | "trust_level">>([
    {
      type: "list",
      name: "llm_model",
      message: chalk.white(tr.newModelName),
      when: step1.llm_provider !== "none",
      choices: modelChoices,
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

  // Merge answers
  const answers: WizardAnswers = {
    ...step1,
    llm_model: step4.llm_model ?? "",
    api_key_method: apiKeyMethod,
    api_key_value: resolvedApiKey ?? "",
    output_format: step4.output_format,
    trust_level: step4.trust_level,
  };

  // Create files
  const projectName = answers.name;
  const dest = targetDir
    ? path.resolve(targetDir, projectName)
    : path.resolve(process.cwd(), projectName);

  if (fs.existsSync(dest)) {
    console.log(chalk.red(`\n✗ ${tr.newDirExists} ${dest}`));
    process.exit(1);
  }

  const spinner = ora(tr.newCreating).start();

  try {
    fs.mkdirSync(dest, { recursive: true });

    const apiKeyVar = getApiKeyVar(answers.llm_provider);
    fs.writeFileSync(path.join(dest, "agent.yaml"), buildAgentYaml(answers, apiKeyVar, resolvedApiKey));
    fs.writeFileSync(path.join(dest, "agent.test.yaml"), buildTestYaml(answers.name));
    fs.writeFileSync(path.join(dest, "README.md"), buildReadme(answers));

    if (apiKeyVar && apiKeyMethod === "env") {
      fs.writeFileSync(path.join(dest, ".env.example"), `${apiKeyVar}=your-api-key-here\n`);
    }

    spinner.succeed(chalk.green(tr.newCreated));

    console.log("");
    console.log(chalk.bold("  📁 " + dest));
    console.log(chalk.gray("  ├── agent.yaml"));
    console.log(chalk.gray("  ├── agent.test.yaml"));
    console.log(chalk.gray("  ├── README.md"));
    if (apiKeyVar && apiKeyMethod === "env") {
      console.log(chalk.gray("  └── .env.example"));
    }
    console.log("");
    console.log(chalk.bold.cyan("  " + tr.newNextSteps));
    console.log(chalk.white(`  $ cd ${projectName}`));
    if (apiKeyVar && apiKeyMethod === "env") {
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

function buildAgentYaml(answers: WizardAnswers, apiKeyVar: string | null, resolvedKey: string | null): string {
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
    if (resolvedKey) {
      lines.push(`  api_key: "${resolvedKey}"`);
    } else if (apiKeyVar) {
      lines.push(`  api_key: "\${${apiKeyVar}}"`);
    }
    lines.push(`  temperature: 0.1`);
    lines.push(`  max_tokens: 1000`);
  }

  lines.push(``, `prompt:`, `  system: |`,
    `    You are ${answers.description}.`,
    `    Be concise, accurate, and helpful.`,
    `  user_template: "{{input}}"`, `  variables:`,
    `    - name: input`, `      required: true`, `      description: "The user's input"`,
    ``, `output:`, `  format: ${answers.output_format}`,
    ``, `tests:`, `  - file: agent.test.yaml`, ``);

  return lines.join("\n");
}

function buildTestYaml(agentName: string): string {
  return [
    `agent: "${agentName}"`, ``, `cases:`,
    `  - name: "basic test"`, `    input:`, `      input: "Hello, world!"`,
    `    expected_contains:`, `      - "Hello"`,
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
    `## Usage`, ``, "```bash", `cforge run`, `cforge test`, "```", ``,
    `---`, ``, `Built with [Clayton Forge](https://github.com/devclaytonn10/clayton-forge)`, ``,
  ].join("\n");
}
