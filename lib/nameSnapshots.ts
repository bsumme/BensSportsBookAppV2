import fs from 'fs/promises';
import path from 'path';

import { DEFAULT_SNAPSHOT_BOOKMAKERS, DEFAULT_SNAPSHOT_REGIONS } from './data/bookmakers';
import { fetchEventsForSport, fetchMarketsForEvent, fetchSports, getOddsApiKey } from './oddsApi';
import { MarketSnapshotOptions } from './types/snapshot';
import { EventTeamInfo, MarketDefinition } from './types/odds';
import {
  NameSnapshotOptions,
  PlayerNamesSnapshotResult,
  SportNamesSnapshotResult,
  TeamNamesSnapshotResult,
} from './types/names';

const SPORT_NAMES_SNAPSHOT_LOG_FILENAME = 'LatestSnapshotSportNames.log';
const TEAM_NAMES_SNAPSHOT_LOG_FILENAME = 'LatestSnapshotTeamNames.log';
const PLAYER_NAMES_SNAPSHOT_LOG_FILENAME = 'LatestSnapshotPlayerNames.log';

function formatWarnings(warnings: string[]): string[] {
  if (warnings.length === 0) {
    return [];
  }

  const lines: string[] = ['Warnings:'];

  warnings.forEach((warning, index) => {
    lines.push(`  ${index + 1}. ${warning}`);
  });

  return lines;
}

function formatOptions(options: NameSnapshotOptions): string {
  return `Options -> hoursAhead=${options.hoursAhead}, maxSports=${options.maxSports}, maxEventsPerSport=${options.maxEventsPerSport}, regions=${options.regions}, bookmakers=${options.bookmakers.join(',')}, useCache=${options.useCache}`;
}

function formatSportNamesSnapshotLog(snapshot: SportNamesSnapshotResult): string {
  const lines: string[] = [];
  lines.push(`Sport names snapshot captured at ${snapshot.capturedAt}`);
  lines.push(formatOptions(snapshot.options));
  lines.push(`Sports checked: ${snapshot.sportsChecked}`);
  lines.push(...formatWarnings(snapshot.warnings));

  if (snapshot.sportNames.length > 0) {
    lines.push('');
    lines.push('Sport names:');

    snapshot.sportNames.forEach((sport) => {
      lines.push(`- ${sport.sportKey}${sport.sportTitle ? ` (${sport.sportTitle})` : ''}`);
      lines.push(`  Group: ${sport.group}`);

      if (sport.description) {
        lines.push(`  Description: ${sport.description}`);
      }

      lines.push(`  Has outrights: ${sport.hasOutrights ?? false}`);
    });
  }

  return lines.join('\n');
}

function formatTeamNamesSnapshotLog(snapshot: TeamNamesSnapshotResult): string {
  const lines: string[] = [];
  lines.push(`Team names snapshot captured at ${snapshot.capturedAt}`);
  lines.push(formatOptions(snapshot.options));
  lines.push(`Sports checked: ${snapshot.sportsChecked}`);
  lines.push(`Events captured: ${snapshot.eventsCaptured}`);
  lines.push(...formatWarnings(snapshot.warnings));

  if (snapshot.teamsBySport.length > 0) {
    lines.push('');
    lines.push('Teams by sport:');

    snapshot.teamsBySport.forEach((entry) => {
      lines.push(`- ${entry.sportKey}${entry.sportTitle ? ` (${entry.sportTitle})` : ''}`);
      lines.push(`  Events checked: ${entry.eventsChecked}`);
      lines.push(`  Teams (${entry.teams.length}): ${entry.teams.join(', ') || 'none'}`);
    });
  }

  return lines.join('\n');
}

function formatPlayerNamesSnapshotLog(snapshot: PlayerNamesSnapshotResult): string {
  const lines: string[] = [];
  lines.push(`Player names snapshot captured at ${snapshot.capturedAt}`);
  lines.push(formatOptions(snapshot.options));
  lines.push(`Sports checked: ${snapshot.sportsChecked}`);
  lines.push(`Events captured: ${snapshot.eventsCaptured}`);
  lines.push(`Markets captured: ${snapshot.marketsCaptured}`);
  lines.push(...formatWarnings(snapshot.warnings));

  if (snapshot.playerNamesBySport.length > 0) {
    lines.push('');
    lines.push('Player-like outcome names by sport:');

    snapshot.playerNamesBySport.forEach((entry) => {
      lines.push(`- ${entry.sportKey}${entry.sportTitle ? ` (${entry.sportTitle})` : ''}`);
      lines.push(`  Events checked: ${entry.eventsChecked}`);
      lines.push(`  Markets checked: ${entry.marketsChecked}`);
      lines.push(`  Outcome names (${entry.playerNames.length}): ${entry.playerNames.join(', ') || 'none'}`);
    });
  }

  return lines.join('\n');
}

