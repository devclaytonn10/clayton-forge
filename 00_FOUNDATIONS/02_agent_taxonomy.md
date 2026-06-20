# Agent Taxonomy — The Complete Map of Agent Types

> `00_FOUNDATIONS / 02`
> Use this to identify exactly what kind of agent you're building before designing anything.

---

## Why Taxonomy Matters

Calling something "an AI agent" is like calling something "a vehicle." A bicycle, a truck, and a spaceship are all vehicles — but they require completely different design approaches.

Choosing the wrong agent type is one of the most common and expensive mistakes in AI projects. You end up over-engineering simple problems or under-engineering complex ones.

This document gives you a precise language to identify what you're building.

---

## The Two Classification Axes

Every agent can be placed on two axes:

```
                        COMPLEXITY OF REASONING
                    Simple ◄──────────────────► Complex
                        │                           │
HIGH    ┌───────────────┼───────────────────────────┤
        │               │                           │
A       │  REACTIVE     │    DELIBERATIVE            │
U       │  AGENT        │    AGENT                  │
T       │               │                           │
O       ├───────────────┼───────────────────────────┤
N       │               │                           │
O       │  REFLEX       │    LEARNING               │
M       │  AGENT        │    AGENT                  │
Y       │               │                           │
LOW     └───────────────┴───────────────────────────┘
```

Most LLM-based agents today live in the top half. The bottom half is more relevant to classical AI and robotics.

---

## The Seven Agent Archetypes

### Archetype 1 — Reflex Agent

**The simplest possible agent. Responds to input with a fixed rule.**

```
Input ──→ [Rule: IF X THEN Y] ──→ Output
```

**Characteristics:**
- No memory
- No planning
- Deterministic
- Very fast and cheap

**When to use:**
- When the problem has a small, well-defined input/output space
- When cost and speed are critical
- When predictability matters more than flexibility

**LLM equivalent:** A simple prompt with strict output format. No tools. No history.

**Example:** "Classify this support ticket as URGENT / NORMAL / LOW. Reply with only one word."

**Template to use:** PRD + SPEC only. No memory system needed.

---

### Archetype 2 — Reactive Agent

**Responds to input with reasoning, but no persistent memory.**

```
Input ──→ [LLM Reasoning] ──→ Output
              ↑
         [Context injected
          per call]
```

