import { NextResponse } from 'next/server';

import { fetchEventsForSport, fetchMarketsForEvent, fetchSports, getOddsApiKey } from '@/lib/oddsApi';

export const dynamic = 'force-dynamic';

interface MarketAggregate {
  sports: Set<string>;
  bookmakers: Set<string>;
  eventIds: Set<string>;
}

function parsePositiveInt(value: string | null, defaultValue: number): number {
  const parsed = Number(value);

  if (Number.isFinite(parsed) && parsed > 0) {
    return parsed;
  }

  return defaultValue;
}

const DEFAULT_BOOKMAKERS = ['fanduel', 'draftkings', 'novig'];
const DEFAULT_REGIONS = 'us,us_ex';
const DEFAULT_MAX_SPORTS = 1;
const DEFAULT_MAX_EVENTS_PER_SPORT = 3;

export async function GET(request: Request): Promise<NextResponse> {
  const url = new URL(request.url);
  const dangerousFlag = url.searchParams.get('dangerous');

  if (dangerousFlag !== 'true') {
    return NextResponse.json(
      {
        error:
          'The market catalog crawl is intentionally disabled by default. Pass dangerous=true to acknowledge the API quota cost.',
      },
      { status: 400 },
    );
  }

  let apiKey: string;

  try {
    apiKey = getOddsApiKey();
  } catch (error) {
    return NextResponse.json({ error: (error as Error).message }, { status: 400 });
  }

  const sportsParam = url.searchParams.get('sports') ?? 'all';
  const sportsFilter = sportsParam === 'all'
    ? []
    : sportsParam
        .split(',')
        .map((sportKey) => sportKey.trim())
        .filter((sportKey) => sportKey.length > 0);
  const maxSports = parsePositiveInt(url.searchParams.get('maxSports'), DEFAULT_MAX_SPORTS);
  const maxEventsPerSport = parsePositiveInt(
    url.searchParams.get('maxEventsPerSport'),
    DEFAULT_MAX_EVENTS_PER_SPORT,
  );
  const parsedBookmakers = (url.searchParams.get('bookmakers') ?? DEFAULT_BOOKMAKERS.join(','))
    .split(',')
    .map((bookmaker) => bookmaker.trim())
    .filter((bookmaker) => bookmaker.length > 0);
  const bookmakers = parsedBookmakers.length > 0 ? parsedBookmakers : DEFAULT_BOOKMAKERS;
  const regions = url.searchParams.get('regions') ?? DEFAULT_REGIONS;

  console.warn(
    '[market-catalog] Dangerous full catalog crawl requested. This call is quota-expensive and should only run on-demand.',
    {
      sportsParam,
      maxSports,
      maxEventsPerSport,
      bookmakers,
      regions,
    },
  );

  try {
    const allSports = await fetchSports(apiKey, { useCache: true });
    const activeSports = allSports.filter((sport) => sport.active);
    const requestedSports = sportsParam === 'all'
      ? activeSports
      : activeSports.filter((sport) => sportsFilter.includes(sport.key));
    const scopedSports = requestedSports.slice(0, maxSports);

    if (scopedSports.length === 0) {
      return NextResponse.json(
        { error: 'No active sports matched the request. Adjust the sports filter or try again later.' },
        { status: 404 },
      );
    }

    console.info(
      `[market-catalog] Scanning ${scopedSports.length} sports (requested=${requestedSports.length}, active=${activeSports.length})`,
    );

    const catalog = new Map<string, MarketAggregate>();
    let eventsScanned = 0;

    for (const sport of scopedSports) {
      const events = await fetchEventsForSport(sport.key, apiKey, { useCache: true });
      const sortedEvents = events.sort((left, right) => left.startTime.localeCompare(right.startTime));
      const scopedEvents = sortedEvents.slice(0, maxEventsPerSport);

      console.info(
        `[market-catalog] Scanning ${scopedEvents.length} upcoming events for sport ${sport.key} (requested=${events.length})`,
      );

      for (const event of scopedEvents) {
        const markets = await fetchMarketsForEvent(sport.key, event.eventId, apiKey, {
          regions,
          bookmakers,
          useCache: false,
        });

        eventsScanned += 1;

        const marketAggregateUpdates = markets.bookmakerMarkets?.length
          ? markets.bookmakerMarkets.flatMap((bookmaker) =>
              (bookmaker.markets ?? []).map((market) => ({
                marketKey: market.key,
                bookmakerKey: bookmaker.key,
              })),
            )
          : markets.marketKeys.map((marketKey) => ({ marketKey, bookmakerKey: undefined }));

        marketAggregateUpdates.forEach(({ marketKey, bookmakerKey }) => {
          if (!marketKey) {
            return;
          }

          if (!catalog.has(marketKey)) {
            catalog.set(marketKey, {
              sports: new Set<string>(),
              bookmakers: new Set<string>(),
              eventIds: new Set<string>(),
            });
          }

          const entry = catalog.get(marketKey)!;
          entry.sports.add(sport.key);
          entry.eventIds.add(event.eventId);

          if (bookmakerKey) {
            entry.bookmakers.add(bookmakerKey);
          } else {
            bookmakers.forEach((bookmaker) => entry.bookmakers.add(bookmaker));
          }
        });
      }
    }

    const markets = Object.fromEntries(
      Array.from(catalog.entries()).map(([marketKey, aggregate]) => [
        marketKey,
        {
          sports: Array.from(aggregate.sports).sort(),
          bookmakers: Array.from(aggregate.bookmakers).sort(),
          eventCount: aggregate.eventIds.size,
        },
      ]),
    );

    const responseBody = {
      generatedAt: new Date().toISOString(),
      bookmakers,
      sportsScanned: scopedSports.length,
      eventsScanned,
      markets,
      warning:
        'This endpoint performs a full snapshot-style crawl of the Odds API for schema discovery. Use sparingly to conserve quota.',
    };

    console.info(
      `[market-catalog] Completed crawl: sports=${responseBody.sportsScanned}, events=${responseBody.eventsScanned}, markets=${Object.keys(markets).length}`,
    );

    return NextResponse.json(responseBody, { status: 200 });
  } catch (error) {
    console.error('[market-catalog] Catalog crawl failed', {
      error: error instanceof Error ? error.message : String(error),
      sportsParam,
      maxSports,
      maxEventsPerSport,
      bookmakers,
      regions,
    });

    return NextResponse.json(
      { error: 'Failed to build market catalog. Check server logs for details and use sparingly due to quota cost.' },
      { status: 500 },
    );
  }
}
