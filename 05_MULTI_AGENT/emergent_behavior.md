# Emergent Behavior — When Agents Surprise You

> `05_MULTI_AGENT / 03`
> Multi-agent systems produce behaviors that no individual agent was designed to produce. Some are useful. Some are catastrophic. All need to be anticipated.

---

## What Is Emergent Behavior?

Emergent behavior is what happens at the system level that wasn't explicitly programmed at the component level.

A single agent produces outputs you can test and predict. A multi-agent system produces interactions — and those interactions produce patterns that no individual agent's designer anticipated.

This is not a theoretical concern. It has caused real production failures.

---

## The Four Failure Modes of Multi-Agent Systems

### Failure Mode 1 — Cascading Errors

**What happens:** Agent A produces a slightly wrong output. Agent B treats it as correct and builds on it. Agent C builds on B's output. By the time you see the final result, the error has compounded into something completely wrong — and it's hard to trace back to Agent A.

**Why it happens:** Each agent validates its own input but trusts upstream agents too much.

**Real example:**
```
Agent A (classifier): classifies ticket as "billing" (actually "shipping") — 78% confidence
Agent B (router): routes to billing team based on A's classification
Agent C (responder): writes billing-specific response
Customer receives: a response about billing when their issue is shipping
                   → customer frustration, repeat contact
```

**Prevention:**
```
1. Confidence thresholds: if confidence < 0.85, flag for verification before passing on
2. Independent validation: critical classifications checked by a second agent
3. Feedback loops: downstream agents report when upstream output seems inconsistent
4. Human checkpoints: for high-stakes pipelines, insert human review at key transitions
```

---

### Failure Mode 2 — Feedback Loops and Infinite Cycles

**What happens:** Agent A produces output that triggers Agent B. Agent B's output triggers Agent A again. Repeat until timeout, budget exhaustion, or manual intervention.

**Why it happens:** Orchestrators designed to retry and improve can create conditions where no completion state is ever reached.

**Real example:**
```
[Orchestrator]: "Write a summary, then review it"
  [Writer]: writes draft → confidence 0.72
  [Reviewer]: score 68/100 → "needs improvement"
  [Orchestrator]: "improve the draft"
  [Writer]: revises → confidence 0.74
  [Reviewer]: score 71/100 → "needs improvement" (threshold: 75)
  [Orchestrator]: "improve the draft"
  [Writer]: revises → confidence 0.71 (slightly worse)
  ... repeats 47 more times until budget limit hit
```

**Prevention:**
```
Rule 1: Every iterative loop MUST have a maximum iteration count (never infinite)
Rule 2: Track improvement per iteration — if improvement < threshold, stop
Rule 3: Track total cost — if cost > limit, stop
Rule 4: Track time — if total time > limit, stop and return best result so far

Example:
  max_iterations: 3
  min_improvement_per_iteration: 0.02  # at least 2 points improvement
  stop_if_no_improvement: true
  return_on_stop: "best result so far, not last result"
```

---

### Failure Mode 3 — Context Drift

**What happens:** As a task passes through multiple agents, the original intent gets distorted. Each agent interprets its input through its own lens, adding its own assumptions, and by the end, the output doesn't match what was originally requested.

**Why it happens:** Agents are optimized for their specific task. They don't maintain perfect fidelity to the original request.

**Real example:**
```
User asks: "Summarize this document in a formal tone, 200 words max"

Agent A (researcher): adds additional context not in original document
Agent B (writer): interprets "formal" as "technical" and uses jargon
Agent C (formatter): reformats to 300 words (didn't check length constraint)

Final output: 300-word technical document with extra information, informal elements
              → none of the original constraints honored
```

**Prevention:**
```
1. Pass original requirements to every agent, not just the previous agent's output
2. Explicit constraint checking at each step
3. Final validation agent that checks output against original requirements
4. Immutable requirements object that travels through the full pipeline:

{
  "original_request": "Summarize in formal tone, 200 words max",
  "constraints": {
    "max_words": 200,
    "tone": "formal",
    "content_scope": "only what's in the original document"
  }
}
```

