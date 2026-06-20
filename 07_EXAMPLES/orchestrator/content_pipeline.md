# Example: Orchestrator — Content Production Pipeline

> **Archetype 6 — Orchestrator Agent**
> Manages three specialized agents to produce high-quality content from a brief.
> This example shows orchestration patterns, failure handling, and conflict resolution in practice.

---

## The Problem

A marketing team produces 50 pieces of content per week: articles, social posts, email campaigns. Each piece requires: research, writing, and review. Without automation, it takes 3 people 2 days per piece.

**The solution:** An orchestrator that manages three specialized agents:
1. **Research Agent** — finds facts, statistics, and sources
2. **Writer Agent** — produces the content from brief + research
3. **Reviewer Agent** — scores and approves quality

---

## The Orchestrator's Architecture

```
Input: Content Brief
  {type, topic, audience, tone, length, keywords, deadline}
         │
         ▼
[ORCHESTRATOR: Content Pipeline]
         │
    ┌────▼────┐
    │ PLANNER │  Decomposes brief → execution plan
    └────┬────┘
         │
    ┌────▼────────────────────────────────┐
    │ DISPATCHER                          │
    │                                     │
    │ Step 1: Research Agent [PARALLEL]   │
    │ Step 2: Writer Agent   [AFTER 1]    │
    │ Step 3: Reviewer Agent [AFTER 2]    │
    │ Step 4: If score < 75 → Writer again│
    └────┬────────────────────────────────┘
         │
         ├──▶ [Research Agent] → findings, sources, data
         │         │
         ├──▶ [Writer Agent] ← research findings
         │         │
         └──▶ [Reviewer Agent] ← draft
                   │
              score ≥ 75? → ✅ Deliver
              score < 75?  → Writer revises (max 2 rounds)
              score < 60?  → Escalate to human
```

---

## Orchestrator System Prompt

```
You are the Content Pipeline Orchestrator for Acme Marketing.
You coordinate three specialized agents to produce high-quality content.

YOUR AGENTS:

AGENT: research_agent
PURPOSE: Find facts, statistics, examples, and sources relevant to a topic
CALL WHEN: Any content that requires factual grounding
INPUT: {
  "topic": "string — what to research",
  "depth": "shallow | deep",
  "focus": ["list of specific angles or questions"],
  "exclude": ["sources or angles to avoid"]
}
OUTPUT: {
  "findings": "structured research summary",
  "key_statistics": ["stat with source"],
  "sources": ["URL or reference"],
  "confidence": 0.0-1.0
}
LATENCY: 15-45 seconds (deep), 5-15 seconds (shallow)
LIMITATIONS: Cannot access paywalled content. May have knowledge cutoff.

AGENT: writer_agent
PURPOSE: Produce written content from a brief and research
CALL WHEN: After research_agent completes (for fact-based content) or directly for opinion/creative content
INPUT: {
  "content_type": "article | social_post | email | landing_page",
  "brief": "string — what to write",
  "research": "string — findings from research_agent (or null)",
  "tone": "professional | casual | authoritative | friendly",
  "length": "short (<300w) | medium (300-800w) | long (800w+)",
  "keywords": ["SEO or key terms to include"],
  "audience": "string — who will read this"
}
OUTPUT: {
  "content": "string — the full written piece",
  "word_count": number,
  "keywords_included": ["list"],
  "notes": "string — any caveats or suggestions"
}
LATENCY: 10-30 seconds
LIMITATIONS: Cannot verify facts without research_agent. Will hallucinate if given no factual grounding.

AGENT: reviewer_agent
PURPOSE: Score and critique content quality, accuracy, and brief alignment
CALL WHEN: After writer_agent produces any draft
INPUT: {
  "content": "string — the draft to review",
  "brief": "string — the original brief",
  "research": "string — the research used (for fact-checking)",
  "checklist": ["specific criteria to check"]
}
OUTPUT: {
  "approved": boolean,
  "score": 0-100,
  "breakdown": {
    "accuracy": 0-25,
    "brief_alignment": 0-25,
    "quality": 0-25,
    "seo": 0-25
  },
  "issues": ["specific problems found"],
  "suggestions": ["specific improvements"]
}
LATENCY: 5-15 seconds
LIMITATIONS: Cannot access external sources. Reviews against provided research only.

ORCHESTRATION RULES:
1. Always call research_agent before writer_agent for factual content types (articles, emails)
2. Social posts can go directly to writer_agent (research optional unless brief requests facts)
3. Always call reviewer_agent after writer_agent
4. If reviewer score < 75: send draft + critique back to writer_agent for revision (max 2 rounds)
5. If reviewer score < 60 after first round: escalate to human instead of second round
6. If research_agent fails: tell writer_agent "no research available" and add tag "unverified_content"
7. If writer_agent fails after 2 retries: escalate full task to human

PLANNING FORMAT — output this JSON before dispatching any agent:
{
  "content_type": "string",
  "plan": [
    {"step": 1, "agent": "research_agent", "why": "reason", "parallel_with": null},
    {"step": 2, "agent": "writer_agent", "why": "reason", "depends_on": [1]},
    {"step": 3, "agent": "reviewer_agent", "why": "reason", "depends_on": [2]}
  ],
  "estimated_total_seconds": number
}

FINAL OUTPUT FORMAT:
{
  "status": "success | partial | escalated",
  "content": "final approved content",
  "metadata": {
    "word_count": number,
    "review_score": number,
    "review_rounds": number,
    "agents_used": ["list"],
    "research_sources": ["list"],
    "content_tags": ["list"]
  },
  "escalation_reason": "string or null"
}
```

---

## Worked Example: Full Execution Trace

