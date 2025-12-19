import { DEFAULT_SNAPSHOT_BOOKMAKERS, DEFAULT_SNAPSHOT_REGIONS } from '@/lib/data/bookmakers';
import { createPlayerNamesSnapshot } from '@/lib/nameSnapshots';
import { MarketSnapshotOptions } from '@/lib/types/snapshot';

interface CliArgs {
  sport?: string;
  hoursAhead: number;
  maxEventsPerSport: number;
}

function parseArgs(argv: string[]): CliArgs {
  const args: CliArgs = { hoursAhead: 12, maxEventsPerSport: 2 };

  argv.forEach((arg) => {
    if (arg.startsWith('--sport=')) {
      args.sport = arg.replace('--sport=', '').trim();
    }

    if (arg.startsWith('--hoursAhead=')) {
      const parsed = Number.parseInt(arg.replace('--hoursAhead=', ''), 10);
      if (Number.isFinite(parsed) && parsed > 0) {
        args.hoursAhead = parsed;
      }
    }

    if (arg.startsWith('--maxEvents=')) {
      const parsed = Number.parseInt(arg.replace('--maxEvents=', ''), 10);
      if (Number.isFinite(parsed) && parsed > 0) {
        args.maxEventsPerSport = parsed;
      }
    }
  });

  return args;
}

async function main(): Promise<void> {
  const apiKey = process.env.THE_ODDS_API_KEY;

  if (!apiKey) {
    console.error('Missing THE_ODDS_API_KEY. Set it before running the snapshot smoke test.');
    process.exitCode = 1;
    return;
  }

  const { sport, hoursAhead, maxEventsPerSport } = parseArgs(process.argv.slice(2));

  const options: MarketSnapshotOptions = {
    hoursAhead,
    maxSports: 1,
    maxEventsPerSport,
    regions: DEFAULT_SNAPSHOT_REGIONS.join(','),
    bookmakers: [...DEFAULT_SNAPSHOT_BOOKMAKERS],
    sports: sport ? [sport] : undefined,
    useCache: true,
  };

  console.info(
    `Running player name snapshot smoke test with maxEvents=${maxEventsPerSport}, hoursAhead=${hoursAhead}, sport=${sport ?? 'first active'}`,
  );

  const snapshot = await createPlayerNamesSnapshot(options, apiKey);

  console.info(`Captured ${snapshot.playerNamesBySport.length} sport entries from ${snapshot.sportsChecked} checked sports.`);
  snapshot.playerNamesBySport.forEach((entry) => {
    console.info(
      `\n${entry.sportKey} (${entry.sportTitle ?? 'untitled'}) -> events checked: ${entry.eventsChecked}, markets checked: ${entry.marketsChecked}`,
    );
    console.info(entry.playerNames.length > 0 ? `Players found: ${entry.playerNames.join(', ')}` : 'Players found: none');
  });

  console.info(`Log file written to ${snapshot.logPath}`);
}

main().catch((error) => {
  console.error('Player name snapshot smoke test failed:', error);
  process.exitCode = 1;
});
