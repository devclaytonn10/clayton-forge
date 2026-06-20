# Orchestration Patterns — How Agents Work Together

> `02_PROTOCOLS / 03`
> The proven patterns for composing multiple agents into reliable systems.

---

## The Core Challenge of Multi-Agent Systems

A single agent that fails is a problem. A multi-agent system where one agent's failure cascades into all the others is a disaster.

Good orchestration is about more than connecting agents. It's about:
- Containing failures so they don't propagate
- Ensuring results are trustworthy even when parts fail
- Making the system observable and debuggable
- Scaling without exponential complexity

This document gives you the proven patterns.

---

## Pattern 1 — Pipeline (Sequential)

**Structure:** Each agent passes its output to the next agent in sequence.

```
Input → [Agent A] → [Agent B] → [Agent C] → Output
```

**When to use:**
- Each step transforms or enriches the data
- Order matters — B needs A's output to work
- Steps have clear dependencies

**Strengths:**
- Simple to reason about
- Easy to debug (you know exactly where failure occurred)
- Easy to add/remove steps

**Weaknesses:**
- Total latency = sum of all agent latencies
- One agent's failure stops the whole pipeline
- No parallelism

**Failure handling:**
```
[Agent A] fails:
  → Retry A (up to N times)
  → If exhausted: return partial result with error in metadata
  → OR escalate entire pipeline to human queue

[Agent B] receives bad output from A:
  → B validates input before processing
  → If invalid: return error with context "bad upstream output from A"
  → Pipeline logs the issue and halts
```

**Implementation pattern:**
```
async function runPipeline(input) {
  let state = { input, results: [], errors: [] }

  for (const agent of pipeline) {
    const result = await callWithRetry(agent, state.current)

    if (result.status === 'error') {
      if (!result.retryable || retriesExhausted) {
        return { status: 'partial', completed: state.results, failed_at: agent.id }
      }
    }

    state.results.push(result)
    state.current = result.output  // next agent gets this agent's output
  }

  return { status: 'success', results: state.results }
}
```

---

## Pattern 2 — Parallel Fan-Out / Fan-In

**Structure:** One orchestrator distributes work to multiple agents simultaneously, then aggregates results.

```
                    ┌─── [Agent A] ───┐
Input → [Dispatch] ─┼─── [Agent B] ───┼─→ [Aggregate] → Output
                    └─── [Agent C] ───┘
```

**When to use:**
- Tasks can be executed independently
- Speed matters — parallelism reduces total latency
- Different aspects of a problem need different specialists

**Strengths:**
- Total latency ≈ slowest agent (not sum of all)
- Natural specialization
- Failures are isolated

**Weaknesses:**
- Aggregation logic can be complex
- Results may conflict — need tie-breaking rules
- Higher cost (all agents run even if early results are sufficient)

**Aggregation strategies:**

| Strategy | When to use |
|---|---|
| **Merge all** | All results are additive (A finds entities, B finds sentiment) |
| **Best of N** | Multiple agents solve the same problem, pick the best result |
| **Majority vote** | Controversial decisions need consensus |
| **First N complete** | You only need some results, not all |
| **Weighted average** | Agents have different confidence scores |

**Failure handling:**
```
Partial failure policy (choose one per use case):

STRICT:   All agents must succeed. One failure = pipeline fails.
LENIENT:  Return results from successful agents, note failures.
QUORUM:   At least N of M agents must succeed.
FALLBACK: If agent A fails, use agent A' as backup.
```

**Implementation pattern:**
```
async function runParallel(input, agents, policy) {
  const promises = agents.map(agent => callWithTimeout(agent, input))
  const results = await Promise.allSettled(promises)

  const succeeded = results.filter(r => r.status === 'fulfilled')
  const failed = results.filter(r => r.status === 'rejected')

  if (policy === 'STRICT' && failed.length > 0) {
    return { status: 'error', failed_agents: failed.map(f => f.agent_id) }
  }

  return aggregate(succeeded.map(r => r.value))
}
```

---

## Pattern 3 — Conditional Routing

**Structure:** The orchestrator inspects the input (or intermediate result) and routes to different agents based on conditions.

```
         ┌──→ [Agent A: Simple cases] ──┐
Input →  │                              │→ Output
[Router] ├──→ [Agent B: Complex cases] ─┤
         │                              │
         └──→ [Agent C: Edge cases] ────┘
```

**When to use:**
- Different types of input need different specialized handling
- Cost optimization — route simple cases to cheaper agents
- Quality optimization — route high-stakes cases to better agents

**Routing strategies:**

### Rule-based routing (deterministic, preferred when possible)
```
if input.urgency == 'CRITICAL':
  route to Agent A (premium, fast)
elif input.type == 'billing':
  route to Agent B (billing specialist)
else:
  route to Agent C (general)
```

### LLM-based routing (flexible, handles ambiguous cases)
```
Prompt: "Classify this request as: SIMPLE | COMPLEX | BILLING | ESCALATE.
         Reply with only one word."
→ Use classification to route
```

### Hybrid routing (recommended)
```
1. Try rule-based first (fast, cheap)
2. If no rule matches, use LLM classifier
3. LLM classifier has defined confidence threshold
4. Below threshold → human review
```

