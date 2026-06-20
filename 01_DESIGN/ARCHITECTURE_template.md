# ARCHITECTURE — Agent Architecture Document

> **Clayton Forge Template v2.0**
> Documents the structural decisions of your agent. Every ADR here answers a question that would otherwise be re-debated in every session.

---

## Document Header

| Field | Value |
|---|---|
| **Agent Name** | |
| **Architecture Version** | v1.0 |
| **SPEC Reference** | SPEC_[agent-name]_v[X].md |
| **Author** | |
| **Last Updated** | YYYY-MM-DD |

---

## Section 1 — System Diagram

### 1.1 High-Level View

```
[TRIGGER / INPUT]
       │
       ▼
[AGENT BOUNDARY — everything inside is this agent's responsibility]
│                                                                   │
│   [PERCEPTION]    [MEMORY]    [PLANNING]    [EXECUTION]          │
│                                                                   │
[OUTPUT / ACTIONS]
       │
       ▼
[WORLD — systems this agent affects]
```

### 1.2 Component Diagram

```
[Draw your specific component layout here]

Example:

┌──────────────────────────────────────────────────────────────────┐
│                    DELIVERY COMPLIANCE AGENT                     │
│                                                                  │
│  ┌─────────────┐   ┌──────────────┐   ┌──────────────────────┐  │
│  │  WEBHOOK    │   │    CORE      │   │     NOTIFIER         │  │
│  │  RECEIVER   │──▶│  (LLM loop)  │──▶│  Slack + WhatsApp    │  │
│  └─────────────┘   └──────┬───────┘   └──────────────────────┘  │
│                           │                                      │
│              ┌────────────┼────────────┐                        │
│              ▼            ▼            ▼                        │
│       ┌──────────┐ ┌──────────┐ ┌──────────┐                   │
│       │ Driver   │ │  Photo   │ │  Logger  │                   │
│       │ Lookup   │ │ Analyzer │ │          │                   │
│       └──────────┘ └──────────┘ └──────────┘                   │
│              │            │            │                        │
└──────────────┼────────────┼────────────┼────────────────────────┘
               │            │            │
               ▼            ▼            ▼
          [Supabase]  [Claude Vision] [Supabase]
```

### 1.3 Sequence Diagram (Primary Flow)

```
[Actor/Trigger]   [Agent]   [Tool A]   [Tool B]   [Output]
      │              │          │          │           │
      │──trigger────▶│          │          │           │
      │              │──call───▶│          │           │
      │              │◀─result──│          │           │
      │              │──call──────────────▶│           │
      │              │◀─result─────────────│           │
      │              │                     │           │
      │              │─────────────────────────────────▶│
      │              │          │          │           │
```

---

## Section 2 — Architecture Decision Records (ADRs)

> An ADR captures a significant architectural decision: the context, the options considered, the choice made, and the consequences. Write one for every non-obvious decision.
>
> Rule: If someone asks "why did we do it this way?" and the answer isn't obvious — it needs an ADR.

---

### ADR-001: [Decision Title]

| Field | Value |
|---|---|
| **Status** | `Proposed` / `Accepted` / `Deprecated` / `Superseded by ADR-00X` |
| **Date** | YYYY-MM-DD |
| **Decided by** | |
| **PRD Requirement** | [Which requirement drove this decision] |

**Context:**
What situation or constraint forced this decision? What was unclear or in conflict?

**Options Considered:**

| Option | Description | Pros | Cons |
|---|---|---|---|
| A | | | |
| B | | | |
| C | | | |

**Decision:**
> We chose Option [X] because [reason]. The key factor was [factor].

**Consequences:**
- ✅ [Positive outcome]
- ✅ [Positive outcome]
- ⚠️ [Trade-off or limitation accepted]
- ⚠️ [Trade-off or limitation accepted]

**Revisit when:**
[Condition that would make us reconsider — e.g., "If volume exceeds 10k/day, revisit caching strategy"]

---

### ADR-002: [Decision Title]

| Field | Value |
|---|---|
| **Status** | |
| **Date** | |
| **Decided by** | |
| **PRD Requirement** | |

**Context:**

**Options Considered:**

| Option | Description | Pros | Cons |
|---|---|---|---|
| A | | | |
| B | | | |

**Decision:**

**Consequences:**

**Revisit when:**

---

### ADR-003: [Decision Title]

*(Copy ADR block for each additional decision)*

---

## Section 3 — Integration Patterns

### 3.1 How the Agent Receives Input

