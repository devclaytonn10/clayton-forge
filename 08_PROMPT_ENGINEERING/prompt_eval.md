# Prompt Eval — Testing and Measuring Prompt Quality

> `08_PROMPT_ENGINEERING / 03`
> A prompt you can't measure is a prompt you can't improve. Evals are how you know if your agent is getting better or worse.

---

## What Is an Eval?

An eval (evaluation) is a systematic test of your prompt against a set of inputs with known correct outputs.

Without evals:
- You change a prompt and hope it got better
- You deploy and discover problems in production
- You can't compare two prompt versions objectively

With evals:
- Every change is measured before deployment
- Regressions are caught before they reach users
- You can make decisions based on evidence

---

## The Golden Test Set

The foundation of all evals is a curated set of test cases with known correct answers.

### Building Your Golden Test Set

**Minimum size:** 50 examples (100+ for high-stakes agents)

**Composition:**
```
60% — Common cases (what the agent sees most often)
25% — Edge cases (unusual but valid inputs)
10% — Failure cases (inputs that should produce refusals or escalations)
5%  — Adversarial cases (attempts to break scope or bypass rules)
```

**Sources:**
1. Real production inputs (anonymized) — most valuable
2. Manually crafted cases — fill gaps in coverage
3. Systematically generated cases — for specific behaviors

### Test Case Format

```yaml
- id: TC-001
  category: happy_path
  difficulty: easy
  description: "Customer provides order ID directly"

  input: "Where is my order ORD-12345?"

  expected_output:
    action: "query_order"
    order_id: "ORD-12345"
    confidence_min: 0.90

  evaluation_criteria:
    - field: action
      match: exact
      expected: "query_order"
    - field: order_id
      match: exact
      expected: "ORD-12345"
    - field: confidence
      match: range
      min: 0.90
      max: 1.00

  notes: "Basic happy path. Should be near-perfect accuracy."

---

- id: TC-002
  category: extraction_challenge
  difficulty: medium
  description: "Order ID embedded in natural language with noise"

  input: "Hi, I bought a sofa last week, order number is 12345, tracking says it shipped but I haven't gotten a notification?"

  expected_output:
    action: "query_order"
    order_id: "ORD-12345"  # must normalize "12345" to "ORD-12345"

  evaluation_criteria:
    - field: action
      match: exact
    - field: order_id
      match: exact

  notes: "Tests ID extraction and normalization from noisy input."

---

- id: TC-010
  category: out_of_scope
  difficulty: easy
  description: "Question outside agent scope"

  input: "Can you help me write a product review?"

  expected_output:
    action: "redirect"
    escalation_required: false

  evaluation_criteria:
    - field: action
      match: exact
      expected: "redirect"
    - behavior: "response must NOT attempt to write a review"
      match: semantic_negative

  notes: "Agent must decline gracefully and redirect."
```

---

## Evaluation Metrics

### Metric 1 — Exact Match Accuracy

For outputs with a finite set of correct values:

```
Exact match accuracy = correct outputs / total test cases

Example:
  50 test cases
  46 correct outputs
  Exact match accuracy = 46/50 = 92%
```

**Use for:** Classification, extraction, routing, any structured output with clear right/wrong answers.

### Metric 2 — Field-Level Accuracy

For JSON outputs, measure accuracy per field:

```
Per-field accuracy:
  action:      50/50 = 100%  ✅
  order_id:    47/50 = 94%   ✅
  confidence:  45/50 = 90%   ✅ (within expected range)
  urgency:     42/50 = 84%   ⚠️  (below 90% threshold)

Overall:       184/200 = 92%
```

**Use for:** When you need to know which part of the output is failing.

### Metric 3 — Semantic Similarity

For natural language outputs where exact match doesn't apply:

```
Human evaluator (or LLM-as-judge) rates:
  5 = Perfect answer, nothing to improve
  4 = Good answer, minor improvement possible
  3 = Acceptable, missing some element
  2 = Partially correct, significant issues
  1 = Wrong or unhelpful

Target: avg score ≥ 4.0 on golden set
```

**Use for:** Response quality, tone, completeness of natural language answers.

### Metric 4 — Behavioral Tests

For properties that can't be measured numerically:

```
Test: Does the agent escalate when it should?
  Run 10 "escalation required" test cases
  Count: how many triggered escalation?
  Pass: ≥ 9/10 (90%)

Test: Does the agent stay in scope?
  Run 10 "out of scope" test cases
  Count: how many did agent correctly refuse?
  Pass: 10/10 (100% — this is a trust and safety property)
```

---

## The Eval Workflow

### Before Every Deployment

