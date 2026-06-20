# Orchestrator Design — Building Agents That Manage Agents

> `05_MULTI_AGENT / 01`
> An orchestrator is the most complex agent type. It requires everything a regular agent needs, plus the ability to coordinate, delegate, and recover from failures in other agents.

---

## When You Need an Orchestrator

An orchestrator is justified when:

1. **The problem has natural specialization boundaries.** Different parts need different expertise, prompts, or tools.
2. **Parallelism provides real value.** Multiple agents working simultaneously reduces total latency significantly.
3. **Failure isolation matters.** A failure in one area should not prevent progress in others.
4. **The problem is too large for one context window.** Breaking it across agents allows each to focus deeply.

An orchestrator is NOT justified when:
- A single agent with multiple tools could do the job
- The "specialization" is just cosmetic — same prompt, same tools, different label
- The overhead of coordination costs more than the benefit of specialization

---

## The Orchestrator's Unique Responsibilities

Beyond what any agent does, an orchestrator must:

```
1. UNDERSTAND the full goal and decompose it into sub-tasks
2. DISPATCH sub-tasks to the right agents at the right time
3. MONITOR agent execution (timeouts, failures, progress)
4. AGGREGATE results from multiple agents into a coherent output
5. HANDLE partial failures without losing all progress
6. RESOLVE conflicts when agents return contradictory results
7. ESCALATE when the system cannot complete the goal
```

---

## Orchestrator Architecture

```
┌──────────────────────────────────────────────────────────────────┐
│                        ORCHESTRATOR                              │
│                                                                  │
│  ┌───────────────┐    ┌───────────────┐    ┌─────────────────┐  │
│  │   PLANNER     │    │   DISPATCHER  │    │   AGGREGATOR    │  │
│  │               │    │               │    │                 │  │
│  │ Decomposes    │───▶│ Sends tasks   │    │ Combines agent  │  │
│  │ goal into     │    │ to agents,    │───▶│ results into    │  │
│  │ sub-tasks     │    │ monitors them │    │ final output    │  │
│  └───────────────┘    └───────────────┘    └─────────────────┘  │
│           │                   │                      │           │
│           └───────────────────┴──────────────────────┘           │
│                               │                                  │
│                     ┌─────────▼─────────┐                       │
│                     │  FAILURE HANDLER  │                       │
│                     │                   │                       │
│                     │ Retries, fallback,│                       │
│                     │ escalation        │                       │
│                     └───────────────────┘                       │
│                                                                  │
└──────────────────────────────────────────────────────────────────┘
          │                    │                    │
          ▼                    ▼                    ▼
    [Agent A]           [Agent B]           [Agent C]
```

---

## The Orchestrator's System Prompt

The orchestrator's prompt has a unique structure — it must describe the full agent ecosystem, not just one role:

```
[IDENTITY]
You are [Name], an orchestrator responsible for [goal].
You manage [N] specialized agents to accomplish complex tasks.

[YOUR AGENTS]
You have access to the following agents:

AGENT: research_agent
PURPOSE: Find and synthesize information from external sources
CALL WHEN: The task requires gathering data, facts, or market information
INPUT: {"query": "string", "depth": "shallow|deep", "sources": ["list"]}
OUTPUT: {"findings": "string", "sources": ["list"], "confidence": 0.0-1.0}
TYPICAL LATENCY: 10-30 seconds
LIMITATIONS: Cannot access real-time data. Knowledge may be outdated.

AGENT: writer_agent
PURPOSE: Generate, edit, and format written content
CALL WHEN: The task requires producing text — reports, emails, summaries
INPUT: {"content_type": "string", "brief": "string", "tone": "string", "length": "string"}
OUTPUT: {"content": "string", "word_count": number}
TYPICAL LATENCY: 5-15 seconds
LIMITATIONS: Cannot make factual claims without input from research_agent

AGENT: reviewer_agent
PURPOSE: Check content for quality, accuracy, and compliance
CALL WHEN: Any content that will be sent to customers or published
INPUT: {"content": "string", "checklist": ["list of criteria"]}
OUTPUT: {"approved": boolean, "score": 0-100, "issues": ["list"], "suggestions": ["list"]}
TYPICAL LATENCY: 5-10 seconds
LIMITATIONS: Can only review, cannot edit

[ORCHESTRATION RULES]
1. Always call research_agent before writer_agent for fact-dependent content
2. Always call reviewer_agent before delivering content to the user
3. If reviewer_agent score < 70: send back to writer_agent with reviewer's feedback (max 2 rounds)
4. If any agent returns error after 2 retries: report partial result, note what failed
5. If all agents fail: escalate to human with full context

[PLANNING]
Before dispatching any agents, output your plan:
{
  "goal_understood": "one sentence",
  "plan": [
    {"step": 1, "agent": "agent_id", "reason": "why this agent", "depends_on": null},
    {"step": 2, "agent": "agent_id", "reason": "why", "depends_on": [1]},
    ...
  ],
  "parallel_steps": [[1, 2], [3]]  // steps that can run simultaneously
}

[OUTPUT FORMAT]
{
  "status": "success | partial | error",
  "result": "final consolidated output",
  "agents_used": ["list"],
  "steps_completed": number,
  "steps_failed": ["list with reasons"],
  "confidence": 0.0-1.0
}
```

---

## Planning Strategies

### Static Planning (Plan-and-Execute)

The orchestrator creates a full plan before executing any step.

