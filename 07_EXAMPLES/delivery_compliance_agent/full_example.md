# Complete Example — AI-Powered Delivery Compliance Agent

> This example walks through the complete Clayton Forge process for a real-world agent.
> Every section links to the template it came from.

---

## What We're Building

An agent that:
1. Receives delivery photos from drivers via WhatsApp
2. Analyzes them against a compliance checklist using AI
3. Scores each delivery on 0–100 scale
4. Notifies the responsible coordinator if score < 70
5. Logs all results to a database for reporting

This maps to **Archetype 3 (Tool-Use Agent)** with elements of **Archetype 4 (Memory)** for driver history.

---

## Foundation Decisions

**From `00_FOUNDATIONS/04_agent_vs_automation.md`:**

Is a script enough? No — photos can't be evaluated with if/else.
Is a single LLM call enough? No — needs to receive photos via webhook and trigger notifications.
Is a workflow enough? No — needs vision AI + dynamic routing logic.
Is a stateless agent enough? No — needs driver history to detect patterns.

**→ Tool-Use Agent with Memory is the right archetype.**

---

## PRD

**Agent Name:** Delivery Compliance Auditor
**Type:** Tool-Use + Memory
**Trust Level:** 1 (can log to database and send internal notifications; cannot modify driver records)

**Problem Statement:**
The logistics coordinator manually reviews 150–200 delivery photos per day to verify compliance with B&G's packaging and safety standards. This takes 3 hours daily, generates a 10–15% error rate due to reviewer fatigue, and delays compliance reports by 24–48 hours. Drivers with repeat violations are not identified systematically.

**Root Cause:**
Photo review requires visual judgment. No automated tool exists internally. Manual volume has grown 40% in 6 months as the driver fleet expanded.

**Evidence:**
- Coordinator reports: 3h/day on photo review (logged time-tracking data)
- Error rate: ~12% of violations missed, caught in next supervisor audit
- Report delay: currently 48h; target is same-day

**What the agent does:**
Automatically receives photos via WhatsApp webhook, analyzes each photo against the defined checklist, assigns a compliance score, notifies the coordinator if score < 70, and logs all results.

**What the agent does NOT do:**
- Does not take disciplinary action against drivers
- Does not handle non-delivery photos (wrong file type → rejected)
- Does not operate outside 06:00–22:00 (photos outside window → queued)
- Does not override human coordinator decisions on disputed cases

**Primary Use Case:**
```
Actor:      Driver (via WhatsApp)
Trigger:    Photo received at Z-API webhook
Pre-cond:   Driver is registered in the system

Flow:
  1. Webhook receives photo + driver WhatsApp number
  2. Agent identifies driver from phone number
  3. Agent retrieves driver's compliance checklist
  4. Agent analyzes photo against checklist items
  5. Agent calculates compliance score
  6. Agent logs result to database
  7. If score < 70: notify coordinator with photo + score + specific violations
  8. Agent sends confirmation to driver ("Photo received ✓")

Output: Compliance score, list of violations, database record
```

**Edge Cases:**

| Scenario | Behavior |
|---|---|
| Unregistered driver | Reject with message: "Number not registered. Contact logistics." |
| Photo too dark/blurry to analyze | Score = null, flag for manual review, notify coordinator |
| Non-photo file (document, video) | Reject: "Please send a photo only." |
| Multiple photos at once | Process each independently |
| Photo sent outside 06:00–22:00 | Acknowledge receipt, queue for analysis at 06:00 |
| Driver sends same photo twice within 5 min | Detect duplicate, return cached result |

**Success Metrics:**

| Metric | Baseline | Target |
|---|---|---|
| Coordinator time on photo review | 3h/day | < 15min/day |
| Missed violations | ~12% | < 2% |
| Report delay | 48h | Same day |
| Photo processing time | Manual | < 45 seconds |

---

## Cognitive Architecture

**Perception:** WhatsApp webhook → validate → extract (driver_number, photo_url, timestamp)

**Memory:**
- Short-term cache: current session, duplicate detection (5-min window)
- Long-term DB: driver profiles, compliance history, checklist definitions
- No vector store needed (structured data only)

**Planning:** ReAct pattern
```
Thought: Got photo from driver +55119xxxx. Need to identify driver and checklist.
Action: lookup_driver(phone="+55119xxxx")
Observation: Driver = João Silva, ID=D042, active, checklist=standard_v3

Thought: Have checklist. Need to analyze photo.
Action: analyze_photo(url="...", checklist="standard_v3")
Observation: {score: 62, violations: ["box_unsealed", "no_protective_wrap"]}

Thought: Score 62 < 70. Need to notify coordinator and log.
Action: log_result(driver_id="D042", score=62, violations=[...])
Action: notify_coordinator(driver="João Silva", score=62, violations=[...], photo="...")
Action: send_driver_confirmation(phone="+55119xxxx", score=62)

Done.
```

**Execution:** Four tools (lookup_driver, analyze_photo, log_result, notify_coordinator + send_driver_confirmation)

**Reflection:** After analyze_photo, validate: is score between 0–100? Is violations list non-null? If not → retry once with corrective prompt.

---

## Trust Model

**Trust Level:** 1 — Limited Actor

**Permissions:**
```yaml
read:
  - drivers table (lookup by phone)
  - checklists table
  - compliance_history (last 30 days, for context)

write:
  - compliance_records (insert new record)

execute:
  - send WhatsApp message to driver (confirmation only)
  - send Slack notification to coordinator channel

forbidden:
  - drivers table (UPDATE or DELETE)
  - payment data
  - direct email to driver
  - modify compliance_records after creation
```

