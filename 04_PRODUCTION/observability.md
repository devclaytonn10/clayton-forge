# Observability — Seeing What Your Agent Is Doing

> `04_PRODUCTION / 01`
> If you can't observe it, you can't fix it. Observability is not optional in production agents.

---

## The Observability Stack

A production agent needs three layers of observability working together:

```
┌─────────────────────────────────────────────────────────────────┐
│                    OBSERVABILITY STACK                          │
│                                                                 │
│  ┌─────────────┐   ┌─────────────┐   ┌─────────────────────┐  │
│  │    LOGS     │   │   METRICS   │   │       TRACES        │  │
│  │             │   │             │   │                     │  │
│  │ What        │   │ How much /  │   │ End-to-end journey  │  │
│  │ happened,   │   │ how often / │   │ of a single request │  │
│  │ when, why   │   │ how fast    │   │ across all agents   │  │
│  └─────────────┘   └─────────────┘   └─────────────────────┘  │
│                                                                 │
│  Logs answer: "What happened in execution exec_abc123?"         │
│  Metrics answer: "Is the system healthy right now?"             │
│  Traces answer: "Where did this request spend its time?"        │
└─────────────────────────────────────────────────────────────────┘
```

---

## Layer 1 — Structured Logs

### The Mandatory Log Schema

Every execution must produce exactly one structured log entry. No exceptions.

```json
{
  "execution_id": "exec_7f3a9b2c",
  "trace_id": "trc_abc123def456",
  "agent_id": "support_triage_v2",
  "agent_version": "2.1.0",

  "timing": {
    "started_at": "2024-01-15T14:23:01.234Z",
    "ended_at": "2024-01-15T14:23:04.891Z",
    "duration_ms": 3657
  },

  "trigger": {
    "type": "webhook",
    "source": "zendesk",
    "event": "ticket.created"
  },

  "input": {
    "size_chars": 847,
    "hash": "sha256:a3f9b2c1d4e5f6a7",
    "preview": "First 100 chars of input for debugging..."
  },

  "llm_calls": [
    {
      "call_number": 1,
      "model": "claude-sonnet-4-6",
      "tokens_input": 1240,
      "tokens_output": 187,
      "latency_ms": 2100,
      "cost_usd": 0.0031,
      "cache_hit": false
    }
  ],

  "tools_called": [
    {
      "tool": "lookup_customer",
      "success": true,
      "latency_ms": 234,
      "attempt": 1
    },
    {
      "tool": "update_ticket_status",
      "success": true,
      "latency_ms": 189,
      "attempt": 1
    }
  ],

  "output": {
    "status": "success",
    "result_preview": "Classified as URGENT, team=LOGISTICS",
    "confidence": 0.94
  },

  "cost": {
    "llm_usd": 0.0031,
    "tools_usd": 0.0,
    "total_usd": 0.0031
  },

  "tokens": {
    "input": 1240,
    "output": 187,
    "total": 1427
  },

  "errors": [],
  "retries": 0,
  "cache_hits": 0
}
```

### What NOT to Log

| Data Type | Why | What to Log Instead |
|---|---|---|
| Full input text (if contains PII) | Privacy violation | Hash + char count |
| API keys or credentials | Security | Never |
| Full customer messages | Privacy | First 100 chars + hash |
| Payment details | PCI compliance | Last 4 digits only |
| Passwords | Security | Never |

### Log Levels

| Level | When to Use |
|---|---|
| `DEBUG` | Detailed internal state — development only |
| `INFO` | Normal execution events — every execution |
| `WARN` | Unexpected but handled — retries, fallbacks, low confidence |
| `ERROR` | Failed executions, unhandled exceptions |
| `CRITICAL` | System-level failures, data corruption, security events |

**Production default:** `INFO`. Never run `DEBUG` in production — volume and cost.

### Log Retention Policy

| Log Type | Retention | Reason |
|---|---|---|
| Execution logs | 30 days | Debugging recent issues |
| Error logs | 90 days | Pattern analysis |
| Audit logs (actions taken) | 7 years | Compliance |
| Cost logs | 13 months | Year-over-year comparison |

---

## Layer 2 — Metrics

Metrics are aggregated numbers over time. They tell you if the system is healthy without reading individual logs.

### The Essential Metrics Set

**Health metrics (check every minute):**

| Metric | Formula | Healthy Range | Alert If |
|---|---|---|---|
| Success rate | `succeeded / total` | > 95% | < 95% for 5 min |
| Error rate | `failed / total` | < 5% | > 5% for 5 min |
| Availability | `time_with_executions / total_time` | > 99% | < 99% for 1h |

**Performance metrics (check every 5 minutes):**

| Metric | Formula | Alert If |
|---|---|---|
| P50 latency | Median duration_ms | > [2× baseline] |
| P95 latency | 95th percentile duration_ms | > [threshold] |
| P99 latency | 99th percentile duration_ms | > [hard ceiling] |
| Queue depth | Messages waiting to be processed | > [N] for 10 min |

**Cost metrics (check every hour):**

| Metric | Formula | Alert If |
|---|---|---|
| Cost per execution | avg(cost_total_usd) | > [2× expected] |
| Hourly spend | sum(cost_total_usd) last 1h | > [hourly budget] |
| Daily spend | sum(cost_total_usd) last 24h | > 80% of daily budget |
| Token efficiency | avg(tokens_total) | > [2× baseline] spike |

**Quality metrics (check every hour):**

