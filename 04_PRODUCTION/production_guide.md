# Production Guide — Running Agents That Last

> `04_PRODUCTION`
> Getting an agent to work in a demo is easy. Getting it to work at 3am in production, consistently, for months — that's engineering.

---

## The Production Gap

There is a well-documented pattern in AI agent projects:

```
Week 1:  "This demo is incredible!"
Week 4:  "It's working in staging."
Week 8:  "It's behaving strangely in production."
Week 12: "We had to turn it off."
```

The production gap exists because demos optimize for the happy path. Production is everything else: edge cases, degraded APIs, unexpected inputs, accumulated errors, rising costs, and failures at the worst possible time.

Clayton Forge closes this gap by making production concerns a design requirement, not an afterthought.

---

## The Four Pillars of Production Agents

```
┌──────────────────────────────────────────────────────────────────┐
│                    PRODUCTION READINESS                          │
│                                                                  │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐          │
│  │OBSERVABILITY │  │   FAILURE    │  │     COST     │          │
│  │              │  │  HANDLING    │  │  MANAGEMENT  │          │
│  │ You can see  │  │ Things will  │  │ Spend stays  │          │
│  │ what it's    │  │ break. Plan  │  │ predictable. │          │
│  │ doing.       │  │ for it.      │  │              │          │
│  └──────────────┘  └──────────────┘  └──────────────┘          │
│                                                                  │
│  ┌────────────────────────────────────────────────────┐         │
│  │             LIFECYCLE MANAGEMENT                   │         │
│  │   Agents change. How you deploy, version, and      │         │
│  │   retire them safely.                              │         │
│  └────────────────────────────────────────────────────┘         │
│                                                                  │
└──────────────────────────────────────────────────────────────────┘
```

---

## Pillar 1 — Observability

**The rule:** If you can't observe it, you can't fix it.

### What to log (mandatory)

Every execution must produce a structured log entry:

```json
{
  "execution_id": "exec_7f3a9b2c",
  "agent_id": "support_triage_v2",
  "agent_version": "2.1.0",
  "timestamp_start": "2024-01-15T14:23:01.234Z",
  "timestamp_end": "2024-01-15T14:23:04.891Z",
  "duration_ms": 3657,

  "trigger": {
    "type": "webhook",
    "source": "zendesk",
    "event": "ticket.created"
  },

  "input": {
    "size_chars": 847,
    "hash": "sha256:a3f9b2...",
    "preview": "Customer asking about delayed order..."
  },

  "llm_calls": [
    {
      "call_number": 1,
      "model": "claude-sonnet-4-6",
      "tokens_input": 1240,
      "tokens_output": 187,
      "latency_ms": 2100,
      "cost_usd": 0.0031
    }
  ],

  "tools_called": [
    {
      "tool": "get_order_status",
      "success": true,
      "latency_ms": 340
    }
  ],

  "output": {
    "status": "success",
    "result_preview": "Classified as URGENT, routing to logistics...",
    "confidence": 0.94
  },

  "cost_total_usd": 0.0031,
  "tokens_total": 1427,
  "errors": [],
  "retries": 0
}
```

**Note on sensitive data:** Never log raw input/output if it contains PII. Log the hash and character count. Retrieve the actual content from the original source if needed for debugging.

### Metrics to track

| Metric | How to measure | Alert threshold |
|---|---|---|
| Success rate | `succeeded / total executions` | < 95% |
| P50 latency | Median execution time | > 3s |
| P95 latency | 95th percentile execution time | > 10s |
| Error rate by type | Count each error_code | Any spike |
| Cost per execution | Total USD / execution | > 2x expected |
| Daily cost | Sum of all executions | > budget |
| Token usage | Avg tokens per call | > 2x expected (prompt issue) |
| Retry rate | Retried executions / total | > 10% |

### Distributed tracing in multi-agent systems

Use a single `trace_id` that flows through all agents in a request:

```
[Orchestrator] trace_id="trc_abc" starts
  → [Agent A] trace_id="trc_abc", span_id="span_1"
  → [Agent B] trace_id="trc_abc", span_id="span_2"
  → [Agent C] trace_id="trc_abc", span_id="span_3"
[Orchestrator] trace_id="trc_abc" completes

Debugging: search all logs for trace_id="trc_abc"
→ See the complete picture of what happened
```

### Dashboards (minimum viable)

