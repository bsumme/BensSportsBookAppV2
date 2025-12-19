import { MarketSnapshotOptions } from './snapshot';

export type NameSnapshotOptions =
  & Required<
      Pick<MarketSnapshotOptions, 'hoursAhead' | 'maxSports' | 'maxEventsPerSport' | 'regions' | 'bookmakers' | 'useCache'>
    >
  & Pick<MarketSnapshotOptions, 'sports'>;

export interface SportNameEntry {
  sportKey: string;
  sportTitle: string;
  group: string;
  description?: string;
  hasOutrights?: boolean;
}

export interface SportNamesSnapshotResult {
  capturedAt: string;
  logPath: string;
  options: NameSnapshotOptions;
  sportsChecked: number;
  sportNames: SportNameEntry[];
  warnings: string[];
}

export interface TeamNameSummary {
  sportKey: string;
  sportTitle?: string;
  teams: string[];
  eventsChecked: number;
}

export interface TeamNamesSnapshotResult {
  capturedAt: string;
  logPath: string;
  options: NameSnapshotOptions;
  sportsChecked: number;
  eventsCaptured: number;
  teamsBySport: TeamNameSummary[];
  warnings: string[];
}

export interface PlayerNameSummary {
  sportKey: string;
  sportTitle?: string;
  playerNames: string[];
  eventsChecked: number;
  marketsChecked: number;
}

export interface PlayerNamesSnapshotResult {
  capturedAt: string;
  logPath: string;
  options: NameSnapshotOptions;
  sportsChecked: number;
  eventsCaptured: number;
  marketsCaptured: number;
  playerNamesBySport: PlayerNameSummary[];
  warnings: string[];
}
