export interface MarketSnapshotOptions {
  hoursAhead?: number;
  maxSports?: number;
  maxEventsPerSport?: number;
  regions?: string;
  bookmakers?: string[];
  useCache?: boolean;
}

export interface SnapshotEventEntry {
  sportKey: string;
  sportTitle?: string;
  eventId: string;
  teams: string[];
  startTime: string;
  marketKeys: string[];
  oddsFetchedAt: string;
  odds: unknown;
}

export interface SportMarketSummary {
  sportKey: string;
  sportTitle?: string;
  marketKeys: string[];
}

export interface MarketSnapshotResult {
  capturedAt: string;
  logPath: string;
  options: Required<
    Pick<MarketSnapshotOptions, 'hoursAhead' | 'maxSports' | 'maxEventsPerSport' | 'regions' | 'bookmakers' | 'useCache'>
  >;
  sportsChecked: number;
  eventsCaptured: number;
  entries: SnapshotEventEntry[];
  marketsBySport: SportMarketSummary[];
  warnings: string[];
}