function normalizeOptions(options: MarketSnapshotOptions = {}): NameSnapshotOptions {
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

function extractPlayerOutcomeNames(market: MarketDefinition): string[] {
  if (!market.key?.startsWith('player_')) {
    return [];
  }

  const outcomes = market.outcomes;

  if (!Array.isArray(outcomes)) {
    return [];
  }

  const outcomeNames = new Set<string>();

  outcomes.forEach((outcome) => {
    if (!outcome || typeof outcome !== 'object') {
      return;
    }

    const candidate = outcome as Record<string, unknown>;
    const possibleNames = [candidate.description, candidate.participant];

    possibleNames.forEach((value) => {
      if (typeof value === 'string') {
        const trimmed = value.trim();

        if (trimmed.length > 0) {
          outcomeNames.add(trimmed);
        }
      }
    });
  });

  return Array.from(outcomeNames).sort((left, right) => left.localeCompare(right));
}

export async function createSportNamesSnapshot(
  options: MarketSnapshotOptions = {},
  explicitApiKey?: string,
): Promise<SportNamesSnapshotResult> {
  const apiKey = getOddsApiKey(explicitApiKey);
  const normalizedOptions = normalizeOptions(options);
  const sports = await fetchSports(apiKey, { useCache: normalizedOptions.useCache });
  const activeSports = sports.filter((sport) => sport.active).slice(0, normalizedOptions.maxSports);
  const warnings: string[] = [];

  if (activeSports.length === 0) {
    warnings.push('No active sports available from Odds API.');
  }

  const snapshot: SportNamesSnapshotResult = {
    capturedAt: new Date().toISOString(),
    logPath: path.join(process.cwd(), SPORT_NAMES_SNAPSHOT_LOG_FILENAME),
    options: normalizedOptions,
    sportsChecked: activeSports.length,
    sportNames: activeSports.map((sport) => ({
      sportKey: sport.key,
      sportTitle: sport.title,
      group: sport.group,
      description: sport.description,
      hasOutrights: sport.hasOutrights,
    })),
    warnings,
  };

  await fs.writeFile(snapshot.logPath, formatSportNamesSnapshotLog(snapshot), 'utf-8');
  console.info(`Sport names snapshot captured with ${snapshot.sportNames.length} sports. Log written to ${snapshot.logPath}.`);

  return snapshot;
}

export async function createTeamNamesSnapshot(
  options: MarketSnapshotOptions = {},
  explicitApiKey?: string,
): Promise<TeamNamesSnapshotResult> {
  const apiKey = getOddsApiKey(explicitApiKey);
  const normalizedOptions = normalizeOptions(options);
  const sports = await fetchSports(apiKey, { useCache: normalizedOptions.useCache });
  const activeSports = sports.filter((sport) => sport.active).slice(0, normalizedOptions.maxSports);
  const warnings: string[] = [];
  const teamsBySport = [] as TeamNamesSnapshotResult['teamsBySport'];
  let eventsCaptured = 0;

  if (activeSports.length === 0) {
    throw new Error('No active sports available for team name capture.');
  }

  for (const sport of activeSports) {
    const events = await fetchEventsForSport(sport.key, apiKey, {
      hoursAhead: normalizedOptions.hoursAhead,
      useCache: normalizedOptions.useCache,
    });
    const selectedEvents = events.slice(0, normalizedOptions.maxEventsPerSport);

    if (selectedEvents.length === 0) {
      warnings.push(`No events found for sport ${sport.key} within the next ${normalizedOptions.hoursAhead} hours.`);
      continue;
    }

    const teamNames = new Set<string>();

    selectedEvents.forEach((event) => {
      normalizeTeams(event).forEach((teamName) => teamNames.add(teamName));
    });

    eventsCaptured += selectedEvents.length;

    teamsBySport.push({
      sportKey: sport.key,
      sportTitle: sport.title,
      teams: Array.from(teamNames).sort((left, right) => left.localeCompare(right)),
      eventsChecked: selectedEvents.length,
    });
  }

  const snapshot: TeamNamesSnapshotResult = {
    capturedAt: new Date().toISOString(),
    logPath: path.join(process.cwd(), TEAM_NAMES_SNAPSHOT_LOG_FILENAME),
    options: normalizedOptions,
    sportsChecked: activeSports.length,
    eventsCaptured,
    teamsBySport,
    warnings,
  };

  await fs.writeFile(snapshot.logPath, formatTeamNamesSnapshotLog(snapshot), 'utf-8');
  console.info(`Team names snapshot captured with ${eventsCaptured} events. Log written to ${snapshot.logPath}.`);

  return snapshot;
}

export async function createPlayerNamesSnapshot(
  options: MarketSnapshotOptions = {},
  explicitApiKey?: string,
): Promise<PlayerNamesSnapshotResult> {
  const apiKey = getOddsApiKey(explicitApiKey);
  const normalizedOptions = normalizeOptions(options);
  const sports = await fetchSports(apiKey, { useCache: normalizedOptions.useCache });
  const activeSports = sports.filter((sport) => sport.active).slice(0, normalizedOptions.maxSports);
  const warnings: string[] = [];
  const playerNamesBySport = [] as PlayerNamesSnapshotResult['playerNamesBySport'];
  let eventsCaptured = 0;
  let marketsCaptured = 0;

  if (activeSports.length === 0) {
    throw new Error('No active sports available for player name capture.');
  }

  for (const sport of activeSports) {
    const events = await fetchEventsForSport(sport.key, apiKey, {
      hoursAhead: normalizedOptions.hoursAhead,
      useCache: normalizedOptions.useCache,
    });
    const selectedEvents = events.slice(0, normalizedOptions.maxEventsPerSport);

    if (selectedEvents.length === 0) {
      warnings.push(`No events found for sport ${sport.key} within the next ${normalizedOptions.hoursAhead} hours.`);
      continue;
    }

    const playerNames = new Set<string>();
    let sportMarketsChecked = 0;

    for (const event of selectedEvents) {
      const markets = await fetchMarketsForEvent(sport.key, event.eventId, apiKey, {
        regions: normalizedOptions.regions,
        bookmakers: normalizedOptions.bookmakers,
        useCache: normalizedOptions.useCache,
      });

      const playerMarkets = markets.rawMarkets.filter((market) => market.key?.startsWith('player_'));

      sportMarketsChecked += playerMarkets.length;
      marketsCaptured += playerMarkets.length;
      eventsCaptured += 1;

      playerMarkets.forEach((market) => {
        extractPlayerOutcomeNames(market).forEach((outcomeName) => playerNames.add(outcomeName));
      });
    }

    if (playerNames.size === 0) {
      warnings.push(`No player-like outcome names found for sport ${sport.key}.`);
    }

    playerNamesBySport.push({
      sportKey: sport.key,
      sportTitle: sport.title,
      playerNames: Array.from(playerNames).sort((left, right) => left.localeCompare(right)),
      eventsChecked: selectedEvents.length,
      marketsChecked: sportMarketsChecked,
    });
  }

  const snapshot: PlayerNamesSnapshotResult = {
    capturedAt: new Date().toISOString(),
    logPath: path.join(process.cwd(), PLAYER_NAMES_SNAPSHOT_LOG_FILENAME),
    options: normalizedOptions,
    sportsChecked: activeSports.length,
    eventsCaptured,
    marketsCaptured,
    playerNamesBySport,
    warnings,
  };

  await fs.writeFile(snapshot.logPath, formatPlayerNamesSnapshotLog(snapshot), 'utf-8');
  console.info(
    `Player names snapshot captured with ${eventsCaptured} events and ${marketsCaptured} markets. Log written to ${snapshot.logPath}.`,
  );

  return snapshot;
}

export {
  PLAYER_NAMES_SNAPSHOT_LOG_FILENAME,
  SPORT_NAMES_SNAPSHOT_LOG_FILENAME,
  TEAM_NAMES_SNAPSHOT_LOG_FILENAME,
};
