import {
  ApiEvent,
  EventMarkets,
  EventMarketsPayload,
  EventOddsSnapshot,
  EventTeamInfo,
  MarketDefinition,
  Sport,
} from './types/odds';

const ODDS_API_BASE_URL = 'https://api.the-odds-api.com/v4';
const DEFAULT_CACHE_TTL_MS = 10 * 60 * 1000;

interface CacheEntry<T> {
  value: T;
  expiresAt: number;
}

interface FetchOptions {
  useCache?: boolean;
  cacheTtlMs?: number;
}

interface FetchEventsOptions extends FetchOptions {
  hoursAhead?: number;
}

interface FetchOddsOptions extends FetchOptions {
  markets?: string[];
  regions?: string;
  bookmakers?: string[];
}

interface FetchMarketsOptions extends FetchOptions {
  regions?: string;
  bookmakers?: string[];
}

const cache = new Map<string, CacheEntry<unknown>>();

export function getOddsApiKey(explicitKey?: string): string {
  const apiKey = explicitKey ?? process.env.THE_ODDS_API_KEY;

  if (!apiKey) {
    throw new Error('Missing Odds API key. Set THE_ODDS_API_KEY or pass it explicitly.');
  }

  return apiKey;
}

function readCache<T>(cacheKey: string): T | undefined {
  const entry = cache.get(cacheKey) as CacheEntry<T> | undefined;

  if (!entry) {
    return undefined;
  }

  if (Date.now() > entry.expiresAt) {
    cache.delete(cacheKey);
    return undefined;
  }

  return entry.value;
}

function writeCache<T>(cacheKey: string, value: T, ttlMs: number): void {
  cache.set(cacheKey, {
    value,
    expiresAt: Date.now() + ttlMs,
  });
}

function buildUrl(path: string, searchParams: URLSearchParams): string {
  const url = new URL(`${ODDS_API_BASE_URL}${path}`);
  url.search = searchParams.toString();
  return url.toString();
}

async function oddsApiGet<T>(
  path: string,
  params: Record<string, string | number | boolean | undefined>,
  apiKey?: string,
  options: FetchOptions = {},
): Promise<T> {
  const resolvedApiKey = getOddsApiKey(apiKey);
  const searchParams = new URLSearchParams();
  searchParams.set('apiKey', resolvedApiKey);

  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined) {
      searchParams.set(key, String(value));
    }
  });

  const cacheKey = `${path}?${searchParams.toString()}`;
  const { useCache = true, cacheTtlMs = DEFAULT_CACHE_TTL_MS } = options;

  if (useCache) {
    const cached = readCache<T>(cacheKey);

    if (cached !== undefined) {
      return cached;
    }
  }

  const url = buildUrl(path, searchParams);
  const response = await fetch(url, { cache: 'no-store' });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Odds API GET ${path} failed (${response.status}): ${body}`);
  }

  const payload = (await response.json()) as T;

  if (useCache) {
    writeCache(cacheKey, payload, cacheTtlMs);
  }

  return payload;
}

export async function fetchSports(apiKey?: string, options: FetchOptions = {}): Promise<Sport[]> {
  const sports = await oddsApiGet<Sport[]>('/sports', {}, apiKey, options);

  console.info(`Fetched ${sports.length} sports from Odds API`);

  return sports;
}

export async function fetchEventsForSport(
  sportKey: string,
  apiKey?: string,
  options: FetchEventsOptions = {},
): Promise<EventTeamInfo[]> {
  const { hoursAhead = 48, ...fetchOptions } = options;
  const events = await oddsApiGet<ApiEvent[]>(`/sports/${sportKey}/events`, {}, apiKey, fetchOptions);
  const now = Date.now();
  const cutoff = now + hoursAhead * 60 * 60 * 1000;

  const filteredEvents = events.filter((event) => {
    const start = new Date(event.commence_time).getTime();
    return start >= now && start <= cutoff;
  });

  const summaries = filteredEvents.map<EventTeamInfo>((event) => ({
    eventId: event.id,
    sportKey: event.sport_key,
    teams: event.teams,
    homeTeam: event.home_team,
    awayTeam: event.away_team,
    startTime: event.commence_time,
  }));

  console.info(`Fetched ${filteredEvents.length} events for ${sportKey} occurring in the next ${hoursAhead} hours`);

  return summaries;
}

export async function fetchMarketsForEvent(
  sportKey: string,
  eventId: string,
  apiKey?: string,
  options: FetchMarketsOptions = {},
): Promise<EventMarkets> {
  const { regions = 'us', bookmakers, ...fetchOptions } = options;
  const bookmakerParam = bookmakers?.filter((key) => key.trim().length > 0).join(',') || undefined;
  const rawPayload = await oddsApiGet<MarketDefinition[] | EventMarketsPayload>(
    `/sports/${sportKey}/events/${eventId}/markets`,
    { regions, bookmakers: bookmakerParam },
    apiKey,
    fetchOptions,
  );
  const bookmakerMarkets = Array.isArray(rawPayload?.bookmakers)
    ? rawPayload.bookmakers.filter((bookmaker): bookmaker is BookmakerMarkets =>
        Boolean(bookmaker && Array.isArray(bookmaker.markets)),
      )
    : undefined;
  const rawMarkets: MarketDefinition[] = Array.isArray(rawPayload)
    ? rawPayload
    : bookmakerMarkets?.flatMap((bookmaker) => bookmaker.markets) ?? [];
  const marketKeys = Array.from(
    new Set(
      rawMarkets
        .map((market) => market.key)
        .filter((key): key is string => typeof key === 'string' && key.trim().length > 0),
    ),
  );

  const bookmakerCount = bookmakerMarkets?.length ?? 0;

  console.info(
    `Fetched ${marketKeys.length} markets for sport ${sportKey} event ${eventId} (bookmakers observed: ${bookmakerCount})`,
  );

  return {
    eventId,
    marketKeys,
    rawMarkets,
    bookmakerMarkets,
  };
}

export async function fetchOddsForEvent(
  sportKey: string,
  eventId: string,
  marketKeys: string[] = [],
  apiKey?: string,
  options: FetchOddsOptions = {},
): Promise<EventOddsSnapshot> {
  const { markets = marketKeys, regions = 'us', bookmakers, ...fetchOptions } = options;
  const marketParam = markets.length > 0 ? markets.join(',') : undefined;
  const bookmakerParam = bookmakers?.filter((key) => key.trim().length > 0).join(',') || undefined;
  const rawOdds = await oddsApiGet<unknown>(
    `/sports/${sportKey}/events/${eventId}/odds`,
    { markets: marketParam, regions, bookmakers: bookmakerParam },
    apiKey,
    { ...fetchOptions, useCache: fetchOptions.useCache ?? false },
  );

  const fetchedAt = new Date().toISOString();

  console.info(
    `Fetched odds for sport ${sportKey} event ${eventId} covering markets: ${markets.join(', ') || 'all available'}`,
  );

  return {
    eventId,
    markets: markets.length > 0 ? markets : undefined,
    fetchedAt,
    raw: rawOdds,
  };
}
