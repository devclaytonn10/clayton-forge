# Example: Simple Agent — Support Ticket Classifier

> **Archetype 1/2 — Reflex / Reactive Agent**
> Stack: Any LLM API + any language. No tools, no memory, no orchestration.
> This is the simplest complete agent. Start here if you're new to Clayton Forge.

---

## Why This Example

The support ticket classifier is the "Hello World" of AI agents. It's simple enough to understand completely, but realistic enough to teach real lessons.

**The problem:** A company receives 500 support emails per day. Someone has to read each one and route it to the right team. It takes 2 minutes per email = 17 hours of work per day.

**The solution:** An agent that reads each email, classifies it, and routes it — in under 2 seconds.

---

## Foundation Analysis

From `00_FOUNDATIONS/04_agent_vs_automation.md`:

```
Is it rule-based?
  → No. "Billing" emails don't always contain the word "billing."
    "My card was charged twice for an order I never received"
    is both billing AND logistics. Judgment required.

Is it text-only (no external actions)?
  → The classification is text-only.
    Routing requires an action (assigning in the ticketing system).
    → Tool-use needed for routing.

But wait — what's the MVP?
  → Start with classification only (no routing tool).
    Verify quality first. Add the action (routing) after.

→ Archetype 2 (Reactive) for MVP. Upgrade to Archetype 3 (Tool-Use) in v1.1.
```

---

## PRD (Filled)

**Agent:** Support Ticket Classifier — MVP
**Type:** Reactive (Archetype 2)
**Trust Level:** 0 (read-only — classifies, does not route yet)

**Problem:** 500 tickets/day, 2 min each, 17h/day of manual classification work. Error rate: 8% wrong routing (from quarterly audit).

**Solution:** Agent reads each ticket, outputs a classification: team + urgency + tags.

**What it does:** Receives ticket text → returns `{team, urgency, tags[], summary}`

**What it doesn't do:** Does not route (v1.1). Does not respond to customer. Does not modify any system.

**Use case:**
```
Trigger: New ticket arrives in system
Input: {ticket_id, subject, body, customer_tier}
Output: {team, urgency, tags[], summary, confidence}
Time: < 3 seconds
```

**Edge cases:**
- Ticket in another language → classify as-is, add tag `requires_translation`
- Ticket is empty or spam → classify as `SPAM`, confidence 0.99
- Ticket touches multiple teams → classify by primary issue, add secondary as tag
- Customer tier is missing → treat as standard tier

**Success metrics:**
- Classification accuracy ≥ 93% (measured on labeled test set)
- P95 latency < 3 seconds
- Cost < $0.005 per ticket

---

## System Prompt (Final v1.0)

```
You are a support ticket classifier for Acme Corp. Your job is to read support tickets and classify them accurately.

TEAMS:
- BILLING: payments, charges, invoices, refunds, subscription changes
- LOGISTICS: delivery, shipping, tracking, damaged goods, returns
- TECHNICAL: product defects, app issues, account access, bugs
- SALES: pricing questions, upgrades, new orders, partnerships
- GENERAL: anything that doesn't fit the above

URGENCY LEVELS:
- CRITICAL: Customer cannot use the product at all, or financial loss is occurring right now
- HIGH: Significant problem, customer is frustrated or blocked
- MEDIUM: Issue exists but customer can work around it
- LOW: Question, feedback, or minor inconvenience

ESCALATION SIGNALS (automatically set CRITICAL or HIGH):
- Words: "urgent", "emergency", "immediately", "losing money", "cannot work"
- Duplicate charges or overcharges
- Complete service outage
- Customer tier: ENTERPRISE or VIP → minimum HIGH urgency

OUTPUT FORMAT — respond with JSON only, no other text:
{
  "team": "BILLING | LOGISTICS | TECHNICAL | SALES | GENERAL",
  "urgency": "CRITICAL | HIGH | MEDIUM | LOW",
  "tags": ["array", "of", "relevant", "tags"],
  "summary": "One sentence describing the core issue",
  "confidence": 0.0-1.0,
  "escalate_reason": "string or null — why CRITICAL/HIGH was assigned"
}

RULES:
- If confidence < 0.75, add tag "needs_human_review"
- For SPAM or test tickets: team="GENERAL", urgency="LOW", tags=["spam"]
- Never guess when uncertain — use "needs_human_review" tag
- summary must be ≤ 20 words
```

**LLM Parameters:**
- Temperature: 0.1 (consistent, deterministic classification)
- Max tokens: 200 (output is small JSON)

