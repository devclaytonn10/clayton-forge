# Agent vs. Automation — When You Don't Actually Need an Agent

> `00_FOUNDATIONS / 04`
> The most important decision in AI agent development is whether to build an agent at all.

---

## The Hard Truth

AI agents are exciting. They're also expensive, unpredictable, and harder to maintain than traditional automation.

The best engineers ask this question before building anything:

> **"Is an AI agent the simplest solution that solves this problem?"**

If the answer is no, build something simpler. You'll ship faster, spend less, and sleep better.

---

## The Solution Spectrum

Not every problem needs an agent. Problems exist on a spectrum of solutions:

```
SIMPLER ◄─────────────────────────────────────────────────────► COMPLEX

  Script    Rule-based    Workflow      LLM Call     AI Agent    Autonomous
            System        Automation    (one-shot)               Agent

  If/else   Decision      n8n / Zapier  Classify     Tool-use    Self-directed
  loops     trees         pipelines     / summarize  + memory    multi-step
```

**The rule:** use the leftmost solution that solves your problem.

---

## The Decision Framework

Work through these questions in order. Stop when you have your answer.

---

### Question 1 — Is the logic fully rule-based?

**Yes:** Can you write the complete decision logic as if/else statements or a decision tree, with no edge cases that require judgment?

→ **Use a script or rule-based system.** Agents add cost and unpredictability you don't need.

**No:** The logic requires judgment, context, or handling of unpredictable inputs.

→ Continue to Question 2.

---

### Question 2 — Is the task purely about generating or transforming text?

**Yes:** The input is text/data, the output is text/data, and there are no external actions needed?

→ **Use a single LLM call.** No agent loop required. Just a well-crafted prompt.

**Examples:**
- "Summarize this document"
- "Classify this email as spam or not"
- "Extract all dates and names from this text"
- "Rewrite this in a professional tone"

**No:** The agent needs to take actions in the world (call APIs, write to databases, send messages, etc.)

→ Continue to Question 3.

---

### Question 3 — Is the sequence of actions fixed and predictable?

**Yes:** You can enumerate exactly which steps happen in what order, every time?

→ **Use a workflow automation** (n8n, Zapier, Make, Airflow). Add an LLM call as one step if needed. You don't need a full agent.

**Example:** "When a new order comes in → check inventory → if available, confirm → if not, notify customer." This is a workflow, not an agent.

**No:** The sequence of actions depends on intermediate results, requires judgment about what to do next, or handles many different cases.

→ Continue to Question 4.

---

### Question 4 — Does the task require persistent memory across sessions?

**No:** Each execution is independent.

→ **Use a stateless Tool-Use agent** (Archetype 3). Simpler, cheaper, easier to debug.

**Yes:** The agent's behavior should change based on history.

→ **Use a Memory agent** (Archetype 4). Design the memory layer explicitly.

---

### Question 5 — Does the task require coordinating multiple specialized capabilities?

**No:** One agent with the right tools can handle it.

→ Stay with a single agent. Keep it simple.

**Yes:** Different parts of the task need different prompts, different tools, different levels of access, or benefit from parallelism.

→ **Use an Orchestrator** (Archetype 6). Read `05_MULTI_AGENT/` before designing.

---

## Decision Matrix

Use this as a quick reference:

| Your Problem | Solution |
|---|---|
| Fixed if/else logic | Script |
| Complex rules, many conditions | Rule engine / Decision table |
| Fixed sequence of automated steps | Workflow automation (n8n, Zapier) |
| Generate, classify, or transform text | Single LLM call |
| Text task + needs external data or actions, single session | Tool-Use agent (Archetype 3) |
| Same as above + needs history across sessions | Memory agent (Archetype 4) |
| Complex multi-step reasoning required | Planning agent (Archetype 5) |
| Multiple specialized capabilities needed | Orchestrator (Archetype 6) |
| Long-running, self-directed, sets own goals | Autonomous agent (Archetype 7) — use carefully |

