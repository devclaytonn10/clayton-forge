# Message Schema — Standard Format for Agent Communication

> `02_PROTOCOLS / 02`
> Every message exchanged between agents follows this schema. Consistency here is what makes multi-agent systems debuggable.

---

## Why a Standard Schema

In a multi-agent system, messages are the blood. When they're inconsistent:
- You can't trace a request across agents
- You can't tell if a failure happened in the sender or receiver
- You can't build generic tooling (loggers, monitors, retriers)

When they're consistent:
- Every failure has a clear owner
- Every execution is traceable end-to-end
- You can build infrastructure once and reuse it everywhere

---

## The Envelope

Every message between agents uses this envelope, regardless of what's in the payload:

```json
{
  "message_id": "msg_7f3a9b2c4d5e6f7a",
  "trace_id": "trc_abc123def456",
  "span_id": "span_001",
  "parent_span_id": "span_000",

  "from": {
    "agent_id": "orchestrator_v2",
    "agent_version": "2.1.0",
    "instance_id": "inst_a3f9"
  },

  "to": {
    "agent_id": "research_agent_v1",
    "endpoint": "https://agents.internal/research/run"
  },

  "type": "task",
  "priority": "normal",

  "created_at": "2024-01-15T14:23:01.234Z",
  "expires_at": "2024-01-15T14:23:31.234Z",

  "payload": {
    "...": "agent-specific content here"
  },

  "metadata": {
    "attempt": 1,
    "max_attempts": 3,
    "idempotency_key": "idem_xyz789",
    "tags": ["production", "priority-customer"]
  }
}
```

---

## Field Reference

### Identification Fields

| Field | Type | Required | Description |
|---|---|---|---|
| `message_id` | string (uuid) | Yes | Unique ID for this specific message. Format: `msg_` + 16 hex chars |
| `trace_id` | string | Yes | Shared across all messages in a single user request. Format: `trc_` + 12 alphanum |
| `span_id` | string | Yes | ID for this specific operation within the trace. Format: `span_` + 3-digit sequence |
| `parent_span_id` | string | No | The span that triggered this one. Null if this is the root. |

**Tracing example:**
```
User request arrives at orchestrator
  trace_id = "trc_abc123"
  span_id  = "span_001"   (orchestrator root)
  │
  ├── Calls Agent A
  │     trace_id = "trc_abc123"   ← same trace, different span
  │     span_id  = "span_002"
  │     parent   = "span_001"
  │
  └── Calls Agent B
        trace_id = "trc_abc123"   ← same trace, different span
        span_id  = "span_003"
        parent   = "span_001"

To reconstruct the full request: filter logs by trace_id = "trc_abc123"
```

### Routing Fields

| Field | Type | Required | Description |
|---|---|---|---|
| `from.agent_id` | string | Yes | Sending agent's ID |
| `from.agent_version` | string | Yes | Sending agent's version (semver) |
| `from.instance_id` | string | No | Specific instance, for load-balanced deployments |
| `to.agent_id` | string | Yes | Receiving agent's ID |
| `to.endpoint` | string | No | Explicit endpoint, overrides registry lookup |

### Type Field

| Value | Meaning | Expected Response |
|---|---|---|
| `task` | Request to perform work | `result` or `error` |
| `result` | Successful completion | None (fire-and-forget) |
| `error` | Failed completion | None |
| `status` | Progress update during long task | None |
| `cancel` | Request to cancel a running task | `result` (cancelled) |
| `heartbeat` | Agent is alive | `heartbeat` (optional) |

### Priority Field

| Value | Meaning | Processing |
|---|---|---|
| `critical` | Business-critical, maximum priority | Jump queue, alert if delayed |
| `high` | Important, process next | Front of queue |
| `normal` | Standard priority | Default queue |
| `low` | Background work | Back of queue |
| `batch` | Non-urgent bulk work | Process when idle |

### Timing Fields

| Field | Type | Required | Description |
|---|---|---|---|
| `created_at` | ISO 8601 datetime | Yes | When message was created |
| `expires_at` | ISO 8601 datetime | No | Message is invalid after this time. Use for time-sensitive tasks. |

### Metadata Fields

| Field | Type | Description |
|---|---|---|
| `attempt` | integer | Which retry attempt this is (1 = first attempt) |
| `max_attempts` | integer | Total attempts allowed before giving up |
| `idempotency_key` | string | Same key = same logical operation. Use to prevent duplicate processing. |
| `tags` | string[] | Labels for filtering, routing, and analytics |

---

## Standard Payload Schemas

### Task Payload

```json
{
  "payload": {
    "task_id": "task_uuid",
    "instruction": "What the agent should do — plain language",
    "input": {
      "...": "agent-specific input data"
    },
    "context": {
      "user_id": "if relevant",
      "session_id": "if relevant",
      "prior_results": "results from previous agents in the pipeline, if needed"
    },
    "constraints": {
      "max_tokens": 1000,
      "language": "pt-BR",
      "format": "json"
    }
  }
}
```

### Result Payload