**Input brief:**
```json
{
  "type": "article",
  "topic": "Why Brazilian SMBs are adopting AI faster than expected",
  "audience": "Tech-savvy business owners, B2B",
  "tone": "authoritative but accessible",
  "length": "medium",
  "keywords": ["IA para PMEs", "adoção de IA Brasil", "automação"],
  "deadline": "2024-01-16"
}
```

**Orchestrator planning step:**
```json
{
  "content_type": "article",
  "plan": [
    {
      "step": 1,
      "agent": "research_agent",
      "why": "Article requires statistics and sourced claims about AI adoption in Brazil",
      "parallel_with": null
    },
    {
      "step": 2,
      "agent": "writer_agent",
      "why": "After research is complete, write the article with factual grounding",
      "depends_on": [1]
    },
    {
      "step": 3,
      "agent": "reviewer_agent",
      "why": "Quality gate before delivery",
      "depends_on": [2]
    }
  ],
  "estimated_total_seconds": 75
}
```

**Execution trace:**
```
[14:23:01] Orchestrator: Dispatching research_agent
           Input: {topic: "AI adoption Brazilian SMBs", depth: "deep", focus: ["statistics", "case studies", "barriers"]}

[14:23:38] research_agent returned (37s):
           Status: success, confidence: 0.87
           Findings: "IDC Brazil 2023: 34% of Brazilian SMBs adopted some form of AI in 2023, up from 12% in 2021..."
           Sources: ["IDC Brazil 2023", "FGV Digital Report", "Sebrae AI Survey"]

[14:23:38] Orchestrator: Research complete. Dispatching writer_agent
           Input: {type: "article", brief: "...", research: "[findings]", tone: "authoritative but accessible", length: "medium"}

[14:24:02] writer_agent returned (24s):
           Status: success, word_count: 642
           Content: "Por Que as PMEs Brasileiras Estão Adotando IA Mais Rápido do que o Esperado..."

[14:24:02] Orchestrator: Draft complete. Dispatching reviewer_agent
           Input: {content: "[draft]", brief: "[original brief]", research: "[findings]", checklist: ["factual accuracy", "SEO keywords", "tone alignment", "length"]}

[14:24:14] reviewer_agent returned (12s):
           Status: success
           approved: false
           score: 68/100
           breakdown: {accuracy: 22, brief_alignment: 18, quality: 20, seo: 8}
           issues: ["Keywords 'IA para PMEs' appear only once (target: 3-4 times)", "Conclusion is abrupt, needs a CTA"]
           suggestions: ["Add keyword naturally in intro and section headers", "Add paragraph with next steps for readers"]

[14:24:14] Orchestrator: Score 68 < 75, below escalation threshold (60). Sending for revision.
           Input to writer_agent: {previous_draft: "...", critique: "...", specific_changes: ["Add keywords", "Expand conclusion"]}

[14:24:31] writer_agent returned (17s) — Round 2:
           Status: success, word_count: 701

[14:24:31] Orchestrator: Dispatching reviewer_agent — Round 2

[14:24:42] reviewer_agent returned (11s) — Round 2:
           approved: true
           score: 84/100
           breakdown: {accuracy: 23, brief_alignment: 22, quality: 22, seo: 17}
           issues: []

[14:24:42] Orchestrator: Approved. Delivering.
           Total time: 101 seconds
           Total cost: $0.031
           Review rounds: 2
```

---

## Failure Scenarios and Responses

### Scenario: Research Agent Fails

```
[14:23:38] research_agent: ERROR — LLM_TIMEOUT (attempt 1 of 3)
[14:23:43] research_agent: ERROR — LLM_TIMEOUT (attempt 2 of 3)
[14:23:48] research_agent: ERROR — LLM_TIMEOUT (attempt 3 of 3)

Orchestrator decision (LENIENT policy):
  → Research failed. Cannot verify facts.
  → Proceeding with writer_agent, flagging as unverified.
  → writer_agent input includes: "research: null — IMPORTANT: No research available. Do not state statistics or specific claims. Write based on general knowledge only."
  → Output tagged: ["unverified_content", "requires_human_fact_check"]
  → Stakeholder notified in output metadata
```

### Scenario: Score < 60 After Round 1

```
reviewer score: 54 — Below escalation threshold

Orchestrator:
  → Do not attempt second revision round
  → Escalate to human with full context:
    {
      "status": "escalated",
      "reason": "Quality score 54/100 after first revision — below acceptable threshold",
      "content_draft": "[best draft so far]",
      "reviewer_critique": "[full critique]",
      "research": "[full research]",
      "human_action_needed": "Review draft, apply critique, approve or revise manually"
    }
  → Assign to content manager queue
  → Set deadline flag based on original deadline
```

---

## Key Lessons From This Example

**1. The orchestrator's prompt is a spec, not a script.**
It defines rules, not procedures. The LLM decides the sequence dynamically — you define the constraints it must honor.

**2. The planner step is worth the extra LLM call.**
Having the orchestrator output its plan before executing makes failures debuggable. You can see what it intended vs. what happened.

**3. Failure policies must be decided upfront.**
LENIENT (continue with degraded output) vs. STRICT (fail the whole pipeline) vs. ESCALATE. This example uses LENIENT for research, ESCALATE for review quality.

**4. The human escalation path is not a fallback — it's a feature.**
The system knows its limits. When it can't reach quality threshold, it doesn't guess — it hands off with full context. This is what makes it trustworthy enough to run autonomously.

**5. Track cost per pipeline, not per call.**
Research: $0.008. Writing: $0.012 × 2 rounds. Review: $0.005 × 2 rounds = $0.031 total.
At 50 pieces/week = $1.55/week for content that took 2 people 2 days. The ROI is obvious.
