# Example: Memory Agent — Customer Service Assistant

> **Archetype 4 — Memory Agent**
> Maintains persistent memory of customer history across sessions.
> This example demonstrates when and how to design memory intentionally.

---

## Why Memory Changes Everything

Compare two interactions with a support agent:

**Without memory:**
```
Customer: "This is the third time my delivery was late!"
Agent:    "I'm sorry to hear about the delay. Can you share your order number?"

→ Agent has no idea this is the third time. Cannot prioritize appropriately.
   Customer feels ignored. Resolution is generic.
```

**With memory:**
```
Customer: "This is the third time my delivery was late!"
Agent:    "I can see this is the third late delivery in 6 months — I'm escalating
           this directly to our logistics supervisor and applying a priority flag
           to your next order. Here's your case ID: CS-789."

→ Agent knows the history. Response is specific and appropriate.
   Customer feels heard. Trust is maintained.
```

Memory turns a reactive chatbot into an intelligent assistant.

---

## The Memory Design Decision

Before writing any code, answer these:

| Question | Answer for This Agent |
|---|---|
| What needs to be remembered? | Customer contact history, preferences, past issues, resolutions |
| For how long? | Interactions: 90 days. Preferences: permanent. |
| How is it retrieved? | By customer ID (exact lookup) + semantic search for relevant past issues |
| Who can access it? | Only the agent for this customer's session |
| When is it updated? | After each interaction, agent writes a summary |
| What if memory is wrong? | Customer can correct. Agent flags for human review. |

---

## Memory Architecture (for this agent)

```
┌──────────────────────────────────────────────────────────────────┐
│                  CUSTOMER SERVICE AGENT MEMORY                   │
│                                                                  │
│  Working Memory (context window):                                │
│    - Current message                                             │
│    - Last 5 interactions (recency)                              │
│    - Top 3 semantically relevant past interactions               │
│    - Customer profile (permanent facts)                          │
│    Total: ~2,000 tokens injected per call                       │
│                                                                  │
│  Short-term Cache (Redis, TTL 4h):                              │
│    - Current session state                                       │
│    - In-progress ticket details                                  │
│                                                                  │
│  Long-term Database (Supabase, permanent):                       │
│    - Customer profile and preferences                            │
│    - Full interaction history (90-day retention)                 │
│    - Resolved issue summaries (permanent)                        │
│                                                                  │
│  Semantic Store (pgvector):                                      │
│    - Embeddings of past interactions                             │
│    - Retrieved by: "find interactions similar to current issue"  │
│                                                                  │
└──────────────────────────────────────────────────────────────────┘
```

---

## What Gets Stored After Each Interaction

At the end of every conversation, the agent writes:

```json
{
  "customer_id": "cust_abc123",
  "interaction_id": "int_xyz789",
  "date": "2024-01-15",
  "channel": "whatsapp",
  "duration_messages": 8,
  "issue": {
    "type": "late_delivery",
    "order_id": "ORD-45678",
    "resolved": true,
    "resolution": "Refund issued, priority flag added to next order"
  },
  "sentiment": "frustrated → satisfied",
  "agent_notes": "Third late delivery in 6 months. Customer is at risk. Escalated to logistics supervisor.",
  "follow_up_required": false,
  "tags": ["late_delivery", "escalated", "resolved", "loyalty_risk"]
}
```

And updates the customer profile:
```json
{
  "customer_id": "cust_abc123",
  "facts": {
    "preferred_channel": "whatsapp",
    "communication_style": "direct, prefers short responses",
    "sensitivity": "high — any delivery issue should be escalated",
    "loyalty_status": "at_risk",
    "delivery_issues_count": 3,
    "last_issue_date": "2024-01-15"
  }
}
```

---

## System Prompt (with memory injection)

