# Cost Management — Keeping Spend Predictable

> `04_PRODUCTION / 02`
> LLM costs compound silently. A bug, a prompt change, or a traffic spike can 10x your bill before you notice. This document prevents that.

---

## The Cost Structure of LLM Agents

Understanding where money goes is the first step to controlling it.

```
COST SOURCES FOR A TYPICAL AGENT

LLM Calls (usually 70–95% of total cost)
  ├── Input tokens  (system prompt + context + user message)
  ├── Output tokens (agent's response)
  └── Image tokens  (if vision model)

External APIs (usually 5–20%)
  ├── Search APIs
  ├── Database reads/writes
  └── Third-party services

Infrastructure (usually 2–10%)
  ├── Compute (running the agent process)
  ├── Database storage
  └── Vector store
```

### Token Cost Reality Check

```
Example: Support triage agent
  System prompt:       800 tokens  (constant per call)
  Retrieved context:   400 tokens  (variable)
  User message:        200 tokens  (variable)
  Agent response:      150 tokens  (variable)
  ────────────────────────────────
  Total per call:    1,550 tokens

At Claude Sonnet pricing (~$3/1M input, ~$15/1M output):
  Input cost:  1,400 × $3/1M  = $0.0042
  Output cost:   150 × $15/1M = $0.0023
  Per call:                      $0.0065

At 500 calls/day:     $3.25/day  =  $97/month
At 5,000 calls/day:  $32.50/day  = $975/month
At 50,000 calls/day: $325/day    = $9,750/month

→ Cost scales linearly with volume. Plan accordingly.
```

---

## The Cost Control Toolkit

### Lever 1 — Model Selection

The single most powerful cost lever. Models vary 10–100x in price.

```
Task: Classify a support ticket into 5 categories

Option A: Use premium model (Claude Opus)
  Cost: ~$0.075 per call
  Quality: Exceptional

Option B: Use mid-tier model (Claude Sonnet)
  Cost: ~$0.0065 per call  (10× cheaper)
  Quality: Very good — sufficient for classification

Option C: Use fast/cheap model (Claude Haiku)
  Cost: ~$0.0008 per call  (90× cheaper than Opus)
  Quality: Good for simple structured tasks

Decision: Use Haiku for classification. Save Sonnet/Opus for complex reasoning.
Savings: 90% cost reduction with minimal quality loss for this specific task.
```

**Model selection matrix:**

| Task Complexity | Recommended Tier | Why |
|---|---|---|
| Classification, extraction, formatting | Fast/cheap | Simple structured output |
| Tool-use, multi-step reasoning | Mid-tier | Balance quality/cost |
| Complex analysis, creative work | Premium | Quality matters more than cost |
| Research, long-form synthesis | Premium | Context + quality critical |

### Lever 2 — Prompt Compression

Every token in your system prompt costs money on every call.

```
BEFORE (verbose): 1,200 tokens
"You are a helpful customer support assistant working for Acme Corporation,
a leading provider of software solutions. Your role is to assist customers
with their inquiries in a professional, courteous, and efficient manner..."

AFTER (compressed): 380 tokens
"You are Acme Corp support. Help customers efficiently and professionally."
→ Same behavior. 68% fewer tokens. 68% lower cost on every call.
```

**Compression techniques:**
- Remove filler phrases ("Please note that...", "It's important to remember...")
- Use lists instead of paragraphs for rules
- Move static knowledge to RAG (retrieve only when needed)
- Combine related rules into single statements

**Warning:** Measure quality before and after. Compression can degrade performance. Test on 50+ real cases.

### Lever 3 — Output Length Control

You control max output length. Use it.

```
Bad: max_tokens = 4096 (default — you're paying for tokens you don't use)

Good: Measure your actual output distribution:
  P50 output: 150 tokens
  P95 output: 380 tokens
  Max needed: 500 tokens

Set: max_tokens = 600 (P95 + 20% buffer)
Cost saved: up to 85% of output token budget
```

### Lever 4 — Caching

Identical or near-identical inputs don't need new LLM calls.

**Exact cache (cheapest):**
```
cache_key = hash(agent_id + normalized_input)
if cache.exists(cache_key):
    return cache.get(cache_key)  # free
else:
    result = call_llm(input)
    cache.set(cache_key, result, ttl=appropriate)
    return result
```

**Semantic cache (catches near-duplicates):**
```
# "How do I cancel?" and "How can I cancel my account?" are the same question
embed(query) → find nearest cached response → if similarity > 0.95, return it
```

**Cache TTL guidelines:**

