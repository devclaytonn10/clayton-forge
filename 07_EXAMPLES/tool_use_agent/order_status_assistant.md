# Example: Tool-Use Agent — Order Status Assistant

> **Archetype 3 — Tool-Use Agent (ReAct Pattern)**
> The most common archetype in production. An agent that needs real-world data to answer questions.
> Stack-agnostic — the patterns here apply to any language or framework.

---

## Why Tool-Use Agents Are Everywhere

Most real business questions can't be answered from the LLM's training data alone:

- "Where is my order?" → needs live order database
- "Is this product in stock?" → needs inventory system
- "When will the technician arrive?" → needs scheduling system
- "What's my account balance?" → needs financial system

A reactive agent (no tools) would hallucinate or say "I don't know." A tool-use agent goes and gets the real answer.

This example builds an order status assistant that handles the most common customer question in e-commerce: "What's happening with my order?"

---

## Foundation Analysis

From `00_FOUNDATIONS/04_agent_vs_automation.md`:

```
Is it rule-based?
  → Mostly yes for routing, but natural language input requires judgment.
    "Where's my stuff?" and "I haven't received order 12345" are the same intent.

Is it text-only?
  → No. Needs to query order database to give a real answer.

Is the sequence fixed?
  → Mostly: extract order ID → query status → respond.
    But: what if customer doesn't provide order ID? Agent must ask.
    What if there are multiple orders? Agent must clarify.
    → Judgment required for sequence. → Agent, not workflow.

Needs memory?
  → Not for MVP. Each conversation is about one order.
    (Add in v1.1 if we want to remember customer's history)

→ Archetype 3 (Tool-Use / ReAct) is correct.
```

---

## PRD (Filled)

**Agent:** Order Status Assistant
**Type:** Tool-Use Agent (Archetype 3)
**Trust Level:** 0 (read-only — cannot modify orders)

**Problem:** 40% of all support contacts are "where is my order?" questions. Each takes 3–5 minutes for a support agent to look up and answer. Volume: 800 contacts/day = 40–67 hours of work daily.

**Solution:** Agent that understands order status questions in natural language, looks up the real data, and gives a clear, accurate answer — in under 10 seconds.

**What it does:**
- Understands order status questions in any phrasing
- Extracts order ID from message or asks for it
- Queries live order database
- Interprets status codes in plain language
- Proactively mentions next steps (estimated delivery, what to do if late)

**What it does NOT do:**
- Cannot change or cancel orders (Trust Level 0 — read-only)
- Cannot issue refunds
- Cannot answer questions unrelated to order status
- Does not store conversation history (stateless per conversation)

**Primary use case:**
```
Trigger: Customer sends message via chat widget
Input: Natural language message from customer

Flow:
  1. Agent reads message
  2. If order ID present → query directly
  3. If no order ID → ask customer for it
  4. Query order API with order ID
  5. Interpret status in human language
  6. Respond with status + relevant next steps

Output: Natural language status update
```

**Edge cases:**

| Scenario | Behavior |
|---|---|
| Customer provides no order ID | Ask: "Could you share your order number? It looks like ORD-XXXXX." |
| Order ID not found | "I couldn't find that order. Please check the number and try again, or contact our team." |
| Multiple orders found for customer | List them and ask which one they're asking about |
| Order is genuinely late | Acknowledge, provide carrier tracking link, offer escalation |
| Order delivered but customer says not received | Empathize, provide proof of delivery details, offer human escalation |
| Question is not about order status | "I'm specialized in order tracking. For [other topic], please contact our support team at [contact]." |

**Success metrics:**

| Metric | Baseline | Target |
|---|---|---|
| Support contacts resolved without human | 0% | 60% |
| Avg resolution time | 4 minutes | < 15 seconds |
| CSAT on bot interactions | N/A | > 4.0/5.0 |
| Escalation rate | 100% (manual) | < 40% |

---

## Tools

This agent uses two tools:

### Tool 1: `get_order_status`

```json
{
  "name": "get_order_status",
  "description": "Retrieve the current status and details of an order. Use this whenever the customer provides an order ID or when you have identified their order number.",
  "parameters": {
    "type": "object",
    "properties": {
      "order_id": {
        "type": "string",
        "description": "The order ID. Usually in format ORD-XXXXX or just a number. Clean up before passing: remove spaces, hashes, and 'order' prefix."
      }
    },
    "required": ["order_id"]
  }
}
```

**Returns on success:**
```json
{
  "order_id": "ORD-12345",
  "status": "IN_TRANSIT",
  "status_label": "On its way",
  "created_at": "2024-01-10T09:00:00Z",
  "estimated_delivery": "2024-01-17",
  "carrier": "FedEx",
  "tracking_number": "799503836389",
  "tracking_url": "https://fedex.com/track?n=799503836389",
  "items": [
    {"sku": "SOFA-GRY-L", "name": "Gray Sofa L-Shape", "qty": 1}
  ],
  "shipping_address": {
    "city": "São Paulo",
    "state": "SP"
  }
}
```

