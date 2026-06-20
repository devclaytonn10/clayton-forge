# Lifecycle Management — Deploying, Versioning, and Retiring Agents

> `04_PRODUCTION / 04`
> An agent that works today may silently degrade tomorrow. Lifecycle management is how you keep it working.

---

## The Agent Lifecycle

```
┌──────────┐    ┌──────────┐    ┌──────────┐    ┌──────────┐    ┌──────────┐
│  DESIGN  │───▶│  BUILD   │───▶│  STAGE   │───▶│PRODUCTION│───▶│  RETIRE  │
└──────────┘    └──────────┘    └──────────┘    └──────────┘    └──────────┘
                                                      │
                                                      ▼
                                               ┌──────────┐
                                               │ ITERATE  │
                                               │(new ver) │
                                               └──────────┘
```

Each phase has specific entry criteria and exit conditions. Skipping phases is where most production failures originate.

---

## Versioning

### Semantic Versioning for Agents

Agents follow semantic versioning with agent-specific meaning:

```
v MAJOR . MINOR . PATCH

MAJOR (v1 → v2):
  - Prompt fundamentally rewritten
  - Output schema changed
  - Behavior changes in a way that callers must adapt to
  → Callers must explicitly migrate to new version

MINOR (v1.0 → v1.1):
  - New tool added
  - New capability or use case supported
  - Performance improvement (same behavior, faster/cheaper)
  → Callers don't need to change, but can use new capabilities

PATCH (v1.0.0 → v1.0.1):
  - Bug fix (wrong output corrected)
  - Prompt tweak (same behavior, improved reliability)
  - Configuration adjustment
  → Transparent to callers
```

### What Gets Versioned

Everything that affects the agent's behavior must be versioned:

| Artifact | How to Version | Where to Store |
|---|---|---|
| System prompt | v1.0.txt, v1.1.txt, etc. | `/prompts/[agent]/` |
| Output schema | Include in prompt version | Same file |
| Tool definitions | Part of SPEC version | `/docs/01_DESIGN/` |
| Model choice | Part of config | Config file + log |
| Threshold values | Part of config | Config file |

**Critical rule:** Never overwrite a prompt version. Always create a new file.

```
/prompts/support_triage/
  v1.0.txt    ← original
  v1.1.txt    ← added urgency scoring
  v2.0.txt    ← complete rewrite for new output format
  CHANGELOG.md
```

### Prompt Changelog Format

```markdown
# Support Triage Prompt — Changelog

## v2.0.0 — 2024-03-01
BREAKING: Output schema changed. Added confidence field. Removed legacy_team field.
- Rewritten for clarity and consistency
- Output now includes confidence score (0.0-1.0)
- ESCALATION category renamed to HIGH_URGENCY

## v1.1.0 — 2024-02-15
- Added CRITICAL urgency level for system-down scenarios
- Improved handling of multi-team tickets

## v1.0.0 — 2024-01-01
- Initial version
```

---

## Deployment Process

### The Safe Deployment Flow

```
NEVER: Push directly to production
ALWAYS: Follow this flow

1. DEVELOPMENT
   ├── Write changes
   ├── Test on 20+ synthetic cases
   └── Test on 20+ real cases from production logs

2. STAGING
   ├── Deploy to staging environment
   ├── Run full test suite
   ├── Run acceptance criteria from SPEC
   └── Measure: latency, cost, accuracy vs. baseline

3. CANARY (5% of traffic)
   ├── Deploy new version to 5% of production traffic
   ├── Run old version for 95% (as control)
   ├── Monitor for 24–48 hours:
   │   - Error rate: should not increase
   │   - Latency: should not increase significantly
   │   - Cost: should not increase significantly
   │   - Output quality: compare samples from old vs. new
   └── If any metric regresses: rollback immediately

4. GRADUAL ROLLOUT
   ├── 5% → 25% → 50% → 100%
   ├── Wait 2–4 hours at each step
   └── Monitor throughout

5. FULL PRODUCTION
   ├── Old version stays live for 7 days (rollback window)
   └── Monitor for first 48 hours intensively
```

### Rollback Decision Criteria

Trigger immediate rollback if any of these occur after deployment:
- Error rate increases by > 2% absolute
- P95 latency increases by > 50%
- Cost per execution increases by > 30%
- Output quality drops (measured by: confidence drop, classification distribution shift, increase in "needs_review" flags)
- Any CRITICAL error that wasn't occurring before

### Rollback Procedure

```
1. Route 100% of traffic back to previous version (< 1 minute)
2. Confirm metrics return to baseline (check within 5 minutes)
3. Preserve the failing deployment for analysis (don't delete)
4. Document in incident log: what changed, what metric triggered rollback
5. Root cause analysis before re-attempting deployment
```

---

## Prompt Regression Testing

Every time you change a prompt, you must verify the new version is better (or at least not worse) than the old one.

### Building a Test Set

```
Golden test set requirements:
  - Minimum 50 examples (100+ for high-stakes agents)
  - Covers all major use cases (not just happy path)
  - Covers known edge cases
  - Labeled with correct expected output
  - Sourced from real production inputs (anonymized)

Structure per example:
  input: [realistic input]
  expected_output: [correct answer]
  category: [use_case_category]
  difficulty: [easy | medium | hard]
  notes: [why this is in the test set]
```

