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
export ODDS_API_KEY=your_api_key_here
```

The `lib/oddsApi.ts` helper centralizes all API connectivity:

- `fetchSports` retrieves and caches available sports, logging the total count.
- `fetchEventsForSport` returns upcoming events (default next 48 hours) with `eventId`, `teams`, and `startTime`.
- `fetchMarketsForEvent` lists available markets per event.
- `fetchOddsForEvent` fetches raw odds JSON for specific markets and stamps it with the fetch time.
