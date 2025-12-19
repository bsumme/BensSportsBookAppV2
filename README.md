# BensSportsBookAppV2

Odds research web app, arbitrage bet searching.

## Getting Started

1. Install dependencies (requires access to the npm registry):

   ```bash
   npm install
   ```

2. Run the development server on port 8000 and listen on all interfaces (for web and mobile access):

   ```bash
   npm run dev
   ```

Visit [http://localhost:8000](http://localhost:8000) to view the homepage.

## Odds API setup

Set your [The Odds API](https://the-odds-api.com/) key before making server-side requests:

```bash
export THE_ODDS_API_KEY=your_api_key_here
```

The `lib/oddsApi.ts` helper centralizes all API connectivity:

- `fetchSports` retrieves and caches available sports, logging the total count.
- `fetchEventsForSport` returns upcoming events (default next 48 hours) with `eventId`, `teams`, and `startTime`.
- `fetchMarketsForEvent` lists available markets per event and requires the sport key to scope the request.
- `fetchOddsForEvent` fetches raw odds JSON for a sport-scoped event, honoring requested markets and regions, and stamps it
  with the fetch time.

> **Note on market endpoints:** The Odds API only serves market discovery on sport-scoped routes. Calls to sport-agnostic
> endpoints such as `/v4/events/{event_id}/markets` return 404s. Always include the sport key in the path,
> e.g. use `/v4/sports/{sport_key}/events/{event_id}/markets` (correct) instead of `/v4/events/{event_id}/markets`
> (incorrect). This constraint is intentionally enforced in code to prevent regressions.

## Odds API smoke test

Run a quick, server-side smoke test to see the JSON we currently receive from The Odds API. With `THE_ODDS_API_KEY` set
and the dev server running, hit the new route handler:

```bash
curl "http://localhost:8000/api/odds-smoke?hoursAhead=24&maxMarkets=3"
```

The response summarizes the first active sport returned by the API, the number of upcoming events within the specified
window, and (when available) a sample event with the requested markets and their raw odds payload.

## Market snapshot logging

Generate a one-time snapshot that enumerates active sports, near-term events, available markets, and their raw odds. The
route writes a human-readable log (`LatestSnapshotMarket.log`) in the project root and returns the structured snapshot as
JSON.

1. Ensure `THE_ODDS_API_KEY` is set (see "Odds API setup" above) and the dev server is running.
2. Trigger the snapshot via the API route:

   ```bash
   curl "http://localhost:8000/api/market-snapshot?hoursAhead=48&maxSports=3&maxEventsPerSport=10&regions=us"
   ```

3. Inspect `LatestSnapshotMarket.log` in the repository root for a readable summary of the captured sports, events,
   markets, and odds payloads. Each run overwrites the previous snapshot.

Query parameters allow quick scoping when testing:

- `hoursAhead` (default `48`): how far into the future to look for events.
- `maxSports` (default `3`): maximum number of active sports to include.
- `maxEventsPerSport` (default `10`): limit of events inspected per sport.
- `regions` (default `us`): Odds API regions filter used for markets and odds.
- `useCache` is disabled for snapshots to force fresh data.

## Market catalog logging

Create a point-in-time log of the markets available for a specific event by hitting the new route handler. The endpoint
merges the core Odds API markets with any additional markets discovered for the given event, writes them to
`LatestMarketsCatalog.log` in the project root, and returns a JSON summary.

1. Ensure `THE_ODDS_API_KEY` is set and the dev server is running.
2. Provide a `sportKey` and `eventId` (you can grab both from a previous `/api/market-snapshot` run or the Odds API
   dashboard) and trigger the logger:

   ```bash
   curl "http://localhost:8000/api/markets-catalog?sportKey=soccer_epl&eventId=sample-event-id&regions=us"
   ```

3. Inspect `LatestMarketsCatalog.log` for the merged list of markets. Each run overwrites the previous log so the file
   always reflects the most recent request.

## Full market catalog crawl (dangerous)

Enumerate every market currently exposed by FanDuel, DraftKings, and Novig across active sports. This route issues a
sport list call, then walks upcoming events per sport, and finally fetches available markets per event. The crawl is
**quota-expensive** and must be explicitly opted into with `dangerous=true`; it will never run automatically.

Example (safe defaults limit to 1 sport and 3 events per sport):

```bash
curl "http://localhost:8000/api/market-catalog?dangerous=true"
```

Helpful query parameters:

- `sports` (default `all`): comma-separated sport keys. Use this to restrict the crawl to a single sport when possible.
- `maxSports` (default `1`): caps the number of sports included. Defaults to 1 to avoid runaway usage.
- `maxEventsPerSport` (default `3`): limits how many upcoming events are inspected per sport.
- `bookmakers` (default `fanduel,draftkings,novig`): bookmaker keys passed to the Odds API.
- `regions` (default `us,us_ex`): regions forwarded to the Odds API market endpoint.
- `dangerous` (required, must be `true`): acknowledges the quota cost and allows the crawl to run.

The JSON response groups discovered markets by key and lists which sports and bookmakers expose each market along with a
count of how many events surfaced it. Use this only for schema discovery and debugging—not for production odds polling.
