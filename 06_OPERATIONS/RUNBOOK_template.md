# Runbook Template — Operating Your Agent in Production

> **Clayton Forge Template v2.0**
> A runbook is the on-call engineer's guide. It answers: "Something is wrong — what do I do?"
> Write this before going to production. Use it the night something breaks.

---

## Agent Identity

| Field | Value |
|---|---|
| **Agent Name** | |
| **Agent ID** | |
| **Version in Production** | |
| **Owner** | |
| **Escalation Contact** | |
| **Critical? (Y/N)** | Y = failure directly impacts users or revenue |

---

## Quick Reference

*Copy these somewhere you can access even if the main system is down.*

| Resource | URL / Contact |
|---|---|
| Log dashboard | |
| Metrics dashboard | |
| Alert channel | |
| Primary on-call | |
| Secondary on-call | |
| LLM provider status page | |
| External APIs status pages | |
| Code repository | |
| Deployment guide | |

---

## Health Check

**To confirm the agent is running normally:**

```bash
# Check health endpoint
curl https://[agent-url]/health

# Expected response:
{
  "status": "healthy",
  "version": "x.x.x",
  "uptime_seconds": 12345,
  "last_execution": "2024-01-15T14:23:01Z",
  "error_rate_1h": 0.02
}

# If response is not 200 or status is not "healthy": → See "Agent Not Responding" below
```

---

## Alert Response Guides

---

### ALERT: High Error Rate

**Trigger:** Error rate > 5% in the last 15 minutes

**Step 1 — Diagnose**
```
1. Go to log dashboard
2. Filter: agent_id = [agent_id], time = last 30 min
3. Group by: error_code
4. Identify the dominant error type
```

**Step 2 — By error type:**

**If `LLM_TIMEOUT`:**
```
→ Check LLM provider status page: [URL]
→ If provider has incident: wait, enable fallback model if configured
→ If provider is healthy: check for input size spike (context overflow?)
→ Temporary fix: increase timeout in config
→ Escalate if persists > 30 min
```

**If `TOOL_UNAVAILABLE`:**
```
→ Identify which tool: check logs field `tools_called[].tool`
→ Check that tool's status/health
→ If tool is down: activate fallback behavior in config
→ Alert tool owner: [contact]
→ Escalate if tool is critical and no fallback available
```

**If `INPUT_VALIDATION_FAILED` (spike):**
```
→ Check if input source changed format (upstream deployment?)
→ Review sample of rejected inputs in logs
→ If upstream format change: coordinate with upstream team
→ If attack/abuse: activate rate limiting
```

**If `RATE_LIMIT_EXCEEDED`:**
```
→ Check if traffic is 10x normal (upstream spike?)
→ If yes: activate request queuing
→ Contact LLM provider to increase limits: [contact]
→ If budget exhausted: check cost dashboard
```

**Step 3 — Resolution**
```
→ Once error rate returns to normal, document in incident log
→ If issue recurs: create a ticket for root cause analysis
```

---

### ALERT: High Latency

**Trigger:** P95 latency > [X] seconds

**Step 1 — Diagnose**
```
1. Check log dashboard: which step is slow?
   - LLM call latency → LLM provider issue
   - Tool call latency → External API issue
   - Total latency but LLM fast → application issue
```

**Step 2 — Response**

**If LLM is slow:**
```
→ Check provider status page
→ Consider switching to faster model (lower quality trade-off)
→ If critical: enable fallback model
```

**If external tool is slow:**
```
→ Check tool health
→ Implement or decrease timeout for that tool
→ Use cached results if available
```

**If application overhead:**
```
→ Check server resources: CPU, memory, connections
→ Check if database queries are slow (explain analyze)
→ Restart service if memory leak suspected
```

---

### ALERT: Cost Spike

**Trigger:** Daily cost > [X]% of budget OR per-execution cost > [Y]

**Step 1 — Diagnose**
```
1. Cost dashboard → which agent is spending?
2. Is execution volume spiking? (more calls than expected)
3. Is cost per call spiking? (tokens growing?)
```

**Step 2 — Response**

**If volume spike:**
```
→ Is this legitimate traffic or a loop/bug?
→ Check for runaway retry loops in logs
→ If bug: halt agent, fix, redeploy
→ If legitimate: increase budget or throttle
```

