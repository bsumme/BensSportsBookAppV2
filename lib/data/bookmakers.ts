export interface BookmakerInfo {
  key: string;
  name: string;
  note?: string;
}

export type BookmakerRegionKey = 'us' | 'us2' | 'us_dfs' | 'us_ex';

export const BOOKMAKER_REGIONS: Record<BookmakerRegionKey, BookmakerInfo[]> = {
  us: [
    { key: 'betonlineag', name: 'BetOnline.ag' },
    { key: 'betmgm', name: 'BetMGM' },
    { key: 'betrivers', name: 'BetRivers' },
    { key: 'betus', name: 'BetUS' },
    { key: 'bovada', name: 'Bovada' },
    { key: 'williamhill_us', name: 'Caesars', note: 'Only available on paid subscriptions' },
    { key: 'draftkings', name: 'DraftKings' },
    { key: 'fanatics', name: 'Fanatics', note: 'Only available on paid subscriptions' },
    { key: 'fanduel', name: 'FanDuel' },
    { key: 'lowvig', name: 'LowVig.ag' },
    { key: 'mybookieag', name: 'MyBookie.ag' },
  ],
  us2: [
    { key: 'ballybet', name: 'Bally Bet' },
    { key: 'betanysports', name: 'BetAnything', note: 'Formerly BetAnySports' },
    { key: 'betparx', name: 'betPARX' },
    { key: 'espnbet', name: 'ESPN BET' },
    { key: 'fliff', name: 'Fliff' },
    { key: 'hardrockbet', name: 'Hard Rock Bet' },
    { key: 'rebet', name: 'ReBet', note: 'Only available on paid subscriptions' },
  ],
  us_dfs: [
    { key: 'betr_us_dfs', name: 'Betr Picks', note: 'Selections with non-default multipliers are included in alternate markets' },
    { key: 'pick6', name: 'DraftKings Pick6', note: 'Selections with non-default multipliers are included in alternate markets' },
    { key: 'prizepicks', name: 'PrizePicks', note: 'Alternate market odds may use default assumptions' },
    { key: 'underdog', name: 'Underdog Fantasy', note: 'Selections with non-default multipliers are included in alternate markets' },
  ],
  us_ex: [
    { key: 'betopenly', name: 'BetOpenly', note: 'Use the "includeBetLimits" parameter to find open bets' },
    { key: 'kalshi', name: 'Kalshi' },
    { key: 'novig', name: 'Novig' },
    { key: 'prophetx', name: 'ProphetX' },
  ],
};

export const DEFAULT_SNAPSHOT_REGIONS = ['us', 'us_ex'] as const;
export const DEFAULT_SNAPSHOT_BOOKMAKERS = ['draftkings', 'fanduel', 'novig'] as const;