| Pattern | Used? | Details |
|---|---|---|
| Webhook (push) | Yes/No | `POST /agent/run` — caller sends data |
| Polling | Yes/No | Agent checks [source] every [interval] |
| Schedule (cron) | Yes/No | Runs at [cron expression] |
| Event stream | Yes/No | Subscribes to [topic/queue] |
| Manual API call | Yes/No | `POST /run` with auth |

**Webhook security (if applicable):**
```
Validation:
  1. Verify signature: HMAC-SHA256 of body with shared secret
  2. Check timestamp: reject if > 5 minutes old (replay attack prevention)
  3. Validate Content-Type: must be application/json
  4. Validate payload schema before processing
```

### 3.2 How the Agent Delivers Output

| Output | Target | Method | Format |
|---|---|---|---|
| | | HTTP POST / DB write / Message | JSON / Text |

### 3.3 External Dependencies Map

```
[AGENT]
   │
   ├──reads──▶ [System A] — what data, how often, criticality
   ├──reads──▶ [System B]
   ├──writes─▶ [System C]
   └──calls──▶ [LLM Provider]
```

**Dependency risk assessment:**

| Dependency | Criticality | SLA | What happens if it fails |
|---|---|---|---|
| LLM Provider | Critical | 99.9% | Agent cannot operate — activate fallback |
| [System A] | High | [SLA] | [fallback] |
| [System B] | Medium | [SLA] | [fallback] |

---

## Section 4 — State Machine

> If your agent has multiple distinct states, document the transitions here.

```
States:
  IDLE        → Waiting for input
  RECEIVING   → Validating and parsing input
  RETRIEVING  → Fetching context from memory/tools
  REASONING   → LLM is processing
  EXECUTING   → Running tool calls
  VALIDATING  → Checking output quality
  DELIVERING  → Sending output / taking action
  ERROR       → Failure state
  COMPLETE    → Successful completion

Transitions:
  IDLE        → RECEIVING     : trigger received
  RECEIVING   → RETRIEVING    : input valid
  RECEIVING   → ERROR         : input invalid
  RETRIEVING  → REASONING     : context assembled
  REASONING   → EXECUTING     : tool call required
  REASONING   → VALIDATING    : direct response
  EXECUTING   → REASONING     : tool result received
  EXECUTING   → ERROR         : tool call failed (after retries)
  VALIDATING  → DELIVERING    : output valid
  VALIDATING  → REASONING     : output invalid, retry
  DELIVERING  → COMPLETE      : output delivered
  ERROR       → [ESCALATE]    : notify human
```

---

## Section 5 — Scalability and Limits

### 5.1 Current Limits

| Limit | Value | What Happens When Exceeded |
|---|---|---|
| Concurrent executions | [N] | Queue additional requests |
| Requests per minute | [N] | Rate limit — return 429 |
| Input size | [N] chars | Reject with CONTEXT_OVERFLOW |
| LLM context window | [N] tokens | Truncate or split |
| Daily budget | $[N] | Pause until reset |

### 5.2 Scaling Path

```
Current: [N] executions/day — single instance
Phase 2: [N] executions/day — [what changes]
Phase 3: [N] executions/day — [what changes]
```

### 5.3 Bottlenecks

| Component | Bottleneck | Mitigation |
|---|---|---|
| LLM calls | Latency + cost | Caching, model selection |
| [Tool A] | Rate limit | Queuing |
| Database | Write throughput | Connection pooling, batching |

---

## Section 6 — Environments

| Env | Purpose | Key Differences |
|---|---|---|
| **Development** | Local testing | Cheaper model, no real notifications sent |
| **Staging** | Integration testing | Real APIs, real model, test data |
| **Production** | Live | Full cost limits, all alerts active |

**Config differences by environment:**
```yaml
development:
  llm_model: [cheaper-model]
  notifications_enabled: false
  log_level: DEBUG
  cost_limit_daily: 1.00

staging:
  llm_model: [production-model]
  notifications_enabled: true  # but to test channels only
  log_level: INFO
  cost_limit_daily: 10.00

production:
  llm_model: [production-model]
  notifications_enabled: true
  log_level: WARN
  cost_limit_daily: [budget]
```

---

## Section 7 — Architecture Changelog

| Version | Date | Change | Reason | ADR |
|---|---|---|---|---|
| 1.0 | | Initial architecture | | — |

---

*With this ARCHITECTURE complete, proceed to `KNOWLEDGE_BASE_template.md`.*
