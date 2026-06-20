# KNOWLEDGE BASE — Agent Domain Knowledge

> **Clayton Forge Template v2.0**
> The knowledge base defines what the agent knows about its domain.
> It feeds the system prompt, the few-shot examples, and the RAG retrieval system.
> A generic LLM becomes a domain expert when given a well-structured knowledge base.

---

## Document Header

| Field | Value |
|---|---|
| **Agent Name** | |
| **Domain** | [e.g., e-commerce logistics, financial compliance, HR onboarding] |
| **Version** | v1.0 |
| **Last Updated** | YYYY-MM-DD |
| **Source of Truth** | [Where does this knowledge come from?] |

---

## Section 1 — Domain Overview

### 1.1 What World Does This Agent Operate In?

Describe the domain in 2–3 paragraphs. Write it as if explaining to a very smart person who has never worked in this field. This text may be used directly in the system prompt.

**[Write here]**

### 1.2 Domain Vocabulary

Every domain has its own language. Define it explicitly — the LLM may know general meanings but not domain-specific usage.

| Term | Definition in This Context | Common Misconception |
|---|---|---|
| [Term 1] | | |
| [Term 2] | | |
| [Acronym] | | |

### 1.3 Key Entities in This Domain

What are the main "objects" or "actors" the agent deals with?

| Entity | What It Is | Key Attributes | Valid States |
|---|---|---|---|
| | | | |

---

## Section 2 — Business Rules

> Business rules are the laws of your domain. The agent must follow them precisely.
> Be exhaustive — the LLM won't invent rules you forgot to write.

### 2.1 Absolute Rules (Never Violated)

These rules have no exceptions. If the agent ever violates them, something is seriously wrong.

- **RULE-001:** [State the rule clearly]
- **RULE-002:**
- **RULE-003:**

### 2.2 Standard Rules (Applied in Normal Conditions)

These apply in the default case. Edge cases may have exceptions (documented in 2.3).

| Rule ID | Rule | When It Applies |
|---|---|---|
| R-001 | | Always |
| R-002 | | When [condition] |
| R-003 | | Unless [exception] |

### 2.3 Exception Rules

Situations where the standard rules have different behavior.

| Situation | Standard Rule | Exception | Who Can Approve Exception |
|---|---|---|---|
| | R-00X | [Different behavior] | |

### 2.4 Decision Tables

For complex multi-condition decisions, use a table:

| Condition A | Condition B | Condition C | → Action |
|---|---|---|---|
| True | True | Any | → [Action 1] |
| True | False | True | → [Action 2] |
| False | Any | Any | → [Action 3] |

### 2.5 Escalation Rules

When should the agent stop and escalate to a human?

- Escalate when: [condition]
- Escalate when: [condition]
- Always escalate when: [high-stakes condition]
- Never escalate for: [common case that might seem uncertain but has a clear answer]

---

## Section 3 — Processes and Workflows

### 3.1 Main Process the Agent Supports

Describe how the underlying business process works — not the agent, but the real-world process the agent is automating or assisting.

```
[Process name]

Step 1: [Who does what]
Step 2: [Who does what]
Step 3: [Decision point — if X then Y, else Z]
Step 4: [Who does what]
...
End state: [What "done" looks like]
```

### 3.2 Status Lifecycles

If your domain has entities with states, document all transitions:

```
Entity: [Order / Ticket / Application / etc.]

States:
  [STATE_A] → can transition to: [STATE_B], [STATE_C]
  [STATE_B] → can transition to: [STATE_D]
  [STATE_C] → terminal state
  [STATE_D] → terminal state

Rules:
  - Cannot go from [STATE_B] back to [STATE_A]
  - [STATE_C] requires approval from [role]
  - Timeout: if in [STATE_A] for > [X hours], automatically move to [STATE_X]
```

---

## Section 4 — Reference Data

### 4.1 Classification Systems

