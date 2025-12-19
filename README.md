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

## Sport, team, and player name snapshots

Capture the string identifiers needed for your data schema without pulling full odds payloads. Three lightweight routes
mirror the market snapshot controls but focus on names only:

- `/api/sport-names-snapshot`: returns active sports with their titles, groups, and description metadata.
- `/api/team-names-snapshot`: walks upcoming events per sport and aggregates the participating team names.
- `/api/player-names-snapshot`: inspects market outcome names (handy for player props) to seed a player/participant catalog.

Each route mirrors the market snapshot logging flow and writes a human-readable log to the project root:

- `LatestSnapshotSportNames.log` for sport metadata
- `LatestSnapshotTeamNames.log` for collected team names
- `LatestSnapshotPlayerNames.log` for discovered player-like outcome names

Each route accepts the familiar snapshot parameters:

- `hoursAhead` (default `48`): event lookahead window for team/player discovery.
- `maxSports` (default `3`) and `maxEventsPerSport` (default `10`): scope how many sports/events are scanned.
- `regions` (default `us,us_ex`) and `bookmakers` (default `draftkings,fanduel,novig`): forwarded to the Odds API when
  markets are involved (player lookup).
- `useCache` (default `false`): flip to `true` if you are iterating locally and want to re-use the last Odds API
  responses.

Example calls (with `THE_ODDS_API_KEY` set and the dev server running):

```bash
curl "http://localhost:8000/api/sport-names-snapshot?maxSports=5"
curl "http://localhost:8000/api/team-names-snapshot?hoursAhead=24&maxEventsPerSport=3"
curl "http://localhost:8000/api/player-names-snapshot?hoursAhead=12&bookmakers=draftkings,fanduel&regions=us"

# Inspect the latest logs after a run
cat LatestSnapshotSportNames.log
cat LatestSnapshotTeamNames.log
cat LatestSnapshotPlayerNames.log
```

## Event markets logging

Create a point-in-time log of the markets available for a specific event by hitting the new route handler. The endpoint
merges the core Odds API markets with any additional markets discovered for the given event, writes them to
`LatestMarketsCatalog.log` in the project root, and returns a JSON summary.

1. Ensure `THE_ODDS_API_KEY` is set and the dev server is running.
2. Provide a `sportKey` and `eventId` (you can grab both from a previous `/api/market-snapshot` run or the Odds API
   dashboard) and trigger the logger:

   ```bash
   curl "http://localhost:8000/api/event-markets-log?sportKey=soccer_epl&eventId=sample-event-id&regions=us"
   ```

3. Inspect `LatestMarketsCatalog.log` for the merged list of markets. Each run overwrites the previous log so the file
   always reflects the most recent request.

## Markets discovery crawl (dangerous)

Enumerate every market currently exposed by FanDuel, DraftKings, and Novig across active sports. This route issues a
sport list call, then walks upcoming events per sport, and finally fetches available markets per event. The crawl is
**quota-expensive** and must be explicitly opted into with `dangerous=true`; it will never run automatically.

Example (safe defaults limit to 1 sport and 3 events per sport):

```bash
curl "http://localhost:8000/api/markets-discovery?dangerous=true"
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

## Schema-building playbook (markets, bookmakers, regions, arbitrage safety)

Use the existing routes together to incrementally build and validate your market schema while keeping API usage predictable:

1. **Smoke test connectivity before every schema run**

   Verify your Odds API key and event/market payloads are still healthy. This helps catch upstream outages before expensive
   crawls:

   ```bash
   curl "http://localhost:8000/api/odds-smoke?hoursAhead=24&maxMarkets=3"
   ```

   The response shows the chosen sport, a sample event, and the markets requested for odds, proving the pipeline works.

2. **Capture a sport-scoped snapshot with bookmaker and region filters**

   Establish a baseline catalog that ties markets to specific bookmakers and regions while keeping quota under control. The
   snapshot writes `LatestSnapshotMarket.log` for auditing:

   ```bash
   curl "http://localhost:8000/api/market-snapshot?hoursAhead=24&maxSports=2&maxEventsPerSport=5&regions=us,us_ex&bookmakers=fanduel,draftkings"
   ```

   Use the response (and log) to seed your schema with the market keys actually exposed per bookmaker/region combination.

3. **Drill into individual events to reconcile additional markets**

   When you see mismatches or missing markets, pull a focused log for a specific event. This merges core and additional
   markets and records the merged catalog in `LatestMarketsCatalog.log`:

   ```bash
   curl "http://localhost:8000/api/event-markets-log?sportKey=soccer_epl&eventId=example-event-id&regions=us&bookmakers=novig"
   ```

   Compare the additional markets against your schema and update per-bookmaker coverage as needed.

4. **Run the dangerous full crawl only when you need exhaustive coverage**

   For a complete market-to-sport-to-bookmaker map, run the discovery crawl with explicit acknowledgment. Keep the scope as
   narrow as possible (sport filter, event limits, bookmaker/region selection) to avoid quota blowups:

   ```bash
   curl "http://localhost:8000/api/markets-discovery?dangerous=true&sports=basketball_nba&maxSports=1&maxEventsPerSport=2&bookmakers=fanduel,draftkings&regions=us"
   ```

## All-in-one seed data capture (PowerShell)

Run every snapshot route plus the full markets discovery crawl in one pass and capture the combined JSON output in
`All_Seed_Data.log`. The script defaults to aggressive parameters (wide hours ahead, very high sport/event caps, all documented
bookmakers, and all U.S. regions) so it can be executed once and parsed for seeding.

1. Ensure the dev server is running on port 8000 with `THE_ODDS_API_KEY` set.
2. Execute the script with PowerShell (`pwsh` works cross-platform). `-BaseUrl` must be a fully qualified URL (including
   `http://` or `https://` and a hostname). The script trims surrounding whitespace and throws a descriptive error if the
   value is not a valid HTTP/HTTPS URI:

   ```bash
   pwsh ./generate_All_seed_data.ps1 \
     -BaseUrl "http://localhost:8000" \
     -HoursAhead 168 \
     -MaxSports 1000 \
     -MaxEventsPerSport 500 \
     -Regions "us,us2,us_dfs,us_ex" \
     -Bookmakers "betonlineag,betmgm,betrivers,betus,bovada,williamhill_us,draftkings,fanatics,fanduel,lowvig,mybookieag,ballybet,betanysports,betparx,espnbet,fliff,hardrockbet,rebet,betr_us_dfs,pick6,prizepicks,underdog,betopenly,kalshi,novig,prophetx" \
     -LogPath "./All_Seed_Data.log"
   ```

The log records each request URI, the full JSON response, and any errors without overwriting your per-endpoint logs. Use the
parameters to reduce scope when running against a limited quota.

   The response shows which markets appear for which bookmakers and how many events surfaced each market—ideal for filling
   gaps in your schema.

5. **Arbitrage safety checks**

   * Prefer the targeted snapshot and event logs for day-to-day schema work; reserve the full crawl for periodic audits.
   * Scope regions and bookmakers tightly when exploring new markets to avoid over-attributing coverage.
   * Keep `hoursAhead`, `maxSports`, and `maxEventsPerSport` small unless you are deliberately stress-testing coverage.
   * Treat every crawl as quota-costly—avoid running concurrent discovery calls and delete stale results instead of
     rerunning immediately.
