# PRD — Product Requirements Document

> **Clayton Forge Template v2.0**
> Fill one of these per agent. Complete this before writing any code.
> Fields marked `[REQUIRED]` block progress. Fields marked `[OPTIONAL]` are judgment calls.

---

## Document Header

| Field | Value |
|---|---|
| **Agent Name** | [REQUIRED] |
| **Version** | v0.1 — Draft |
| **Status** | `Draft` / `In Review` / `Approved` / `Deprecated` |
| **Author** | [REQUIRED] |
| **Created** | YYYY-MM-DD |
| **Last Updated** | YYYY-MM-DD |
| **Agent Type** | See `00_FOUNDATIONS/02_agent_taxonomy.md` |
| **Trust Level** | 0 / 1 / 2 / 3 — See `02_PROTOCOLS/trust_model.md` |
| **Replaces** | [OPTIONAL] Prior system or process this agent replaces |

---

## Section 1 — The Problem

> *Start here. If you can't describe the problem clearly, you're not ready to build a solution.*

### 1.1 Problem Statement

Write one paragraph that:
- Describes the current situation
- Names who is affected and how often
- Quantifies the cost (time, money, errors, frustration)

**[Write here]**

> **Good example:** "The logistics team manually reviews 200+ delivery photos per day to verify driver compliance with packaging standards. This takes 3 hours of a coordinator's time daily, has a 12% error rate due to fatigue, and delays compliance reports by 24–48 hours."

> **Bad example:** "We need an AI to help with delivery photos." ← No problem stated.

### 1.2 Root Cause

Why does this problem exist? What has prevented it from being solved before?

**[Write here]**

### 1.3 Evidence

What data, observations, or feedback confirms this is a real problem worth solving?

- Evidence 1: [metric, observation, or user quote]
- Evidence 2:
- Evidence 3:

### 1.4 Impact of NOT Solving It

If this agent is never built, what continues to happen?

**[Write here]**

---

## Section 2 — The Solution

### 2.1 Proposed Solution

One paragraph describing what the agent does, in terms anyone can understand.

**[Write here]**

> **Good example:** "An agent that automatically receives delivery photos via WhatsApp, analyzes them against a defined checklist using computer vision and AI, assigns a compliance score, and notifies the responsible team if the score falls below threshold — in under 30 seconds."

### 2.2 What the Agent Does NOT Do

Explicit non-goals are as important as goals. List what is out of scope.

- ❌ Does not replace the human coordinator for disputed cases
- ❌ Does not handle photos sent outside the defined window
- ❌ Does not process videos, only photos
- ❌ [Add your own]

### 2.3 Agent Identity

| Question | Answer |
|---|---|
| What is this agent's *role*? | (e.g., "Compliance auditor for delivery photos") |
| What is its *trigger*? | Webhook / Schedule / Manual / Event |
| Does it act *autonomously*? | Yes / No / With approval |
| Who does it report to? | (system, team, or human) |
| What tone should it have? | (if it communicates with humans) |

---

## Section 3 — Use Cases

### 3.1 Primary Use Case (Happy Path)

Describe the most common, ideal-conditions scenario:

```
Actor:         [who or what initiates the interaction]
Pre-condition: [what must already be true]
Trigger:       [what starts the agent's execution]

Flow:
  1. [Step 1]
  2. [Step 2]
  3. [Step 3]
  ...

Post-condition: [state of the world after success]
Output:         [what is produced]
```

### 3.2 Secondary Use Cases

**Use Case 2 — [Name]**
```
Trigger:
Flow:
Output:
```

**Use Case 3 — [Name]**
```
Trigger:
Flow:
Output:
```

### 3.3 Edge Cases and Failure Scenarios

*Every edge case that isn't handled becomes a production incident.*

| Scenario | Expected Agent Behavior | Severity |
|---|---|---|
| Input is empty or malformed | Return validation error, don't process | High |
| Primary API is down | Retry 3x, then queue and alert | High |
| LLM returns unstructured output | Retry with corrective prompt once | Medium |
| Input exceeds context limit | Split or reject with clear message | Medium |
| Duplicate input (already processed) | Detect and skip, return cached result | Low |
| Input in unexpected language | Process and note, or route to human | Medium |
| Confidence below threshold | Return result with low-confidence flag | Medium |
| [Specific to your domain] | | |