### Running the Comparison

```
1. Take golden test set (50–100 examples)

2. Run ALL examples through OLD prompt version
   → Record: outputs, confidence scores, accuracy

3. Run ALL examples through NEW prompt version
   → Record: outputs, confidence scores, accuracy

4. Compare:
   Accuracy:   new_correct / total  vs  old_correct / total
   Confidence: avg new confidence vs avg old confidence
   Cost:       avg new tokens vs avg old tokens
   Examples where new is BETTER: [list]
   Examples where new is WORSE:  [list]

5. Decision criteria:
   - New accuracy >= old accuracy: PROCEED
   - New accuracy < old accuracy by > 2%: DO NOT DEPLOY
   - New accuracy < old accuracy by 1–2%: requires manual review of failing cases
```

### Regression Test Automation

Run regression tests automatically before every deployment:

```bash
# Pseudocode
run_regression_test() {
  old_results = evaluate_prompt(version=CURRENT, test_set=golden_set)
  new_results = evaluate_prompt(version=CANDIDATE, test_set=golden_set)

  accuracy_delta = new_results.accuracy - old_results.accuracy
  cost_delta     = new_results.avg_cost - old_results.avg_cost

  if accuracy_delta < -0.02:
    echo "BLOCKED: New prompt is 2%+ less accurate. Do not deploy."
    exit 1

  if accuracy_delta >= 0 and cost_delta <= 0:
    echo "APPROVED: New prompt is better or equal in accuracy and cost."
    exit 0

  echo "REVIEW REQUIRED: Mixed results. Manual evaluation needed."
  show_failing_cases(new_results.regressions)
  exit 2
}
```

---

## Monitoring for Drift

Production agents degrade silently over time. Inputs change. User behavior changes. External APIs change their responses. Monitor for drift.

### Types of Drift

**Input drift:** The distribution of inputs is changing.
```
Signal: Average input length is growing 5% per week
Cause: Users are sending longer messages
Risk: Context overflow is more likely
Action: Review context management, adjust truncation
```

**Output drift:** The distribution of outputs is changing.
```
Signal: 30% of tickets classified as CRITICAL last week vs. 5% last month
Cause: Either users are having more critical issues, OR the prompt is misbehaving
Action: Sample and manually review a set of "CRITICAL" classifications
```

**Performance drift:** Quality is degrading without obvious cause.
```
Signal: Confidence scores have been declining 0.5% per week for 6 weeks
Cause: The inputs have drifted away from the distribution the prompt was tuned for
Action: Add new examples to prompt, or re-tune on recent data
```

### Drift Monitoring Setup

```
Weekly automated checks:
  1. Run golden test set → compare accuracy to previous week
     Alert if accuracy drops > 1% week-over-week

  2. Check output distribution → compare to baseline
     Alert if any class shifts > 10% from baseline

  3. Check average confidence → compare to baseline
     Alert if drops > 0.05 from baseline

Monthly checks:
  4. Sample 50 random outputs for manual review
  5. Identify patterns in errors
  6. Update golden test set with new representative examples
```

---

## Deprecation and Retirement

### When to Retire an Agent

- Replaced by a better version (most common)
- Use case no longer exists
- Technology underlying it is being replaced

### Deprecation Timeline

```
T+0:    Decision to deprecate made
T+0:    Mark agent status as "deprecated" in registry
T+1w:   Notify all known callers: "This agent will be retired on [date]. Use [replacement]."
T+4w:   Remove from orchestrator routing (if applicable)
T+6w:   Shut down agent process
T+8w:   Archive documentation (keep, don't delete)
T+8w:   Retain logs for compliance period, then delete
```

### What to Preserve After Retirement

| Artifact | Keep? | How Long |
|---|---|---|
| Final prompt version | Yes | Permanent |
| SPEC and PRD | Yes | Permanent |
| Execution logs | Archive | Per compliance policy |
| Test set | Yes | Permanent (reuse for replacement) |
| Runbook | Yes | Permanent (reference for similar agents) |
| Performance metrics summary | Yes | Permanent |

---

## Lifecycle Checklist

**Before first deployment:**
- [ ] Version documented in SPEC
- [ ] Prompt in version-controlled file
- [ ] Golden test set built (min 50 examples)
- [ ] Regression test passes vs. baseline
- [ ] Staging test passes acceptance criteria
- [ ] Rollback procedure documented and tested

**Every deployment:**
- [ ] Regression test run and passed
- [ ] Canary deployment used
- [ ] Monitoring dashboards checked during rollout
- [ ] Rollback criteria defined in advance

**Every 4 weeks:**
- [ ] Golden test set regression run
- [ ] Output distribution review
- [ ] Cost trend review
- [ ] Prompt changelog updated

**Before retirement:**
- [ ] All callers notified with minimum 30 days notice
- [ ] Replacement agent documented and tested
- [ ] Migration guide written
- [ ] Retirement date set and communicated

---

*End of 04_PRODUCTION. Proceed to `05_MULTI_AGENT/` or `06_OPERATIONS/` as needed.*
