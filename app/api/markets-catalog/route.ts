import { NextResponse } from 'next/server';

import { fetchMarketsForEvent } from '@/lib/oddsApi';
import { MARKET_CATALOG_LOG_FILENAME, writeMarketCatalogLog } from '@/lib/marketsLogger';

export const dynamic = 'force-dynamic';

export async function GET(request: Request): Promise<NextResponse> {
  const apiKey = process.env.THE_ODDS_API_KEY;

  if (!apiKey) {
    return NextResponse.json(
      { error: 'Missing Odds API key. Set THE_ODDS_API_KEY in your environment before logging markets.' },
      { status: 400 },
    );
  }

  const url = new URL(request.url);
  const sportKey = url.searchParams.get('sportKey')?.trim();
  const eventId = url.searchParams.get('eventId')?.trim();
  const regions = url.searchParams.get('regions')?.trim() || 'us';
  const bookmakers = (url.searchParams.get('bookmakers') || '')
    .split(',')
    .map((bookmaker) => bookmaker.trim())
    .filter((bookmaker) => bookmaker.length > 0);
  const useCache = url.searchParams.get('useCache') === 'true';

  if (!sportKey || !eventId) {
    return NextResponse.json(
      { error: 'Both sportKey and eventId are required to generate a market catalog log.' },
      { status: 400 },
    );
  }

  try {
    const markets = await fetchMarketsForEvent(sportKey, eventId, apiKey, { regions, bookmakers, useCache });
    const bookmakerDescription = bookmakers.length > 0 ? `, bookmakers=${bookmakers.join(',')}` : '';
    const { catalog, logPath } = await writeMarketCatalogLog(markets.rawMarkets, {
      sourceDescription: `Markets for sport ${sportKey} event ${eventId} (regions=${regions}${bookmakerDescription})`,
    });
    const coreMarketCount = catalog.filter((market) => market.source === 'core').length;
    const additionalMarketCount = catalog.filter((market) => market.source === 'additional').length;

    return NextResponse.json(
      {
        generatedAt: new Date().toISOString(),
        sportKey,
        eventId,
        regions,
        bookmakers,
        totalMarkets: catalog.length,
        coreMarkets: coreMarketCount,
        additionalMarkets: additionalMarketCount,
        logFile: MARKET_CATALOG_LOG_FILENAME,
        logPath,
      },
      { status: 200 },
    );
  } catch (error) {
    console.error('Failed to generate market catalog log', {
      error: error instanceof Error ? error.message : String(error),
      sportKey,
      eventId,
      regions,
      bookmakers,
      useCache,
    });

    return NextResponse.json(
      { error: 'Failed to generate market catalog log. Check server logs for details.' },
      { status: 500 },
    );
  }
}