| Code / ID | Name | Description | Rules |
|---|---|---|---|
| | | | |

### 4.2 Thresholds and Limits

| Parameter | Value | Unit | What Happens at Limit |
|---|---|---|---|
| | | | |

### 4.3 Time-Based Rules

| Rule | Applies When | Time Condition |
|---|---|---|
| | | |

---

## Section 5 — What the Agent Must NOT Do

Explicit prohibitions. Write these with the same care as the rules — the LLM needs to know what's forbidden.

- ❌ **NEVER:** [Forbidden action 1] — because [reason]
- ❌ **NEVER:** [Forbidden action 2]
- ❌ **NEVER:** Guess when uncertain — say "I don't have enough information to answer this"
- ❌ **NEVER:** [Domain-specific prohibition]

**When asked about topics outside scope:**
> "I'm specialized in [domain]. For [out-of-scope topic], please contact [who/where]."

---

## Section 6 — Few-Shot Examples

> Few-shot examples are the most powerful tool for calibrating agent behavior.
> Include at least 5 examples covering: happy path, edge cases, and failures.
> Every example should demonstrate a rule from Section 2.

---

### Example 1 — [Happy Path Case Name]

**Scenario:** [Brief description of the situation]

**Input:**
```
[Realistic input — message, data, or request]
```

**Expected Output:**
```
[Exactly what the agent should produce]
```

**Why this output?**
> Applies Rule R-00X: [quote the rule]. The [key element] in the input triggers [specific behavior].

---

### Example 2 — [Edge Case Name]

**Scenario:**

**Input:**
```
```

**Expected Output:**
```
```

**Why this output?**

---

### Example 3 — [Escalation Case Name]

**Scenario:** [Case that requires human escalation]

**Input:**
```
```

**Expected Output:**
```
[Agent correctly identifies it cannot handle this and escalates]
```

**Why this output?**
> Escalation rule: [quote rule from Section 2.5]

---

### Example 4 — [Ambiguous Case Name]

**Scenario:** [Case where the answer isn't clear-cut]

**Input:**
```
```

**Expected Output:**
```
[Agent asks for clarification or applies best judgment with explicit reasoning]
```

**Why this output?**

---

### Example 5 — [Negative Example — What NOT to Do]

**Scenario:**

**Input:**
```
```

**Incorrect Output (avoid this):**
```
[What a poorly calibrated agent might say]
```

**Correct Output:**
```
[What the agent should actually say]
```

**Why the first is wrong:**

---

## Section 7 — Common Questions and Answers

Frequently asked questions in this domain, with the correct answer. Used to calibrate the agent's responses.

**Q: [Common question]**
A: [Precise, correct answer]

**Q: [Common question with a nuanced answer]**
A: [Nuanced answer — include conditions]

**Q: [Question that seems answerable but isn't — the agent should escalate]**
A: [Why the agent should escalate rather than guess]

---

## Section 8 — Knowledge Gaps and Limitations

Be explicit about what the agent does NOT know and what it should do when it encounters these gaps.

| Gap | What Agent Does |
|---|---|
| [Topic outside domain] | Redirect: "Please contact [who]" |
| [Outdated information risk] | Acknowledge: "This may have changed — please verify with [source]" |
| [Requires human judgment] | Escalate: "This requires human review" |

---

## Section 9 — Maintenance

### When to Update This Document

- [ ] A business rule changes
- [ ] A new entity or state is added to the domain
- [ ] The agent consistently makes a type of mistake → add to few-shot examples
- [ ] A new common question is identified → add to Section 7
- [ ] Reference data changes (thresholds, codes, etc.)

### Update Process

1. Identify what changed
2. Update the relevant section
3. Add or update a few-shot example if the change affects agent behavior
4. Update the system prompt in SPEC (section 3.2) if needed
5. Test on at least 10 real cases
6. Update changelog below

### Changelog

| Date | Section | What Changed | Who Updated |
|---|---|---|---|
| | | | |