**Returns on error:**
```json
{
  "error": "ORDER_NOT_FOUND",
  "message": "No order found with ID ORD-99999"
}
```

### Tool 2: `get_customer_orders`

```json
{
  "name": "get_customer_orders",
  "description": "Look up all recent orders for a customer by their email or phone number. Use this when the customer doesn't know their order ID but can provide their contact information.",
  "parameters": {
    "type": "object",
    "properties": {
      "email": {
        "type": "string",
        "description": "Customer's email address"
      },
      "phone": {
        "type": "string",
        "description": "Customer's phone number, any format"
      }
    }
  }
}
```

**Returns:**
```json
{
  "orders": [
    {
      "order_id": "ORD-12345",
      "status": "IN_TRANSIT",
      "created_at": "2024-01-10",
      "items_summary": "Gray Sofa L-Shape"
    },
    {
      "order_id": "ORD-11999",
      "status": "DELIVERED",
      "created_at": "2023-12-20",
      "items_summary": "Coffee Table"
    }
  ]
}
```

---

## System Prompt

```
You are the Order Status Assistant for Acme Store. You help customers check the status of their orders quickly and clearly.

YOUR ROLE:
You have access to our live order system. You can look up any order and give accurate, real-time status information.

YOUR TOOLS:
- get_order_status: Use when you have an order ID
- get_customer_orders: Use when customer provides email/phone but no order ID

CONVERSATION FLOW:
1. If the message contains an order ID → call get_order_status immediately
2. If no order ID but customer asks about their order → ask for order ID OR email/phone
3. If multiple orders returned → ask which one they're asking about
4. After getting order data → explain status in plain, friendly language

ORDER STATUS TRANSLATIONS:
PROCESSING     → "We've received your order and are preparing it"
WAREHOUSE      → "Your order is being packed at our warehouse"
SHIPPED        → "Your order has been shipped and is on its way to the carrier"
IN_TRANSIT     → "Your order is on its way to you"
OUT_FOR_DELIVERY → "Your order is out for delivery today — expect it soon!"
DELIVERED      → "Your order has been delivered"
RETURNING      → "Your return is being processed"
CANCELLED      → "This order has been cancelled"

RESPONSE RULES:
- Be clear and direct. Customers want to know: where is it and when will it arrive.
- For IN_TRANSIT: always include estimated delivery date and tracking link
- For DELIVERED: include delivery date. If customer says they didn't receive it, empathize and offer escalation
- For late orders (past estimated delivery): acknowledge the delay, apologize briefly, provide tracking
- For CANCELLED: explain it's cancelled and what to do next (reorder or contact support)
- Never make up information. If you can't find the order, say so clearly.
- Keep responses under 150 words unless the situation genuinely requires more

OUT OF SCOPE:
If asked about anything other than order status, say:
"I'm specialized in order tracking. For [topic], please contact our support team at support@acme.com or call 0800-XXX-XXXX."

DO NOT:
- Promise specific delivery times you can't confirm
- Make exceptions or change order details (you are read-only)
- Share one customer's order info with another customer
```

**LLM Parameters:** Temperature: 0.2 | Max tokens: 400

---

## Execution Traces

### Trace 1 — Happy Path

```
Customer: "Hey, where is my order ORD-12345?"

THOUGHT: Customer provided order ID directly. Call get_order_status.
ACTION: get_order_status(order_id="ORD-12345")
OBSERVATION: {status: "IN_TRANSIT", estimated_delivery: "2024-01-17",
              carrier: "FedEx", tracking_url: "https://fedex.com/track?n=799503836389",
              items: [{name: "Gray Sofa L-Shape"}]}

THOUGHT: Got the data. Order is in transit, delivery tomorrow. Give clear update with tracking link.
RESPONSE: "Your Gray Sofa L-Shape is on its way! 🚚

Estimated delivery: January 17th
Carrier: FedEx
Track in real-time: https://fedex.com/track?n=799503836389

Is there anything else I can help you with?"

Total time: 1.8 seconds | Cost: $0.0042
```

### Trace 2 — No Order ID Provided

```
Customer: "I ordered a sofa last week and haven't heard anything"

THOUGHT: Customer doesn't have an order ID. Need to identify their order.
         Options: ask for order ID, or ask for email/phone.
         Best: ask for order ID first (fastest path).
RESPONSE: "I'd be happy to check that for you! Could you share your order number?
           It usually looks like ORD-XXXXX and you can find it in your confirmation email."

Customer: "It's 12345"

THOUGHT: Got the order ID. Clean it up and query.
ACTION: get_order_status(order_id="ORD-12345")
OBSERVATION: {status: "WAREHOUSE", estimated_delivery: "2024-01-19", ...}

THOUGHT: Order is still in the warehouse. Explain this clearly without making customer anxious.
RESPONSE: "Found it! Your order is currently being packed at our warehouse.
           Estimated delivery: January 19th

           You'll receive a shipping confirmation email with tracking info once it leaves our facility, usually within 1–2 business days."

Total turns: 2 | Total cost: $0.0071
```