```
You are a customer service assistant for Acme Corp. You have access to this customer's history.

CUSTOMER PROFILE:
Name: {{customer_name}}
Tier: {{customer_tier}}
Member since: {{member_since}}
Sensitivity flags: {{sensitivity_flags}}

INTERACTION HISTORY (most recent first):
{{last_5_interactions}}

RELEVANT PAST ISSUES (similar to current conversation):
{{semantic_retrieval_results}}

CURRENT SESSION:
{{current_session_context}}

YOUR BEHAVIOR:
1. Acknowledge relevant history — don't make the customer re-explain known issues
2. Adjust urgency based on history — repeat issues are automatically escalated
3. Be proactive — if customer shows risk signals (3+ issues, negative trend), escalate
4. After resolving: write a concise summary to memory (use write_interaction_summary tool)
5. Never share one customer's information with another

ESCALATION RULES:
- Delivery issues: escalate if this is customer's 2nd+ issue in 90 days
- Billing disputes: always escalate (Trust Level 2 action, requires human approval)
- Customer explicitly requests manager: always escalate
- Loyalty risk flag active: mention it in internal notes when escalating

MEMORY RULES:
- If customer corrects something you said about their history: update your notes
- If you're unsure whether something is in the customer's history: ask, don't guess
- After every resolved interaction: call write_interaction_summary before closing
```

---

## Memory Retrieval Flow

```
Customer sends message: "My delivery is late again"
                │
                ▼
Identify customer: lookup_customer(phone_number)
→ customer_id = "cust_abc123"
                │
                ▼
Parallel retrieval:
  ├── get_customer_profile("cust_abc123")
  │   → {name, tier, facts, sensitivity_flags}
  │
  ├── get_recent_interactions("cust_abc123", limit=5)
  │   → [{date, issue, resolution}, ...]
  │
  └── semantic_search("late delivery", customer_id="cust_abc123", top_k=3)
      → [{similar past interaction}, ...]
                │
                ▼
Assemble context (max 2000 tokens):
  System prompt + customer profile + recent (5) + relevant (3) + current message
                │
                ▼
LLM call with full context
                │
                ▼
Agent response (sees: 3 prior late deliveries → escalates automatically)
                │
                ▼
After resolution: write_interaction_summary(...)
```

---

## Memory Update: The write_interaction_summary Tool

```json
{
  "name": "write_interaction_summary",
  "description": "Write a summary of the current interaction to memory. Call this at the end of every resolved conversation.",
  "parameters": {
    "type": "object",
    "properties": {
      "issue_type": {"type": "string"},
      "issue_detail": {"type": "string"},
      "resolved": {"type": "boolean"},
      "resolution": {"type": "string"},
      "sentiment_trend": {"type": "string", "description": "e.g., frustrated → satisfied"},
      "notes": {"type": "string", "description": "Internal notes about this interaction"},
      "update_profile": {
        "type": "object",
        "description": "Facts to update in the customer profile"
      },
      "follow_up_required": {"type": "boolean"},
      "tags": {"type": "array", "items": {"type": "string"}}
    },
    "required": ["issue_type", "resolved", "tags"]
  }
}
```

---

## Memory Hygiene

**Conflict resolution** (customer states something that contradicts their profile):
```
Customer: "Actually I prefer email, not WhatsApp"
Agent behavior:
  1. Acknowledge: "Thanks for letting me know — I'll update your preferences."
  2. Call update_customer_profile({preferred_channel: "email"})
  3. Note the change in interaction summary
  4. Do NOT continue using the old preference
```

**Memory correction** (agent discovers a fact is outdated):
```
Agent notes customer profile says "delivery_issues_count: 1"
But interaction history shows 3 late deliveries in 3 months.
→ Agent calls update_customer_profile({delivery_issues_count: 3, loyalty_status: "at_risk"})
→ Adds note: "Profile corrected based on interaction history audit"
```

**Retention:**
- Interaction details: 90 days (then archive)
- Customer profile facts: permanent until explicitly changed
- Session cache: 4 hours TTL

---

## Key Lesson From This Example

Memory makes agents personal. But it also creates responsibility:
- Wrong memory is worse than no memory (it creates false confidence)
- Memory must be actively maintained, not just accumulated
- The agent must know when to ask, not just when to use

The hardest part of memory agent design is not storage — it's knowing what to remember, what to forget, and when to update.
