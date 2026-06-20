# Prompt Fundamentals — Writing Prompts That Work

> `08_PROMPT_ENGINEERING / 01`
> The system prompt is the most important piece of code in your agent. It deserves the same rigor as any other critical system component.

---

## What a Prompt Actually Is

A system prompt is a behavioral specification. It tells the LLM:
- Who it is (identity and role)
- What it knows (domain knowledge)
- How it should behave (rules and constraints)
- What it should produce (output format)

A bad prompt produces inconsistent, unpredictable agents. A good prompt produces reliable, trustworthy agents that behave the same way on the 10,000th call as on the first.

The difference is not the LLM — it's the prompt.

---

## The Anatomy of a Well-Structured Prompt

Every effective agent system prompt has five sections. Not all agents need all five, but you should consciously decide what to include.

```
┌─────────────────────────────────────────────────────────────┐
│                  SYSTEM PROMPT STRUCTURE                    │
│                                                             │
│  [1] IDENTITY                                               │
│      Who are you? What is your purpose?                     │
│                                                             │
│  [2] CONTEXT & KNOWLEDGE                                    │
│      What do you know? What domain are you an expert in?    │
│                                                             │
│  [3] BEHAVIOR RULES                                         │
│      What must you always do? What must you never do?       │
│      How do you handle ambiguity?                           │
│                                                             │
│  [4] OUTPUT FORMAT                                          │
│      Exactly how should responses be structured?            │
│                                                             │
│  [5] EXAMPLES (few-shot)                                    │
│      Input → output demonstrations                          │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

### Section 1 — Identity

Set the role clearly and concisely. The identity anchors all subsequent behavior.

```
✅ Good:
"You are the Delivery Compliance Auditor for B&G Móveis.
Your role is to analyze delivery photos and score driver compliance
with packaging and safety standards."

❌ Bad:
"You are a helpful AI assistant that can help with many things
including analyzing photos and answering questions."

Why bad: Generic identity produces generic behavior.
Why good: Specific identity constrains behavior to what matters.
```

### Section 2 — Context and Knowledge

What the agent must know that isn't in the LLM's general training:

```
Include:
  ✓ Domain-specific terminology
  ✓ Company-specific rules and policies
  ✓ Reference data (classifications, thresholds, codes)
  ✓ Known edge cases and how to handle them
  ✓ What to do when uncertain

Do NOT include:
  ✗ General knowledge the LLM already has
  ✗ Information that changes frequently (use tools to fetch instead)
  ✗ Information not relevant to the agent's tasks
```

### Section 3 — Behavior Rules

The most important section. Rules shape everything.

```
Structure rules in order of priority:

ABSOLUTE RULES (never violated):
  "Never share one customer's data with another customer."
  "Never promise a delivery date you cannot confirm."

STANDARD RULES (apply in normal conditions):
  "When a customer provides an order ID, query get_order_status first."
  "Always include the tracking URL when order is IN_TRANSIT."

EXCEPTION RULES (override standards in specific conditions):
  "If order shows DELIVERED but customer says not received:
   acknowledge the discrepancy and offer escalation."

UNCERTAINTY RULES (what to do when unsure):
  "If confidence is below 0.75, ask for clarification rather than guessing."
  "If the question is outside your scope, redirect to [contact]."
```

### Section 4 — Output Format

Specify format precisely. Ambiguity here produces inconsistent outputs.

```
For structured outputs (JSON):
"Respond ONLY with a valid JSON object. No prose, no markdown, no explanation.
Format:
{
  'status': 'success' | 'needs_review' | 'error',
  'score': integer 0-100,
  'violations': array of strings,
  'confidence': float 0.0-1.0
}"

For natural language outputs:
"Respond in 1-3 short paragraphs. Maximum 150 words. Friendly but professional tone.
Start with the answer, then add context. Don't start with 'I'."

For mixed outputs:
"Respond with:
1. A one-sentence summary (plain text)
2. A JSON block with structured data
3. A human-readable next step (plain text)"
```

### Section 5 — Few-Shot Examples

The single most powerful tool for calibrating behavior. Show, don't just tell.

```
Format:
---EXAMPLE---
Input: [realistic input]
Output: [exact expected output]
Why: [brief explanation — helps the LLM generalize the pattern]

