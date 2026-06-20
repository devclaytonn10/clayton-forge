# Cognitive Architecture — The Internal Layers of an Agent

> `00_FOUNDATIONS / 03`
> The internal structure that every well-designed agent shares, regardless of implementation.

---

## What is Cognitive Architecture?

Cognitive architecture is the internal organization of an agent — the distinct layers responsible for different aspects of its behavior.

Think of it like the architecture of a building: you can build a house without a blueprint, but it will have structural problems that are hard to fix later. Cognitive architecture is the blueprint for your agent's mind.

Every production-grade AI agent — regardless of framework, language, or LLM — benefits from having these layers explicitly designed.

---

## The Five Layers

```
┌─────────────────────────────────────────────────────────────────────┐
│                    COGNITIVE ARCHITECTURE                           │
│                                                                     │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │  LAYER 5: PERCEPTION                                         │   │
│  │  How the agent receives and interprets input from the world  │   │
│  └─────────────────────────────────────────────────────────────┘   │
│                              ↓                                      │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │  LAYER 4: MEMORY                                             │   │
│  │  What the agent stores, retrieves, and forgets               │   │
│  └─────────────────────────────────────────────────────────────┘   │
│                              ↓                                      │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │  LAYER 3: PLANNING                                           │   │
│  │  How the agent decides what to do                            │   │
│  └─────────────────────────────────────────────────────────────┘   │
│                              ↓                                      │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │  LAYER 2: EXECUTION                                          │   │
│  │  How the agent carries out its decisions                     │   │
│  └─────────────────────────────────────────────────────────────┘   │
│                              ↓                                      │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │  LAYER 1: REFLECTION                                         │   │
│  │  How the agent evaluates its own outputs and improves        │   │
│  └─────────────────────────────────────────────────────────────┘   │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

Not every agent needs all five layers. Simple agents may only need layers 3 and 4. Complex agents use all five. Clayton Forge helps you decide which layers you need and how to design each one.

---

## Layer 5 — Perception

**What it does:** Receives input from the world and converts it into a form the agent can reason about.

**Inputs can be:**
- Text (messages, documents, code)
- Structured data (JSON, database rows, API responses)
- Images, audio, video (multimodal)
- Events (webhooks, system alerts, schedule triggers)
- Sensor data

**What good perception design includes:**

```
Raw Input
    │
    ▼
[Input Validation]         ← Is this input valid? Expected format?
    │
    ▼
[Input Parsing]            ← Extract structured meaning from raw input
    │
    ▼
[Intent Detection]         ← What is the user/system trying to accomplish?
    │
    ▼
[Entity Extraction]        ← What are the key objects/values mentioned?
    │
    ▼
Structured Perception      ← Ready for the next layer
```

**Common mistakes:**
- Passing raw, unvalidated input directly to the LLM
- Not handling edge cases (empty input, wrong format, malicious content)
- Treating all input types the same (a message and a webhook event need different parsing)

**Design question for your agent:**
> What are all the ways input can arrive, and what does "valid input" look like for each?

---

## Layer 4 — Memory

**What it does:** Stores and retrieves information that the agent needs across the reasoning cycle.

Memory is the most underdesigned layer in most agents. Without explicit memory design, agents are stateless — they forget everything between calls. This is fine for simple use cases and catastrophic for complex ones.

**The four memory types:**

```
┌─────────────────────────────────────────────────────────────────┐
│                        MEMORY TYPES                             │
├────────────────┬────────────────────────────────────────────────┤
│ WORKING        │ The current context window.                    │
│ MEMORY         │ Everything the LLM can "see" right now.        │
│                │ Capacity: limited (varies by model).           │
│                │ Duration: one call.                            │
├────────────────┼────────────────────────────────────────────────┤
│ EPISODIC       │ Records of specific past events.               │
│ MEMORY         │ "On Jan 5, user complained about delivery."    │
│                │ Capacity: unlimited (stored externally).       │
│                │ Duration: configurable.                        │
├────────────────┼────────────────────────────────────────────────┤
│ SEMANTIC       │ General knowledge and facts about the world.   │
│ MEMORY         │ "This user prefers short answers."             │
│                │ Capacity: unlimited.                           │
│                │ Duration: permanent until explicitly changed.  │
├────────────────┼────────────────────────────────────────────────┤
│ PROCEDURAL     │ How-to knowledge. Skills.                      │
│ MEMORY         │ "When checking order status, always verify     │
│                │  payment first."                               │
│                │ Capacity: unlimited.                           │
│                │ Duration: permanent.                           │
└────────────────┴────────────────────────────────────────────────┘
```

**Design question for your agent:**
> Which memory types does this agent need? What does it need to remember, for how long, and why?

Full memory design in `03_MEMORY_SYSTEM/`.

---

## Layer 3 — Planning

**What it does:** Decides what to do, in what order, and with what resources.

This is the core reasoning layer — the layer that makes an agent an agent rather than a lookup table.

**Planning strategies:**

### Direct Response (no explicit planning)
```
Input → [LLM reasons implicitly] → Output
```
*Use for: simple Q&A, classification, extraction*

### Chain of Thought
```
Input → "Let me think step by step..." → [reasoning] → Output
```
*Use for: problems that benefit from explicit reasoning steps*

### ReAct (Reason + Act)
```
Input →
  Thought: what do I know? what do I need?
  Action: call tool X
  Observation: result Y
  Thought: now what?
  Action: call tool Z
  Observation: result W
  Answer: [final output]