**Implementation pattern:**
```
async function routeRequest(input) {
  // 1. Try rule-based first
  const ruleRoute = applyRoutingRules(input)
  if (ruleRoute) return await dispatch(ruleRoute, input)

  // 2. Fall back to LLM classifier
  const classification = await classifierAgent.run(input)

  if (classification.confidence < 0.7) {
    return await humanQueue.submit(input, reason: 'low confidence routing')
  }

  return await dispatch(classification.route, input)
}
```

---

## Pattern 4 — Iterative Refinement

**Structure:** An agent runs, its output is evaluated, and it runs again until quality is sufficient.

```
Input → [Agent] → [Evaluator] → Good enough? → Output
                       │
                   Not yet ←────────────┘
                       │
               [Agent runs again
                with feedback]
```

**When to use:**
- Output quality is critical
- The agent can improve given feedback
- You can define "good enough" programmatically

**Evaluator types:**

| Type | How it works | Best for |
|---|---|---|
| **Rule-based** | Check output format, completeness, constraints | Structured outputs |
| **LLM critic** | Another LLM grades and explains flaws | Natural language quality |
| **Human review** | A person evaluates | High-stakes, low-volume |
| **Automated test** | Run output against test cases | Code generation |

**Termination conditions (always define at least one):**
- Quality score ≥ threshold
- Max iterations reached
- No improvement between iterations
- Time limit reached

**Anti-pattern to avoid:** Infinite loops. Always set a max iteration count.

```
async function iterativeRefine(input, maxIterations = 3) {
  let output = await agent.run(input)
  let iterations = 0

  while (iterations < maxIterations) {
    const evaluation = await evaluator.assess(output)

    if (evaluation.score >= QUALITY_THRESHOLD) break

    // Give agent feedback and let it improve
    output = await agent.run(input, feedback: evaluation.critique)
    iterations++
  }

  return { output, iterations, quality: evaluation.score }
}
```

---

## Pattern 5 — Hierarchical (Orchestrator of Orchestrators)

**Structure:** A top-level orchestrator delegates to mid-level orchestrators, which delegate to worker agents.

```
[Top Orchestrator]
        │
   ┌────┴────┐
   ▼         ▼
[Orch A]  [Orch B]
   │         │
 ┌─┴─┐     ┌─┴─┐
[A1][A2]  [B1][B2]
```

**When to use:**
- Very complex problems with natural decomposition
- Different domains need different orchestration strategies
- Teams managing different parts of the system independently

**Critical rules:**
1. Each orchestrator owns its subtree completely
2. Communication only through the contract (no direct agent-to-agent calls across branches)
3. Failures bubble up to the nearest orchestrator that can handle them
4. Top orchestrator has the final say on escalation

**Depth limit:** In practice, more than 3 levels of hierarchy becomes very hard to debug. If you need more, question whether the problem is truly that complex.

---

## Pattern 6 — Blackboard (Shared State)

**Structure:** Agents read from and write to a shared state store, without direct communication between them.

```
[Agent A] ──→ ┌──────────┐ ←── [Agent B]
              │BLACKBOARD│
[Agent C] ──→ │  (shared │ ←── [Agent D]
              │  state)  │
              └──────────┘
```

**When to use:**
- Agents need to share evolving state
- The order of agent execution is dynamic
- Agents need to react to each other's outputs without tight coupling

**Strengths:**
- Loose coupling — agents don't know about each other
- Easy to add new agents to the system
- Natural for event-driven architectures

**Weaknesses:**
- Race conditions if agents write to the same fields
- Harder to trace causality ("who wrote this value?")
- Requires strong consistency guarantees from the state store

**Implementation requirements:**
- Atomic read-modify-write operations
- Optimistic locking or versioning on state updates
- Full audit log of who wrote what and when

---

## Choosing the Right Pattern

```
Do agents need to run one after another (order matters)?
└── Yes → PIPELINE

Do agents run independently on the same input?
└── Yes → PARALLEL FAN-OUT

Does the input determine which agent to use?
└── Yes → CONDITIONAL ROUTING

Does the output need refinement until it's good enough?
└── Yes → ITERATIVE REFINEMENT

Do orchestrators need to manage orchestrators?
└── Yes → HIERARCHICAL

Do agents need to share evolving state?
└── Yes → BLACKBOARD

Can't decide? → Start with PIPELINE. Evolve as needed.
```

---

## Combining Patterns

Real systems combine patterns. A common example:

```
Input
  │
  ▼
[Router: classify the request]           ← CONDITIONAL ROUTING
  │
  ├── Simple → [Single agent]
  │
  └── Complex →
        │
        ▼
     [Orchestrator]                       ← PIPELINE
        │
        ├── [Parallel: research agents]  ← PARALLEL
        │       [Agent A] [Agent B]
        │           └──────┘
        │               │
        ▼               ▼
     [Synthesizer agent]
        │
        ▼
     [Quality evaluator]                  ← ITERATIVE REFINEMENT
        │ (if score < threshold, re-run)
        │
        ▼
     Output
```

Document which pattern each part of your system uses. This makes debugging exponentially easier.

---

*Next: `04_trust_model.md` — What agents are allowed to do, and how to enforce it*
