import fs from 'fs/promises';
import path from 'path';

import { buildMarketCatalog, MarketInfo } from './data/markets';
import { MarketDefinition } from './types/odds';

export const MARKET_CATALOG_LOG_FILENAME = 'LatestMarketsCatalog.log';

export interface MarketCatalogLogOptions {
  sourceDescription?: string;
}

function formatMarketCatalogLog(catalog: MarketInfo[], options: MarketCatalogLogOptions = {}): string {
  const { sourceDescription } = options;
  const sortedCatalog = [...catalog].sort((a, b) => a.key.localeCompare(b.key));
  const coreMarkets = sortedCatalog.filter((market) => market.source === 'core');
  const additionalMarkets = sortedCatalog.filter((market) => market.source === 'additional');
  const lines: string[] = [];

  lines.push(`Market catalog generated at ${new Date().toISOString()}`);

  if (sourceDescription) {
    lines.push(`Source: ${sourceDescription}`);
  }

  lines.push(`Total markets: ${sortedCatalog.length}`);
  lines.push(`- Core markets: ${coreMarkets.length}`);
  lines.push(`- Additional markets: ${additionalMarkets.length}`);
  lines.push('');
  lines.push('Markets:');

  sortedCatalog.forEach((market, index) => {
    lines.push(`${index + 1}. ${market.key} :: ${market.name}`);
    lines.push(`    Description: ${market.description}`);
    lines.push(`    Source: ${market.source}${market.notes ? ` (${market.notes})` : ''}`);
  });

  return lines.join('\n');
}

export async function writeMarketCatalogLog(
  additionalMarkets: MarketDefinition[] = [],
  options: MarketCatalogLogOptions = {},
): Promise<{ catalog: MarketInfo[]; logPath: string }> {
  const catalog = buildMarketCatalog(additionalMarkets);
  const logContents = formatMarketCatalogLog(catalog, options);
  const logPath = path.join(process.cwd(), MARKET_CATALOG_LOG_FILENAME);

  await fs.writeFile(logPath, logContents, 'utf-8');
  console.info(`Market catalog log written to ${logPath}`);

  return { catalog, logPath };
}
