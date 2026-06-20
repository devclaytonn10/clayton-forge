# Agent Theory — What an AI Agent Really Is

> `00_FOUNDATIONS / 01`
> Read this before anything else. Every decision in Clayton Forge is built on these ideas.

---

## The One-Sentence Definition

An AI agent is a system that **perceives** its environment, **reasons** about what to do, and **acts** to change that environment — repeatedly, over time, toward a goal.

That's it. Everything else is implementation detail.

---

## Why the Definition Matters

Most people think of agents as "a chatbot that can use tools." That's not wrong, but it's incomplete — and the gaps in that mental model cause most of the failures in real-world agent projects.

The correct mental model is this:

```
┌───────────────────────────────────────────────────────────────┐
│                                                               │
│   Environment ──→ [PERCEIVE] ──→ [REASON] ──→ [ACT] ──→ Environment
│        ↑                                              │       │
│        └──────────────────────────────────────────────┘       │
│                                                               │
│   The agent changes the environment. The environment changes  │
│   what the agent perceives. The loop repeats.                 │
│                                                               │
└───────────────────────────────────────────────────────────────┘
```

This loop — perceive, reason, act — is called the **agent cycle**. Everything you design in Clayton Forge is designed around it.

---

## The Four Fundamental Properties

Every AI agent has exactly four properties. How you design each one determines everything else.

### Property 1 — Autonomy

How much does the agent decide for itself?

```
FULL HUMAN CONTROL ◄──────────────────────────────► FULL AUTONOMY
        │                                                    │
   "approve every              "tell me when              "just do it"
    action first"               it's done"
        │                          │                         │
   Human-in-the-loop          Human-on-the-loop         Human-out-of-loop
```

**The mistake:** building with full autonomy before you understand your agent's failure modes.

**The rule:** start at human-in-the-loop. Move right only when the agent has earned your trust through evidence.

---

### Property 2 — Reactivity vs. Proactivity

```
REACTIVE                                              PROACTIVE
    │                                                     │
Responds only to                              Acts without being asked,
external triggers.                            based on goals and state.
    │                                                     │
"Answer when asked."                          "Check for problems every
                                               hour and alert if found."
```

Most agents should start reactive. Proactivity requires much more robust failure handling — a proactive agent that fails silently is worse than no agent.

---

### Property 3 — Memory Horizon

```
NO MEMORY                                          PERSISTENT MEMORY
    │                                                     │
Each call is                                  Agent remembers across
completely fresh.                             sessions, users, events.
    │                                                     │
Stateless.                                        Stateful.
Predictable.                              Powerful but complex.
Cheap.                                         More expensive.
```

The right choice depends on your use case. See `03_MEMORY_SYSTEM/` for a full treatment.

---

### Property 4 — Action Space

What is the agent allowed to do?

```
READ-ONLY                                           READ-WRITE
    │                                                     │
Can only observe,                           Can create, modify, delete,
summarize, classify.                        send, call, execute.
    │                                                     │
Low risk.                                          High risk.
Easy to verify.                         Requires careful trust model.
```

**The mistake:** giving agents write access before you've verified their reasoning on read-only tasks.

**The rule:** expand the action space incrementally. Verify at each step.

---

## The Agent Cycle in Detail

The perceive-reason-act loop has more nuance than it appears:

```
┌─────────────────────────────────────────────────────────────────────┐
│                        FULL AGENT CYCLE                             │
│                                                                     │
│  1. PERCEIVE                                                        │
│     ├── Receive input (message, event, schedule, sensor)            │
│     ├── Parse and validate the input                                │
│     └── Extract relevant entities and intent                        │
│                                                                     │
│  2. CONTEXTUALIZE                                                    │
│     ├── Retrieve relevant memories                                  │
│     ├── Fetch relevant tools/knowledge                              │
│     └── Assemble full context for reasoning                         │
│                                                                     │
│  3. REASON                                                          │
│     ├── Understand the goal                                         │
│     ├── Generate candidate actions                                  │
│     ├── Evaluate trade-offs                                         │
│     └── Select action(s)                                            │
│                                                                     │
│  4. ACT                                                             │
│     ├── Execute the selected action(s)                              │
│     ├── Observe the result                                          │
│     └── Detect success or failure                                   │
│                                                                     │
│  5. LEARN / UPDATE                                                  │
│     ├── Update memory with new information                          │
│     ├── Update state                                                │
│     └── Decide: loop again or terminate?                            │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

Steps 2 and 5 are where most amateur implementations fail. They build perceive → reason → act and forget that **context** and **learning** are what make an agent actually useful over time.

---

## What Makes an Agent Different from a Script

This is one of the most important distinctions in AI engineering:

| | Script / Automation | AI Agent |
|---|---|---|
| **Decision logic** | Hardcoded if/else | Emergent from reasoning |
| **Handles unexpected input** | No — breaks or ignores | Yes — reasons about it |
| **Improves over time** | No | Yes (with memory) |
| **Explains its decisions** | No | Can be asked to |
| **Adapts to context** | No | Yes |
| **Fails unpredictably** | Rarely | More often |
| **Cost per execution** | Low | Higher |
| **Auditability** | High | Medium |

**The key insight:** use a script when the problem is well-defined and bounded. Use an agent when the problem requires judgment.

See `00_FOUNDATIONS/04_agent_vs_automation.md` for a decision framework.

---

## The Reliability Paradox

Here is something that surprises many people new to AI agents:

> **More capable agents fail in more interesting ways.**

A simple rule-based system fails predictably — you can enumerate its failure modes. An LLM-powered agent can fail in ways you never anticipated, because its reasoning is emergent.

This is not a reason to avoid agents. It's a reason to:

1. **Design failure handling before you design the happy path**
2. **Log everything** — you need to understand what happened
3. **Start with human oversight** — earn autonomy gradually
4. **Test edge cases aggressively** — not just the happy path

Clayton Forge builds this mindset into every template and process.

---

## The Three Honest Limitations of LLM-Based Agents

LLMs are extraordinarily capable. They are also fundamentally limited in ways that affect agent design:

### Limitation 1 — No persistent state
The LLM itself remembers nothing between calls. Every call starts fresh. Memory must be designed and injected explicitly. This is why `03_MEMORY_SYSTEM/` is its own chapter.

### Limitation 2 — Probabilistic, not deterministic
The same input can produce different outputs. This is a feature (flexibility) and a bug (unpredictability). Design for it: validate outputs, use low temperature for structured tasks, test edge cases.

### Limitation 3 — Knowledge cutoff
The LLM's knowledge has a cutoff date. For anything time-sensitive, provide the information via tools or context. Don't rely on the model knowing current events, prices, or system states.

---

## Summary

| Concept | The Key Idea |
|---|---|
| **Agent cycle** | Perceive → Contextualize → Reason → Act → Update. All five steps. |
| **Autonomy** | Start human-in-the-loop. Earn autonomy through verified reliability. |
| **Action space** | Expand incrementally. Read-only before read-write. |
| **Memory** | Must be designed explicitly. It doesn't happen by default. |
| **Failure** | More capable = more interesting failures. Design for it from day one. |

---

*Next: `02_agent_taxonomy.md` — The complete map of agent types*