---

## Section 4 — Requirements

### 4.1 Functional Requirements

**MUST (blocking — agent doesn't ship without these):**
- [ ] FR01: 
- [ ] FR02: 
- [ ] FR03: 

**SHOULD (important but not blocking):**
- [ ] FR04: 
- [ ] FR05: 

**COULD (nice to have — future versions):**
- [ ] FR06: 
- [ ] FR07: 

### 4.2 Non-Functional Requirements

| Requirement | Specification | Rationale |
|---|---|---|
| **Latency** | P95 < ___ seconds | [Why this matters] |
| **Availability** | ___% uptime | |
| **Accuracy** | ≥ ___% on test set | |
| **Max cost per execution** | $___  / R$___ | |
| **Max daily cost** | $___  / R$___ | |
| **Language** | | |
| **Privacy** | [PII handling policy] | |
| **Audit log retention** | ___ days | |
| **Concurrent executions** | Up to ___ | |

### 4.3 Constraints

Things that are fixed and cannot change:

- Constraint 1: [e.g., "Must use existing Supabase instance"]
- Constraint 2: [e.g., "Cannot store images — only metadata"]
- Constraint 3: [e.g., "Must complete within 30s due to webhook timeout"]

---

## Section 5 — Users and Stakeholders

### 5.1 Who Interacts with the Agent

| Role | Interaction Type | Frequency | Priority |
|---|---|---|---|
| | Sends input / Reviews output / Receives notifications | | High / Medium / Low |

### 5.2 Who Is Affected by the Agent's Output

| Stakeholder | How they're affected | Their concern |
|---|---|---|
| | | |

### 5.3 Who Owns This Agent

| Role | Person | Responsibility |
|---|---|---|
| Product owner | | Defines what the agent does |
| Technical owner | | Maintains the implementation |
| Escalation contact | | Called when it breaks |

---

## Section 6 — Integrations and Dependencies

| System | Direction | What For | Criticality | Fallback |
|---|---|---|---|---|
| | Input / Output / Both | | High / Med / Low | [behavior if unavailable] |

---

## Section 7 — Success Metrics

### 7.1 How We Know It's Working

| Metric | Current Baseline | Target | Measurement Method |
|---|---|---|---|
| | | | |

### 7.2 Acceptance Criteria

The agent is considered successfully built when:

- [ ] All MUST requirements (FR01–FR0X) pass in staging
- [ ] Edge cases in Section 3.3 have defined and tested behavior
- [ ] P95 latency ≤ ___ seconds (tested under load)
- [ ] Accuracy ≥ ___% on the defined test set (min 50 cases)
- [ ] Cost per execution ≤ $___ (measured over 100 executions)
- [ ] Observability: structured logs, metrics, and alerts configured
- [ ] Runbook written and reviewed

---

## Section 8 — Risks

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| LLM produces incorrect output | Medium | High | Output validation + confidence scoring |
| Dependency API unavailable | Low | Medium | Retry + fallback + alert |
| Unexpected cost spike | Low | Medium | Per-execution cost limit + daily budget alert |
| Prompt drift degrades quality over time | Medium | Medium | Monthly prompt regression testing |
| [Domain-specific risk] | | | |

---

## Section 9 — Phased Delivery

| Phase | Scope | Success Criteria | ETA |
|---|---|---|---|
| **MVP** | [minimum viable version] | [measurable] | |
| **v1.0** | [full feature set] | | |
| **v1.x** | [enhancements] | | |

---

## Section 10 — Open Questions

*Questions that must be answered before or during development.*

| # | Question | Owner | Due | Answer |
|---|---|---|---|---|
| Q01 | | | | |
| Q02 | | | | |

---

## Section 11 — Document History

| Version | Date | Author | Changes |
|---|---|---|---|
| 0.1 | | | Initial draft |

---

*With this PRD complete, proceed to `SPEC_template.md`.*