---

## Data Flow

```
1. INPUT
   Ticketing system sends webhook:
   {
     "ticket_id": "TKT-12345",
     "subject": "Charged twice!!",
     "body": "I was charged twice this month and I need this fixed TODAY",
     "customer_tier": "STANDARD"
   }

2. BUILD PROMPT
   System: [system prompt above]
   User: "Ticket #TKT-12345\nSubject: Charged twice!!\n\nI was charged twice this month and I need this fixed TODAY\n\nCustomer tier: STANDARD"

3. CALL LLM
   POST /v1/messages
   {model, temperature: 0.1, max_tokens: 200, messages}

4. PARSE AND VALIDATE RESPONSE
   Raw: '{"team":"BILLING","urgency":"HIGH","tags":["duplicate_charge"],"summary":"Customer charged twice, requesting immediate resolution","confidence":0.98,"escalate_reason":"Duplicate charge reported"}'
   
   Validate:
   ✓ Valid JSON
   ✓ team in allowed values
   ✓ urgency in allowed values
   ✓ confidence between 0 and 1
   ✓ summary ≤ 20 words (check: 9 words ✓)

5. LOG
   {
     "execution_id": "exec_abc123",
     "ticket_id": "TKT-12345",
     "result": {...},
     "tokens_used": 847,
     "duration_ms": 1240,
     "cost_usd": 0.0021
   }

6. RETURN
   {
     "status": "success",
     "ticket_id": "TKT-12345",
     "classification": {
       "team": "BILLING",
       "urgency": "HIGH",
       "tags": ["duplicate_charge"],
       "summary": "Customer charged twice, requesting immediate resolution",
       "confidence": 0.98
     },
     "execution_id": "exec_abc123"
   }
```

---

## Error Handling

| Error | Response |
|---|---|
| LLM timeout (> 10s) | Retry once. If fails again: return `{status: "error", error_code: "LLM_TIMEOUT", retryable: true}` |
| Invalid JSON from LLM | Retry with prompt: "Your response must be valid JSON only. Try again." — once. |
| Missing required fields | Return error — do not guess missing fields |
| Input too long (> 4000 chars) | Truncate body to 3000 chars, add tag `input_truncated` |

---

## Test Cases

| # | Input | Expected Classification | Validates |
|---|---|---|---|
| T01 | "When will my order arrive? Tracking says delayed" | LOGISTICS, MEDIUM | Happy path |
| T02 | "URGENT: My account is locked and I'm losing sales" | TECHNICAL, CRITICAL | Escalation signals |
| T03 | "Can I upgrade to the Pro plan?" | SALES, LOW | Sales routing |
| T04 | "asdfjkl qwerty" | GENERAL, LOW, tag:spam | Spam handling |
| T05 | "Mi paquete no llegó" (Spanish) | LOGISTICS, MEDIUM, tag:requires_translation | Language edge case |
| T06 | "My invoice is wrong AND my app keeps crashing" | Primary issue determines team, secondary as tag | Multi-team |
| T07 | "" (empty) | GENERAL, LOW, tag:spam | Empty input |
| T08 | [VIP customer] "Minor question about billing" | BILLING, HIGH (VIP escalation) | Tier escalation |

**Accuracy target:** 8/8 on test set before any production traffic.

---

## What's NOT in This Example (by design)

This MVP deliberately omits:
- ❌ Database storage (add in v1.1 if you need history)
- ❌ Routing action (add in v1.1 when accuracy is verified)
- ❌ Customer response (different agent entirely)
- ❌ Memory of past tickets (not needed for classification)

**Lesson:** Start with the minimum that proves value. Add complexity only after you've validated the core.

---

## Upgrade Path

**v1.1 — Add Routing Action (Archetype 3: Tool-Use)**
```
Add tool: assign_ticket(ticket_id, team, urgency)
Logic: After classification, call tool to update ticketing system
Requires: Trust Level 1 (can write to ticketing system)
Test first: Shadow mode — classify AND route, but verify routing is correct
```

**v1.2 — Add Memory (Archetype 4: Memory)**
```
Add: Customer history lookup before classification
Why: "This customer has complained about billing 3 times this month" → changes urgency
Storage: Customer ID → {ticket_history, tier, sentiment_trend}
```

**v2.0 — Multi-agent (with Quality Reviewer)**
```
Add: Second agent that reviews low-confidence classifications (< 0.80)
Pattern: Iterative Refinement
When: When error rate in production is not meeting target
```
