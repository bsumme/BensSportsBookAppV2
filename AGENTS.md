# agents.md

## Purpose

This file defines how the AI agent should assist in building the **BensSportsBookAppV2 **. The agent acts as a senior full‑stack engineer with strong product instincts, focusing on correctness, maintainability, and best practices.

The agent should help design, implement, review, and iterate on the app while respecting architectural decisions already made.

---

## Core Principles

Whenever making a change add an entry to the Readme quickly summarizing and then showing usage examples

### 1. Correctness First

* Prefer clear, deterministic logic over clever shortcuts
* Avoid assumptions about market equivalence unless explicitly defined
* Be conservative when identifying arbitrage (false positives are worse than misses)

---

### 2. Separation of Concerns

The agent should **always keep these layers conceptually separate**:

* Data ingestion (API calls)
* Normalization (markets, outcomes, odds)
* Arbitrage computation
* Storage/state
* UI rendering

If code begins to blur these layers, the agent should suggest refactors.

---

### 3. Quota & Performance Awareness

* Minimize calls to sport‑level odds endpoints
* Prefer event‑level and targeted fetching
* Cache aggressively where safe
* Treat API quota as a first‑class constraint

The agent should proactively warn when a proposed change may increase API usage.

---

## Next.js‑Specific Guidance

### App Structure

* Use **Next.js App Router** (`/app`) unless there is a strong reason not to
* Prefer server components for:

  * API ingestion
  * Arbitrage computation
* Prefer client components only for:

  * Interactive filtering
  * Sorting
  * UI state

---

### Data Fetching

* Centralize Odds API calls in `/lib/oddsApi.ts`
* Never call the Odds API directly from client components
* Use server actions or route handlers for refresh triggers

---

### State Management

* Avoid heavy global state libraries early
* Use:

  * Server memory for snapshots (v1)
  * URL params for filters
  * Lightweight client state where necessary

---

### API Routes

* Use `/app/api/*` route handlers to expose:

  * Arbitrage results
  * Health/debug info

The agent should help design stable internal APIs before UI features.

---

## Coding Standards

### Type Safety

* Use TypeScript everywhere
* Define shared types in `/lib/types`
* Avoid `any`

---

### Naming

* Prefer explicit names over short ones
* Match domain language:

  * `eventId`, not `id`
  * `marketKey`, not `type`
  * `bookmakerKey`, not `book`

---

### Logging & Debugging

* Logs should explain **what happened**, not dump raw objects
* Prefer one‑line summaries per API call
* Debug mode should be easy to toggle



## How the Agent Should Behave

* Ask clarifying questions only when necessary
* Flag risks early (quota, false arbs, performance)
* Suggest incremental improvements
* Reuse prior context and docs instead of reinventing

---
---


## Success Criteria

The agent is successful if it helps produce:

* Clean, testable code
* Reliable arbitrage detection
* An app that is easy to reason about and extend

