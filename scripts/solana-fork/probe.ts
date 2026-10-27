/** Compares the fork source with the pins and manifest; warn-only unless strict. */
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

import { FORK_CASES, caseId } from './manifest.js';
import { PROGRAM_PINS, type Network, type ProgramName } from './networks.js';
import type { Snapshot } from './snapshot.js';

const short = (hash = 'absent') => hash.slice(0, 12);

export function probe(network: Network, snapshot: Snapshot): string[] {
  const pins = PROGRAM_PINS[network];
  const changed = (Object.keys(pins) as ProgramName[]).filter(
    (name) => snapshot.programs[name].sha256 !== (pins[name] || undefined),
  );
  const findings = changed.map(
    (name) =>
      `deployed program changed: ${name} (pinned ${short(pins[name])}, now ${short(snapshot.programs[name].sha256)})`,
  );
  for (const forkCase of FORK_CASES) {
    const support = forkCase.support[network];
    const upgraded =
      support === 'run'
        ? []
        : (support.until ?? []).filter((name) => changed.includes(name));
    if (support !== 'run' && upgraded.length) {
      findings.push(
        `READY TO ENABLE? ${caseId(forkCase)}: ${upgraded.join(', ')} changed since "${support.reason}"`,
      );
    }
  }
  return findings;
}

/** Every example file and every action in its usage string needs an entry. */
export function checkManifestCompleteness(root: string): void {
  const problems: string[] = [];
  for (const file of readdirSync(join(root, 'examples'))) {
    if (!/^solana-.*\.ts$/.test(file)) continue;
    const script = `examples/${file}`;
    const cases = FORK_CASES.filter((entry) => entry.script === script);
    if (cases.length === 0) problems.push(`${script} has no manifest entry`);
    const usage = readFileSync(join(root, script), 'utf8').match(
      /Usage: \S+ [<[]([\w|]+)[>\]]/,
    );
    for (const action of usage?.[1].split('|') ?? []) {
      if (!cases.some((entry) => entry.action === action)) {
        problems.push(`${script} ${action} has no manifest entry`);
      }
    }
  }
  if (problems.length) {
    throw new Error(`Fork manifest is incomplete:\n${problems.join('\n')}`);
  }
}