| Metric | Formula | Alert If |
|---|---|---|
| Average confidence | avg(confidence) | < [threshold] |
| Low confidence rate | `confidence < 0.75 / total` | > 20% |
| Retry rate | `retries > 0 / total` | > 10% |
| Fallback rate | executions using fallback / total | > 5% |

### Metric Dimensions

Always record metrics with these dimensions so you can filter and compare:

- `agent_id` — which agent
- `agent_version` — which version (catch regressions in deployments)
- `trigger_type` — webhook / schedule / manual
- `environment` — production / staging

### Baseline Calibration

The first week in production, record your baseline:

```
Day 1–7 average:
  success_rate:        98.2%
  p50_latency_ms:      1340
  p95_latency_ms:      3200
  cost_per_execution:  $0.0031
  avg_confidence:      0.91
  retry_rate:          2.1%

→ Set alerts at 2× these values for most metrics
→ Success rate: alert at < 95% (absolute, not relative)
```

---

## Layer 3 — Distributed Tracing

In multi-agent systems, a single user request flows through multiple agents. Tracing lets you follow that journey.

### The Trace Model

```
User request arrives
│
├── trace_id = "trc_abc123"   ← Created once, flows through everything
│
├── [Orchestrator]  span_id="span_001"  parent=null       duration: 4,800ms
│   │
│   ├── [Research Agent]  span_id="span_002"  parent="span_001"  duration: 2,100ms
│   │   ├── LLM call #1:  300ms
│   │   └── Tool: web_search  1,200ms
│   │
│   └── [Writer Agent]    span_id="span_003"  parent="span_001"  duration: 1,900ms
│       └── LLM call #1:  1,800ms
│
└── Total: 4,800ms
```

**To debug any failure:** search all logs for `trace_id = "trc_abc123"` — see the complete picture instantly.

### Trace Propagation Rules

1. The first agent in a request generates the `trace_id`
2. Every subsequent agent receives it and passes it forward
3. Every log entry includes `trace_id` and `span_id`
4. Never generate a new `trace_id` for the same logical request

### What a Trace Reveals

| Problem | What the Trace Shows |
|---|---|
| "Request is slow" | Which span took the most time → drill down there |
| "Request failed" | Which span errored first → root cause |
| "Result is wrong" | Which agent produced the unexpected output |
| "Request is expensive" | Which agent consumed the most tokens/cost |

---

## Dashboards

Every production agent needs at minimum two dashboards.

### Dashboard 1 — Health Overview (for on-call)

```
┌─────────────────────────────────────────────────────┐
│  AGENT: support_triage_v2    Last updated: 2 min ago │
├──────────────┬──────────────┬─────────────┬─────────┤
│ SUCCESS RATE │ P95 LATENCY  │ COST TODAY  │ ERRORS  │
│    97.8%     │   3,240ms    │   $12.40    │    4    │
│  ↑ healthy   │  ↑ nominal   │ 62% budget  │ 2h ago  │
├──────────────┴──────────────┴─────────────┴─────────┤
│ Error breakdown (last 24h):                          │
│   LLM_TIMEOUT: 3    INPUT_VALIDATION: 1             │
│                                                      │
│ Latency trend (last 6h):  ▁▂▂▃▂▂ nominal           │
└──────────────────────────────────────────────────────┘
```

### Dashboard 2 — Cost and Usage (for owner)

```
┌──────────────────────────────────────────────────────┐
│  COST & USAGE                          Last 30 days  │
├─────────────────────────────────────────────────────┤
│ Daily spend:    ████████░░░░░░░  $12.40 / $20 budget │
│ Monthly trend:  $8 → $10 → $12 → $12 (stable)       │
│                                                      │
│ Executions/day:  avg 1,240                          │
│ Cost/execution:  avg $0.0031  (baseline: $0.0031)   │
│ Tokens/exec:     avg 1,427    (baseline: 1,380)     │
│                                                      │
│ Top cost drivers:                                    │
│   LLM calls: 94%   |  Tools: 6%                     │
└──────────────────────────────────────────────────────┘
```

---

## Alerting

### Alert Routing

| Severity | Who Gets It | Channel | Response Time |
|---|---|---|---|
| **Critical** | On-call + owner | PagerDuty / phone | < 15 min |
| **High** | On-call | Slack #alerts | < 1 hour |
| **Medium** | Owner | Slack #monitoring | Next business day |
| **Low** | Owner | Email digest | Weekly review |

### Alert Fatigue Prevention

More alerts = worse response. Keep alerts meaningful:

- ✅ Alert on trends, not single spikes (`> threshold for 5 min`, not `> threshold once`)
- ✅ Alert on rate of change, not just absolute value
- ✅ Group related alerts (don't send 50 alerts when the LLM is down)
- ❌ Never alert on things you can't act on
- ❌ Never alert on things that resolve themselves in < 2 minutes

---

## Observability Checklist

Before going to production:

**Logging:**
- [ ] Structured log schema implemented (all mandatory fields)
- [ ] PII excluded from logs
- [ ] Log level set to INFO
- [ ] Log retention policy configured

**Metrics:**
- [ ] Success rate tracked
- [ ] Latency (P50, P95) tracked
- [ ] Cost per execution tracked
- [ ] Baseline established from staging data

**Tracing:**
- [ ] `trace_id` generated and propagated (if multi-agent)
- [ ] `span_id` assigned per agent call

**Dashboards:**
- [ ] Health dashboard created and accessible to on-call
- [ ] Cost dashboard created and accessible to owner

**Alerting:**
- [ ] Critical alerts configured (error rate, availability)
- [ ] Cost alerts configured (80% and 100% of budget)
- [ ] Alert routing tested end-to-end

---

*Next: `02_cost_management.md`*
