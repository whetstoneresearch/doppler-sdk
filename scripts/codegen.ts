#!/usr/bin/env npx tsx
/**
 * Generate TypeScript codecs via Codama from committed IDL files.
 *
 * Reads IDL JSON from scripts/idl/ and generates TypeScript into
 * src/solana/generated/.
 *
 * Usage:
 *   pnpm generate:codecs
 */
import { createFromRoot } from 'codama';
import { rootNodeFromAnchor } from '@codama/nodes-from-anchor';
import { renderVisitor } from '@codama/renderers-js';
import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PACKAGE_ROOT = path.resolve(__dirname, '..');
const IDL_DIR = path.join(PACKAGE_ROOT, 'scripts', 'idl');
const GENERATED_DIR = path.join(PACKAGE_ROOT, 'src', 'solana', 'generated');

const PROGRAMS = [
  { idl_name: 'cpmm',                out_dir: 'cpmm' },
  { idl_name: 'cpmm_migrator',       out_dir: 'cpmmMigrator' },
  { idl_name: 'initializer',         out_dir: 'initializer' },
  { idl_name: 'prediction_migrator', out_dir: 'predictionMigrator' },
  { idl_name: 'trusted_oracle',      out_dir: 'trustedOracle' },
] as const;

fs.mkdirSync(IDL_DIR, { recursive: true });
fs.mkdirSync(GENERATED_DIR, { recursive: true });

// Flatten struct-typed instruction args into their constituent fields.
// Mirrors what Codama's flattenInstructionDataArgumentsVisitor does, but
// applied to the raw IDL JSON before rootNodeFromAnchor parses it — necessary
// because Codama resolves PDA seed paths against top-level arg names during
// import (not during a visitor pass), and throws if the name isn't found.
function flattenIdlInstructionArgs(idl: any): any {
  const type_map: Record<string, any[]> = {};
  for (const defined_type of idl.types ?? []) {
    if (defined_type.type?.kind === 'struct') {
      type_map[defined_type.name] = defined_type.type.fields ?? [];
    }
  }

  return {
    ...idl,
    instructions: idl.instructions?.map((ix: any) => {
      const flattened_args: any[] = [];
      for (const arg of ix.args ?? []) {
        const defined_name = arg.type?.defined?.name;
        const struct_fields = defined_name ? type_map[defined_name] : undefined;
        if (struct_fields) {
          flattened_args.push(...struct_fields);
        } else {
          flattened_args.push(arg);
        }
      }
      return { ...ix, args: flattened_args };
    }),
  };
}

console.log('\nGenerating TypeScript codecs...');
for (const program of PROGRAMS) {
  const idl_path = path.join(IDL_DIR, `${program.idl_name}.json`);
  const raw_idl = JSON.parse(fs.readFileSync(idl_path, 'utf-8'));
  const output_dir = path.join(GENERATED_DIR, program.out_dir);

  // `rootNodeFromAnchor` resolves PDA seed paths against instruction arg names
  // at parse time. When an instruction takes a struct arg (e.g. `args:
  // CreatePositionArgs`) but PDA seeds reference inner fields (e.g.
  // `position_id`), it throws before any visitor can flatten things.
  // Pre-flatten struct args in the IDL JSON so each field becomes a top-level
  // instruction arg, matching what `flattenInstructionDataArgumentsVisitor`
  // would do post-parse if the error didn't fire first.
  const idl = flattenIdlInstructionArgs(raw_idl);

  const codama = createFromRoot(rootNodeFromAnchor(idl));
  await codama.accept(renderVisitor(output_dir, {
    deleteFolderBeforeRendering: true,
    generatedFolder: '.',
    syncPackageJson: false,
  }));

  console.log(`  ✓ ${program.idl_name} → src/solana/generated/${program.out_dir}/`);
}

console.log('\nCodegen complete.');
