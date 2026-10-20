import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';

const [outputPath] = process.argv.slice(2);
if (!outputPath) {
  throw new Error(
    'Usage: node scripts/prepare-solana-initializer-candidate.mjs <output.so>',
  );
}

const fixtureDirectory = new URL(
  '../test/solana/fixtures/initializer-v2/',
  import.meta.url,
);
const manifest = JSON.parse(
  readFileSync(new URL('manifest.json', fixtureDirectory), 'utf8'),
);
const artifact = manifest.artifacts.mainnet;
const binary = gunzipSync(
  readFileSync(new URL(artifact.file, fixtureDirectory)),
);
const sha256 = createHash('sha256').update(binary).digest('hex');
if (sha256 !== artifact.sha256 || binary.length !== artifact.bytes) {
  throw new Error('Mainnet initializer fixture does not match its manifest');
}
writeFileSync(outputPath, binary);
console.log(
  `Using mainnet initializer candidate from ${manifest.repository}@${manifest.revision} (sha256 ${sha256})`,
);
