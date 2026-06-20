# MEMORY — Project Memory Document

> **Clayton Forge Template v2.0**
> This is the institutional memory of your agent project. It answers "what do we know?" across sessions.
> Update after every meaningful decision. Read at the start of every session.

---

## Project Identity

| Field | Value |
|---|---|
| **Agent Name** | |
| **Version** | |
| **Phase** | Discovery / Design / Build / Test / Production |
| **Last Updated** | YYYY-MM-DD HH:MM |
| **Sessions Completed** | |

---

## Part A — Decisions (Never Re-Debate These)

> Once a decision is recorded here, it's settled. If circumstances change and it needs revisiting, create a new entry — don't delete the old one.

| # | Decision | Context | Date | Alternatives Rejected |
|---|---|---|---|---|
| D01 | | | | |
| D02 | | | | |
| D03 | | | | |

---

## Part B — Technical Knowledge

### B1. Stack and Configuration

**Stack confirmed:**
- Runtime:
- LLM:
- Database:
- [Other layers]:

**Key credentials and endpoints** (reference only — actual values in .env):
```
LLM_API_KEY        → [service where key is stored]
DATABASE_URL       → [service where config is stored]
[OTHER_KEY]        → [location]
```

**Environment-specific configuration:**
```
Development: [key differences]
Staging:     [key differences]
Production:  [key differences]
```

### B2. Known Behaviors and Quirks

Things that surprised you and will surprise you again if not documented:

- ⚠️ **[Quirk 1]:** [Description and how to handle it]
- ⚠️ **[Quirk 2]:** [Description]
- 💡 **[Discovery 1]:** [Something useful learned]
- 💡 **[Discovery 2]:** [Something useful learned]

### B3. Established Patterns

Conventions adopted in this project that everyone should follow:

- **Naming:** [e.g., "all database tables use snake_case"]
- **Error handling:** [e.g., "always log before returning error, never swallow exceptions"]
- **Prompt versioning:** [e.g., "prompts live in /prompts/[agent]/v[X].txt"]
- **[Other pattern]:**

### B4. Things That Don't Work (and Why)

Approaches tried and rejected — so you don't try them again:

| Approach | Why It Failed | Date Tried |
|---|---|---|
| | | |

---

## Part C — Domain Knowledge Learned

Facts about the domain or business that were discovered during development (not in the original Knowledge Base):

- [Fact 1 discovered during testing]
- [Edge case discovered in production]
- [Business rule clarification from stakeholder]

---

## Part D — External Contacts and Resources

People and resources relevant to this project:

| Contact/Resource | Role | How to Reach | Notes |
|---|---|---|---|
| | Technical owner | | |
| | Business stakeholder | | |
| | [API vendor] support | | |

**Key documentation links:**
- LLM API docs: [URL]
- [External system] docs: [URL]
- Internal wiki: [URL]

---

## Part E — Session Log

Brief log of what happened in each session. Used to understand project evolution.

### Session N — YYYY-MM-DD
**Duration:** ___ hours
**Done:** [2-3 bullet points]
**Decided:** [Key decisions made]
**Learned:** [Key things discovered]

### Session N-1 — YYYY-MM-DD
**Duration:** ___ hours
**Done:**
**Decided:**
**Learned:**

---

## Part F — Open Questions

Questions that haven't been answered yet. Each should have an owner and a due date.

| # | Question | Owner | Due | Answer |
|---|---|---|---|---|
| Q01 | | | | [Pending] |
| Q02 | | | | [Pending] |