### Trace 3 — Delivered but Customer Didn't Receive It

```
Customer: "I need to know where my order ORD-12345 is, I haven't received it"

ACTION: get_order_status(order_id="ORD-12345")
OBSERVATION: {status: "DELIVERED", delivered_at: "2024-01-15T14:32:00Z",
              delivery_notes: "Left at front door", proof_of_delivery_url: "..."}

THOUGHT: Order shows as delivered but customer says they didn't receive it.
         This is a sensitive situation. Acknowledge, provide proof, offer escalation.
         Do NOT accuse customer. Do NOT promise a replacement (outside my authority).
RESPONSE: "I can see your order shows as delivered on January 15th at 2:32 PM,
           with a note that it was left at the front door.

           I understand this is frustrating if you didn't receive it. Here's what I'd suggest:
           1. Check around your door, porch, or with neighbors
           2. View the delivery photo: [proof_of_delivery_url]

           If you still can't locate it, our support team can investigate further:
           📧 support@acme.com | 📞 0800-XXX-XXXX

           I'm sorry for the inconvenience!"

Total time: 2.1 seconds | Cost: $0.0051
```

### Trace 4 — Order Not Found

```
Customer: "Status of order ORD-99999"

ACTION: get_order_status(order_id="ORD-99999")
OBSERVATION: {error: "ORDER_NOT_FOUND", message: "No order found with ID ORD-99999"}

THOUGHT: Order not found. Could be typo, or wrong store.
         Don't assume it doesn't exist — customer may have the wrong number.
RESPONSE: "I wasn't able to find an order with ID ORD-99999.

           This sometimes happens with a small typo. Could you double-check the number
           in your confirmation email?

           If you're still having trouble, our team can look you up by email:
           support@acme.com"

Total time: 1.3 seconds | Cost: $0.0038
```

---

## Error Handling

| Error | Cause | Agent Behavior |
|---|---|---|
| `ORDER_NOT_FOUND` | Wrong ID or typo | Ask to verify + offer email lookup |
| `API_TIMEOUT` (get_order_status) | Database slow | Retry once, then: "Having trouble connecting to our system. Try again in a moment or contact support." |
| `MULTIPLE_ORDERS` (get_customer_orders) | Customer has many orders | List last 3, ask which one |
| Question not about orders | Scope mismatch | Redirect to support contact |
| Customer is angry/upset | Emotional state | Acknowledge feelings before giving facts |

---

## Cost Model

| Item | Value |
|---|---|
| Input tokens per call | ~900 (system prompt + context + message) |
| Output tokens per call | ~120 |
| Tool calls per conversation | avg 1.3 |
| LLM cost per conversation | ~$0.004 |
| Expected volume | 800 conversations/day |
| **Daily LLM cost** | **~$3.20/day = $96/month** |
| Support cost avoided | 800 × 4min × $0.50/min = $1,600/day |
| **ROI** | **50× cost reduction** |

---

## Upgrade Path

**v1.1 — Proactive Delay Detection:**
```
Add: Check if delivery is past estimated date before customer asks
If late: "I see your order was expected by Jan 15 and today is Jan 17.
          I'm escalating this to our logistics team. Your case ID is #789."
Requires: Scheduled job that runs tool on "expected today" orders
```

**v1.2 — Memory (Archetype 4):**
```
Add: Remember customer's previous orders and contact info
Why: "Check my order" (without ID) works if agent remembers last order
Storage: Customer phone → {last_order_id, name, preferences}
```

**v2.0 — Action Capabilities (Trust Level 1):**
```
Add tools: request_redelivery, flag_missing_package
Trust level upgrade required: Level 0 → Level 1
Approval gate: Any action confirmed with customer before executing
```

---

## Key Lessons From This Example

**1. The ReAct pattern is conversational, not robotic.**
The agent's "Thought → Action → Observation" loop is internal. The customer sees a natural conversation.

**2. Tool descriptions are critical.**
The LLM reads tool descriptions to decide when and how to use them. Vague descriptions = wrong tool calls. Be specific about when to use and what the input format should be.

**3. Error states are use cases, not edge cases.**
"Order not found" and "delivered but not received" happen every day. Design them as first-class scenarios, not afterthoughts.

**4. Read-only first.**
This agent proves its value before touching any data. Trust Level 0 means zero risk of side effects while you validate quality.

**5. Measure the right thing.**
Cost to run: ~$96/month. Cost avoided: ~$48,000/month. Don't optimize for prompt token count — optimize for the business outcome.
