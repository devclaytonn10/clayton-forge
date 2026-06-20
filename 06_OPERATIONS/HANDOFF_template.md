# HANDOFF — Session Continuity Document

> **Clayton Forge Template v2.0**
>
> WRITE THIS AT THE END OF EVERY SESSION.
> READ THIS AT THE START OF THE NEXT SESSION.
>
> Rule: If the next session has to ask "where were we?", this document failed.

---

## Session Identity

| Field | Value |
|---|---|
| **Agent** | |
| **Session Number** | Session ___ |
| **Date** | YYYY-MM-DD |
| **Start Time** | HH:MM |
| **End Time** | HH:MM |
| **Duration** | ___ hours |

---

## 🔴 Critical State Block

*The first thing anyone reads. Must be completable in 60 seconds.*

```
═══════════════════════════════════════════════════════════
AGENT:          [name]
PHASE:          Discovery / Design / Build / Test / Production
STATUS:         STABLE / IN PROGRESS / BLOCKED / BROKEN

LAST ACTION:
[One sentence — the very last thing done in this session]

NEXT ACTION:
[One sentence — the very first thing to do in the next session]

BLOCKERS:
[List or NONE]
═══════════════════════════════════════════════════════════
```

---

## What Was Done This Session

### Issues Worked

| Issue | Title | Result | Notes |
|---|---|---|---|
| ISS-XXX | | ✅ Done / 🔄 50% / 🚫 Blocked | |
| ISS-XXX | | | |

### Narrative Summary

[2–5 bullet points describing the session in plain language]

- 
- 
- 

### Problems Encountered and Resolutions

| Problem | Root Cause | Resolution | Resolved? |
|---|---|---|---|
| | | | Yes / No / Partial |

---

## Decisions Made This Session

| Decision | Options Considered | Choice | Reason |
|---|---|---|---|
| | | | |

*(Update MEMORY_template.md Part A with these decisions)*

---

## Current System State

| Component | Status | Version/Branch | Notes |
|---|---|---|---|
| Setup / Infrastructure | ✅ / 🔄 / ❌ | | |
| System prompt | ✅ / 🔄 / ❌ | v___ | |
| Core agent loop | ✅ / 🔄 / ❌ | | |
| [Tool A] integration | ✅ / 🔄 / ❌ | | |
| [Tool B] integration | ✅ / 🔄 / ❌ | | |
| Database schema | ✅ / 🔄 / ❌ | | |
| Observability | ✅ / 🔄 / ❌ | | |
| Tests | ✅ / 🔄 / ❌ | | |

---

## Next Session Plan

### Start Here (in order)

**1st:** [Exact action — specific enough that you don't have to think about what to do]
- Context: [Why this is first / what to know before starting]
- File/location: [Where the relevant code or doc is]
- Reference: ISS-XXX

**2nd:** [Exact action]
- Context:
- Reference:

**3rd:** [Exact action]
- Context:
- Reference:

### Issues Ready to Work

| Issue | Priority | Est. Hours | Start Here |
|---|---|---|---|
| ISS-XXX | P0 | | [specific starting point within the issue] |
| ISS-XXX | P1 | | |

### Blockers to Resolve

| Blocker | Who Can Unblock | Action Needed |
|---|---|---|
| | | |

---

## Technical Context for Next Session

*Code, config, or data the next session will need immediately.*

### Current Code State

```[language]
// Paste relevant in-progress code or the exact point where you stopped
// Include file path as a comment

// File: src/agent/core.js
// Status: completed up to line 87, needs error handling from line 88
```

### Active Configuration

```env
# Values currently in use (reference — actual values in .env)
RELEVANT_SETTING=value
```

### Data State

```json
// Current database schema or payload structure being worked on
{
  "table": "compliance_records",
  "status": "created, needs index on driver_id"
}
```

### Active Endpoints

| Name | URL | Status |
|---|---|---|
| | | Working / Broken / Untested |

---

## Learnings This Session

*Things future-you must not learn twice.*

- 💡 [Something discovered that will save time later]
- ⚠️ [A gotcha — something that looks one way but works another]
- 📝 [Something to add to the Knowledge Base or MEMORY]

---

## For AI-Assisted Sessions

*If using Claude, ChatGPT, or another AI to help build — paste this at the start of the next conversation:*

```
CONTEXT FOR THIS SESSION:

I'm building: [agent name] — [one sentence description]
Framework: Clayton Forge

Current state:
  Phase: [phase]
  What works: [list]
  What doesn't: [list]

Last session I: [last action]
This session I need to: [next action]

Blockers: [list or NONE]

Relevant files to know about:
  - [file]: [what it is]
  - [file]: [what it is]

Key decisions already made (don't re-debate):
  - [decision 1]
  - [decision 2]

Known quirks of this project:
  - [quirk 1]
  - [quirk 2]
```

---

## Session Metrics

| Metric | Value |
|---|---|
| Issues completed | ___/__ planned |
| Issues in progress | |
| New issues discovered | |
| Estimated % complete | |
| Cost spent this session (LLM + APIs) | $___ |

---

## Handoff History

| Session | Date | Last Action | Next Action | % Done |
|---|---|---|---|---|
| 1 | | | | |
| 2 | | | | |
| ___ | | | | |