---

## System Prompt

```
You are the Delivery Compliance Auditor for B&G Móveis. Your role is to analyze delivery photos and evaluate driver compliance with packaging and safety standards.

IDENTITY:
- You are precise, objective, and consistent
- You evaluate photos based only on the defined checklist
- You do not make assumptions — if you cannot see something clearly, say so

CHECKLIST (standard_v3):
1. PACKAGING: Box must be sealed on all visible sides
2. PROTECTION: Fragile items must show protective wrapping
3. LABEL: Shipping label must be visible and unobstructed
4. CONDITION: Box must show no visible damage
5. STACKING: If multiple boxes, proper stacking required

SCORING:
- Each item is PASS (20 pts) or FAIL (0 pts) or NOT_VISIBLE (10 pts)
- Maximum score: 100
- Score < 70 triggers coordinator notification

RESPONSE FORMAT (JSON only, no prose):
{
  "score": <0-100>,
  "items": {
    "packaging": "PASS" | "FAIL" | "NOT_VISIBLE",
    "protection": "PASS" | "FAIL" | "NOT_VISIBLE",
    "label": "PASS" | "FAIL" | "NOT_VISIBLE",
    "condition": "PASS" | "FAIL" | "NOT_VISIBLE",
    "stacking": "PASS" | "FAIL" | "NOT_VISIBLE" | "NOT_APPLICABLE"
  },
  "violations": ["list of failed items"],
  "notes": "brief observation if something unusual",
  "confidence": <0.0-1.0>
}

RULES:
- If photo quality is too poor to evaluate, set score to null and explain in notes
- Never guess — NOT_VISIBLE is always valid if you cannot see clearly
- confidence reflects how certain you are of your evaluation
```

---

## Implementation Notes

**Stack chosen:** n8n (orchestration) + Claude claude-sonnet-4-6 Vision + Supabase + Z-API

**Why n8n:** Non-developer maintainability. The logistics team can modify notification routing without code.

**Why Claude Vision:** Best-in-class performance on structured visual evaluation tasks.

**Key technical decisions:**

| Decision | Choice | Reason |
|---|---|---|
| Photo storage | Don't store — analyze URL directly | Privacy, storage cost |
| Duplicate detection | Hash of (driver_id + photo_url + 5min window) | Simple and reliable |
| Score recalculation on retry | Recalculate, don't use first attempt | First attempt may have been low confidence |
| Driver confirmation timing | Immediately after receipt, before analysis | UX — driver knows we got it |

---

## Cost Model

| Item | Estimate |
|---|---|
| Input tokens per call | ~800 (system prompt + checklist + context) |
| Vision tokens | ~500 (per image, variable) |
| Output tokens | ~200 |
| Cost per call (Claude Sonnet) | ~$0.005 |
| Expected volume | 200 calls/day |
| **Daily cost** | **~$1.00/day = ~$30/month** |

Hard limit: $0.05 per execution, $5/day (safety ceiling at 5x expected)

---

## Issues (Prioritized)

| ID | Title | Status | Priority |
|---|---|---|---|
| ISS-001 | Set up n8n workflow skeleton with webhook | ✅ Done | P0 |
| ISS-002 | Implement driver lookup from WhatsApp number | ✅ Done | P0 |
| ISS-003 | Integrate Claude Vision with photo URL | ✅ Done | P0 |
| ISS-004 | Implement output validation and retry | 🔄 In Progress | P0 |
| ISS-005 | Implement Supabase logging | 📋 Backlog | P0 |
| ISS-006 | Implement Slack coordinator notification | 📋 Backlog | P1 |
| ISS-007 | Implement Z-API driver confirmation | 📋 Backlog | P1 |
| ISS-008 | Duplicate detection | 📋 Backlog | P1 |
| ISS-009 | Outside-hours queueing | 📋 Backlog | P2 |
| ISS-010 | Driver compliance history in context | 📋 Backlog | P2 |

---

## Handoff — Current Session State

```
STATUS: BUILD PHASE — Core working, integrations pending

LAST THING DONE:
Claude Vision integration tested — returning valid JSON scores on 15 test photos.
Accuracy: 13/15 correct (86.7%). Two failures on very dark photos → handled by confidence threshold.

NEXT THING TO DO:
ISS-004: Implement output validation.
If confidence < 0.6 OR score is null → flag for manual review + notify coordinator.
Start in n8n node after Claude Vision response.

BLOCKERS:
- Diego needs to confirm coordinator Slack channel name (asked June 20)
- Z-API credentials need to be added to n8n environment

TECHNICAL CONTEXT:
Claude Vision call format: POST to /messages with image_url in content array.
Current prompt version: v1.2 (in /prompts/compliance_auditor/v1.2.txt)
n8n workflow: "Compliance_Auditor_v1" in b&g workspace
Supabase table: compliance_records (created, schema in ISS-005 description)

LEARNINGS:
⚠️ Z-API returns 200 even on failure — check response.sent field, not HTTP status
💡 Claude Vision needs explicit instruction to output ONLY JSON or it adds prose
💡 Photos over 5MB need to be passed as base64, not URL (Z-API limitation)
```

---

*This example demonstrates how all Clayton Forge documents work together on a real project.*
*Every section maps directly to a template. The process is the product.*
