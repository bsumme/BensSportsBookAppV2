const fs = require("fs");
const path = require("path");

/**
 * Capitalize each word in a string separated by underscores.
 */
function toLabel(key) {
  return key
    .split("_")
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function parseRunMetadata(lines) {
  const startedLine = lines.find((line) => line.startsWith("All seed data snapshot run started at"));
  const finishedLine = lines.find((line) => line.startsWith("All seed data snapshot run finished at"));
  const baseUrlLine = lines.find((line) => line.startsWith("Base URL:"));
  const hoursLine = lines.find((line) => line.startsWith("Hours ahead:"));
  const regionsLine = lines.find((line) => line.startsWith("Regions:"));
  const bookmakersLine = lines.find((line) => line.startsWith("Bookmakers:"));

  const parseNumberList = (source) => {
    if (!source) return {};
    const matches = Array.from(source.matchAll(/([A-Za-z ]+):\s*([0-9]+)/g));
    return matches.reduce(
      (acc, [, key, value]) => ({
        ...acc,
        [key.trim()]: Number(value),
      }),
      {}
    );
  };

  const parseCsvValue = (line) =>
    line
      ?.replace(/^[^:]+:\s*/, "")
      .split(",")
      .map((value) => value.trim())
      .filter(Boolean);

  const hoursAndCaps = parseNumberList(hoursLine);

  return {
    startedAt: startedLine?.replace("All seed data snapshot run started at ", "").trim(),
    finishedAt: finishedLine?.replace("All seed data snapshot run finished at ", "").trim(),
    baseUrl: baseUrlLine?.replace("Base URL: ", "").trim(),
    hoursAhead: hoursAndCaps?.["Hours ahead"] ?? null,
    maxSports: hoursAndCaps?.["Max sports"] ?? null,
    maxEventsPerSport: hoursAndCaps?.["Max events per sport"] ?? null,
    regions: parseCsvValue(regionsLine),
    bookmakers: parseCsvValue(bookmakersLine),
  };
}

function extractJsonBlocks(lines) {
  const blocks = [];
  let depth = 0;
  let buffer = [];

  for (const line of lines) {
    if (line.includes("{")) {
      depth += (line.match(/{/g) || []).length;
      buffer.push(line);
    } else if (depth > 0) {
      buffer.push(line);
    }

    if (line.includes("}") && depth > 0) {
      depth -= (line.match(/}/g) || []).length;
      if (depth === 0) {
        const jsonText = buffer.join("\n");
        blocks.push(JSON.parse(jsonText));
        buffer = [];
      }
    }
  }

  return blocks;
}

function buildCatalog(raw) {
  const regions = {};
  const supportedBookmakers = raw.run.bookmakers ?? [];
  (raw.run.regions ?? []).forEach((regionKey, index) => {
    regions[regionKey] = {
      label: toLabel(regionKey),
      default: index === 0,
      supportedBookmakers,
    };
  });

  const bookmakers = {};
  supportedBookmakers.forEach((bookmakerKey) => {
    bookmakers[bookmakerKey] = {
      label: toLabel(bookmakerKey),
      aliases: [],
      regions: raw.run.regions ?? [],
      enabled: true,
    };
  });

  const sports = {};
  (raw.sportNamesSnapshot?.sportNames ?? []).forEach((sport) => {
    sports[sport.sportKey] = {
      label: sport.sportTitle,
      active: true,
    };
  });

  const markets = {};
  const discoveryMarkets = raw.marketsDiscovery?.markets ?? {};
  Object.entries(discoveryMarkets).forEach(([marketKey, info]) => {
    markets[marketKey] = {
      label: toLabel(marketKey),
      category: "other",
      outcomes: null,
      arbSafe: false,
      requiresLine: false,
      polarity: "multi",
      sports: info.sports ?? "all",
      eventCount: info.eventCount ?? null,
      bookmakers: info.bookmakers ?? [],
    };
  });

  return { regions, bookmakers, sports, markets };
}

function main() {
  const logPath = path.resolve("All_Seed_Data.log");
  if (!fs.existsSync(logPath)) {
    throw new Error(`Cannot find ${logPath}`);
  }

  const lines = fs.readFileSync(logPath, "utf-8").split(/\r?\n/);
  const run = parseRunMetadata(lines);
  const [marketSnapshot, sportNamesSnapshot, teamNamesSnapshot, playerNamesSnapshot, marketsDiscovery] = extractJsonBlocks(lines);

  const raw = {
    run,
    marketSnapshot,
    sportNamesSnapshot,
    teamNamesSnapshot,
    playerNamesSnapshot,
    marketsDiscovery,
  };

  const rawPath = path.resolve("AllSeedDataRaw.json");
  fs.writeFileSync(rawPath, JSON.stringify(raw, null, 2));

  const catalogPath = path.resolve("schema.catalog.seed.json");
  const catalog = buildCatalog(raw);
  fs.writeFileSync(catalogPath, JSON.stringify(catalog, null, 2));

  console.log(`Parsed ${logPath}`);
  console.log(`- Wrote raw snapshot to ${rawPath}`);
  console.log(`- Wrote catalog-friendly seed data to ${catalogPath}`);
}

main();
