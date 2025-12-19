import { NextResponse } from 'next/server';

import { fetchEventsForSport, fetchMarketsForEvent, fetchOddsForEvent, fetchSports } from '@/lib/oddsApi';

export const dynamic = 'force-dynamic';

export async function GET(request: Request): Promise<NextResponse> {
  try {
    const apiKey = process.env.ODDS_API_KEY;

    if (!apiKey) {
      return NextResponse.json(
        { error: 'Missing Odds API key. Set ODDS_API_KEY in your environment before running the smoke test.' },
        { status: 400 },
      );
    }

    const url = new URL(request.url);
    const hoursAheadParam = Number.parseInt(url.searchParams.get('hoursAhead') ?? '24', 10);
    const maxMarketsParam = Number.parseInt(url.searchParams.get('maxMarkets') ?? '3', 10);
    const hoursAhead = Number.isFinite(hoursAheadParam) && hoursAheadParam > 0 ? hoursAheadParam : 24;
    const maxMarkets = Number.isFinite(maxMarketsParam) && maxMarketsParam > 0 ? maxMarketsParam : 3;

    const sports = await fetchSports(apiKey, { useCache: false });
    const activeSports = sports.filter((sport) => sport.active);

    if (activeSports.length === 0) {
      return NextResponse.json({ error: 'No active sports returned by Odds API.' }, { status: 404 });
    }

    const primarySport = activeSports[0];
    const events = await fetchEventsForSport(primarySport.key, apiKey, { hoursAhead, useCache: false });
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

    const markets = await fetchMarketsForEvent(sampleEvent.eventId, apiKey, { useCache: false });
    const selectedMarketKeys = markets.marketKeys.slice(0, maxMarkets);
    const oddsSnapshot = await fetchOddsForEvent(sampleEvent.eventId, selectedMarketKeys, apiKey, { useCache: false });

    return NextResponse.json(
      {
        testedAt: new Date().toISOString(),
        primarySport: { key: primarySport.key, title: primarySport.title },
        eventsChecked: events.length,
        sampleEvent: {
          eventId: sampleEvent.eventId,
          teams: sampleEvent.teams,
          startTime: sampleEvent.startTime,
          marketsRequested: selectedMarketKeys,
          totalMarketsAvailable: markets.marketKeys.length,
          odds: oddsSnapshot,
        },
      },
      { status: 200 },
    );
  } catch (error) {
    console.error('Odds API smoke test failed', error);

    return NextResponse.json(
      { error: 'Odds API smoke test failed. Check server logs for details.' },
      { status: 500 },
    );
  }
}
