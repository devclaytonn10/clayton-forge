import * as fs from "fs";
import * as path from "path";
import * as os from "os";

// ─────────────────────────────────────────────
// Config file: ~/.cforge/config.json
// ─────────────────────────────────────────────

const CONFIG_DIR = path.join(os.homedir(), ".cforge");
const CONFIG_FILE = path.join(CONFIG_DIR, "config.json");

export type Lang = "en" | "pt";

interface CforgeConfig {
  lang: Lang;
}

export function loadConfig(): CforgeConfig {
  try {
    if (fs.existsSync(CONFIG_FILE)) {
      const raw = fs.readFileSync(CONFIG_FILE, "utf-8");
      return JSON.parse(raw) as CforgeConfig;
    }
  } catch {
    // ignore
  }
  return { lang: "en" };
}

export function saveConfig(config: CforgeConfig): void {
  fs.mkdirSync(CONFIG_DIR, { recursive: true });
  fs.writeFileSync(CONFIG_FILE, JSON.stringify(config, null, 2), "utf-8");
}

export function getLang(): Lang {
  return loadConfig().lang;
}

// ─────────────────────────────────────────────
// Translations
// ─────────────────────────────────────────────

export const translations = {
  en: {
    // index
    tagline: "Build AI agents with confidence.",
    selectLang: "🌐 Language / Idioma:",
    commands: "Available commands:",
    cmdNew: "Create a new agent",
    cmdRun: "Execute an agent",
    cmdTest: "Run the agent test suite",
    cmdValidate: "Validate agent.yaml",
    tip: "Run cforge <command> --help for usage details.",

    // new
    newHeader: "Let's create your agent. Answer a few questions.",
    newCancel: "Press Ctrl+C at any time to cancel.",
    newAgentName: "Agent name",
    newAgentNameHint: "(kebab-case, e.g. invoice-classifier):",
    newAgentNameError: "Use lowercase letters, numbers, and hyphens only",
    newDescription: "What does this agent do?",
    newDescriptionError: "Please write a short description",
    newAgentType: "Agent type:",
    newTypeReactive: "reactive     — receives input → processes → responds",
    newTypeProactive: "proactive    — acts on triggers without waiting for input",
    newTypePipeline: "pipeline     — sequential steps, each feeding the next",
    newTypeOrchestrator: "orchestrator — coordinates other agents",
    newTypeWorker: "worker       — executed by an orchestrator",
    newLLMProvider: "LLM provider:",
    newModelName: "Model name:",
    newAuthMethod: "How do you want to authenticate?",
    newAuthEnv: "env var       — use $KEY (already set in your environment)",
    newAuthPaste: "paste key     — type or paste your API key now",
    newAuthBrowser: "browser login — open the console to generate a key automatically",
    newPasteKey: "Paste your API key:",
    newKeyTooShort: "Key seems too short",
    newOutputFormat: "Output format:",
    newOutputText: "text     — plain text response",
    newOutputJson: "json     — structured JSON (add output schema)",
    newOutputMarkdown: "markdown — formatted markdown",
    newTrustLevel: "Trust level:",
    newTrust0: "0 — sandboxed  (no external access)",
    newTrust1: "1 — read-only  (reads data, no writes)",
    newTrust2: "2 — write      (reads and writes)",
    newTrust3: "3 — admin      (full control)",
    newBrowserOpening: "Opening your browser to generate an API key...",
    newBrowserFallback: "Could not open browser automatically. Please open the URL above manually.",
    newPasteBrowserKey: "Paste the key you just created:",
    newCreating: "Creating your agent...",
    newCreated: "Agent created!",
    newFailed: "Failed to create agent",
    newDirExists: "Directory already exists:",
    newNextSteps: "Next steps:",
    newEnvHint: "# add your API key",

    // run
    runNotFound: "✗ No agent.yaml found. Run this command inside an agent directory.",
    runInvalidYaml: "✗ Invalid agent.yaml:",
    runRunning: "Running agent...",
    runDone: "Done",
    runOutput: "Output:",
    runTokens: "Tokens:",
    runFailed: "Execution failed",
    runError: "Error:",

    // test
    testNotFound: "✗ No agent.yaml found.",
    testInvalidYaml: "✗ Invalid agent.yaml:",
    testNoFiles: "✗ No test files found. Create agent.test.yaml first.",
    testRunning: "Running tests...",
    testTesting: "Testing:",
    testProvider: "Provider:",
    testFile: "File:",
    testCases: "Cases:",
    testPass: "PASS",
    testFail: "FAIL",
  },

  pt: {
    // index
    tagline: "Construa agentes de IA com confiança.",
    selectLang: "🌐 Language / Idioma:",
    commands: "Comandos disponíveis:",
    cmdNew: "Criar um novo agente",
    cmdRun: "Executar um agente",
    cmdTest: "Rodar a suite de testes",
    cmdValidate: "Validar o agent.yaml",
    tip: "Execute cforge <comando> --help para detalhes de uso.",

    // new
    newHeader: "Vamos criar seu agente. Responda algumas perguntas.",
    newCancel: "Pressione Ctrl+C a qualquer momento para cancelar.",
    newAgentName: "Nome do agente",
    newAgentNameHint: "(kebab-case, ex: classificador-faturas):",
    newAgentNameError: "Use apenas letras minúsculas, números e hífens",
    newDescription: "O que este agente faz?",
    newDescriptionError: "Por favor escreva uma descrição curta",
    newAgentType: "Tipo de agente:",
    newTypeReactive: "reactive     — recebe input → processa → responde",
    newTypeProactive: "proactive    — age em gatilhos sem esperar input",
    newTypePipeline: "pipeline     — etapas sequenciais, cada uma alimenta a próxima",
    newTypeOrchestrator: "orchestrator — coordena outros agentes",
    newTypeWorker: "worker       — executado por um orchestrator",
    newLLMProvider: "Provedor de LLM:",
    newModelName: "Nome do modelo:",
    newAuthMethod: "Como você quer autenticar?",
    newAuthEnv: "env var       — usar $KEY (já definida no seu ambiente)",
    newAuthPaste: "colar a key   — digitar ou colar sua API key agora",
    newAuthBrowser: "login browser — abrir o console para gerar a key automaticamente",
    newPasteKey: "Cole sua API key:",
    newKeyTooShort: "A key parece curta demais",
    newOutputFormat: "Formato de saída:",
    newOutputText: "text     — resposta em texto simples",
    newOutputJson: "json     — JSON estruturado (adicionar schema de saída)",
    newOutputMarkdown: "markdown — markdown formatado",
    newTrustLevel: "Nível de confiança:",
    newTrust0: "0 — sandboxed  (sem acesso externo)",
    newTrust1: "1 — read-only  (lê dados, sem escrita)",
    newTrust2: "2 — write      (lê e escreve)",
    newTrust3: "3 — admin      (controle total)",
    newBrowserOpening: "Abrindo seu navegador para gerar uma API key...",
    newBrowserFallback: "Não foi possível abrir o navegador automaticamente. Abra a URL acima manualmente.",
    newPasteBrowserKey: "Cole a key que você acabou de criar:",
    newCreating: "Criando seu agente...",
    newCreated: "Agente criado!",
    newFailed: "Falha ao criar agente",
    newDirExists: "Diretório já existe:",
    newNextSteps: "Próximos passos:",
    newEnvHint: "# adicione sua API key",

    // run
    runNotFound: "✗ Nenhum agent.yaml encontrado. Execute este comando dentro de um diretório de agente.",
    runInvalidYaml: "✗ agent.yaml inválido:",
    runRunning: "Executando agente...",
    runDone: "Concluído",
    runOutput: "Saída:",
    runTokens: "Tokens:",
    runFailed: "Execução falhou",
    runError: "Erro:",

    // test
    testNotFound: "✗ Nenhum agent.yaml encontrado.",
    testInvalidYaml: "✗ agent.yaml inválido:",
    testNoFiles: "✗ Nenhum arquivo de teste encontrado. Crie o agent.test.yaml primeiro.",
    testRunning: "Rodando testes...",
    testTesting: "Testando:",
    testProvider: "Provedor:",
    testFile: "Arquivo:",
    testCases: "Casos:",
    testPass: "PASSOU",
    testFail: "FALHOU",
  },
} as const;

export type T = typeof translations.en;

export function t(): typeof translations.en | typeof translations.pt {
  return translations[getLang()];
}
