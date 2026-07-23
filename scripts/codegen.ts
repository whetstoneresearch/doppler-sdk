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
import { createFromRoot, fixedSizeTypeNode, type RootNode } from 'codama';
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
  { idl_name: 'cpmm', out_dir: 'cpmm' },
  { idl_name: 'cpmm_migrator', out_dir: 'cpmmMigrator' },
  {
    idl_name: 'doppler_launch_hook_v1',
    out_dir: 'dopplerLaunchHookV1',
  },
  { idl_name: 'initializer', out_dir: 'initializer' },
  { idl_name: 'prediction_migrator', out_dir: 'predictionMigrator' },
  { idl_name: 'trusted_oracle', out_dir: 'trustedOracle' },
] as const;

type ProgramIdlName = (typeof PROGRAMS)[number]['idl_name'];

// InitConfig retains its original 2,123-byte allocation even though its typed
// fields now occupy 2,122 bytes. Model that retained byte in the outer account
// codec so every generated size API agrees with the on-chain allocation.
const ACCOUNT_ALLOCATION_OVERRIDES: Partial<
  Record<ProgramIdlName, Readonly<Record<string, number>>>
> = {
  cpmm_migrator: { initConfig: 2_123 },
  initializer: { initConfig: 2_123 },
  prediction_migrator: { initConfig: 2_123 },
};

function applyAccountAllocationOverrides(
  root: RootNode,
  overrides: Readonly<Record<string, number>> | undefined,
): RootNode {
  if (!overrides) return root;

  const missingAccountNames = new Set(Object.keys(overrides));
  const accounts = root.program.accounts.map((account) => {
    const allocationSize = overrides[account.name];
    if (allocationSize === undefined) return account;

    missingAccountNames.delete(account.name);
    return {
      ...account,
      size: allocationSize,
      data: fixedSizeTypeNode(account.data, allocationSize),
    };
  });

  if (missingAccountNames.size > 0) {
    throw new Error(
      `Account allocation overrides did not match generated accounts: ${[
        ...missingAccountNames,
      ].join(', ')}`,
    );
  }

  return {
    ...root,
    program: { ...root.program, accounts },
  };
}

fs.mkdirSync(IDL_DIR, { recursive: true });
fs.rmSync(GENERATED_DIR, { recursive: true, force: true });
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

  const root = applyAccountAllocationOverrides(
    rootNodeFromAnchor(idl),
    ACCOUNT_ALLOCATION_OVERRIDES[program.idl_name],
  );
  const codama = createFromRoot(root);
  await codama.accept(
    renderVisitor(output_dir, {
      deleteFolderBeforeRendering: true,
      generatedFolder: '.',
      syncPackageJson: false,
    }),
  );

  console.log(
    `  ✓ ${program.idl_name} → src/solana/generated/${program.out_dir}/`,
  );
}

const generated_index = `/**
 * Codama-generated clients for Doppler Solana programs.
 *
 * This file is generated by scripts/codegen.ts.
 */

${PROGRAMS.map(
  ({ out_dir }) => `export * as ${out_dir} from './${out_dir}/index.js';`,
).join('\n')}
`;
fs.writeFileSync(path.join(GENERATED_DIR, 'index.ts'), generated_index);

// Fix TS2308: Codama generates event types (e.g. AddLiquidity) in their own
// file (addLiquidity.ts) alongside an encoder-input type named AddLiquidityArgs.
// When the instruction-args file (addLiquidityArgs.ts) also exports AddLiquidityArgs,
// the barrel re-export `export * from './addLiquidity'` causes a name collision.
// Patch the cpmm types index to use explicit exports for the event files,
// dropping the conflicting *Args encoder-input type (the instruction-args
// version takes precedence as it is what SDK consumers actually use).
const cpmm_types_index_path = path.join(
  GENERATED_DIR,
  'cpmm',
  'types',
  'index.ts',
);
const CONFLICTING_EVENTS: Array<{ file: string; type: string; fns: string[] }> =
  [
    {
      file: 'addLiquidity',
      type: 'AddLiquidity',
      fns: [
        'getAddLiquidityEncoder',
        'getAddLiquidityDecoder',
        'getAddLiquidityCodec',
      ],
    },
    {
      file: 'collectFees',
      type: 'CollectFees',
      fns: [
        'getCollectFeesEncoder',
        'getCollectFeesDecoder',
        'getCollectFeesCodec',
      ],
    },
    {
      file: 'collectProtocolFees',
      type: 'CollectProtocolFees',
      fns: [
        'getCollectProtocolFeesEncoder',
        'getCollectProtocolFeesDecoder',
        'getCollectProtocolFeesCodec',
      ],
    },
    {
      file: 'redeemProtocolShares',
      type: 'RedeemProtocolShares',
      fns: [
        'getRedeemProtocolSharesEncoder',
        'getRedeemProtocolSharesDecoder',
        'getRedeemProtocolSharesCodec',
      ],
    },
    {
      file: 'removeLiquidity',
      type: 'RemoveLiquidity',
      fns: [
        'getRemoveLiquidityEncoder',
        'getRemoveLiquidityDecoder',
        'getRemoveLiquidityCodec',
      ],
    },
  ];
let cpmm_types_index = fs.readFileSync(cpmm_types_index_path, 'utf-8');
for (const { file, type, fns } of CONFLICTING_EVENTS) {
  const explicit_exports = [`type ${type}`, ...fns].join(', ');
  cpmm_types_index = cpmm_types_index.replace(
    new RegExp(`export \\* from '\\.\/${file}';`),
    `export { ${explicit_exports} } from './${file}';`,
  );
}
fs.writeFileSync(cpmm_types_index_path, cpmm_types_index);
console.log(
  '  ✓ patched cpmm/types/index.ts (resolved CPMM event/args naming collisions)',
);

console.log('\nCodegen complete.');