**If per-call cost spike:**
```
→ Check average token count vs. baseline
→ Growing tokens usually means: prompt leaked, context not truncated, or user injecting large inputs
→ Check prompt for recent changes
→ Implement or reduce max_tokens limit
```

**Emergency cost control:**
```
→ Set rate limit to 0 (pause agent): [command]
→ Or: route all traffic to fallback (cheaper) model: [command]
```

---

### ALERT: Agent Not Responding

**Trigger:** Health check fails OR no executions logged in > [N] minutes when traffic expected

```
Step 1: Check if process is running
  [command to check process status]

Step 2: Check recent logs for crash signal
  [command to view last 100 log lines]

Step 3: Restart the agent
  [command to restart service]
  Wait 30 seconds
  Run health check again

Step 4: If restart doesn't help
  → Check infrastructure: [cloud console URL]
  → Check if dependencies (DB, cache) are up
  → Escalate to: [contact]

Step 5: If agent will be down for > [N] minutes
  → Notify: [stakeholders channel]
  → Activate manual fallback: [process description]
```

---

### ALERT: Silent Failure (Wrong Outputs)

**Trigger:** Human reports incorrect output, or quality monitoring detects anomaly

*This is the hardest type of failure. The agent is "working" but producing wrong results.*

```
Step 1: Confirm the issue
  → Collect 5+ examples of bad outputs
  → Identify the pattern: Is it all inputs or specific types?

Step 2: Assess scope
  → When did it start? (Check when output quality changed)
  → How many executions affected? (Check logs since start time)

Step 3: Identify cause
  → Did the prompt change recently? (Check prompt version history)
  → Did the input format change? (Upstream deployment?)
  → Did the LLM model change? (Provider-side change?)

Step 4: Immediate mitigation
  → If prompt change: rollback to previous prompt version
  → If model change: pin to specific model version in config
  → If upstream format change: coordinate with upstream team

Step 5: Remediation
  → For affected records: identify and flag for manual review
  → Document which execution_ids are affected
  → Notify stakeholders of the issue and remediation plan
```

---

## Routine Operations

### Deploying a New Version

```
Pre-deployment:
  1. [ ] Tests pass in staging
  2. [ ] Prompt regression test complete (compare v_old vs v_new on test set)
  3. [ ] Cost estimate for new version within budget
  4. [ ] Rollback plan confirmed

Deployment:
  1. Deploy to 5% canary
  2. Monitor for 2 hours: error rate, latency, cost, output quality
  3. If healthy: expand to 25% → 50% → 100%
  4. Keep previous version running for 7 days

Post-deployment:
  5. [ ] Update version in monitoring dashboards
  6. [ ] Update this runbook if anything changed
  7. [ ] Document deployment in changelog
```

### Rolling Back

```
Trigger: Error rate spikes or quality degrades after deployment

1. Identify the previous healthy version: [command]
2. Rollback: [command]
3. Confirm rollback: health check + error rate check
4. Document the rollback in incident log
5. Analyze what went wrong before re-deploying
```

### Updating the Prompt

```
NEVER edit the prompt directly in production.

Process:
  1. Create new prompt version file: /prompts/[agent]/v[N+1].txt
  2. Test on 50+ cases from the test set
  3. Compare accuracy with previous version
  4. If improved: follow deployment process above
  5. If degraded: iterate, do not deploy
```

### Clearing the Cache

```
When to clear: Bad data cached, after a major fix, configuration change
Command: [cache clear command]
Warning: Will cause temporary latency spike as cache warms up
Best time: Low traffic period
```

---

## Escalation Path

```
Level 1: On-call engineer handles (this runbook)
  ↓ if unresolved in 30 min
Level 2: [Senior engineer / team lead contact]
  ↓ if unresolved in 60 min or business-critical impact
Level 3: [Engineering manager / CTO contact]
  ↓ for external dependency issues
Vendor: [LLM provider support / API vendor support contacts]
```

---

## Incident Log

Record every incident, even minor ones:

| Date | Alert | Duration | Root Cause | Resolution | Action Items |
|---|---|---|---|---|---|
| | | | | | |

---

## Known Issues and Quirks

*Document the weird behaviors you've discovered. Future you will thank you.*

- ⚠️ **[Issue]:** [Description and workaround]
- ⚠️ **[Issue]:** [Description and workaround]

---

*This runbook should be reviewed and updated after every incident and every major deployment.*
