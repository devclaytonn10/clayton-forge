# Memory Architecture — What Agents Remember and How

> `03_MEMORY_SYSTEM / 01`
> Memory is the difference between an agent that helps once and an agent that gets better over time.

---

## The Memory Problem

Every LLM call starts from zero. The model has no inherent memory of past interactions, past decisions, or past failures. Without explicit memory design, your agent is perpetually amnesiac — brilliant in the moment, forgetful by design.

This is not a bug. It's an architectural property. And it means that **memory must be designed, built, and maintained explicitly**.

Clayton Forge treats memory as a first-class architectural concern — not an afterthought.

---

## The Four Memory Stores

```
┌──────────────────────────────────────────────────────────────────┐
│                     MEMORY ARCHITECTURE                          │
│                                                                  │
│  ┌──────────────┐   ┌──────────────┐   ┌──────────────┐        │
│  │   WORKING    │   │  SHORT-TERM  │   │  LONG-TERM   │        │
│  │   MEMORY     │   │    CACHE     │   │   DATABASE   │        │
│  │              │   │              │   │              │        │
│  │ Context      │   │ Session      │   │ Persistent   │        │
│  │ window.      │   │ state.       │   │ facts.       │        │
│  │ Ephemeral.   │   │ Hours/days.  │   │ Permanent.   │        │
│  └──────────────┘   └──────────────┘   └──────────────┘        │
│                                                                  │
│  ┌──────────────────────────────────────────────────────┐       │
│  │               SEMANTIC MEMORY (VECTOR)                │       │
│  │  Knowledge stored as embeddings.                     │       │
│  │  Retrieved by meaning, not by key.                   │       │
│  └──────────────────────────────────────────────────────┘       │
│                                                                  │
└──────────────────────────────────────────────────────────────────┘
```

---

## Working Memory — The Context Window

**What it is:** The text the LLM can "see" during a single call. Everything you inject into the prompt is working memory.

**Capacity:** Model-dependent. Common limits:
- Small models: 4K–8K tokens (~3,000–6,000 words)
- Medium models: 32K–128K tokens (~24,000–96,000 words)
- Large models: 200K+ tokens (~150,000+ words)

**The problem:** Working memory is limited. You can't put everything in the prompt.

**The solution:** Selective retrieval. Don't dump everything — retrieve only what's relevant for this specific call.

```
DON'T:
prompt = system_prompt + ENTIRE_USER_HISTORY + current_message
# Context window overflow. Expensive. Degrades quality.

DO:
relevant_history = retrieve_relevant(current_message, top_k=5)
prompt = system_prompt + relevant_history + current_message
# Only what's needed. Efficient. Better results.
```

**Working memory management strategies:**

| Strategy | How it works | Best for |
|---|---|---|
| **Sliding window** | Keep last N messages | Conversational agents |
| **Relevance retrieval** | Semantic search for related memories | Knowledge-heavy agents |
| **Summarization** | Compress old context into a summary | Long-running sessions |
| **Priority queue** | Always include highest-priority memories | Goal-directed agents |
| **Hybrid** | Fixed recent + semantic retrieval | Most production agents |

---

## Short-Term Cache — Session State

**What it is:** Temporary storage for data that spans multiple calls within a session or a short time window.

**Examples of what to store here:**
- Intermediate results in a multi-step task
- User preferences stated in the current session
- In-progress forms or data collection
- Locks and coordination state between agents

**Duration:** Minutes to hours. Clears when session ends or TTL expires.

**Technology options:** Redis, Memcached, in-memory store, database with TTL.

**Design pattern:**
```
Session created:
  session_id = generate_uuid()
  cache.set(session_id, {
    user_id: "...",
    context: {},
    in_progress: null,
    started_at: now()
  }, ttl=3600)

During session:
  state = cache.get(session_id)
  state.context.last_intent = "check_order_status"
  state.context.order_id = "ORD-12345"
  cache.set(session_id, state, ttl=3600)  # refresh TTL

Session ends:
  persist important state to long-term DB
  cache.delete(session_id)
```

---

## Long-Term Database — Persistent Facts

**What it is:** Permanent storage for information that should persist indefinitely across sessions.

**Examples of what to store here:**
- User profiles and preferences
- Complete interaction history (for compliance/audit)
- Entity data (customers, orders, products)
- Agent decisions and their outcomes
- Learned patterns and configurations

**Schema design principles:**

### Entity-Attribute-Value pattern (flexible, good for agent memory)
```sql
-- Core entities
CREATE TABLE agent_entities (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_id   TEXT NOT NULL,        -- e.g., "user_123", "order_456"
  entity_type TEXT NOT NULL,        -- e.g., "user", "order", "product"
  created_at  TIMESTAMPTZ DEFAULT now(),
  UNIQUE(entity_id, entity_type)
);

-- Facts about entities
CREATE TABLE agent_facts (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_id   TEXT NOT NULL,
  fact_key    TEXT NOT NULL,        -- e.g., "preferred_language"
  fact_value  JSONB NOT NULL,       -- e.g., "pt-BR"
  confidence  FLOAT DEFAULT 1.0,   -- How confident are we in this fact?
  source      TEXT,                 -- How was this fact learned?
  valid_from  TIMESTAMPTZ DEFAULT now(),
  valid_until TIMESTAMPTZ,          -- NULL = still valid
  created_at  TIMESTAMPTZ DEFAULT now()
);

-- Interaction history
CREATE TABLE agent_interactions (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  execution_id  UUID NOT NULL,
  agent_id      TEXT NOT NULL,
  entity_id     TEXT,
  input         JSONB NOT NULL,
  output        JSONB NOT NULL,
  tokens_used   INTEGER,
  duration_ms   INTEGER,
  status        TEXT NOT NULL,      -- success, partial, error
  created_at    TIMESTAMPTZ DEFAULT now()
);
```