**Characteristics:**
- Reasons about the input
- Context can be injected (but doesn't persist)
- Each call is independent
- Stateless between calls

**When to use:**
- Classification, summarization, extraction tasks
- When each request is self-contained
- When you need reasoning but not continuity

**Example:** "Analyze this customer message and identify the sentiment, topic, and suggested response."

**Template to use:** PRD + SPEC + KNOWLEDGE BASE

---

### Archetype 3 — Tool-Use Agent (ReAct Pattern)

**Reasons about when and how to use external tools to complete a task.**

```
Input ──→ [LLM: what do I need?]
               │
        ┌──────┴──────┐
        ▼             ▼
   [Call Tool A]  [Call Tool B]
        │             │
        └──────┬───────┘
               ▼
         [LLM: synthesize results]
               │
               ▼
            Output
```

**Characteristics:**
- Decides which tools to use (and when)
- Can chain tool calls
- Still stateless unless memory is added
- More powerful, more expensive, slower

**The ReAct pattern (Reason + Act):**
```
Thought: I need to check the order status
Action: call_order_api(order_id="12345")
Observation: Order is delayed by 2 days
Thought: I should notify the customer
Action: send_message(customer_id="abc", message="...")
Observation: Message sent successfully
Answer: Customer has been notified about the delay.
```

**When to use:**
- When the agent needs real-world data to answer
- When the agent needs to take actions in external systems
- When the answer requires multiple steps

**Example:** An agent that checks inventory, calculates shipping cost, and sends an order confirmation.

**Template to use:** PRD + SPEC + ARCHITECTURE + KNOWLEDGE BASE + PROTOCOLS

---

### Archetype 4 — Memory Agent

**Maintains context across multiple interactions or sessions.**

```
              ┌─────────────────────────────┐
              │         MEMORY STORE         │
              │  Short-term │  Long-term     │
              └──────┬──────┴────────┬───────┘
                     │               │
Input ──→ [Retrieve relevant memories]
               │
          [LLM + context]
               │
          [Update memory]
               │
            Output
```

**Memory types:**
- **Episodic:** what happened ("User complained about shipping on Jan 5")
- **Semantic:** what is known ("This user prefers email over WhatsApp")
- **Procedural:** how to do things ("When user asks X, always check Y first")

**When to use:**
- Customer service agents that need user history
- Personal assistants
- Any agent where context across sessions changes the answer

**Example:** A sales agent that remembers a customer's past purchases, preferences, and complaints.

**Template to use:** All DESIGN templates + full MEMORY SYSTEM chapter

---

### Archetype 5 — Planning Agent

**Breaks a complex goal into a sequence of sub-tasks and executes them.**

```
Goal ──→ [LLM: decompose into steps]
              │
    ┌─────────┴──────────┐
    ▼         ▼           ▼
[Step 1]  [Step 2]   [Step 3]
    │         │           │
    └─────────┴───────────┘
              │
        [Consolidate]
              │
           Output
```

**Planning strategies:**
- **Chain of Thought:** reason step by step before acting
- **Tree of Thoughts:** explore multiple reasoning paths, pick the best
- **ReWOO:** plan all steps upfront, then execute (more efficient)
- **Plan-and-Execute:** plan first, re-plan if a step fails

**When to use:**
- Research tasks that require multiple steps
- Complex analysis that can be decomposed
- When the path to the goal isn't known in advance

**Example:** "Research our top 5 competitors, summarize their pricing models, and identify our gaps."

**Template to use:** All DESIGN templates + PROTOCOLS/orchestration_patterns

---

### Archetype 6 — Orchestrator Agent

**A meta-agent that delegates tasks to specialized sub-agents.**

```
                ┌─────────────────────┐
Input ──→       │    ORCHESTRATOR     │
                │   (decides who      │
                │    does what)       │
                └──────────┬──────────┘
                           │
           ┌───────────────┼───────────────┐
           ▼               ▼               ▼
    [Agent: Research] [Agent: Write] [Agent: Review]
           │               │               │
           └───────────────┴───────────────┘
                           │
                        Output
```

**Orchestration patterns:**
- **Sequential:** A finishes, then B starts
- **Parallel:** A, B, C run simultaneously, results merged
- **Conditional:** B only runs if A returns condition X
- **Iterative:** loop until quality threshold met
- **Hierarchical:** orchestrators orchestrating orchestrators

**When to use:**
- When a problem requires multiple specialized capabilities
- When tasks can be parallelized for speed
- When you want to compose existing agents into a pipeline

**Example:** A content pipeline with agents for research, writing, fact-checking, SEO optimization, and formatting.

**Template to use:** All DESIGN + PROTOCOLS + MULTI_AGENT chapter

---

### Archetype 7 — Autonomous Agent

**Sets its own sub-goals, self-corrects, and operates for extended periods without human input.**

```
High-level Goal
      │
      ▼
[Generate sub-goals]
      │
┌─────▼────────────────────────────────┐
│  EXECUTION LOOP                      │
│                                      │
│  Plan ──→ Act ──→ Observe ──→ Adapt  │
│    ↑                          │      │
│    └──────────────────────────┘      │
│                                      │
│  Runs until: goal achieved OR        │
│              stuck OR timeout        │
└──────────────────────────────────────┘
      │
      ▼
   Output
```

**Warning:** This is the most powerful and most dangerous archetype. Production failures are harder to predict and contain.

**Current state of the art:** Projects like AutoGPT, BabyAGI, and Devin operate here. They work in controlled environments. Real-world reliability is still a major challenge.

**When to use:** Only when you have:
- Strong observability and logging
- Human-on-the-loop monitoring
- Clear termination conditions
- Sandboxed action space
- Extensive testing history

**Example:** A code agent that autonomously diagnoses a bug, writes a fix, runs tests, and creates a PR.

**Template to use:** All chapters of Clayton Forge.

---

## Quick Selection Guide

Answer these questions to find your archetype:

```
Does the agent need to take actions (write, send, call APIs)?
├── No  →  Archetype 1 (Reflex) or 2 (Reactive)
│          → Go to: Is reasoning required?
│             ├── No  →  Archetype 1
│             └── Yes →  Archetype 2
│
└── Yes →  Does it need to remember things across sessions?
           ├── No  →  Archetype 3 (Tool-Use)
           └── Yes →  Archetype 4 (Memory)
                      → Also: Does it need to plan multi-step?
                        ├── No  →  Archetype 4
                        └── Yes →  Archetype 5 (Planning)
                                   → Also: Does it delegate to other agents?
                                     ├── No  →  Archetype 5
                                     └── Yes →  Archetype 6 (Orchestrator)
                                                → Does it set its own goals?
                                                  ├── No  →  Archetype 6
                                                  └── Yes →  Archetype 7 (Autonomous)
```

---

## Complexity vs. Reliability Trade-off

```
RELIABILITY
     │
100% │  ●  Reflex
     │     ●  Reactive
  90 │        ●  Tool-Use
     │           ●  Memory
  80 │              ●  Planning
     │                 ●  Orchestrator
  60 │                    ●  Autonomous
     │
     └────────────────────────────────────
                                  CAPABILITY
```

This is not a reason to always build simple agents. It's a reason to build the simplest agent that solves your problem — and to design the more complex ones with proportionally more rigor.

---

## Combining Archetypes

Real-world agents often combine multiple archetypes:

| Combination | Example |
|---|---|
| Reactive + Memory | Customer service bot with user history |
| Tool-Use + Planning | Research agent that plans and then calls APIs |
| Orchestrator + Memory | Pipeline that remembers results across runs |
| Planning + Autonomous | Long-running code agent that self-corrects |

When combining archetypes, document which archetype governs each behavior. Ambiguity in design becomes unpredictability in production.

---

*Next: `03_cognitive_architecture.md` — The internal layers of an agent*
