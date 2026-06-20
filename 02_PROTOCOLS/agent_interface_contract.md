# Agent Interface Contract — How Agents Communicate

> `02_PROTOCOLS / 01`
> Every agent in a system must honor a contract. This document defines what that contract looks like.

---

## Why Contracts Matter

When a single agent fails, you debug one system. When a multi-agent system fails, you need to know:

- Which agent produced the bad data?
- Did the message arrive in the right format?
- Did the receiving agent interpret it correctly?
- Who is responsible for the error?

Without formal contracts between agents, these questions are unanswerable. With contracts, they're obvious.

**A contract is the specification of what an agent promises to accept as input and deliver as output — and what it promises to do when something goes wrong.**

---

## The Three Parts of Every Agent Contract

```
┌─────────────────────────────────────────────────────────────────┐
│                      AGENT CONTRACT                             │
│                                                                 │
│  ┌─────────────────┐                                           │
│  │  INPUT CONTRACT │  ← What I accept                         │
│  │                 │    Format, required fields, validation    │
│  └─────────────────┘                                           │
│                                                                 │
│  ┌──────────────────┐                                          │
│  │ OUTPUT CONTRACT  │  ← What I deliver                       │
│  │                  │    Format, fields, guarantees            │
│  └──────────────────┘                                          │
│                                                                 │
│  ┌──────────────────┐                                          │
│  │  ERROR CONTRACT  │  ← What I do when I fail                │
│  │                  │    Error types, retry behavior, fallback │
│  └──────────────────┘                                          │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

---

## Standard Agent Contract Template

Use this template to document every agent in your system.

```yaml
# AGENT CONTRACT
# Fill one of these per agent.

agent:
  id: "agent_unique_id"
  name: "Human-readable name"
  version: "1.0.0"
  type: "reactive | tool_use | memory | planning | orchestrator"
  description: "One sentence: what this agent does"

# ─── INPUT CONTRACT ───────────────────────────────────────────────

input:
  trigger:
    type: "webhook | schedule | event | manual | message"
    details: "POST /agent/run | cron: 0 * * * * | event: order.created"

  schema:
    # List every field the agent expects
    - field: "field_name"
      type: "string | number | boolean | array | object"
      required: true
      description: "What this field contains"
      validation: "max 500 chars | must be valid UUID | one of: [A, B, C]"

  example_input:
    field_name: "example value"

  rejection_behavior:
    # What happens if input fails validation?
    action: "return_error | use_default | discard"
    error_message: "Template: 'Invalid input: {reason}'"

# ─── OUTPUT CONTRACT ──────────────────────────────────────────────

output:
  on_success:
    http_status: 200
    schema:
      - field: "status"
        type: "string"
        value: "success"
        description: "Always 'success' on successful completion"
      - field: "result"
        type: "object"
        description: "The main output of this agent"
      - field: "confidence"
        type: "number"
        description: "0.0 to 1.0 — how confident the agent is"
      - field: "execution_id"
        type: "string"
        description: "Unique ID for this execution (for tracing)"
      - field: "duration_ms"
        type: "number"
        description: "Execution time in milliseconds"
      - field: "tokens_used"
        type: "number"
        description: "LLM tokens consumed"

    example_output:
      status: "success"
      result: {}
      confidence: 0.92
      execution_id: "exec_abc123"
      duration_ms: 2340
      tokens_used: 847

  on_partial:
    # When the agent completes but with reduced quality or missing data
    http_status: 206
    schema:
      - field: "status"
        value: "partial"
      - field: "result"
        description: "What was completed"
      - field: "missing"
        description: "What could not be completed and why"

# ─── ERROR CONTRACT ───────────────────────────────────────────────

errors:
  standard_error_schema:
    - field: "status"
      value: "error"
    - field: "error_code"
      description: "Machine-readable error identifier"
    - field: "error_message"
      description: "Human-readable description"
    - field: "retryable"
      type: "boolean"
      description: "Whether the caller should retry"
    - field: "retry_after_seconds"
      description: "If retryable, how long to wait"
    - field: "execution_id"
      description: "For tracing"

  error_types:
    - code: "INPUT_VALIDATION_FAILED"
      retryable: false
      description: "Input does not match expected schema"
      action: "Caller must fix input before retrying"

    - code: "LLM_TIMEOUT"
      retryable: true
      retry_after: 5
      description: "LLM did not respond within timeout"
      action: "Retry with same input after wait"

    - code: "LLM_INVALID_OUTPUT"
      retryable: true
      retry_after: 2
      description: "LLM response could not be parsed"
      action: "Retry once. If fails again, escalate."

    - code: "TOOL_UNAVAILABLE"
      retryable: true
      retry_after: 30
      description: "External tool/API is not responding"
      action: "Retry with backoff. Alert if persists."

    - code: "RATE_LIMIT_EXCEEDED"
      retryable: true
      retry_after: 60
      description: "API rate limit reached"
      action: "Queue and retry after wait"

    - code: "CONTEXT_OVERFLOW"
      retryable: false
      description: "Input exceeds context window"
      action: "Caller must reduce input size"

    - code: "ESCALATION_REQUIRED"
      retryable: false
      description: "Task requires human judgment"
      action: "Route to human queue"

    - code: "INTERNAL_ERROR"
      retryable: false
      description: "Unexpected failure"
      action: "Log, alert, investigate"

# ─── PERFORMANCE CONTRACT ─────────────────────────────────────────

performance:
  timeout_seconds: 30
  max_tokens_per_call: 2000
  expected_latency_p50_ms: 1500
  expected_latency_p95_ms: 4000
  max_cost_per_execution_usd: 0.05

# ─── OPERATIONAL CONTRACT ─────────────────────────────────────────

operations:
  health_check_endpoint: "/health"
  log_level: "INFO"
  alert_on_error_rate_above: "5%"
  owner: "team or person responsible"
  runbook: "link to runbook document"
  escalation_contact: "who to call when it fails"
```

---

## How to Use This Contract

### When building a new agent:
1. Fill the contract template before writing any code
2. Share with anyone who will call this agent
3. Write tests that verify the contract is honored

### When calling another agent:
1. Read the called agent's contract
2. Validate your output matches their input contract before sending
3. Handle all error codes they document

### When debugging a multi-agent failure:
1. Find the execution_id in your logs
2. Trace it across all agents using that ID
3. Find where the contract was violated — that's your bug

---

## The Caller's Responsibilities

A contract works both ways. The agent calling another agent must:

```
Before calling:
  ✓ Validate output format matches callee's input schema
  ✓ Include all required fields
  ✓ Respect rate limits

After receiving response:
  ✓ Check the 'status' field before using 'result'
  ✓ Handle every error_code the callee documents
  ✓ Implement retry logic for retryable errors
  ✓ Log the execution_id for tracing
```

---

## Versioning Contracts

When a contract changes, things break. Handle this properly:

### Backward-compatible changes (minor version bump)
- Adding optional fields to input
- Adding fields to output
- Adding new error codes

### Breaking changes (major version bump)
- Removing or renaming required input fields
- Changing output field types
- Changing the meaning of existing fields

### Migration process for breaking changes:
```
1. Deploy new version alongside old version
2. New version: v2.0
3. Old version: v1.0 (deprecated, but still running)
4. Give callers time to migrate (defined SLA, e.g., 30 days)
5. Remove old version after all callers have migrated
```

---

*Next: `02_message_schema.md` — The standard message format for agent communication*
