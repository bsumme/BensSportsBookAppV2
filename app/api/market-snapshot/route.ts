import { NextResponse } from 'next/server';

import { createMarketSnapshot } from '@/lib/marketSnapshot';
import { MarketSnapshotOptions } from '@/lib/types/snapshot';

export const dynamic = 'force-dynamic';

function parsePositiveInt(value: string | null, fallback: number): number {
  const parsed = Number.parseInt(value ?? '', 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

export async function GET(request: Request): Promise<NextResponse> {
  const apiKey = process.env.THE_ODDS_API_KEY;

  if (!apiKey) {
    return NextResponse.json(
      { error: 'Missing Odds API key. Set THE_ODDS_API_KEY in your environment before running the snapshot.' },
      { status: 400 },
    );
  }

  try {
    const url = new URL(request.url);
    const options: MarketSnapshotOptions = {
      hoursAhead: parsePositiveInt(url.searchParams.get('hoursAhead'), 48),
      maxSports: parsePositiveInt(url.searchParams.get('maxSports'), 3),
      maxEventsPerSport: parsePositiveInt(url.searchParams.get('maxEventsPerSport'), 10),
      regions: url.searchParams.get('regions') ?? 'us',
      useCache: false,
    };

    const snapshot = await createMarketSnapshot(options, apiKey);

    return NextResponse.json(snapshot, { status: 200 });
  } catch (error) {
    console.error('Market snapshot generation failed', {
      error: error instanceof Error ? error.message : String(error),
    });

    return NextResponse.json({ error: 'Market snapshot failed. Check server logs for details.' }, { status: 500 });
  }
}