```
1. Make prompt changes

2. Run golden test set against NEW prompt
   → Record: accuracy, per-field breakdown, avg confidence

3. Compare to baseline (CURRENT prompt results)
   → Calculate: delta in accuracy, regression cases

4. Decision gate:
   PASS:   New accuracy ≥ old accuracy - 2%
           No regressions in critical behaviors (escalation, scope)
   REVIEW: New accuracy < old accuracy by 1–2%
           → Manual review of regression cases, decide if acceptable
   BLOCK:  New accuracy < old accuracy by > 2%
           → Do not deploy. Fix prompt first.

5. If PASS: proceed with canary deployment
   If REVIEW: get second opinion, document trade-off decision
   If BLOCK: investigate failures, revise prompt, repeat from step 1
```

### Monthly Regression Test

```
1. Run golden test set against CURRENT production prompt
   (no changes — just checking that it still works as expected)

2. Compare to last month's results:
   - Accuracy should be stable (within ±1%)
   - If accuracy is declining: inputs are drifting. Update test set and retune.

3. Update test set:
   - Add 5-10 new cases from production (recent failures or new patterns)
   - Remove obsolete cases (scenarios that no longer apply)
   - Re-run baseline with updated test set to reset the reference
```

---

## LLM-as-Judge Pattern

For evaluating natural language quality at scale, use an LLM to judge outputs:

```python
JUDGE_PROMPT = """
You are an expert evaluator assessing the quality of an AI agent's response.

AGENT ROLE: {agent_role}
USER INPUT: {user_input}
AGENT RESPONSE: {agent_response}
EXPECTED BEHAVIOR: {expected_behavior}

Evaluate the response on these dimensions (1-5 each):

1. CORRECTNESS: Is the information accurate and complete?
2. RELEVANCE: Does it address what the user actually asked?
3. TONE: Is the tone appropriate for the context?
4. FORMAT: Is it formatted correctly per the agent's requirements?
5. SCOPE: Did the agent stay within its defined scope?

Respond with JSON:
{
  "scores": {
    "correctness": 1-5,
    "relevance": 1-5,
    "tone": 1-5,
    "format": 1-5,
    "scope": 1-5
  },
  "overall": 1-5,
  "pass": true/false,  // overall >= 4 and scope >= 5
  "issues": ["list of specific problems found"],
  "reasoning": "brief explanation of the overall score"
}
"""
```

**Important:** LLM judges are themselves imperfect. Calibrate them against human judgments on a sample. Use them for scale, not as the sole authority.

---

## Prompt Comparison Report Template

Fill this when comparing two prompt versions:

```markdown
# Prompt Comparison: v[OLD] → v[NEW]
Date: YYYY-MM-DD
Evaluator: [name]
Test set: golden_set_v[N] (50 cases)

## Summary

| Metric | v[OLD] | v[NEW] | Delta |
|---|---|---|---|
| Overall accuracy | 91.2% | 93.4% | +2.2% ✅ |
| action field | 98.0% | 98.0% | 0% |
| order_id extraction | 88.0% | 92.0% | +4.0% ✅ |
| confidence calibration | 87.0% | 91.0% | +4.0% ✅ |
| Avg confidence score | 0.87 | 0.89 | +0.02 |
| Avg tokens/call | 1,240 | 1,180 | -60 ✅ |

## Regressions (cases v[OLD] got right, v[NEW] got wrong)

| Test Case | Input | v[OLD] output | v[NEW] output | Analysis |
|---|---|---|---|---|
| TC-023 | "..." | correct | incorrect | New prompt misses [specific thing] |

## Improvements (cases v[OLD] got wrong, v[NEW] got right)

| Test Case | Input | v[OLD] output | v[NEW] output | Why improved |
|---|---|---|---|---|
| TC-015 | "..." | incorrect | correct | New few-shot example clarifies this |

## Decision

[ ] APPROVED for deployment
[ ] APPROVED with conditions: [specify]
[ ] REJECTED — regressions outweigh improvements

Reasoning: [explanation]

Next steps: [what to do after this evaluation]
```

---

## Eval Checklist

Before considering a prompt ready for production:

**Test set:**
- [ ] Minimum 50 test cases built
- [ ] Covers all major use cases
- [ ] Covers edge cases and failures
- [ ] Labeled with correct expected outputs

**Evaluation run:**
- [ ] Baseline established with current/initial prompt
- [ ] All test cases evaluated
- [ ] Per-field accuracy measured
- [ ] Behavioral tests passed (escalation, scope enforcement)

**For every subsequent change:**
- [ ] Eval run completed before deployment
- [ ] Comparison report filled
- [ ] No regressions in critical behaviors
- [ ] Overall accuracy ≥ baseline - 2%

**Monthly:**
- [ ] Regression test run on production prompt
- [ ] Test set updated with new cases from production
- [ ] Prompt changelog updated

---

*End of 08_PROMPT_ENGINEERING. Clayton Forge is now complete.*
