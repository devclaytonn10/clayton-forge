# Failure Handling — Building Agents That Fail Gracefully

> `04_PRODUCTION / 03`
> Every agent will fail. The question is whether the failure is contained, observable, and recoverable — or catastrophic.

---

## The Failure Mindset

The most dangerous assumption in AI agent development:

> "The happy path works in testing, so it'll be fine in production."

Production introduces what testing doesn't: unexpected inputs, degraded dependencies, concurrent load, adversarial users, and the compounding effect of small failures into large ones.

**The correct mindset:** Design the failure path before you design the happy path.

---

## Failure Taxonomy

Every failure your agent will encounter fits into one of four categories. Knowing the category determines the response.

```
┌─────────────────────────────────────────────────────────────────┐
│                      FAILURE TAXONOMY                           │
├────────────────┬────────────────────────────────────────────────┤
│ TRANSIENT      │ Will probably succeed if you try again.        │
│                │ Cause: temporary unavailability, network blip  │
│                │ Examples: LLM timeout, API 503, rate limit     │
│                │ Action: Retry with backoff                     │
├────────────────┼────────────────────────────────────────────────┤
│ RECOVERABLE    │ Won't succeed with same input, but you can     │
│                │ do something useful anyway.                    │
│                │ Examples: LLM bad output, partial tool data    │
│                │ Action: Fallback to degraded behavior          │
├────────────────┼────────────────────────────────────────────────┤
│ FATAL          │ Cannot proceed. Human must intervene.          │
│                │ Examples: auth failure, data corruption        │
│                │ Action: Alert immediately, halt, escalate      │
├────────────────┼────────────────────────────────────────────────┤
│ SILENT         │ The hardest. Agent "succeeds" but is wrong.    │
│                │ Examples: hallucination, misclassification     │
│                │ Action: Output validation + monitoring         │
└────────────────┴────────────────────────────────────────────────┘
```

---

## Handling Transient Failures — Retry Strategy

### Retry Policy Design

Not all errors should be retried the same way. Define per error type:

```yaml
retry_policies:

  LLM_TIMEOUT:
    max_attempts: 3
    strategy: exponential_backoff
    initial_delay_ms: 1000
    multiplier: 2.0
    max_delay_ms: 30000
    jitter: true          # Add randomness to prevent thundering herd
    # Delays: ~1s, ~2s, ~4s

  TOOL_UNAVAILABLE:
    max_attempts: 3
    strategy: exponential_backoff
    initial_delay_ms: 2000
    max_delay_ms: 60000
    # Delays: ~2s, ~4s, ~8s

  RATE_LIMIT_EXCEEDED:
    max_attempts: 5
    strategy: fixed
    delay_ms: 60000       # Respect the rate limit window
    respect_retry_after: true  # Use Retry-After header if provided

  LLM_INVALID_OUTPUT:
    max_attempts: 2
    strategy: fixed
    delay_ms: 500
    modify_prompt: true   # Add corrective instruction on retry

  INPUT_VALIDATION_FAILED:
    max_attempts: 0       # Never retry — caller must fix input

  AUTH_FAILURE:
    max_attempts: 0       # Never retry — must fix credentials
```

### Exponential Backoff with Jitter

```python
def calculate_delay(attempt, initial_ms, multiplier, max_ms, jitter=True):
    delay = min(initial_ms * (multiplier ** (attempt - 1)), max_ms)
    if jitter:
        delay = delay * (0.5 + random() * 0.5)  # ±50% randomness
    return delay

# Example: initial=1000ms, multiplier=2, max=30000ms
# Attempt 1: ~750ms–1000ms
# Attempt 2: ~1000ms–2000ms
# Attempt 3: ~2000ms–4000ms
# ... capped at ~15000ms–30000ms
```

### When to Stop Retrying

Always define a stopping condition:
- Max attempts reached → escalate or return degraded result
- Total elapsed time > timeout → stop, return partial result
- Error is not retryable → stop immediately
- Budget would be exceeded by retrying → stop

---

## Handling Recoverable Failures — Fallback Hierarchy

For every critical behavior, define what happens at each level of degradation:

```
FULL CAPABILITY
    │
    ├── Primary path fails → Fallback Level 1 (degraded but functional)
    │     Example: LLM slow → use faster/cheaper model
    │
    ├── Fallback 1 fails → Fallback Level 2 (minimal)
    │     Example: All LLMs unavailable → return cached result with staleness note
    │
    └── All fallbacks fail → Human escalation
          Example: No data available → route to human queue with context

```

### Fallback Design Template

Document this for every agent before shipping:

```
Agent: [name]
Primary behavior: [what agent does normally]

FALLBACK 1 — [name]:
  Trigger: [what causes fallback 1]
  Behavior: [what happens instead]
  Quality impact: [what the user loses]
  How user is informed: [message or flag in response]

FALLBACK 2 — [name]:
  Trigger: [what causes fallback 2]
  Behavior:
  Quality impact:
  How user is informed:

ESCALATION:
  Trigger: [when to give up and escalate]
  Escalation target: [human queue / alert / specific person]
  Context provided: [what information is passed along]
  Expected response time: [SLA for human response]
```

### Example: Support Triage Agent Fallbacks

```
Primary: Full LLM classification with tool lookup
  → Returns: team, urgency, confidence, customer history

Fallback 1 — Degraded (LLM timeout after 2 retries):
  → Use rule-based classifier (keyword matching)
  → Quality: 70% accuracy vs 94% primary
  → User informed: response includes flag "classified_by_fallback: true"

Fallback 2 — Minimal (all LLMs down):
  → Return: team="GENERAL", urgency="MEDIUM", needs_review=true
  → All tickets routed to general queue for human review
  → User informed: "System is experiencing delays. Ticket queued for review."

Escalation (Fallback 2 active for > 30 min):
  → Alert: PagerDuty to on-call
  → Stakeholder notification: "Triage agent is down. Manual routing active."
  → Expected human response: < 1 hour
```