Every production agent should have:
1. **Health dashboard:** Success rate, error rate, latency — last 24h
2. **Cost dashboard:** Daily spend, trend, breakdown by agent
3. **Error dashboard:** Error types, frequency, last occurrence

---

## Pillar 2 — Failure Handling

**The rule:** Every failure mode must have a defined response. "Unknown failure" is not a valid state.

### The Failure Taxonomy

```
┌─────────────────────────────────────────────────────────────────┐
│                    FAILURE TYPES                                 │
├──────────────────┬──────────────────────────────────────────────┤
│ TRANSIENT        │ Will likely succeed on retry.                │
│                  │ Examples: LLM timeout, API rate limit,       │
│                  │           network blip                       │
│                  │ Action: Retry with exponential backoff       │
├──────────────────┼──────────────────────────────────────────────┤
│ RECOVERABLE      │ Won't succeed with same input, but can       │
│                  │ degrade gracefully.                          │
│                  │ Examples: LLM invalid output, tool error,   │
│                  │           partial data available            │
│                  │ Action: Fallback behavior or partial result  │
├──────────────────┼──────────────────────────────────────────────┤
│ FATAL            │ Cannot proceed. Human intervention required. │
│                  │ Examples: auth failure, data corruption,     │
│                  │           constraint violation               │
│                  │ Action: Alert, halt, escalate               │
├──────────────────┼──────────────────────────────────────────────┤
│ SILENT / WRONG   │ The hardest kind. Agent succeeds but         │
│                  │ produces wrong output.                       │
│                  │ Examples: misclassification, hallucination, │
│                  │           wrong calculation                 │
│                  │ Action: Output validation + monitoring       │
└──────────────────┴──────────────────────────────────────────────┘
```

### Retry Strategy

Not all errors warrant retry. Define clearly:

```
retry_policy:
  LLM_TIMEOUT:
    max_attempts: 3
    backoff: exponential
    initial_delay_ms: 1000
    max_delay_ms: 30000
    jitter: true

  TOOL_UNAVAILABLE:
    max_attempts: 3
    backoff: exponential
    initial_delay_ms: 2000
    max_delay_ms: 60000

  RATE_LIMIT_EXCEEDED:
    max_attempts: 5
    backoff: fixed
    delay_ms: 60000  # Wait 1 minute

  INPUT_VALIDATION_FAILED:
    max_attempts: 0  # Don't retry — fix the input

  LLM_INVALID_OUTPUT:
    max_attempts: 2
    strategy: "rephrase_prompt"  # Retry with modified prompt
```

### The Fallback Hierarchy

For every critical agent behavior, define what happens at each level of degradation:

```
Level 0 (ideal): Agent operates normally
Level 1 (degraded): Main LLM slow → switch to faster model, lower quality
Level 2 (partial): Tool unavailable → return partial result with notice
Level 3 (minimal): Most tools down → basic response only
Level 4 (manual): Agent completely unavailable → human queue
```

Document this for every agent. Never assume "it'll be fine."

### Circuit Breaker Pattern

Prevent a failing dependency from taking down your whole system:

```
States:
  CLOSED   → Normal operation. Requests pass through.
  OPEN     → Dependency is failing. Requests are blocked immediately.
  HALF-OPEN → Testing if dependency has recovered.

Transitions:
  CLOSED → OPEN:      failure_rate > threshold (e.g., 50% in last 60s)
  OPEN → HALF-OPEN:   after cooldown period (e.g., 30s)
  HALF-OPEN → CLOSED: probe request succeeds
  HALF-OPEN → OPEN:   probe request fails

Effect:
  CLOSED: requests call dependency, failures tracked
  OPEN:   requests immediately return fallback (no call made)
  HALF-OPEN: one request allowed through to test recovery
```

### Output Validation

Silent failures (wrong outputs) are caught by validation:

```
After every LLM call, validate the output before using it:

1. Schema validation:    Does it match the expected JSON structure?
2. Type validation:      Are field types correct?
3. Range validation:     Is confidence between 0 and 1?
4. Business validation:  Is the classification in the allowed set?
5. Consistency check:    Is the output consistent with the input?

If validation fails:
→ Retry with corrective prompt (max 1 retry)
→ If still fails: return error, don't guess
```

---

## Pillar 3 — Cost Management

**The rule:** Every production agent must have a cost ceiling.

### Understanding LLM Costs

LLM APIs charge per token (roughly per word). Costs compound quickly:

