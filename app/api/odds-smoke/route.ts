import { NextResponse } from 'next/server';

import { fetchEventsForSport, fetchMarketsForEvent, fetchOddsForEvent, fetchSports } from '@/lib/oddsApi';

// Explicitly mark this route as dynamic so Next.js does not attempt to cache the response.
export const dynamic = 'force-dynamic';

// Run a simple end-to-end call chain against The Odds API to confirm connectivity and payload shapes.
// The endpoint fetches a sport, grabs a sample event, and then requests odds for a handful of markets.
export async function GET(request: Request): Promise<NextResponse> {
  // Keep track of the last successful step so errors can be debugged quickly in server logs.
  const debugContext: Record<string, unknown> = {};

  try {
    // Fail fast if the API key is not configured to avoid wasted requests.
    const apiKey = process.env.THE_ODDS_API_KEY;

    if (!apiKey) {
      return NextResponse.json(
        { error: 'Missing Odds API key. Set THE_ODDS_API_KEY in your environment before running the smoke test.' },
        { status: 400 },
      );
    }

    // Allow callers to control how far into the future to look and how many markets to request,
    // but provide safe defaults so the smoke test works out of the box.
    const url = new URL(request.url);
    const hoursAheadParam = Number.parseInt(url.searchParams.get('hoursAhead') ?? '24', 10);
    const maxMarketsParam = Number.parseInt(url.searchParams.get('maxMarkets') ?? '3', 10);
    const hoursAhead = Number.isFinite(hoursAheadParam) && hoursAheadParam > 0 ? hoursAheadParam : 24;
    const maxMarkets = Number.isFinite(maxMarketsParam) && maxMarketsParam > 0 ? maxMarketsParam : 3;

    debugContext.hoursAhead = hoursAhead;
    debugContext.maxMarkets = maxMarkets;

    // Pull the list of sports to find something active we can test against.
    const sports = await fetchSports(apiKey, { useCache: false });
    const activeSports = sports.filter((sport) => sport.active);

    if (activeSports.length === 0) {
      return NextResponse.json({ error: 'No active sports returned by Odds API.' }, { status: 404 });
    }

    // Use the first active sport as a deterministic choice for the smoke test.
    const primarySport = activeSports[0];
    debugContext.primarySport = { key: primarySport.key, title: primarySport.title };
    console.info(
      `Odds API smoke test using primary sport ${primarySport.key} (${primarySport.title}) with hoursAhead=${hoursAhead} and maxMarkets=${maxMarkets}`,
    );

    // Fetch events occurring soon for the chosen sport so we can drill into one example.
    const events = await fetchEventsForSport(primarySport.key, apiKey, { hoursAhead, useCache: false });
    debugContext.eventsChecked = events.length;
    const sampleEvent = events[0];

    if (!sampleEvent) {
      return NextResponse.json(
        {
          testedAt: new Date().toISOString(),
          primarySport: { key: primarySport.key, title: primarySport.title },
          eventsChecked: 0,
          sampleEvent: null,
          note: `No events found for ${primarySport.key} in the next ${hoursAhead} hours.`,
        },
        { status: 200 },
      );
    }

    // The Odds API can surface team names in multiple fields; normalize to a reliable pair for logging and responses.
    const teamsFromPayload = sampleEvent.teams?.filter((team) => typeof team === 'string' && team.trim().length > 0);
    const teamsFromHomeAway = [sampleEvent.homeTeam, sampleEvent.awayTeam]
      .map((team) => team?.trim())
      .filter((team): team is string => Boolean(team && team.length > 0));
    const normalizedTeams = (() => {
      if (teamsFromPayload && teamsFromPayload.length > 0) {
        return teamsFromPayload;
      }

      if (teamsFromHomeAway.length > 0) {
        if (teamsFromHomeAway.length === 1) {
          const placeholder = teamsFromHomeAway[0] === sampleEvent.homeTeam?.trim() ? 'Away Team' : 'Home Team';
          return [...teamsFromHomeAway, placeholder];
        }

        return teamsFromHomeAway;
      }

      return ['Home Team', 'Away Team'];
    })();

    debugContext.sampleEvent = {
      eventId: sampleEvent.eventId,
      teams: sampleEvent.teams,
      normalizedTeams,
      homeTeam: sampleEvent.homeTeam,
      awayTeam: sampleEvent.awayTeam,
      startTime: sampleEvent.startTime,
    };

    console.info(
      `Odds API smoke test inspecting event ${sampleEvent.eventId} (${normalizedTeams.join(' vs ')}) commencing ${sampleEvent.startTime}`,
    );

    // Request the list of markets to know which ones we can request odds for.
    const markets = await fetchMarketsForEvent(primarySport.key, sampleEvent.eventId, apiKey, { useCache: false });
    console.info(
      `Odds API smoke test fetched ${markets.marketKeys.length} markets for event ${sampleEvent.eventId}; requesting up to ${maxMarkets} in odds snapshot`,
    );
    const selectedMarketKeys = markets.marketKeys.slice(0, maxMarkets);
    debugContext.marketsRequested = selectedMarketKeys;

    console.info(
      `Odds API smoke test requesting odds for event ${sampleEvent.eventId} across markets: ${selectedMarketKeys.join(', ') || 'none available'}`,
    );
    // Pull a small odds snapshot to confirm the API returns data for the event and markets.
    const oddsSnapshot = await fetchOddsForEvent(primarySport.key, sampleEvent.eventId, selectedMarketKeys, apiKey, {
      useCache: false,
      regions: 'us',
    });

    return NextResponse.json(
      {
        testedAt: new Date().toISOString(),
        primarySport: { key: primarySport.key, title: primarySport.title },
        eventsChecked: events.length,
        sampleEvent: {
          eventId: sampleEvent.eventId,
          teams: normalizedTeams,
          startTime: sampleEvent.startTime,
          marketsRequested: selectedMarketKeys,
          totalMarketsAvailable: markets.marketKeys.length,
          odds: oddsSnapshot,
        },
      },
      { status: 200 },
    );
  } catch (error) {
    console.error('Odds API smoke test failed', {
      error: error instanceof Error ? error.message : String(error),
      hint: 'Check debugContext for the last successful step.',
      debugContext,
    });

    return NextResponse.json(
      {
        error: 'Odds API smoke test failed. Check server logs for details.',
      },
      { status: 500 },
    );
  }
}
