import { MarketDefinition } from '../types/odds';

type MarketSource = 'core' | 'additional';

export interface MarketInfo {
  key: string;
  name: string;
  description: string;
  source: MarketSource;
  notes?: string;
}

export const ADDITIONAL_MARKETS_SOURCE_NOTE =
  'Additional markets are retrieved with a one-time call to /events/{eventId}/odds using the additional_markets selector.';

export const CORE_MARKETS: MarketInfo[] = [
  {
    key: 'h2h',
    name: 'Head to head / Moneyline',
    description: 'Bet on the winning team or player of a game (includes the draw for soccer).',
    source: 'core',
  },
  {
    key: 'spreads',
    name: 'Points spread / Handicap',
    description: 'Bet on the winning team after a points handicap has been applied to each team.',
    source: 'core',
  },
  {
    key: 'totals',
    name: 'Total points / Over-Under',
    description: 'Bet on the total score of the game being above or below a threshold.',
    source: 'core',
  },
  {
    key: 'outrights',
    name: 'Outrights / Futures',
    description: 'Bet on a final outcome of a tournament or competition.',
    source: 'core',
  },
  {
    key: 'h2h_lay',
    name: 'Head to head lay',
    description: 'Bet against a head to head outcome (betting exchange only).',
    source: 'core',
    notes: 'Applicable to betting exchanges.',
  },
  {
    key: 'outrights_lay',
    name: 'Outrights lay',
    description: 'Bet against an outrights outcome (betting exchange only).',
    source: 'core',
    notes: 'Applicable to betting exchanges.',
  },
];

export const CORE_MARKET_KEYS = CORE_MARKETS.map((market) => market.key);

function formatMarketNameFromKey(key: string): string {
  return key
    .split('_')
    .filter((part) => part.length > 0)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

export function buildMarketCatalog(additionalMarkets: MarketDefinition[] = []): MarketInfo[] {
  const catalog = new Map<string, MarketInfo>();

  CORE_MARKETS.forEach((market) => {
    catalog.set(market.key, market);
  });

  additionalMarkets.forEach((market) => {
    const key = market.key?.trim();

    if (!key || catalog.has(key)) {
      return;
    }

    catalog.set(key, {
      key,
      name: formatMarketNameFromKey(key),
      description: 'Additional market fetched from Odds API additional_markets payload.',
      source: 'additional',
      notes: ADDITIONAL_MARKETS_SOURCE_NOTE,
    });
  });

  return Array.from(catalog.values());
}