```
Example: Support triage agent
  Input tokens per call:  1,500  (system prompt + context + user message)
  Output tokens per call:   200  (classification + response)
  Cost per call:           ~$0.003

  At 500 tickets/day:      $1.50/day = $45/month
  At 5,000 tickets/day:   $15/day = $450/month

This is manageable. But without monitoring:
  Prompt grows over time:  2x tokens = 2x cost
  A bug causes retries:    3x calls = 3x cost
  Unexpected traffic spike: 10x volume = 10x cost
```

### Cost Control Levers

| Lever | How | Trade-off |
|---|---|---|
| **Model selection** | Use smaller model for simpler tasks | Lower quality |
| **Prompt compression** | Minimize system prompt size | Less context |
| **Output length limit** | Set max_tokens explicitly | Truncated output |
| **Caching** | Cache identical or similar requests | Staleness |
| **Batching** | Group multiple inputs into one call | Latency |
| **Rate limiting** | Cap executions per time window | Delayed processing |
| **Tiered processing** | Simple cases → cheap model, complex → premium | Routing complexity |

### Cost Monitoring Setup

```yaml
cost_controls:
  per_execution:
    soft_limit_usd: 0.10     # Alert if exceeded
    hard_limit_usd: 0.50     # Halt execution if exceeded

  daily:
    budget_usd: 50.00
    alert_at_percent: 80     # Alert when 80% of budget used
    halt_at_percent: 100     # Stop executions when budget exhausted

  monthly:
    budget_usd: 1000.00
    review_date: 1           # Day of month to review

  per_agent:
    support_triage: 30.00/day
    research_agent: 15.00/day
    email_writer: 5.00/day
```

### The Caching Strategy

```
Before calling the LLM:
  cache_key = hash(agent_id + normalized_input)
  cached = cache.get(cache_key)
  if cached and not expired:
    return cached  # Zero LLM cost

After LLM call:
  cache.set(cache_key, result, ttl=appropriate_ttl)
```

Cache TTL guidance:
- Factual, stable content: 24–72 hours
- User-specific dynamic content: 15–60 minutes
- Real-time queries: don't cache

---

## Pillar 4 — Lifecycle Management

### Version Strategy

```
MAJOR version (v1 → v2): Behavioral change, different outputs
MINOR version (v1.0 → v1.1): New capability, backward compatible
PATCH version (v1.0.0 → v1.0.1): Bug fix, prompt tweak

Always:
  - Version your prompts alongside your code
  - Log which version produced each output
  - Never overwrite — create a new version
```

### Safe Deployment Process

```
NEVER: Deploy directly to production with untested changes

DO:
  1. Test in development with synthetic data
  2. Run A/B test in staging with real data (shadow mode)
  3. Canary deploy: 5% traffic to new version, 95% to old
  4. Monitor for 24–48 hours
  5. Gradual rollout: 25% → 50% → 100%
  6. Old version stays live for 7 days (rollback window)
```

### Prompt Versioning

Prompts are code. Treat them that way:

```
/prompts
  /support_triage
    v1.0.0.txt  ← initial version
    v1.1.0.txt  ← added urgency classification
    v2.0.0.txt  ← complete rewrite, different output format
    CHANGELOG.md
```

Never edit prompts in place. Create a new version and test it.

### Deprecation Process

When retiring an agent:
```
Week 1:  Mark as deprecated in documentation
Week 2:  Alert all callers: "This agent will be retired on [date]"
Week 4:  Redirect traffic to replacement agent
Week 6:  Shut down deprecated agent
Week 8:  Archive (don't delete) documentation and logs
```

---

## Pre-Production Checklist

Before any agent goes live:

**Observability:**
- [ ] Structured logging implemented and tested
- [ ] Metrics collection configured
- [ ] Alerting set up for: error rate, latency, cost
- [ ] Dashboard created

**Failure handling:**
- [ ] Retry policy defined for each error type
- [ ] Fallback behavior implemented and tested
- [ ] Circuit breaker configured (if calling external APIs)
- [ ] Output validation implemented

**Cost management:**
- [ ] Cost per execution estimated and documented
- [ ] Per-execution, daily, and monthly cost limits set
- [ ] Cost alerting configured

**Lifecycle:**
- [ ] Version documented
- [ ] Deployment process documented
- [ ] Rollback plan defined
- [ ] Runbook written (`06_OPERATIONS/RUNBOOK_template.md`)
- [ ] Owner and escalation path documented

---

*End of PRODUCTION. Proceed to `05_MULTI_AGENT/` for multi-agent system design.*
