export interface Sport {
  key: string;
  group: string;
  title: string;
  active: boolean;
  description?: string;
  hasOutrights?: boolean;
}

export interface ApiEvent {
  id: string;
  sport_key: string;
  commence_time: string;
  home_team?: string;
  away_team?: string;
  teams?: string[];
}

export interface EventTeamInfo {
  eventId: string;
  sportKey: string;
  teams?: string[];
  homeTeam?: string;
  awayTeam?: string;
  startTime: string;
}

export interface MarketDefinition {
  key: string;
  last_update?: string;
  outcomes?: unknown[];
}

export interface BookmakerMarkets {
  key: string;
  title?: string;
  markets: MarketDefinition[];
}

export interface EventMarketsPayload {
  bookmakers: BookmakerMarkets[];
}

export interface EventMarkets {
  eventId: string;
  marketKeys: string[];
  rawMarkets: MarketDefinition[];
  bookmakerMarkets?: BookmakerMarkets[];
}

export interface EventOddsSnapshot {
  eventId: string;
  markets?: string[];
  fetchedAt: string;
  raw: unknown;
}
