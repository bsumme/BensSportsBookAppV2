# Arbitrage Odds Web App – System Design Document

## 1. Purpose
Design a web application that ingests sports odds from The Odds API, normalizes markets across sportsbooks, detects arbitrage opportunities, and presents them in a clear UI.

The system prioritizes:
- Correctness over speed
- Quota-efficient API usage
- Deterministic, explainable arbitrage logic

---

## 2. Goals & Non‑Goals

### Goals
- Detect true arbitrage opportunities across sportsbooks
- Support moneylines, spreads, totals, and player props
- Use snapshot-based odds analysis
- Scale to multiple sports without rewriting logic

### Non‑Goals (v1)
- Automated betting execution
- Live in-play arbitrage
- User accounts or authentication
- Advanced predictive modeling

---

## 3. High‑Level Architecture

```
[ The Odds API ]
        ↓
[ Ingestion Layer ]
        ↓
[ Normalization Layer ]
        ↓
[ Arbitrage Engine ]
        ↓
[ API / State Store ]
        ↓
[ Web UI ]
```

---

## 4. Data Flow

### Startup Flow
1. Fetch sports list (cached)
2. Fetch active events per sport
3. Select events within time window (e.g. next 24–48h)
4. Discover markets per event
5. Fetch event odds (targeted)
6. Store snapshot in memory

### Refresh Flow
- Periodically refresh odds for active events only
- Recompute arbitrage on each refresh

---

## 5. Core Services

### 5.1 Ingestion Service
**Responsibilities**
- Call Odds API endpoints
- Handle rate limits & retries
- Attach timestamps to all responses

**Endpoints Used**
- GET /v4/sports
- GET /v4/sports/{sport}/events
- GET /v4/sports/{sport}/events/{event_id}/markets
- GET /v4/sports/{sport}/events/{event_id}/odds

---

### 5.2 Normalization Service
**Responsibilities**
- Normalize team names, players, and books
- Normalize markets (h2h, spreads, totals, props)
- Enforce identical line + outcome pairing

**Key Output**
```
NormalizedMarket {
  event_id
  market_type
  side
  line
  bookmaker
  odds
}
```

---

### 5.3 Arbitrage Engine
**Responsibilities**
- Group normalized markets
- Identify opposing outcomes
- Calculate implied probability
- Compute arbitrage margin

**Formula**
```
margin = 1 - (1/oddsA + 1/oddsB)
```

Only positive margins qualify.

---

### 5.4 State Store
**Responsibilities**
- Hold latest odds snapshot
- Hold computed arbitrage results
- Track last update per bookmaker

**Implementation (v1)**
- In‑memory store (Map / dict)

---

### 5.5 Web API Layer
**Responsibilities**
- Expose arbitrage results
- Filter by sport, market, margin

Example endpoints:
- GET /api/arbs
- GET /api/arbs?minMargin=0.5

---

### 5.6 Frontend UI
**Responsibilities**
- Display arbitrage table
- Sort/filter opportunities
- Show timestamps & books

---

## 6. Data Models (Simplified)

### Event
```
{
  id
  sport
  start_time
  teams[]
}
```

### OddsOutcome
```
{
  event_id
  market
  side
  line
  bookmaker
  odds
  timestamp
}
```

### ArbitrageOpportunity
```
{
  event_id
  market
  sideA
  sideB
  stakeSplit
  margin
}
```

---

## 7. Constraints & Risks

- API quota limits
- Market mismatch across books
- Odds staleness
- False arbs from line mismatch

---

## 8. V1 Scope Summary

✅ Sport‑level odds ingestion
✅ Two‑outcome markets only
✅ Snapshot-based arbitrage
✅ Read‑only UI

---

## 9. Future Extensions
- Historical line movement
- Alerts / notifications
- Exchange arbitrage
- User-configurable bankroll

