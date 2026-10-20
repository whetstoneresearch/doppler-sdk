import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';

const [outputPath, network = 'mainnet'] = process.argv.slice(2);
if (!outputPath || !['devnet', 'mainnet'].includes(network)) {
  throw new Error(
    'Usage: node scripts/prepare-solana-initializer-candidate.mjs <output.so> [devnet|mainnet]',
  );
}

const fixtureDirectory = new URL(
  '../test/solana/fixtures/initializer-v2/',
  import.meta.url,
);
const manifest = JSON.parse(
  readFileSync(new URL('manifest.json', fixtureDirectory), 'utf8'),
);
const artifact = manifest.artifacts[network];
const binary = gunzipSync(
  readFileSync(new URL(artifact.file, fixtureDirectory)),
);
const sha256 = createHash('sha256').update(binary).digest('hex');
if (sha256 !== artifact.sha256 || binary.length !== artifact.bytes) {
  throw new Error(`${network} initializer fixture does not match its manifest`);
}
writeFileSync(outputPath, binary);
console.log(
  `Using ${network} initializer candidate from ${manifest.repository}@${manifest.revision} (sha256 ${sha256})`,
);