| Content Type | TTL | Reason |
|---|---|---|
| FAQ / knowledge base answers | 24–72h | Stable content |
| Product information | 1–6h | Changes occasionally |
| User-specific responses | 15–60min | Session-relevant |
| Real-time data (orders, status) | Don't cache | Always fresh |
| After a write operation | Invalidate immediately | Data changed |

**Cache hit rate target:** > 20% for most agents. If < 10%, inputs may be too unique to benefit.

### Lever 5 — Tiered Processing

Route cheap inputs to cheap models. Reserve expensive models for complex cases.

```
Incoming request
      │
      ▼
[Fast classifier: is this simple or complex?]  ← cheap model, < $0.001
      │
      ├── Simple (80% of requests) → [Cheap model]  ← $0.001/call
      │
      └── Complex (20% of requests) → [Premium model]  ← $0.01/call

Weighted average: (0.8 × $0.001) + (0.2 × $0.01) = $0.0028/call
vs. always using premium: $0.01/call

Savings: 72%
```

### Lever 6 — Batching

Some agents can process multiple inputs in a single LLM call.

```
WITHOUT batching:
  3 document summaries × 1 LLM call each = 3 calls
  Cost: 3 × ($0.01 system prompt overhead + $0.005 content) = $0.045

WITH batching:
  1 LLM call with 3 documents
  Cost: 1 × ($0.01 overhead + $0.015 content) = $0.025

Savings: 44%
```

**When batching works:** Same task on multiple independent inputs.
**When it doesn't:** When inputs have dependencies, or when one failure should not affect others.

---

## Cost Monitoring Setup

### Hard Limits (non-negotiable)

```yaml
cost_limits:
  per_execution:
    soft_limit_usd: 0.10    # Log warning
    hard_limit_usd: 0.50    # Halt execution, return error

  per_day:
    budget_usd: 50.00
    alert_at_percent: 80    # Slack alert
    pause_at_percent: 100   # Stop processing new requests
    resume_at: "midnight"   # Auto-resume next day

  per_month:
    budget_usd: 1000.00
    review_date_of_month: 1
```

### Cost Anomaly Detection

Alert on rate of change, not just absolute value:

```
Normal: $0.0031/execution (stable for 30 days)

Anomaly triggers:
  → Cost per execution 2× baseline for > 1 hour    [investigate prompt]
  → Daily spend 50% above 7-day average             [investigate volume or cost/call]
  → Single execution > $0.50                        [investigate immediately]
  → Token usage 2× baseline without volume change   [prompt may have grown]
```

### Weekly Cost Review Checklist

Every week, answer:
- [ ] Is cost per execution stable vs last week?
- [ ] Is volume driving cost, or is cost-per-call changing?
- [ ] Are there any caching opportunities we're missing?
- [ ] Are we using the right model tier for each task?
- [ ] Is the system prompt still as short as it can be?

---

## Cost Incident Response

**"Cost spiked 3× overnight"**
```
1. Check volume: did executions spike? (upstream bug sending duplicates?)
2. Check cost/execution: same volume, more expensive?
   → If yes: did prompt change? Did model change? Did input size change?
3. Check for retry loops: are executions failing and retrying 10× each?
4. Emergency: set rate_limit=0 to pause new executions
5. Diagnose and fix before unpausing
```

**"Monthly budget will be exhausted by day 20"**
```
1. Check growth trend: is this expected growth or anomaly?
2. Identify biggest cost drivers by agent
3. Apply cost levers in order: model → cache → prompt compression → batching
4. If growth is legitimate: increase budget or implement rate limiting
```

---

## Cost Estimation Template

Fill before building. Update after first week in production.

```
Agent: [name]
Date: [YYYY-MM-DD]

INPUTS:
  Expected executions/day: ___
  System prompt tokens (count exactly): ___
  Avg context tokens per call: ___
  Avg user input tokens: ___
  Avg output tokens: ___
  ─────────────────────────────
  Total tokens per call: ___

MODEL:
  Model: ___
  Input price per 1M tokens: $___
  Output price per 1M tokens: $___

CALCULATION:
  Input cost/call:  (system + context + input tokens) × price/1M = $___
  Output cost/call: (output tokens) × price/1M = $___
  Total LLM cost/call: $___

  Daily LLM cost: ___ calls × $___/call = $___/day
  Monthly LLM cost: $___/day × 30 = $___/month

EXTERNAL APIS:
  [API name]: ___ calls/day × $___/call = $___/month

TOTAL MONTHLY ESTIMATE:
  LLM: $___
  APIs: $___
  Infra: $___
  TOTAL: $___

HARD LIMITS TO SET:
  Per execution: $[3× expected cost/call]
  Daily: $[2× expected daily cost]
  Monthly budget: $[1.5× expected monthly]
```

---

*Next: `03_failure_handling.md`*
