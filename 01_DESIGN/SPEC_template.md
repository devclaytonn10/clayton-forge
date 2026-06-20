# SPEC — Technical Specification

> **Clayton Forge Template v2.0**
> Fill this after the PRD is approved. This is the blueprint for implementation.
> Every technical decision made here must trace back to a requirement in the PRD.

---

## Document Header

| Field | Value |
|---|---|
| **Agent Name** | [Same as PRD] |
| **Spec Version** | v0.1 |
| **PRD Reference** | PRD_[agent-name]_v[X].md |
| **Author** | |
| **Created** | YYYY-MM-DD |
| **Status** | `Draft` / `In Review` / `Approved` |

---

## Section 1 — Technical Summary

One paragraph: how is this agent built? What are the key technical choices?

**[Write here]**

**Execution model:** `Synchronous` / `Asynchronous` / `Event-driven` / `Scheduled` / `Hybrid`

**Trigger mechanism:** `Webhook` / `Cron` / `Manual API call` / `Message queue` / `Event stream`

---

## Section 2 — Stack

> Clayton Forge is stack-agnostic. Document whatever you're using and why.

| Layer | Technology | Version | Why This Choice |
|---|---|---|---|
| **Orchestration / Runtime** | | | |
| **LLM Provider** | | | |
| **LLM Model** | | | |
| **Database** | | | |
| **Cache** | | | |
| **Queue / Messaging** | | | |
| **External APIs** | | | |
| **Observability** | | | |
| **Deployment** | | | |

---

## Section 3 — System Prompt

> The system prompt is code. Version it, test it, review it.

### 3.1 Prompt Structure

Every well-designed prompt has these sections (adapt as needed):

```
[SECTION 1 — IDENTITY]
Who is this agent? What is its role?

[SECTION 2 — CONTEXT AND DOMAIN]
What does it know about the domain?
What rules apply?

[SECTION 3 — BEHAVIOR]
What must it always do?
What must it never do?
How should it handle ambiguity?

[SECTION 4 — OUTPUT FORMAT]
Exactly how should it format responses?
JSON schema? Plain text? Structured sections?

[SECTION 5 — EXAMPLES (few-shot)]
Input → Expected output pairs
```

### 3.2 Current Prompt (v1.0)

```
[Paste full system prompt here]
```

### 3.3 Prompt Variables

| Variable | Type | Required | Description | Example |
|---|---|---|---|---|
| `{{var_1}}` | string | Yes | | |
| `{{var_2}}` | string | No | | |

### 3.4 LLM Parameters

| Parameter | Value | Rationale |
|---|---|---|
| **Model** | | |
| **Temperature** | | 0 = deterministic, 1 = creative |
| **Max output tokens** | | |
| **Top P** | [OPTIONAL] | |
| **Stop sequences** | [OPTIONAL] | |
| **Response format** | JSON / Text | |

### 3.5 Prompt Versioning

| Version | Date | What Changed | Test Results |
|---|---|---|---|
| v1.0 | | Initial | |

---

## Section 4 — Tools (Function Calling)

> Skip this section if the agent has no tools.

### Tool: [tool_name]

**Purpose:** [One sentence — what does this tool do and when should the agent use it?]

**Schema:**
```json
{
  "name": "tool_name",
  "description": "Clear description of what this tool does. The agent reads this to decide when to call it.",
  "parameters": {
    "type": "object",
    "properties": {
      "param_1": {
        "type": "string",
        "description": "What this parameter is"
      },
      "param_2": {
        "type": "integer",
        "description": "What this parameter is"
      }
    },
    "required": ["param_1"]
  }
}
```

**Implementation:**
- Endpoint / Function: `[URL or function name]`
- Method: `GET` / `POST` / `function call`
- Auth: `[API key / OAuth / none]`
- Timeout: `[X] seconds`
- Retry: `[yes/no — N times with backoff]`
- Rate limit: `[X requests per minute]`

**Response on success:**
```json
{
  "field": "type and description"
}
```

**Response on failure:**
```json
{
  "error": "description"
}
```

**Tool behavior rules for the agent:**
- Call this tool when: [condition]
- Do not call this tool when: [condition]
- If this tool fails: [behavior]

---

*(Repeat for each tool)*

---

## Section 5 — Data Flow

### 5.1 End-to-End Flow