---

### Failure Mode 4 — Cost Explosion

**What happens:** A multi-agent system that works fine at low volume suddenly becomes very expensive at scale. Or a bug causes agents to make far more calls than intended.

**Why it happens:** Each agent's cost seems reasonable in isolation. The orchestrator's logic multiplies it in ways that weren't tested.

**Real example:**
```
Orchestrator logic (simplified):
  for each of 100 documents:
    call researcher (avg 3 LLM calls each)
    call writer (avg 2 LLM calls each)
    call reviewer (avg 1 LLM call each)
    if reviewer score < 75:
      call writer again (avg 2 more LLM calls)
      call reviewer again

  Expected: 6 LLM calls per document × 100 = 600 calls
  Actual: 60% of documents fail review → 700 additional calls
  Real total: ~1,300 calls — 2x expected cost

  At $0.01/call: expected $6, actual $13 — manageable
  At scale (10,000 docs/day): expected $600, actual $1,300/day = $39,000/month
```

**Prevention:**
```
1. Cost estimate for WORST CASE, not average case
2. Hard per-execution cost limit (halt if exceeded)
3. Daily budget with automatic pause
4. Cost monitoring with trend alerts (not just threshold alerts)
5. Load test before scaling
```

---

## Useful Emergent Behaviors

Not all emergence is bad. Systems can produce useful behaviors that weren't explicitly designed.

### Error Correction Emergence

When multiple agents check each other's work, errors get caught at a rate higher than any individual agent's accuracy would suggest:

```
Agent A accuracy: 90%
Agent B accuracy: 88%
Combined (A checks B, B checks A): ~99%

Why: An agent making an error is more likely to be caught by another agent
     operating independently than to be missed by both
```

### Specialization Emergence

When agents are allowed to develop their own strategies over time (learning systems), they often specialize in ways you didn't design:

```
You designed: 3 identical research agents for load balancing
What emerged: Agent 1 specializes in technical sources
              Agent 2 specializes in recent news
              Agent 3 specializes in historical context
Result: Better coverage than 3 generalists
```

### Collaborative Synthesis Emergence

Multiple narrow agents sometimes produce broader insights than one general agent:

```
Agent A (financial analyst): identifies revenue trend
Agent B (market analyst): identifies market shift
Agent C (synthesizer): connects these independently discovered insights
                       into a strategic implication neither A nor B would find alone
```

---

## Monitoring for Emergent Failures

Standard monitoring (error rates, latency) won't catch emergent failures early enough. Add:

### Cross-Agent Consistency Checks

```
At the orchestrator level, monitor:
- How often does Agent B reject Agent A's output? (drift indicator)
- How many retries does the pipeline take on average? (loop tendency indicator)
- What percentage of pipelines exceed expected cost by >50%? (cascade cost indicator)
```

### Output Drift Detection

```
Maintain a "golden set" — 50 representative inputs with known correct outputs.
Run the full pipeline on this set weekly.
Alert if output quality degrades without code changes.
(This catches emergent drift before it affects production volume)
```

### Dependency Graph Analysis

```
Map: which agent calls which agent, how often
Alert on: unexpected new call patterns (may indicate a loop)
Alert on: new dependencies that weren't designed (agents calling each other directly)
```

---

## Design Principles That Prevent Emergent Failures

1. **Always have a termination condition.** Every loop, every retry, every iterative process must have a state it cannot escape.

2. **Immutable requirements.** The original request should travel unchanged through the full pipeline.

3. **Independent validation.** Critical decisions should be validated by an agent that doesn't share state with the deciding agent.

4. **Cost budgets at every level.** Per-call, per-pipeline, per-day. Not just one.

5. **Circuit breakers between agents.** If Agent B is failing, the orchestrator should stop calling it — not keep retrying.

6. **Human escalation is always valid.** The system should be able to say "I can't complete this" and hand it to a human, without this being treated as a failure.

---

*End of MULTI_AGENT. Proceed to `06_OPERATIONS/` for operational templates.*