### Updating facts without losing history
```
New fact arrives: "User prefers email, not WhatsApp"

WRONG:
  UPDATE agent_facts SET fact_value = 'email'
  WHERE entity_id = 'user_123' AND fact_key = 'preferred_channel'
  -- History lost. We don't know what changed or when.

RIGHT:
  -- Mark old fact as expired
  UPDATE agent_facts
  SET valid_until = now()
  WHERE entity_id = 'user_123'
    AND fact_key = 'preferred_channel'
    AND valid_until IS NULL

  -- Insert new fact
  INSERT INTO agent_facts (entity_id, fact_key, fact_value, source)
  VALUES ('user_123', 'preferred_channel', '"email"', 'user_stated')
  -- History preserved. Old fact is still queryable.
```

---

## Semantic Memory — Vector Store

**What it is:** Knowledge stored as mathematical representations (embeddings) that can be retrieved by meaning, not just by exact keyword match.

**The power:** "Show me everything related to shipping problems" — without having to search for every possible phrase about shipping.

**How it works:**
```
STORAGE:
  Text → [Embedding Model] → Vector [0.23, -0.45, 0.71, ...]
                                          │
                              Store in vector database

RETRIEVAL:
  Query → [Embedding Model] → Vector [0.19, -0.48, 0.68, ...]
                                          │
                              Search for nearest vectors
                                          │
                              Return top-K most similar texts
```

**When you need a vector store:**
- Your agent needs to search a large knowledge base
- Keyword search isn't good enough (semantic meaning matters)
- You're building a RAG (Retrieval Augmented Generation) system
- Your agent needs to find similar past cases

**When you don't need it:**
- Small knowledge base (< 1000 documents) — use keyword search
- Exact matching is sufficient — use a regular database
- You're just storing user preferences — use structured DB

**RAG Pattern (Retrieval Augmented Generation):**
```
User question: "How do I cancel my subscription?"
         │
         ▼
[Embed the question]
         │
         ▼
[Search vector store for similar content]
         │
         ▼
Top results:
  - "Subscription Cancellation Policy" (similarity: 0.94)
  - "Refund Policy" (similarity: 0.87)
  - "Account Management Guide" (similarity: 0.81)
         │
         ▼
[Build prompt with retrieved context]
System: You are a support agent. Answer using the provided context.

Context:
[Subscription Cancellation Policy content...]
[Refund Policy content...]

User: How do I cancel my subscription?
         │
         ▼
[LLM generates answer grounded in retrieved content]
```

---

## Memory Retrieval Patterns

### Pattern 1 — Exact Lookup
```
memory.get(key="user_123:preferred_language")
→ "pt-BR"
```
*Use for: known-key retrieval, preferences, settings*

### Pattern 2 — Filtered Query
```
memory.query(
  entity_type="user",
  entity_id="user_123",
  fact_key="order_history",
  limit=10,
  order_by="created_at DESC"
)
```
*Use for: structured retrieval from long-term DB*

### Pattern 3 — Semantic Search
```
memory.search(
  query="problems with delivery",
  collection="support_tickets",
  top_k=5,
  filter={"status": "resolved"}
)
```
*Use for: knowledge base retrieval, similar case finding*

### Pattern 4 — Recency + Relevance Hybrid
```
# Get recent interactions
recent = memory.get_recent(entity_id="user_123", days=7)

# Get semantically relevant past interactions
relevant = memory.search(query=current_message, entity_id="user_123", top_k=3)

# Merge and deduplicate
context = merge_deduplicate(recent + relevant)
```
*Use for: conversational agents that need both recency and relevance*

---

## Memory Hygiene

Memory grows over time. Without active management, it degrades:
- Outdated facts still surface in queries
- Old preferences override new ones
- Storage costs escalate
- Retrieval quality degrades

**Retention policy template:**

```yaml
retention_policies:
  session_cache:
    ttl: 3600  # 1 hour
    on_expiry: persist_important_to_db

  interaction_history:
    retain_full: 90d
    then: summarize_and_archive
    archive_retention: 7y  # legal compliance

  user_facts:
    never_expire: true
    except:
      - key: "session_preferences"
        ttl: 30d

  vector_embeddings:
    review_interval: 90d
    remove_if: source_document_deleted OR manually_flagged

  logs:
    retain: 30d
    then: delete
```

**Conflict resolution** (when two facts contradict):
```
Priority order:
1. Most recent (newer information wins by default)
2. Higher confidence score
3. More authoritative source (user_stated > agent_inferred > default)
4. If still tied: flag for human review
```

---

## Memory Design Checklist

Before implementing memory for a new agent:

- [ ] **Do I need memory at all?** Stateless agents are simpler. Justify the complexity.
- [ ] **Which memory types does this agent need?** (Working / Cache / DB / Vector)
- [ ] **What specific information needs to be remembered?** (Don't store everything)
- [ ] **For how long?** (Retention policy defined)
- [ ] **How will it be retrieved?** (Exact key / Query / Semantic search)
- [ ] **How are conflicts handled?** (Contradiction resolution policy)
- [ ] **Who can access this memory?** (Privacy and access control)
- [ ] **What happens when memory is wrong?** (Correction mechanism)
- [ ] **How does memory get cleaned up?** (Hygiene process defined)

---

*Next: `02_retrieval_patterns.md` — Advanced retrieval strategies*