```
[Describe the complete data journey from input to output]

Example:
1. INPUT:    Webhook receives {photo_url, driver_phone, timestamp}
2. VALIDATE: Check driver_phone exists in DB → get driver_id, checklist_id
3. RETRIEVE: Fetch checklist rules from DB → {rules[]}
4. ANALYZE:  Call LLM with photo + rules → {score, violations[], confidence}
5. VALIDATE: Score between 0–100? confidence > 0.6? violations is array?
6. PERSIST:  INSERT into compliance_records → {record_id}
7. NOTIFY:   If score < 70 → send Slack to coordinator
8. CONFIRM:  Send WhatsApp confirmation to driver
9. OUTPUT:   Return {status: "success", record_id, score}
```

### 5.2 Input Schema

```json
{
  "field_name": "type — description — required/optional"
}
```

### 5.3 Output Schema (Success)

```json
{
  "status": "success",
  "result": {},
  "execution_id": "string — unique ID for this run",
  "duration_ms": "number"
}
```

### 5.4 Output Schema (Error)

```json
{
  "status": "error",
  "error_code": "string — machine-readable",
  "error_message": "string — human-readable",
  "retryable": "boolean",
  "execution_id": "string"
}
```

### 5.5 Database Schema

```sql
-- Main table for this agent's outputs
CREATE TABLE [table_name] (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  execution_id UUID NOT NULL,
  -- agent-specific fields
  created_at   TIMESTAMPTZ DEFAULT now()
);

-- Indexes
CREATE INDEX idx_[table]_[field] ON [table_name]([field]);
```

---

## Section 6 — Error Handling

### 6.1 Error Classification

| Error | Type | Retryable | Max Retries | Backoff | Fallback |
|---|---|---|---|---|---|
| LLM timeout | Transient | Yes | 3 | Exponential | Lower-tier model |
| LLM invalid output | Recoverable | Yes | 1 | Fixed 2s | Return partial + flag |
| Tool unavailable | Transient | Yes | 3 | Exponential | Alert + queue |
| Input validation failed | Fatal | No | 0 | — | Reject with message |
| Rate limit exceeded | Transient | Yes | 5 | Fixed 60s | Queue |
| Context overflow | Fatal | No | 0 | — | Split or reject |
| Auth failure | Fatal | No | 0 | — | Alert immediately |

### 6.2 Retry Implementation

```
retry_policy:
  default:
    max_attempts: 3
    initial_delay_ms: 1000
    multiplier: 2
    max_delay_ms: 30000
    jitter: true

  rate_limit:
    max_attempts: 5
    delay_ms: 60000  # fixed, not exponential
```

### 6.3 Fallback Hierarchy

```
Primary:   [Ideal behavior]
Fallback 1: [Degraded but functional]
Fallback 2: [Minimal — partial result]
Fallback 3: [Human queue — agent cannot help]
```

### 6.4 Output Validation Rules

After every LLM response, validate before using:

```
Rule 1: [e.g., "Response must be valid JSON"]
Rule 2: [e.g., "score field must be integer 0–100"]
Rule 3: [e.g., "violations must be an array"]
Rule N: [domain-specific validation]

On validation failure:
  → Retry with corrective prompt (max 1 retry)
  → If still invalid: return error, do not guess
```

---

## Section 7 — Memory Implementation

> Reference `03_MEMORY_SYSTEM/memory_architecture.md` for design guidance.

### 7.1 Memory Types Used

| Type | Used? | What's Stored | Duration | Technology |
|---|---|---|---|---|
| Working (context window) | Yes/No | | Per call | — |
| Short-term cache | Yes/No | | [N] hours | |
| Long-term database | Yes/No | | [Policy] | |
| Semantic (vector) | Yes/No | | [Policy] | |

### 7.2 What Gets Stored

| Data | Storage | Retention | Why |
|---|---|---|---|
| | | | |

### 7.3 Retrieval Strategy

```
Before each LLM call, retrieve:
1. [What] from [where] using [how]
2. [What] from [where] using [how]

Inject into prompt at: [position in prompt]
Max tokens for retrieved context: [N]
If retrieved context exceeds limit: [truncate / summarize / prioritize recent]
```

---

## Section 8 — Observability

### 8.1 Structured Log Format

