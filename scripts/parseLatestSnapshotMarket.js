const fs = require('fs');
const path = require('path');

function trackSport(sportsMap, sportKey, sportTitle) {
  if (!sportsMap.has(sportKey)) {
    sportsMap.set(sportKey, sportTitle ?? null);
    return;
  }

  if (sportTitle && !sportsMap.get(sportKey)) {
    sportsMap.set(sportKey, sportTitle);
  }
}

function parseMarketsSummary(lines, sportsMap, markets) {
  const headerIndex = lines.findIndex((line) => line.trim() === 'Markets by sport:');
  if (headerIndex === -1) return;

  let currentSport = null;
  for (let i = headerIndex + 1; i < lines.length; i += 1) {
    const line = lines[i];
    if (line.startsWith('Entry ')) break;

    const sportMatch = line.match(/-\s*([^()]+?)(?:\s+\((.+)\))?$/);
    if (sportMatch) {
      currentSport = sportMatch[1].trim();
      const sportTitle = sportMatch[2]?.trim();
      trackSport(sportsMap, currentSport, sportTitle);
      continue;
    }

    const marketMatch = line.match(/Markets\s*\(\d+\):\s*(.+)/);
    if (marketMatch) {
      marketMatch[1]
        .split(',')
        .map((value) => value.trim())
        .filter(Boolean)
        .forEach((market) => markets.add(market));
    }
  }
}

function parseJsonBlock(lines, startIndex) {
  const buffer = [];
  let depth = 0;
  let started = false;

  for (let i = startIndex; i < lines.length; i += 1) {
    const line = lines[i];
    const opens = (line.match(/{/g) || []).length;
    const closes = (line.match(/}/g) || []).length;

    if (opens > 0) {
      started = true;
    }

    if (started) {
      buffer.push(line.trim());
    }

    depth += opens - closes;

    if (started && depth <= 0) {
      return { value: JSON.parse(buffer.join('\n')), nextIndex: i + 1 };
    }
  }

  return null;
}

function shouldKeepName(name, teams) {
  if (!name) return false;
  const trimmed = name.trim();
  if (trimmed.length === 0) return false;

  const normalized = trimmed.toLowerCase();
  const genericLabels = new Set(['over', 'under', 'yes', 'no', 'draw', 'home team', 'away team']);

  if (genericLabels.has(normalized)) return false;
  if (teams.has(trimmed)) return false;

  return true;
}

function collectPlayersFromOdds(odds, players, teams) {
  const stack = [odds];

  while (stack.length > 0) {
    const current = stack.pop();
    if (!current || typeof current !== 'object') continue;

    if (Array.isArray(current)) {
      stack.push(...current);
      continue;
    }

    if (Array.isArray(current.outcomes)) {
      current.outcomes.forEach((outcome) => {
        if (!outcome || typeof outcome !== 'object') return;

        const participant =
          typeof outcome.participant === 'string' ? outcome.participant : typeof outcome.name === 'string' ? outcome.name : null;
        const description = typeof outcome.description === 'string' ? outcome.description : null;

        if (participant && shouldKeepName(participant, teams)) {
          players.add(participant.trim());
        }

        if (description && shouldKeepName(description, teams)) {
          players.add(description.trim());
        }
      });
    }

    Object.values(current).forEach((value) => {
      if (value && typeof value === 'object') {
        stack.push(value);
      }
    });
  }
}

function parseSnapshotLog(logText) {
  const lines = logText.split(/\r?\n/);
  const sports = new Map();
  const teams = new Set();
  const players = new Set();
  const markets = new Set();

  parseMarketsSummary(lines, sports, markets);

  for (let i = 0; i < lines.length; i += 1) {
    const entryMatch = lines[i].match(/^Entry\s+\d+:\s+Sport\s+([^\s]+)(?:\s+\((.+)\))?/);
    if (!entryMatch) continue;

    const sportKey = entryMatch[1].trim();
    const sportTitle = entryMatch[2]?.trim();
    trackSport(sports, sportKey, sportTitle);

    let j = i + 1;
    while (j < lines.length && !lines[j].startsWith('Entry ')) {
      const line = lines[j];
      const eventMatch = line.match(/Event\s+[^:]+::\s+(.+?)\s+@/);
      if (eventMatch) {
        eventMatch[1]
          .split(/\s+vs\s+/)
          .map((team) => team.trim())
          .filter(Boolean)
          .forEach((team) => teams.add(team));
      }

      const marketMatch = line.match(/Markets\s*\(\d+\):\s*(.+)/);
      if (marketMatch) {
        marketMatch[1]
          .split(',')
          .map((value) => value.trim())
          .filter(Boolean)
          .forEach((market) => markets.add(market));
      }

      if (line.includes('Odds payload:')) {
        const parsed = parseJsonBlock(lines, j + 1);
        if (parsed) {
          collectPlayersFromOdds(parsed.value, players, teams);
          j = parsed.nextIndex;
          continue;
        }
      }

      j += 1;
    }

    i = j - 1;
  }

  return {
    sports: Array.from(sports.entries()).map(([sportKey, sportTitle]) => ({ sportKey, sportTitle })),
    teams: Array.from(teams).sort(),
    players: Array.from(players).sort(),
    markets: Array.from(markets).sort(),
  };
}

function main() {
  const logPath = path.resolve(process.argv[2] ?? 'LatestSnapshotMarket.log');

  if (!fs.existsSync(logPath)) {
    console.error(`Cannot find ${logPath}`);
    process.exit(1);
  }

  const logText = fs.readFileSync(logPath, 'utf-8');
  const summary = parseSnapshotLog(logText);

  console.log(`Parsed ${logPath}`);
  console.log(`- Sports (${summary.sports.length})`);
  console.log(`- Teams (${summary.teams.length})`);
  console.log(`- Players (${summary.players.length})`);
  console.log(`- Markets (${summary.markets.length})`);
  console.log('\nJSON summary:');
  console.log(JSON.stringify(summary, null, 2));
}

if (require.main === module) {
  main();
}

module.exports = { parseSnapshotLog };
