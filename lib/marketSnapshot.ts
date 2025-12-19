import fs from 'fs/promises';
import path from 'path';

import { fetchEventsForSport, fetchMarketsForEvent, fetchOddsForEvent, fetchSports, getOddsApiKey } from './oddsApi';
import { DEFAULT_SNAPSHOT_BOOKMAKERS, DEFAULT_SNAPSHOT_REGIONS } from './data/bookmakers';
import { MarketSnapshotOptions, MarketSnapshotResult, SnapshotEventEntry } from './types/snapshot';
import { EventTeamInfo } from './types/odds';

const SNAPSHOT_LOG_FILENAME = 'LatestSnapshotMarket.log';

function normalizeTeams(event: EventTeamInfo): string[] {
  const teamsFromPayload = event.teams?.filter((team) => typeof team === 'string' && team.trim().length > 0);
  const teamsFromHomeAway = [event.homeTeam, event.awayTeam]
    .map((team) => team?.trim())
    .filter((team): team is string => Boolean(team && team.length > 0));

  if (teamsFromPayload && teamsFromPayload.length > 0) {
    return teamsFromPayload;
  }

  if (teamsFromHomeAway.length > 0) {
    if (teamsFromHomeAway.length === 1) {
      const placeholder = teamsFromHomeAway[0] === event.homeTeam?.trim() ? 'Away Team' : 'Home Team';
      return [...teamsFromHomeAway, placeholder];
    }

    return teamsFromHomeAway;
  }

  return ['Home Team', 'Away Team'];
}

function formatSnapshotLog(snapshot: MarketSnapshotResult): string {
  const lines: string[] = [];
  lines.push(`Market snapshot captured at ${snapshot.capturedAt}`);
  lines.push(
    `Options -> hoursAhead=${snapshot.options.hoursAhead}, maxSports=${snapshot.options.maxSports}, maxEventsPerSport=${snapshot.options.maxEventsPerSport}, regions=${snapshot.options.regions}, bookmakers=${snapshot.options.bookmakers.join(',')}, useCache=${snapshot.options.useCache}`,
  );
  lines.push(`Sports checked: ${snapshot.sportsChecked}`);
  lines.push(`Events captured: ${snapshot.eventsCaptured}`);

  if (snapshot.warnings.length > 0) {
    lines.push('Warnings:');
    snapshot.warnings.forEach((warning, index) => {
      lines.push(`  ${index + 1}. ${warning}`);
    });
  }

  snapshot.entries.forEach((entry, entryIndex) => {
    lines.push('');
    lines.push(`Entry ${entryIndex + 1}: Sport ${entry.sportKey}${entry.sportTitle ? ` (${entry.sportTitle})` : ''}`);
    lines.push(`  Event ${entry.eventId} :: ${entry.teams.join(' vs ')} @ ${entry.startTime}`);
    lines.push(`  Markets (${entry.marketKeys.length}): ${entry.marketKeys.join(', ') || 'none'}`);
    lines.push(`  Odds fetched at ${entry.oddsFetchedAt}`);
    lines.push('  Odds payload:');
    lines.push(
      JSON.stringify(entry.odds, null, 2)
        .split('\n')
        .map((line) => `    ${line}`)
        .join('\n'),
    );
  });

  return lines.join('\n');
}

function normalizeOptions(options: MarketSnapshotOptions = {}): Required<MarketSnapshotOptions> {
  const hoursAhead = Number.isFinite(options.hoursAhead) && (options.hoursAhead ?? 0) > 0 ? options.hoursAhead! : 48;
  const maxSports = Number.isFinite(options.maxSports) && (options.maxSports ?? 0) > 0 ? options.maxSports! : 3;
  const maxEventsPerSport =
    Number.isFinite(options.maxEventsPerSport) && (options.maxEventsPerSport ?? 0) > 0 ? options.maxEventsPerSport! : 10;
  const regions = options.regions?.trim() || DEFAULT_SNAPSHOT_REGIONS.join(',');
  const bookmakers =
    options.bookmakers?.map((bookmaker) => bookmaker.trim()).filter((bookmaker) => bookmaker.length > 0) ||
    [...DEFAULT_SNAPSHOT_BOOKMAKERS];
  const useCache = options.useCache ?? false;

  return { hoursAhead, maxSports, maxEventsPerSport, regions, bookmakers, useCache };
}

export async function createMarketSnapshot(
  options: MarketSnapshotOptions = {},
  explicitApiKey?: string,
): Promise<MarketSnapshotResult> {
  const resolvedApiKey = getOddsApiKey(explicitApiKey);
  const normalizedOptions = normalizeOptions(options);
  const { hoursAhead, maxSports, maxEventsPerSport, regions, bookmakers, useCache } = normalizedOptions;

  const sports = await fetchSports(resolvedApiKey, { useCache });
  const activeSports = sports.filter((sport) => sport.active).slice(0, maxSports);
  const warnings: string[] = [];

  if (activeSports.length === 0) {
    throw new Error('No active sports available to snapshot.');
  }

  const entries: SnapshotEventEntry[] = [];

  for (const sport of activeSports) {
    const events = await fetchEventsForSport(sport.key, resolvedApiKey, { hoursAhead, useCache });
    const selectedEvents = events.slice(0, maxEventsPerSport);

    if (selectedEvents.length === 0) {
      warnings.push(`No events found for sport ${sport.key} within the next ${hoursAhead} hours.`);
      continue;
    }

    for (const event of selectedEvents) {
      const markets = await fetchMarketsForEvent(sport.key, event.eventId, resolvedApiKey, { regions, bookmakers, useCache });
      const oddsSnapshot = await fetchOddsForEvent(
        sport.key,
        event.eventId,
        markets.marketKeys,
        resolvedApiKey,
        {
          regions,
          bookmakers,
          useCache,
        },
      );

      entries.push({
        sportKey: sport.key,
        sportTitle: sport.title,
        eventId: event.eventId,
        teams: normalizeTeams(event),
        startTime: event.startTime,
        marketKeys: markets.marketKeys,
        oddsFetchedAt: oddsSnapshot.fetchedAt,
        odds: oddsSnapshot.raw,
      });
    }
  }

  const snapshot: MarketSnapshotResult = {
    capturedAt: new Date().toISOString(),
    options: normalizedOptions,
    sportsChecked: activeSports.length,
    eventsCaptured: entries.length,
    entries,
    warnings,
    logPath: path.join(process.cwd(), SNAPSHOT_LOG_FILENAME),
  };

  const logBody = formatSnapshotLog(snapshot);
  await fs.writeFile(snapshot.logPath, logBody, 'utf-8');
  console.info(`Market snapshot captured with ${entries.length} entries. Log written to ${snapshot.logPath}.`);

  return snapshot;
}

export { SNAPSHOT_LOG_FILENAME };