Every execution logs:
```json
{
  "execution_id": "uuid",
  "agent_id": "string",
  "agent_version": "semver",
  "timestamp_start": "ISO",
  "timestamp_end": "ISO",
  "duration_ms": "number",
  "trigger": { "type": "string", "source": "string" },
  "input_size_chars": "number",
  "input_hash": "sha256",
  "llm_calls": [
    {
      "model": "string",
      "tokens_input": "number",
      "tokens_output": "number",
      "latency_ms": "number",
      "cost_usd": "number"
    }
  ],
  "tools_called": [{ "tool": "string", "success": "boolean", "latency_ms": "number" }],
  "output_status": "success | partial | error",
  "error_code": "string | null",
  "retries": "number",
  "cost_total_usd": "number",
  "tokens_total": "number"
}
```

### 8.2 Metrics

| Metric | How Measured | Alert Threshold |
|---|---|---|
| Success rate | succeeded/total | < 95% |
| P95 latency | 95th percentile duration_ms | > [X] ms |
| Daily cost | sum cost_total_usd per day | > $[X] |
| Token usage (avg) | avg tokens_total | > [2x baseline] |
| Retry rate | retries > 0 / total | > 10% |

### 8.3 Alert Configuration

| Condition | Channel | Severity | Who Gets It |
|---|---|---|---|
| Error rate > 5% for 15 min | Slack #alerts | High | On-call |
| P95 latency > [X]s | Slack #alerts | Medium | On-call |
| Daily cost > 80% budget | Slack #alerts | Medium | Owner |
| Any auth failure | Slack #alerts | Critical | Owner + Lead |

---

## Section 9 — Security

### 9.1 Authentication

| Interface | Auth Method | Token Storage |
|---|---|---|
| Incoming webhook | Shared secret / HMAC | Environment variable |
| LLM API | API key | Environment variable |
| Database | Connection string | Environment variable |
| External APIs | [method] | Environment variable |

### 9.2 Input Sanitization

```
Before passing user-controlled input to the LLM:
  1. Validate length: reject if > [N] characters
  2. Validate format: must match [expected pattern]
  3. Separate user input from system prompt with clear delimiter
  4. Flag if input contains instruction-like patterns
```

### 9.3 Data Handling

| Data Type | In Prompt? | In Logs? | In DB? | Retention |
|---|---|---|---|---|
| PII (name, email, phone) | Masked only | Never raw | Encrypted | [policy] |
| Order / transaction data | Needed fields only | Hashed | Yes | [policy] |
| Photos / media | URL only | URL only | Never | [policy] |

---

## Section 10 — Cost Model

| Item | Calculation | Monthly Estimate |
|---|---|---|
| LLM input tokens | [tokens/call] × [calls/day] × [cost/1M] × 30 | $[X] |
| LLM output tokens | [tokens/call] × [calls/day] × [cost/1M] × 30 | $[X] |
| External API calls | [calls/day] × [cost/call] × 30 | $[X] |
| Database | [storage + reads/writes] | $[X] |
| Infrastructure | | $[X] |
| **Total** | | **$[X]/month** |

**Hard limits:**
- Per execution: $[X]
- Per day: $[X]
- Per month: $[X]

---

## Section 11 — Environment Variables

```env
# LLM
LLM_API_KEY=
LLM_MODEL=
LLM_MAX_TOKENS=

# Database
DATABASE_URL=

# Cache
CACHE_URL=
CACHE_TTL_SECONDS=

# External APIs
[API_NAME]_KEY=
[API_NAME]_BASE_URL=

# Agent Config
AGENT_ID=
AGENT_VERSION=
LOG_LEVEL=INFO
COST_LIMIT_PER_EXECUTION_USD=
COST_LIMIT_DAILY_USD=

# Notifications
ALERT_CHANNEL=
ESCALATION_CONTACT=
```

---

## Section 12 — Testing Plan

### 12.1 Test Cases Required

| # | Input | Expected Output | Tests What |
|---|---|---|---|
| T01 | [happy path input] | [expected] | Primary use case |
| T02 | [edge case] | [expected] | Handles [specific edge case] |
| T03 | [invalid input] | Error: INPUT_VALIDATION_FAILED | Input validation |
| T04 | [ambiguous input] | [expected + low confidence flag] | Uncertainty handling |
| T05 | [very long input] | Error: CONTEXT_OVERFLOW or truncated | Context limit |

### 12.2 Acceptance Test

Run these before every production deployment:
- [ ] All T0X test cases pass
- [ ] P95 latency < [X]s under [N] concurrent requests
- [ ] Cost per execution < $[X] on 20 real inputs
- [ ] Error rate < 2% on 50 real inputs
- [ ] No PII appears in logs

---

*With this SPEC complete, proceed to `ARCHITECTURE_template.md`.*