```json
{
  "payload": {
    "task_id": "task_uuid",
    "status": "success",
    "result": {
      "...": "agent-specific output"
    },
    "confidence": 0.94,
    "tokens_used": 847,
    "duration_ms": 2340,
    "model_used": "claude-sonnet-4-6"
  }
}
```

### Partial Result Payload

```json
{
  "payload": {
    "task_id": "task_uuid",
    "status": "partial",
    "result": {
      "...": "what was completed"
    },
    "missing": [
      {
        "item": "what could not be completed",
        "reason": "why"
      }
    ],
    "confidence": 0.71,
    "tokens_used": 512,
    "duration_ms": 1800
  }
}
```

### Error Payload

```json
{
  "payload": {
    "task_id": "task_uuid",
    "status": "error",
    "error": {
      "code": "LLM_TIMEOUT",
      "message": "LLM did not respond within 30 seconds",
      "retryable": true,
      "retry_after_seconds": 5,
      "details": {
        "attempt": 3,
        "last_error_at": "2024-01-15T14:23:28.000Z"
      }
    },
    "tokens_used": 0,
    "duration_ms": 90000
  }
}
```

### Status Update Payload (for long-running tasks)

```json
{
  "payload": {
    "task_id": "task_uuid",
    "status": "in_progress",
    "progress": {
      "percent_complete": 45,
      "current_step": "Analyzing documents",
      "steps_completed": 3,
      "steps_total": 7,
      "estimated_completion_seconds": 30
    }
  }
}
```

---

## Message ID Generation

IDs must be:
- Globally unique
- Sortable by creation time (use time-based UUIDs or include timestamp prefix)
- Traceable to the generating agent

**Recommended format:**
```
message_id: "msg_" + timestamp_ms_base36 + "_" + random_4chars
Example: "msg_lp7h3k_a4f2"

trace_id: "trc_" + random_12_alphanum
Example: "trc_abc123def456"

span_id: "span_" + zero_padded_sequence
Example: "span_001", "span_002", ...
```

---

## Idempotency

The `idempotency_key` prevents duplicate processing when messages are retried.

**Rule:** If an agent receives a message with an `idempotency_key` it has already processed:
1. Do NOT process again
2. Return the original result from cache

```
Message received:
  idempotency_key = "idem_order_12345_audit"

Check idempotency store:
  → Found: return cached result immediately (no LLM call)
  → Not found: process normally, store result with key (TTL: 24h)
```

**When to use idempotency keys:**
- Any task that creates, modifies, or sends something
- Any task where duplicate execution has real-world consequences
- All financial, notification, and write operations

---

## Validation Rules

Before processing any incoming message:

```
1. message_id must be present and non-empty
2. trace_id must be present and non-empty
3. type must be one of: task | result | error | status | cancel | heartbeat
4. created_at must be a valid ISO 8601 datetime
5. If expires_at is present: reject if current_time > expires_at
6. payload must be present and valid JSON object
7. from.agent_id must be a known agent (or allowlisted)
```

If any validation fails: return error immediately without processing.

---

## Example: Full Multi-Agent Exchange

```
[Orchestrator] → [Research Agent]

POST https://agents.internal/research/run
{
  "message_id": "msg_lp7h3k_a4f2",
  "trace_id": "trc_abc123def456",
  "span_id": "span_002",
  "parent_span_id": "span_001",
  "from": { "agent_id": "orchestrator_v2", "agent_version": "2.0.1" },
  "to": { "agent_id": "research_agent_v1" },
  "type": "task",
  "priority": "normal",
  "created_at": "2024-01-15T14:23:01.234Z",
  "expires_at": "2024-01-15T14:23:31.234Z",
  "payload": {
    "task_id": "task_xyz789",
    "instruction": "Find the top 3 competitors of B&G Móveis and summarize their pricing models",
    "input": { "company": "B&G Móveis", "market": "Brazil", "segment": "furniture retail" },
    "constraints": { "language": "pt-BR", "max_tokens": 800 }
  },
  "metadata": { "attempt": 1, "max_attempts": 3, "idempotency_key": "idem_research_bg_competitors_20240115" }
}


[Research Agent] → [Orchestrator] (success)

{
  "message_id": "msg_lp7h4m_b5g3",
  "trace_id": "trc_abc123def456",
  "span_id": "span_002",
  "from": { "agent_id": "research_agent_v1", "agent_version": "1.3.2" },
  "to": { "agent_id": "orchestrator_v2" },
  "type": "result",
  "created_at": "2024-01-15T14:23:05.891Z",
  "payload": {
    "task_id": "task_xyz789",
    "status": "success",
    "result": {
      "competitors": [
        { "name": "MadeiraMadeira", "pricing_model": "..." },
        { "name": "Tok&Stok", "pricing_model": "..." },
        { "name": "Etna", "pricing_model": "..." }
      ]
    },
    "confidence": 0.89,
    "tokens_used": 1240,
    "duration_ms": 4657
  }
}
```

---

*Next: `03_trust_model.md` — What agents are allowed to do*