---EXAMPLE---
Input: [different scenario]
Output: [expected output]

---EXAMPLE (negative)---
Input: [tricky input]
Wrong output: [what a poorly calibrated agent would say]
Correct output: [what your agent should say]
Why the wrong output fails: [explanation]
```

**Include examples for:**
- The most common scenario (happy path)
- The most important edge case
- The most dangerous mistake (negative example)
- Any scenario where the expected output is not obvious

---

## The Precision Principle

Every word in a system prompt costs tokens. But more importantly: every ambiguous word costs quality.

```
VAGUE: "Be helpful and professional."
PRECISE: "Use a direct, warm tone. Answer the specific question asked.
          If you cannot help, say so in one sentence and provide the alternative."

VAGUE: "Handle edge cases appropriately."
PRECISE: "If the input doesn't contain an order ID: ask 'Could you share your order number?
          It looks like ORD-XXXXX in your confirmation email.'"

VAGUE: "Escalate when needed."
PRECISE: "Escalate to human review when:
          - Customer explicitly asks to speak with a person
          - Confidence score is below 0.70
          - The issue involves a potential refund above $500"
```

The test: could a smart person read your prompt and implement the exact same behavior as a human expert in this role? If not, it's not precise enough.

---

## Common Prompt Failures

### Failure 1 — The Generic Assistant

```
"You are a helpful AI assistant. Help users with their questions."
→ Produces inconsistent behavior. No role, no constraints, no format.
```

### Failure 2 — The Rule Contradiction

```
"Always respond in under 100 words."
[later in same prompt]
"Always provide a complete explanation with all relevant details and context."
→ LLM has to choose which rule to follow. It will choose inconsistently.
Fix: prioritize rules explicitly, or eliminate the contradiction.
```

### Failure 3 — The Hallucination Invitation

```
"Answer all questions about our products."
→ LLM doesn't know your products. It will make things up.
Fix: "Answer questions about products only using the context provided.
     If the information isn't in the context, say: 'I don't have that information.
     Please check our website at [URL] or contact [support].'"
```

### Failure 4 — The Missing Negative

```
"Classify tickets as: BILLING, LOGISTICS, TECHNICAL, or GENERAL."
→ What if it's spam? What if it's empty? What if it's in another language?
Fix: "If the message is spam or incomprehensible: classify as GENERAL with tag 'spam'.
     If it's in another language: process as normal, add tag 'non-english'."
```

### Failure 5 — The Instruction Drift

```
[200-line system prompt]
→ LLM attention weakens on instructions far from the current position.
   Rules at the bottom of a very long prompt are less reliably followed.
Fix: Put critical rules near the top. Keep prompts as short as they can be
     while remaining precise. Move static knowledge to RAG.
```

---

## Prompt Length vs. Quality

More instructions ≠ better behavior. There is a sweet spot.

```
Too short: Undefined behavior, inconsistent outputs
Sweet spot: Every rule is explicit. No wasted words.
Too long: Instruction overload. LLM starts ignoring later rules.

Practical guidelines:
  Simple reactive agent: 200–500 tokens
  Tool-use agent: 400–800 tokens
  Complex orchestrator: 600–1,200 tokens
  Knowledge-heavy agent: 800–2,000 tokens (consider RAG to offload)
```

---

## Prompt Iteration Process

Writing a good prompt is an empirical process, not an intuitive one.

```
STEP 1 — Draft
Write the first version. Don't overthink it.

STEP 2 — Test on 10 cases
Run 10 real or realistic inputs.
Record: what worked, what didn't, what was unexpected.

STEP 3 — Identify failure patterns
Group failures by type:
  - Wrong output format?     → Fix Section 4
  - Wrong behavior?          → Fix Section 3 or add example
  - Missing domain knowledge? → Fix Section 2
  - Hallucination?           → Add constraint + RAG

STEP 4 — Revise and re-test
Make targeted changes. Test again.
If accuracy doesn't improve: the problem may be elsewhere (model, tools, data).

STEP 5 — Regression test before shipping
Run full golden test set.
New version must be equal or better than old version.
```

---

*Next: `02_prompt_patterns.md` — Reusable patterns for common agent behaviors*