---

## Handling Silent Failures — Output Validation

Silent failures are wrong outputs that look correct. They're the most dangerous because they damage trust without alerting anyone.

### Output Validation Pipeline

```
LLM produces output
        │
        ▼
Step 1: Schema validation
  → Is it valid JSON? (if JSON expected)
  → Are all required fields present?
  → Are field types correct?
        │
        ▼
Step 2: Range validation
  → Is confidence between 0.0 and 1.0?
  → Is score between 0 and 100?
  → Is classification in allowed set?
        │
        ▼
Step 3: Business logic validation
  → Is the output consistent with the input?
  → Does it violate any known business rules?
  → Is the confidence appropriate for the complexity?
        │
        ▼
Step 4: Sanity check (for critical agents)
  → Run a second lightweight check on the output
  → Or: compare with rule-based baseline
        │
        ▼
All pass → Use output
Any fail → Retry with corrective prompt (max 1 retry)
Still fail → Return error + flag for human review
```

### Corrective Retry Prompt

When output fails validation, retry with context about what went wrong:

```
Original prompt: [normal system prompt + input]

Corrective addition (appended to user message):
"Your previous response was invalid. Reason: [specific validation error].
Please try again. Requirements:
- Response must be valid JSON
- The 'confidence' field must be a number between 0.0 and 1.0
- The 'team' field must be one of: BILLING, LOGISTICS, TECHNICAL, SALES, GENERAL

Try again:"
```

### Monitoring for Silent Failures

Silent failures require active monitoring because they don't show up in error rates:

```
Monitoring approaches:
  1. Confidence tracking: alert if avg confidence drops unexpectedly
  2. Distribution shift: alert if classification distribution changes significantly
     (e.g., suddenly 60% of tickets classified as CRITICAL — was it 5% before?)
  3. Human feedback loop: sample 2% of outputs for manual review weekly
  4. Canary testing: weekly run on labeled golden set, alert if accuracy drops
```

---

## The Circuit Breaker

When a dependency is failing consistently, stop calling it. Don't let a failing dependency take down your whole agent.

```
STATES:

CLOSED (normal):
  → All requests go through
  → Track failure rate in rolling window

OPEN (dependency is down):
  → Requests immediately return fallback (no call made)
  → Saves: latency, cost, load on failing system
  → Check: probe request after cooldown period

HALF-OPEN (testing recovery):
  → One probe request allowed through
  → Success → back to CLOSED
  → Failure → back to OPEN

TRANSITIONS:
  CLOSED → OPEN:      failure_rate > 50% in last 60 seconds
  OPEN → HALF-OPEN:   after 30 second cooldown
  HALF-OPEN → CLOSED: probe succeeds
  HALF-OPEN → OPEN:   probe fails (reset cooldown)
```

**Per-dependency circuit breakers:**
Each external dependency should have its own circuit breaker. A failing Slack API shouldn't trigger the LLM circuit breaker.

---

## Error Response Standards

Every error response from your agent must be:
- **Machine-readable:** `error_code` field with consistent values
- **Human-readable:** `error_message` in plain language
- **Actionable:** `retryable` tells the caller what to do
- **Traceable:** `execution_id` for debugging

```json
{
  "status": "error",
  "error_code": "LLM_TIMEOUT",
  "error_message": "The AI model did not respond within 30 seconds",
  "retryable": true,
  "retry_after_seconds": 5,
  "execution_id": "exec_abc123",
  "trace_id": "trc_xyz789",
  "timestamp": "2024-01-15T14:23:31.000Z"
}
```

### Standard Error Codes

| Code | Type | Retryable | Caller Action |
|---|---|---|---|
| `INPUT_VALIDATION_FAILED` | Fatal | No | Fix input |
| `LLM_TIMEOUT` | Transient | Yes | Retry after delay |
| `LLM_INVALID_OUTPUT` | Recoverable | Yes (once) | Retry once |
| `TOOL_UNAVAILABLE` | Transient | Yes | Retry with backoff |
| `RATE_LIMIT_EXCEEDED` | Transient | Yes | Retry after window |
| `CONTEXT_OVERFLOW` | Fatal | No | Reduce input size |
| `AUTH_FAILURE` | Fatal | No | Fix credentials |
| `BUDGET_EXCEEDED` | Fatal | No | Wait for reset or increase budget |
| `ESCALATION_REQUIRED` | Recoverable | No | Route to human |
| `INTERNAL_ERROR` | Fatal | No | Alert, investigate |

---

## Failure Handling Checklist

For every agent before going to production:

**Transient failures:**
- [ ] Retry policy defined for each error type
- [ ] Exponential backoff implemented
- [ ] Max retry count enforced
- [ ] Total timeout enforced (not just per-attempt)

**Recoverable failures:**
- [ ] Fallback hierarchy documented and implemented
- [ ] User informed when fallback is active
- [ ] Fallback quality impact documented

**Silent failures:**
- [ ] Output schema validation implemented
- [ ] Business logic validation implemented
- [ ] Corrective retry prompt written
- [ ] Monitoring for confidence drift configured

**Fatal failures:**
- [ ] Alert configured for immediate notification
- [ ] Escalation path documented
- [ ] Rollback procedure documented

**Circuit breakers:**
- [ ] Circuit breaker implemented for each external dependency
- [ ] Thresholds calibrated to dependency's normal error rate

---

*Next: `04_lifecycle_management.md`*
