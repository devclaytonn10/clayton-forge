# Agent Registry — Managing Your Agent Ecosystem

> `05_MULTI_AGENT / 02`
> As you build more agents, you need a single source of truth for what exists, what it does, and how to use it.

---

## What Is the Agent Registry?

The agent registry is the catalogue of all agents in your system. It's the answer to:
- "What agents do we have?"
- "Who is responsible for agent X?"
- "What does agent X accept as input?"
- "Is agent X healthy right now?"
- "Which agents can I use to accomplish task Y?"

In small systems (2–3 agents), the registry can be a markdown file. In larger systems, it becomes a database or service.

---

## Registry Entry Template

One entry per agent. Keep this updated — an outdated registry is worse than no registry.

```yaml
# ─── AGENT REGISTRY ENTRY ───────────────────────────────────────

id: "agent_unique_id"
name: "Human Readable Name"
version: "2.1.0"
status: "active"           # active | deprecated | experimental | disabled
type: "reactive"           # reflex | reactive | tool_use | memory | planning | orchestrator

description: >
  One paragraph describing what this agent does, when to use it,
  and what makes it different from similar agents.

owner:
  team: "team-name"
  primary: "person-or-email"
  escalation: "manager-or-email"

# ─── CONTRACT ───────────────────────────────────────────────────

input:
  trigger: "webhook | schedule | event | manual"
  endpoint: "https://agents.internal/[agent-id]/run"
  method: "POST"
  auth: "bearer_token | api_key | hmac"
  schema:
    - field: "field_name"
      type: "string"
      required: true
      description: "what this field contains"
  example:
    field_name: "example value"

output:
  success_schema:
    status: "success"
    result: {}
    confidence: 0.0-1.0
    execution_id: "string"
    duration_ms: 0
    tokens_used: 0
  error_codes:
    - code: "INPUT_VALIDATION_FAILED"
      retryable: false
    - code: "LLM_TIMEOUT"
      retryable: true
      retry_after_seconds: 5

# ─── PERFORMANCE ────────────────────────────────────────────────

performance:
  timeout_seconds: 30
  expected_latency_p50_ms: 1500
  expected_latency_p95_ms: 4000
  max_tokens_per_call: 2000
  max_cost_per_execution_usd: 0.05
  max_concurrent_executions: 10

# ─── DEPENDENCIES ───────────────────────────────────────────────

depends_on:
  llm: "claude-sonnet-4-6"
  external_apis:
    - name: "Supabase"
      criticality: "high"
      fallback: "return cached result"
    - name: "Slack API"
      criticality: "low"
      fallback: "log notification, skip sending"
  other_agents: []

# ─── OPERATIONAL ────────────────────────────────────────────────

health_check: "GET https://agents.internal/[agent-id]/health"
logs: "https://dashboard.internal/logs?agent=[agent-id]"
metrics: "https://dashboard.internal/metrics?agent=[agent-id]"
runbook: "docs/06_OPERATIONS/runbook_[agent-id].md"
spec: "docs/01_DESIGN/SPEC_[agent-name].md"

# ─── HISTORY ────────────────────────────────────────────────────

changelog:
  - version: "2.1.0"
    date: "2024-01-15"
    changes: "Added confidence scoring"
  - version: "2.0.0"
    date: "2024-01-01"
    changes: "Breaking: output format changed to include execution_id"
  - version: "1.0.0"
    date: "2023-12-01"
    changes: "Initial release"

deprecated_versions:
  - version: "1.x"
    sunset_date: "2024-02-01"
    migration_guide: "Update output parser to include execution_id field"
```

---

## Registry Index

The registry index is the top-level view of all agents. Keep this as a quick-reference table.

| Agent ID | Name | Type | Status | Version | Owner | Purpose |
|---|---|---|---|---|---|---|
| `research_agent` | Research Agent | Planning | Active | 1.3.2 | data-team | Find and synthesize information |
| `writer_agent` | Content Writer | Reactive | Active | 2.0.1 | content-team | Generate written content |
| `reviewer_agent` | Quality Reviewer | Reactive | Active | 1.1.0 | content-team | Review content quality |
| `triage_agent` | Support Triage | Tool Use | Active | 3.2.1 | support-team | Classify support tickets |
| `orchestrator_v2` | Content Pipeline | Orchestrator | Active | 2.1.0 | content-team | Manages content pipeline |
| `old_classifier` | Legacy Classifier | Reflex | Deprecated | 1.0.0 | — | Superseded by triage_agent |

---

## Finding the Right Agent

Use this decision flow when building a new orchestrator or pipeline:

```
What do I need to accomplish?
         │
         ▼
Search registry by:
  1. type field (what kind of agent?)
  2. description (what does it do?)
  3. tags (domain, capability)
         │
         ▼
Found candidates?
  │                │
  Yes              No
  │                │
  ▼                ▼
Review:        Build a new agent
  - input schema  (use Clayton Forge process)
  - output schema
  - performance SLA
  - dependencies
  - status (not deprecated?)
         │
         ▼
Run integration test
(send a test message, validate response)
         │
         ▼
Register dependency in your agent's SPEC
```

---

## Registry Governance

### Who Can Add to the Registry

- Any team can add their own agents
- New entries must include: all required fields, a runbook, and a passing health check
- Experimental agents are tagged `status: experimental` — not used in production orchestrators

### Who Can Deprecate

- The owning team, after:
  1. Notifying all known callers
  2. Setting a sunset date (minimum 30 days notice)
  3. Providing a migration guide

### Registry Review Cadence

Every 90 days, review:
- Are all `active` agents actually still in use?
- Are deprecated agents past their sunset date? (Remove entries, archive docs)
- Are there agents without runbooks? (Block until runbook is written)
- Are SLAs in the registry still accurate? (Update from metrics data)

---

## Capability Tags

Use consistent tags to make agent discovery easier:

| Tag | Meaning |
|---|---|
| `text-generation` | Produces written content |
| `classification` | Categorizes input into defined classes |
| `extraction` | Pulls structured data from unstructured input |
| `summarization` | Condenses longer content |
| `retrieval` | Searches and returns relevant information |
| `analysis` | Evaluates, scores, or interprets data |
| `notification` | Sends messages to humans or systems |
| `transformation` | Converts data from one format to another |
| `orchestration` | Manages other agents |
| `vision` | Processes image input |
| `code` | Generates or evaluates code |

---

## Health Monitoring

Every agent in the registry should expose a `/health` endpoint:

```json
GET /health

200 OK:
{
  "status": "healthy",
  "version": "2.1.0",
  "uptime_seconds": 86400,
  "last_execution_at": "2024-01-15T14:23:01Z",
  "metrics_1h": {
    "executions": 145,
    "success_rate": 0.98,
    "avg_latency_ms": 1847,
    "total_cost_usd": 0.72
  },
  "dependencies": {
    "llm_api": "healthy",
    "database": "healthy",
    "slack_api": "degraded"  ← shows which dependency is the problem
  }
}

503 Service Unavailable:
{
  "status": "unhealthy",
  "reason": "LLM API not responding",
  "since": "2024-01-15T14:00:00Z"
}
```

---

*Next: `03_emergent_behavior.md` — What happens when agents interact in unexpected ways*
