import { NextResponse } from 'next/server';

import { DEFAULT_SNAPSHOT_REGIONS } from '@/lib/data/bookmakers';
import { createTeamNamesSnapshot } from '@/lib/nameSnapshots';
import { MarketSnapshotOptions } from '@/lib/types/snapshot';

export const dynamic = 'force-dynamic';

function parsePositiveInt(value: string | null, fallback: number): number {
  const parsed = Number.parseInt(value ?? '', 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function parseBooleanFlag(value: string | null, fallback: boolean): boolean {
  if (value === null) {
    return fallback;
  }

  if (value.toLowerCase() === 'true') {
    return true;
  }

  if (value.toLowerCase() === 'false') {
    return false;
  }

  return fallback;
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
    const useCache = parseBooleanFlag(url.searchParams.get('useCache'), false);
    const options: MarketSnapshotOptions = {
      hoursAhead: parsePositiveInt(url.searchParams.get('hoursAhead'), 48),
      maxSports: parsePositiveInt(url.searchParams.get('maxSports'), 3),
      maxEventsPerSport: parsePositiveInt(url.searchParams.get('maxEventsPerSport'), 10),
      regions: url.searchParams.get('regions') ?? DEFAULT_SNAPSHOT_REGIONS.join(','),
      bookmakers: url
        .searchParams
        .get('bookmakers')
        ?.split(',')
        .map((bookmaker) => bookmaker.trim())
        .filter((bookmaker) => bookmaker.length > 0),
      useCache,
    };

    const snapshot = await createTeamNamesSnapshot(options, apiKey);

    return NextResponse.json(
      {
        capturedAt: snapshot.capturedAt,
        sportsChecked: snapshot.sportsChecked,
        eventsCaptured: snapshot.eventsCaptured,
        teamsBySport: snapshot.teamsBySport,
        options: snapshot.options,
        warnings: snapshot.warnings,
      },
      { status: 200 },
    );
  } catch (error) {
    console.error('Team names snapshot generation failed', {
      error: error instanceof Error ? error.message : String(error),
    });

    return NextResponse.json({ error: 'Team names snapshot failed. Check server logs for details.' }, { status: 500 });
  }
}
