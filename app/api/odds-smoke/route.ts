import { NextResponse } from 'next/server';

import { fetchEventsForSport, fetchMarketsForEvent, fetchOddsForEvent, fetchSports } from '@/lib/oddsApi';

export const dynamic = 'force-dynamic';

export async function GET(request: Request): Promise<NextResponse> {
  const debugContext: Record<string, unknown> = {};

  try {
    const apiKey = process.env.THE_ODDS_API_KEY;

    if (!apiKey) {
      return NextResponse.json(
        { error: 'Missing Odds API key. Set THE_ODDS_API_KEY in your environment before running the smoke test.' },
        { status: 400 },
      );
    }

    const url = new URL(request.url);
    const hoursAheadParam = Number.parseInt(url.searchParams.get('hoursAhead') ?? '24', 10);
    const maxMarketsParam = Number.parseInt(url.searchParams.get('maxMarkets') ?? '3', 10);
    const hoursAhead = Number.isFinite(hoursAheadParam) && hoursAheadParam > 0 ? hoursAheadParam : 24;
    const maxMarkets = Number.isFinite(maxMarketsParam) && maxMarketsParam > 0 ? maxMarketsParam : 3;

    debugContext.hoursAhead = hoursAhead;
    debugContext.maxMarkets = maxMarkets;

    const sports = await fetchSports(apiKey, { useCache: false });
    const activeSports = sports.filter((sport) => sport.active);

    if (activeSports.length === 0) {
      return NextResponse.json({ error: 'No active sports returned by Odds API.' }, { status: 404 });
    }

    const primarySport = activeSports[0];
    debugContext.primarySport = { key: primarySport.key, title: primarySport.title };
    console.info(
      `Odds API smoke test using primary sport ${primarySport.key} (${primarySport.title}) with hoursAhead=${hoursAhead} and maxMarkets=${maxMarkets}`,
    );
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

    const markets = await fetchMarketsForEvent(primarySport.key, sampleEvent.eventId, apiKey, { useCache: false });
    console.info(
      `Odds API smoke test fetched ${markets.marketKeys.length} markets for event ${sampleEvent.eventId}; requesting up to ${maxMarkets} in odds snapshot`,
    );
    const selectedMarketKeys = markets.marketKeys.slice(0, maxMarkets);
    debugContext.marketsRequested = selectedMarketKeys;

    console.info(
      `Odds API smoke test requesting odds for event ${sampleEvent.eventId} across markets: ${selectedMarketKeys.join(', ') || 'none available'}`,
    );
    const oddsSnapshot = await fetchOddsForEvent(sampleEvent.eventId, selectedMarketKeys, apiKey, { useCache: false });

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