```
*Use for: tool-use agents that need to gather information before answering*

### Plan-and-Execute
```
Input →
  [Phase 1: Plan]  "I will: 1) do A, 2) do B, 3) do C"
  [Phase 2: Execute] Execute A → Execute B → Execute C
  [Phase 3: Synthesize] Combine results → Output
```
*Use for: complex multi-step tasks where the full plan can be determined upfront*

### Tree of Thoughts
```
Input →
  [Generate multiple candidate approaches]
  [Evaluate each approach]
  [Select the most promising]
  [Execute selected approach]
  [Backtrack if needed]
```
*Use for: creative or complex problems where the best path isn't obvious*

**Design question for your agent:**
> Which planning strategy fits your agent's tasks? Document it explicitly — it determines your prompt structure.

---

## Layer 2 — Execution

**What it does:** Carries out the decisions made in the planning layer.

**Execution includes:**

```
Decision (from Planning layer)
    │
    ▼
[Action Selection]         ← Which tool/action/response to execute?
    │
    ▼
[Parameter Preparation]    ← Format parameters correctly for each action
    │
    ▼
[Execution]                ← Actually call the tool / write the message / etc.
    │
    ▼
[Result Observation]       ← What happened? Success? Error? Partial?
    │
    ▼
[Error Handling]           ← Retry? Fallback? Escalate?
    │
    ▼
Result (back to Planning)
```

**The Tool Interface Contract**

Every tool your agent can use should have:
- A clear description (what it does, when to use it)
- Defined input schema (what parameters, which are required)
- Defined output schema (what format is returned on success)
- Defined error schema (what happens when it fails)
- A timeout and retry policy

This is formalized in `02_PROTOCOLS/agent_interface_contract.md`.

**Design question for your agent:**
> What are all the actions this agent can take? For each action, what can go wrong, and what should happen when it does?

---

## Layer 1 — Reflection

**What it does:** Evaluates the agent's own outputs and improves them before delivering.

This is the most powerful and least used layer. Agents with reflection catch their own mistakes before you do.

**Reflection patterns:**

### Self-Critique
```
[Agent produces output]
         │
         ▼
[Agent reviews its own output]
"Is this correct? Is anything missing? Is the format right?"
         │
         ▼
[Agent revises if needed]
         │
         ▼
[Final output]
```

### Critic-Actor
```
[Actor agent produces output]
         │
         ▼
[Critic agent reviews it]
"Rate this output 1-10. What's wrong? How to improve?"
         │
         ▼
[Actor revises based on critique]
         │
         ▼
[Repeat until quality threshold or max iterations]
```

### Constitutional AI (simplified)
```
[Agent produces output]
         │
         ▼
[Agent checks output against rules]
"Does this violate rule 1? Rule 2? Rule N?"
         │
         ▼
[Agent revises to comply with rules]
```

**When to invest in reflection:**
- When output quality is critical
- When errors are costly
- When the task is complex and self-review adds real value

**When to skip it:**
- Simple, low-stakes tasks
- When latency is critical (reflection adds at least one extra LLM call)
- When you have strong output validation downstream anyway

**Design question for your agent:**
> Does this agent need to check its own work? What are the consequences of an unchecked error?

---

## Assembling the Architecture

When designing your agent, go through each layer and answer:

| Layer | Question | Answer |
|---|---|---|
| **Perception** | What inputs does it receive? How are they validated and parsed? | |
| **Memory** | What does it need to remember? Which memory types? | |
| **Planning** | Which planning strategy? How does it decide what to do? | |
| **Execution** | What actions can it take? What happens when they fail? | |
| **Reflection** | Does it check its own work? How? | |

Document your answers in `01_DESIGN/ARCHITECTURE_template.md`.

---

## The Cognitive Architecture Summary

```
PERCEPTION   →  What the agent knows about right now
MEMORY       →  What the agent carries from the past
PLANNING     →  What the agent decides to do
EXECUTION    →  What the agent actually does
REFLECTION   →  Whether the agent's output is good enough
```

Every failure in a production agent traces back to one of these five layers being under-designed.

---

*Next: `04_agent_vs_automation.md` — When you don't actually need an agent*