---

## When Agents Are Clearly the Right Choice

✅ **The input space is too large to enumerate.** You can't write rules for every possible customer message.

✅ **The task requires genuine judgment.** Not pattern matching — actual reasoning about trade-offs, context, and nuance.

✅ **The task is unpredictable by nature.** The right sequence of actions can't be determined in advance.

✅ **The problem benefits from explanation.** The agent can tell you *why* it made a decision. A rule-based system can't.

✅ **The problem requires natural language interfaces.** Users expect to interact in plain language, not forms.

---

## When Agents Are the Wrong Choice

❌ **The task is fully deterministic.** Regex, formulas, or scripts will do it faster and cheaper.

❌ **You need 100% predictability.** LLMs are probabilistic. If an error is unacceptable, don't rely on an LLM.

❌ **Cost is critical.** LLM calls cost money. A simple automation is free after setup.

❌ **Latency is critical.** Agents are slower than rule-based systems. If you need sub-100ms responses, agents are hard to justify.

❌ **You're solving a solved problem.** There are often better specialized tools (OCR software, translation APIs, search engines) than a general-purpose agent.

---

## The Hybrid Approach

Many real-world systems combine both:

```
[Workflow automation: handles the 90% of standard cases]
              │
              ▼
    [AI Agent: handles the 10% that require judgment]
```

This is often the optimal architecture. Don't feel like you have to choose. Start with the automation, identify where it breaks down, and add an agent only where it's needed.

---

## Cost of Each Approach

Understanding real costs helps make the right choice:

| Approach | Build cost | Run cost | Maintenance | Reliability |
|---|---|---|---|---|
| Script | Low | Near zero | Low | Very high |
| Workflow (n8n/Zapier) | Low | Low | Medium | High |
| Single LLM call | Low | Medium | Low | High |
| Tool-use agent | Medium | Medium-High | Medium | Medium-High |
| Memory agent | High | High | High | Medium |
| Orchestrator | Very High | Very High | Very High | Medium |

---

## A Practical Example

**Problem:** "Route incoming customer emails to the right department."

Let's apply the framework:

1. Is the logic fully rule-based?
   - Maybe — if we could enumerate all keywords for each department. But emails are unpredictable. Some cases will require judgment. → Continue.

2. Is the task purely text transformation?
   - Yes — read email, output department name. → **Use a single LLM call.**

**Solution:** A simple prompt: "Read this email. Which department should handle it: SALES, SUPPORT, BILLING, or OTHER? Reply with only one word."

No agent needed. No tools. No memory. Just a well-crafted prompt.

**Now the problem evolves:** "Route emails, but also reply with a confirmation and estimated response time based on current queue depth."

1. Is it rule-based? No — judgment needed.
2. Text only? No — needs to check queue depth (external system).
3. Fixed sequence? Mostly, but confirmation text needs LLM.

**Solution:** Workflow (route email → call LLM to classify → check queue API → call LLM to write confirmation → send reply). Still not an agent — a workflow with two LLM steps.

**Problem evolves again:** "Handle the entire email thread autonomously — answer questions, escalate complex issues, follow up if no response in 24h, and remember each customer's history."

Now we need a Memory agent. That's where agents earn their complexity.

---

## Summary

```
Before building an agent, ask:
  1. Can a script handle it?           → Use a script
  2. Can one LLM call handle it?       → Use an LLM call
  3. Can a workflow handle it?         → Use a workflow
  4. Is a stateless agent enough?      → Use a Tool-Use agent
  5. Is memory needed?                 → Use a Memory agent
  6. Is orchestration needed?          → Use an Orchestrator

If none of the above is sufficient, you need an Autonomous agent.
Proceed with caution and full Clayton Forge rigor.
```

---

*End of FOUNDATIONS. Proceed to `01_DESIGN/` to start designing your agent.*
