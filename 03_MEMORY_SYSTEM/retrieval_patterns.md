# Retrieval Patterns — Getting the Right Memory at the Right Time

> `03_MEMORY_SYSTEM / 02`
> Storing memory is the easy part. Retrieving the right memory at the right moment is where agents succeed or fail.

---

## The Retrieval Problem

An agent can have millions of stored memories. At the moment it needs to respond, it has milliseconds to decide: which memories are relevant to *this* specific input?

Bad retrieval means:
- Irrelevant memories clutter the context → worse reasoning
- Relevant memories are missed → agent re-asks questions the user already answered
- Too much memory → context window overflow → errors

Good retrieval means:
- Only what's needed, nothing more
- Retrieved in time to be useful
- Ranked by relevance, not just recency

---

## The Four Retrieval Strategies

### Strategy 1 — Exact Key Lookup

**What it is:** Retrieve by a known identifier.

**When to use:** When you know exactly what you're looking for.

```
Examples:
  customer_profile = store.get("customer:cust_abc123:profile")
  checklist = store.get("checklist:standard_v3")
  session = cache.get("session:sess_xyz789")
```

**Pros:** Instant. Perfectly precise. Free.
**Cons:** You must know the exact key. Useless for discovery.

---

### Strategy 2 — Filtered Query

**What it is:** Retrieve records matching structured criteria.

**When to use:** When you know the category and filters, but not the exact record.

```
Examples:
  # Get customer's recent complaints
  complaints = db.query(
    table="interactions",
    where={
      "customer_id": "cust_abc123",
      "issue_type": "complaint",
      "date": ">= 90_days_ago"
    },
    order="date DESC",
    limit=10
  )

  # Get all unresolved tickets assigned to team
  open_tickets = db.query(
    table="tickets",
    where={"team": "LOGISTICS", "status": "open"},
    order="urgency DESC, created_at ASC"
  )
```

**Pros:** Fast. Deterministic. Easy to debug.
**Cons:** Requires structured data. Can't find things you can't describe structurally.

---

### Strategy 3 — Semantic Search (Vector Retrieval)

**What it is:** Find memories that are *similar in meaning* to the query, even if they don't share keywords.

**When to use:**
- When exact keywords won't find what you need
- When the user describes something in their own words
- When past interactions should inform current ones

```
Examples:
  # "How do I cancel?" should find past interactions about
  # "subscription termination", "account closure", "stop service"
  similar_issues = vector_store.search(
    query="customer wants to cancel",
    collection="interactions",
    top_k=5,
    filter={"customer_id": "cust_abc123"}
  )

  # Find similar past cases to inform current response
  similar_cases = vector_store.search(
    query=current_message,
    collection="resolved_cases",
    top_k=3,
    filter={"resolution_quality": "high"}
  )
```

**How it works:**
```
Your query → [Embedding model] → Vector [0.23, -0.45, 0.71, ...]
                                         │
                                Search vector store for
                                nearest neighbors
                                         │
                               Return top-K most similar,
                               ranked by cosine similarity
```

**Pros:** Language-agnostic. Finds conceptually related content. Handles paraphrasing.
**Cons:** More expensive (requires embedding calls). Approximate (may miss or include wrong things). Requires vector infrastructure.

---

### Strategy 4 — Hybrid Retrieval

**What it is:** Combine multiple strategies and merge results.

**When to use:** For agents where both recency and semantic relevance matter (most memory agents).

```
def retrieve_context(customer_id, current_message):

  # 1. Always get: customer profile (exact lookup)
  profile = store.get(f"customer:{customer_id}:profile")

  # 2. Always get: recent interactions (filtered query)
  recent = db.query(
    "interactions",
    where={"customer_id": customer_id},
    order="date DESC",
    limit=5
  )

  # 3. Conditionally get: semantically relevant past issues
  if len(current_message) > 20:  # Only for meaningful messages
    relevant = vector_store.search(
      query=current_message,
      collection="interactions",
      filter={"customer_id": customer_id},
      top_k=3
    )
  else:
    relevant = []

  # 4. Merge and deduplicate
  all_interactions = deduplicate(recent + relevant)

  # 5. Rank by combined score (recency + relevance)
  ranked = rank_by_recency_and_relevance(all_interactions)

  return {
    "profile": profile,
    "interactions": ranked[:7],  # max 7 interactions in context
  }
```

---

## The Context Budget

Working memory (context window) is finite. Before retrieval, set a budget:

```
Total context budget: 4,000 tokens

Allocation:
  System prompt:        800 tokens (fixed)
  Customer profile:     300 tokens
  Recent interactions:  600 tokens (5 × ~120 tokens each)
  Relevant past issues: 450 tokens (3 × ~150 tokens each)
  Current conversation: 500 tokens
  Output buffer:        1,000 tokens
  Reserve:              350 tokens
  ─────────────────────────────────
  Total:                4,000 tokens ✓
```

**Truncation rules (when retrieved content exceeds budget):**
1. Never truncate the system prompt
2. Never truncate the current message
3. Truncate semantic results before recent results
4. Truncate older interactions before recent ones
5. Summarize rather than truncate when possible

---

## Retrieval Quality

### How to measure retrieval quality

**Precision:** Of the memories retrieved, how many were actually relevant?
```
Retrieved 5 memories. 4 were relevant. Precision = 80%.
```

**Recall:** Of all the relevant memories that exist, how many did you retrieve?
```
There were 6 relevant memories. You retrieved 4. Recall = 67%.
```

**The trade-off:** More retrieval = higher recall, lower precision, more tokens used. Less retrieval = lower recall, higher precision, fewer tokens.

**For most agents:** optimize for precision. Too much irrelevant context degrades reasoning more than missing some relevant context.

### Improving retrieval quality

| Problem | Cause | Fix |
|---|---|---|
| Wrong memories retrieved | Query too broad | Narrow the query, add filters |
| Relevant memories missed | Query too narrow | Broaden, use synonyms |
| Old outdated memories returned | No time filter | Add recency filter or TTL |
| Same memory retrieved multiple times | No deduplication | Deduplicate before injecting |
| Context full, important memory excluded | Budget too small | Summarize long memories before storing |

---

## Retrieval Caching

Retrieval is expensive (embedding calls, DB queries). Cache aggressively:

```
Cache key: hash(customer_id + message_intent)
TTL: 5 minutes (for active conversations)

Logic:
  cached = cache.get(cache_key)
  if cached:
    return cached  # skip retrieval, save cost + latency
  
  result = run_retrieval(customer_id, message)
  cache.set(cache_key, result, ttl=300)
  return result
```

**When NOT to cache:**
- Real-time data (order status, ticket state)
- After a write operation (memory just changed)
- High-stakes decisions where stale context is dangerous

---

## Retrieval Design Checklist

For every memory agent, answer before building:

- [ ] **What is retrieved?** List every type of memory retrieved per call.
- [ ] **When is each type retrieved?** Always / conditionally / on-demand?
- [ ] **Context budget?** Tokens allocated to each type of retrieved content.
- [ ] **Truncation rules?** What gets cut when budget is exceeded?
- [ ] **Freshness?** Is there a maximum age for retrieved content?
- [ ] **Deduplication?** How are duplicates removed before injection?
- [ ] **Caching?** What's cached and for how long?
- [ ] **Quality measurement?** How will you know if retrieval is working?

---

*Next: `03_context_management.md` — Managing the context window across a conversation*