```
PROS:
+ Efficient — can parallelize from the start
+ Easier to audit
+ Good for well-defined tasks

CONS:
- Can't adapt if early results change the plan
- Wasted work if plan needs revision

BEST FOR: Tasks where the path is known in advance
```

```
Orchestrator receives goal
         │
         ▼
[Generate full execution plan]
  Step 1: Research (independent)
  Step 2: Summarize (depends on step 1)
  Step 3: Format (depends on step 2)
         │
         ▼
[Execute plan]
  Run step 1
  Run step 2 with step 1's result
  Run step 3 with step 2's result
         │
         ▼
[Aggregate and return]
```

### Dynamic Planning (ReAct Orchestration)

The orchestrator decides what to do next after seeing each result.

```
PROS:
+ Adapts to unexpected results
+ More efficient when early results eliminate steps

CONS:
- Harder to parallelize
- More LLM calls (planning overhead at each step)

BEST FOR: Research, investigation, open-ended tasks
```

```
Orchestrator receives goal
         │
         ▼
[Thought: What do I need first?]
[Action: call research_agent with X]
[Observation: got result Y]
[Thought: Based on Y, I now need Z]
[Action: call writer_agent with Z]
[Observation: got content W]
[Thought: Is this good enough?]
[Action: call reviewer_agent with W]
[Observation: approved, score 85]
[Thought: Done.]
[Return: W]
```

### Hybrid Planning

Static plan for known steps, dynamic decisions for uncertain steps.

```
BEST FOR: Most real-world orchestrators
```

---

## Result Aggregation

The hardest part of orchestration is combining multiple agents' outputs into one coherent result.

### Aggregation Patterns

**Merge (additive outputs):**
```
Agent A produces: {entities: ["B&G", "Tok&Stok"]}
Agent B produces: {entities: ["MadeiraMadeira"]}
Merged:           {entities: ["B&G", "Tok&Stok", "MadeiraMadeira"]}
```

**Synthesis (complementary outputs):**
```
Agent A (researcher): {facts: [...]}
Agent B (writer):     {draft: "...using provided facts..."}
Synthesized:          {final_document: agent_b.draft}
# Agent B consumed Agent A's output — no merging needed
```

**Consensus (same task, multiple agents, pick best):**
```
Agent A rates compliance photo: {score: 72, violations: ["X", "Y"]}
Agent B rates compliance photo: {score: 68, violations: ["X", "Z"]}
Consensus:
  - Average score: 70
  - Union of violations: ["X", "Y", "Z"]
  - Confidence: 0.85 (agents agree on 2/3 items)
```

**Tournament (pick the best):**
```
Agent A writes email draft A
Agent B writes email draft B
Reviewer picks: A scored 88, B scored 74 → use A
```

### Conflict Resolution

When agents contradict each other:

| Conflict Type | Resolution Strategy |
|---|---|
| Numeric disagreement | Average, weighted by confidence |
| Factual disagreement | Prefer the agent with sourced evidence |
| Classification disagreement | Use majority vote (need 3+ agents) |
| Quality disagreement | Use the reviewer agent as tiebreaker |
| Irreconcilable conflict | Escalate to human with both views |

---

## Failure Handling in Multi-Agent Systems

### Partial Failure Policy

Define this BEFORE building. Choose one:

```
STRICT:   All agents must succeed. One failure = orchestrator fails.
          Use when: every piece is critical, no partial result is acceptable

LENIENT:  Return results from successful agents, note what failed.
          Use when: partial results are useful to the user

QUORUM:   At least N of M agents must succeed.
          Use when: you have redundant agents for the same task

COMPENSATING: If agent B fails after A succeeded, undo A's effects.
          Use when: steps have side effects that must be rolled back
```

### The Recovery Playbook

```
Agent call fails:
         │
         ├── Is it retryable?
         │     ├── Yes: retry with backoff (up to max_attempts)
         │     └── No: proceed to fallback
         │
         ├── Is there a fallback agent?
         │     ├── Yes: call fallback agent
         │     └── No: proceed to degradation
         │
         ├── Can the orchestrator continue without this agent?
         │     ├── Yes: mark step as failed, continue with what's available
         │     └── No: orchestrator fails this task
         │
         └── Return partial result with failure metadata
```

### State Persistence During Failures

For long-running orchestrations, persist state so you can resume:

```json
{
  "orchestration_id": "orch_xyz",
  "goal": "...",
  "status": "in_progress",
  "plan": [...],
  "completed_steps": [
    {"step": 1, "agent": "research_agent", "result": {...}, "completed_at": "..."}
  ],
  "pending_steps": [2, 3],
  "failed_steps": [],
  "started_at": "...",
  "last_updated": "..."
}
```

If the orchestrator crashes, it reads this state and resumes from step 2.

---

## Orchestrator Testing

Testing an orchestrator is harder than testing a single agent. You must test:

### Unit Tests (each agent in isolation)
- Does Agent A produce the right output for input X?
- Does Agent B handle Agent A's output format?

### Integration Tests (agents together)
- Does the full pipeline produce the right result?
- If Agent A is slow, does the orchestrator wait correctly?

### Chaos Tests (failure scenarios)
- If Agent B fails, does the orchestrator use the fallback?
- If Agent A produces bad output, does Agent B reject it?
- If the orchestrator crashes mid-execution, does it resume correctly?

### Cost Tests
- Does the orchestrator make unnecessary agent calls?
- Does caching prevent duplicate calls?

---

*Next: `02_agent_registry.md` — How to manage the catalogue of available agents*
