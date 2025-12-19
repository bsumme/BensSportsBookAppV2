# Arbitrage Odds App – Basic Setup Task List

This document is a **minimal, repeatable task checklist** to get the project running end‑to‑end.

Use this as a template every time you restart or refactor.

---

## Phase 0 – Repo & Environment

### Task 0.1 – Create Repository
- Create new repo
- Add README with project goal
- Add .gitignore

### Task 0.2 – Environment Setup
- Choose runtime (Node / Python)
- Add dotenv support
- Store API key securely

---

## Phase 1 – API Connectivity

### Task 1.1 – Fetch Sports
**Input:** API key
**Output:** List of sport keys

Checklist:
- Call GET /v4/sports
- Log count of sports
- Cache response

---

### Task 1.2 – Fetch Events
**Input:** sport_key
**Output:** List of active events

Checklist:
- Call GET /v4/sports/{sport}/events
- Store event_id, teams, start_time
- Filter to next 48 hours

---

### Task 1.3 – Fetch Event Markets
**Input:** event_id
**Output:** List of market keys

Checklist:
- Call GET /events/{event_id}/markets
- Log available markets
- Store per event

---

### Task 1.4 – Fetch Event Odds
**Input:** event_id + markets
**Output:** Raw odds JSON

Checklist:
- Call GET /events/{event_id}/odds
- Attach timestamp
- Store raw response

---

## Phase 2 – Normalization

### Task 2.1 – Normalize Bookmakers
- Create canonical book list
- Map API keys → internal names

---

### Task 2.2 – Normalize Markets
- Define supported markets
- Enforce two‑outcome only
- Match line values exactly

---

### Task 2.3 – Normalize Outcomes
- Convert odds to decimal
- Attach polarity (home/away, over/under)

---

## Phase 3 – Arbitrage Engine

### Task 3.1 – Group Comparable Bets
- Group by event + market + line
- Separate by bookmaker

---

### Task 3.2 – Compute Arbitrage
**Formula:**
```
margin = 1 - (1/oddsA + 1/oddsB)
```

Checklist:
- Ignore negative margins
- Store positive arbs

---

### Task 3.3 – Stake Calculation
- Compute proportional stakes
- Assume fixed bankroll (e.g. $100)

---

## Phase 4 – Storage & Refresh

### Task 4.1 – In‑Memory Store
- Store latest odds snapshot
- Store arbitrage results

---

### Task 4.2 – Refresh Loop
- Poll active events only
- Respect update intervals
- Track last refresh per event

---

## Phase 5 – API Layer

### Task 5.1 – Expose Arbitrage Endpoint
```
GET /api/arbs
```

Filters:
- sport
- market
- minMargin

---

## Phase 6 – UI

### Task 6.1 – Basic Table View
- Event
- Market
- Books
- Odds
- Margin %

---

## Phase 7 – Validation

### Task 7.1 – Sanity Checks
- Same line value on both sides
- Opposite outcomes only
- Odds freshness < threshold

---

## Phase 8 – Logging & Debugging

### Task 8.1 – Debug Mode
- Enable verbose logs
- One‑line summaries per fetch

---

## Phase 9 – Hardening

### Task 9.1 – Quota Protection
- Cache aggressively
- Avoid sport‑level odds refresh

---

## Final Output

At completion, you should have:
- Deterministic arb detection
- Minimal quota usage
- Clear upgrade path

---

This checklist is intentionally boring — boring means reliable.

