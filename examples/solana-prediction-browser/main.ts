import './style.css';
import {
  fetchToken,
  fetchMint,
  fetchMaybeToken,
  findAssociatedTokenPda,
  TOKEN_PROGRAM_ADDRESS,
} from '@solana-program/token';
import {
  fetchMaybeClaimReceipt,
  fetchEntry,
  getPredictionClaimReceiptAddress,
  getPredictionEntryAddress,
} from '../../src/solana/migrators/predictionMigrator/index.ts';
import { fetchLaunchFeeState } from '../../src/solana/generated/initializer/accounts/launchFeeState.ts';
import { getWallets } from '@wallet-standard/app';
import type { Wallet, WalletAccount } from '@wallet-standard/base';
import type {
  StandardConnectFeature,
  StandardEventsFeature,
} from '@wallet-standard/features';
import type { SolanaSignAndSendTransactionFeature } from '@solana/wallet-standard-features';
import {
  address,
  createSolanaRpc,
  createNoopSigner,
  generateKeyPairSigner,
  createTransactionMessage,
  setTransactionMessageFeePayerSigner,
  setTransactionMessageLifetimeUsingBlockhash,
  appendTransactionMessageInstructions,
  partiallySignTransactionMessageWithSigners,
  getTransactionEncoder,
  getBase64EncodedWireTransaction,
  getTransactionMessageSize,
  lamports,
  getBase58Decoder,
  pipe,
  type Instruction,
} from '@solana/kit';
import {
  buildAddressLookupTableSetupInstructions,
  getInstructionLookupTableAddresses,
  compressTransactionMessageWithLookupTable,
} from '../../src/solana/initializer/addressLookupTables.ts';
import * as prediction from '../../src/solana/predictionMarkets/index.ts';
import {
  fetchLaunch,
  fetchLaunchesByAuthority,
} from '../../src/solana/initializer/client/launch.ts';
import {
  getLaunchAuthorityAddress,
  getLaunchFeeStateAddress,
  getConfigAddress,
} from '../../src/solana/initializer/pda.ts';
import { fetchMarket } from '../../src/solana/generated/predictionMigrator/accounts/market.ts';
import { fetchOracleState } from '../../src/solana/generated/trustedOracle/accounts/oracleState.ts';

const $ = <T extends HTMLElement = HTMLElement>(id: string) =>
  document.getElementById(id) as T;
const value = (id: string) => $<HTMLInputElement>(id).value.trim();
const json = (x: unknown) =>
  JSON.stringify(
    x,
    (_, v) =>
      typeof v === 'bigint'
        ? v.toString()
        : v instanceof Uint8Array
          ? Array.from(v)
          : v,
    2,
  );
$('app').innerHTML = `<main>
<header><div class="brand">Doppler / developer examples</div><span class="tag">Devnet & local validator</span></header>
<h1>Prediction markets, end to end.</h1><p class="intro">Create a market, buy an outcome, and follow settlement through to payout. Connect a browser wallet to sign each transaction. Markets stay open until their oracle is finalized.</p>
<div class="steps"><span>01 Create</span><span>02 Register every outcome</span><span>03 Buy</span><span>04 Finalize</span><span>05 Settle & claim</span></div>
<div class="grid"><section class="card"><h2>Connection</h2><label for="network">Network</label><select id="network"><option value="devnet">Devnet</option><option value="local">Local validator</option></select><label for="rpc">RPC endpoint</label><input id="rpc" value="https://api.devnet.solana.com"><div id="deployment-gate" class="status error">Devnet transactions are disabled: its current deployment has not been verified against the merged prediction ABI. Use a local validator with freshly built matching programs for this walkthrough.</div><label for="wallet">Wallet</label><select id="wallet"></select><button id="connect">Connect wallet</button><button id="disconnect" class="secondary">Disconnect</button><button id="local-wallet" class="secondary">Use local test wallet</button><small>Local test wallet: creates an in-memory key and requests 10 local test SOL. Only a loopback validator with a non-public genesis is allowed. The key disappears on reload, disconnect, or network/RPC change.</small><small id="wallet-account">No wallet connected. Install a Wallet Standard Solana wallet to sign.</small></section>
<section class="card"><h2>Inspect a market</h2><label for="manifest-file">Import public CLI manifest or browser session</label><input id="manifest-file" type="file" accept="application/json,.json"><button id="import" class="secondary">Import addresses</button><label for="imported-market">Imported market</label><select id="imported-market"><option value="">No manifest imported</option></select><label for="market">Market address</label><input id="market" placeholder="Paste a market address from an example run"><button id="inspect">Load market</button><p id="market-summary">Load an existing market, or create one below.</p><details><summary>Decoded on-chain state</summary><pre id="state">No market loaded.</pre></details></section>
<section class="card"><h2>Creator · set up</h2><label for="labels">Outcome labels, separated by commas</label><input id="labels" value="YES, NO"><small>Labels encode canonical 32-byte IDs. Declare 2–8 unique outcomes.</small><label for="nonce">Oracle nonce</label><input id="nonce" value="${Date.now()}"><button id="create-oracle">Create oracle</button><label for="oracle">Oracle address · new or existing</label><input id="oracle" placeholder="Create an oracle above, or paste one"><label for="quote">Quote mint</label><input id="quote" value="So11111111111111111111111111111111111111112"><button id="create-market">Create market</button><small>Defaults to wrapped SOL. This example supports classic SPL Token. Creating a market does not register outcomes.</small></section>
<section class="card"><h2>Creator · register outcomes</h2><label for="outcome">Outcome slot</label><select id="outcome"><option value="0">Load a market first</option></select><div class="row"><div><label for="supply">Supply, raw units</label><input id="supply" value="1000000000000000"></div><div><label for="decimals">Token decimals</label><input id="decimals" value="6" type="number" min="0" max="9"></div></div><div class="row"><div><label for="virtual-base">Virtual base, raw units</label><input id="virtual-base" value="2000000000000000"></div><div><label for="virtual-quote">Virtual quote, raw units</label><input id="virtual-quote" value="1000000000"></div></div><button id="register">Register selected outcome</button><small>Repeat for every slot before buying. Each outcome is a buy-only curve. Ephemeral mint/vault keys are generated in memory and never exported.</small></section>
<section class="card"><h2>Participant · buy</h2><label for="launch">Outcome launch address</label><input id="launch" placeholder="Auto-filled when an outcome is selected"><div class="row"><div><label for="amount">Quote amount, raw units</label><input id="amount" value="1000000"></div><div><label for="minimum">Minimum tokens out, raw units</label><input id="minimum" placeholder="Required slippage protection"></div></div><button id="quote-buy" class="secondary">Preview buy · 0.5% slippage</button><button id="buy">Buy outcome</button><small id="buy-quote">Fetch a current quote before buying.</small><small>For wrapped SOL, the SDK wraps the input amount. Independent curve prices are not normalized probabilities. Set a positive minimum based on your acceptable price.</small></section>
<section class="card"><h2>Oracle authority · resolve</h2><label for="winner">Winning outcome slot</label><select id="winner"><option value="0">Load a market first</option></select><button id="finalize">Finalize oracle</button><small>Finalization is irreversible and closes buying across every market sharing this oracle. Only its authority can sign. Select the actual winning outcome.</small><hr><button id="settle" class="secondary">Settle selected launch</button><small>Anyone may settle. Select each outcome above and settle it; already settled entries can be skipped. Winner settlement enables payouts.</small></section>
<section class="card"><h2>Participant · receive payout</h2><label for="burn">Tokens to burn, raw units</label><input id="burn" value="0"><button id="preview-payout" class="secondary">Preview payout & balance</button><button id="claim">Claim winnings</button><button id="harvest" class="secondary">Harvest later proceeds</button><button id="refund" class="secondary">Refund void outcome</button><small id="payout-preview">Preview uses the current pot only; future settlements may add proceeds.</small><small>Claims burn winner tokens. Harvest uses the existing claim receipt after more entries settle. Void refunds burn tokens from the selected outcome and return its available contribution; losing tokens in a normal market have no payout.</small></section>
<section class="card"><h2>Transaction activity</h2><div id="status" class="status" role="status">Ready. Connect your wallet to begin.</div><div id="receipts"></div><button id="export" class="secondary">Download public session state</button><small>Exports addresses and signatures only. Refresh the market after reopening to continue an interrupted workflow.</small></section></div></main>`;

type SigningWallet = Wallet & {
  features: StandardConnectFeature &
    SolanaSignAndSendTransactionFeature &
    Partial<StandardEventsFeature>;
};
let wallet: SigningWallet | undefined;
let account: WalletAccount | undefined;
let unsubscribe: (() => void) | undefined;
let marketData: Awaited<ReturnType<typeof fetchMarket>>['data'] | undefined;
let oracleData:
  | Awaited<ReturnType<typeof fetchOracleState>>['data']
  | undefined;
let launches: Awaited<ReturnType<typeof fetchLaunchesByAuthority>> = [];
const receipts: { action: string; signature: string; network: string }[] = [];
let busy = false;
let localSigner: Awaited<ReturnType<typeof generateKeyPairSigner>> | undefined;
let localGenesis: string | undefined;
const publicGenesisHashes = new Set([
  'EtWTRABZaYq6iMfeYKouRu166VU2xqa1wcaWoxPkrZBG',
  '4uhcVJyU9pJkvQyS88uRDiswHXSCkY3zQawwpjk2NsNY',
  '5eykt4UsFv8P8NJdTREpY1vzqKqZKvdpKuc147dw2N9d',
]);
function clearLocalWallet() {
  localSigner = undefined;
  localGenesis = undefined;
}
async function assertLocalValidator() {
  const endpoint = new URL(value('rpc'));
  if (
    value('network') !== 'local' ||
    !['127.0.0.1', 'localhost', '[::1]'].includes(endpoint.hostname) ||
    !['http:', 'https:'].includes(endpoint.protocol) ||
    endpoint.username ||
    endpoint.password
  )
    throw new Error('Local test wallets require a loopback validator RPC.');
  const client = rpc();
  const genesis = await client.getGenesisHash().send();
  if (publicGenesisHashes.has(genesis))
    throw new Error(
      'Local test wallets cannot use a public-cluster genesis, including through a localhost proxy.',
    );
  if (localGenesis && localGenesis !== genesis) {
    clearLocalWallet();
    throw new Error(
      'Validator genesis changed. Create a fresh local test wallet.',
    );
  }
  return { client, genesis };
}
const rpc = () => {
  const endpoint = new URL(value('rpc'));
  const local = ['127.0.0.1', 'localhost', '[::1]'].includes(endpoint.hostname);
  if (
    value('network') === 'local'
      ? !local
      : endpoint.hostname !== 'api.devnet.solana.com'
  )
    throw new Error(
      'This example allows the public devnet endpoint or a localhost validator. Choose the matching network.',
    );
  return createSolanaRpc(endpoint.toString());
};
const chain = () =>
  value('network') === 'devnet'
    ? ('solana:devnet' as const)
    : ('solana:localnet' as const);
function describeError(error: unknown): string {
  const parts = [error instanceof Error ? error.message : String(error)];
  const seen = new Set<unknown>();
  function visit(value: unknown, depth: number) {
    if (!value || typeof value !== 'object' || depth > 5 || seen.has(value))
      return;
    seen.add(value);
    const record = value as Record<string, unknown>;
    if (Array.isArray(record.logs))
      parts.push(
        ...record.logs
          .filter((line): line is string => typeof line === 'string')
          .slice(-40),
      );
    if (typeof record.__serverMessage === 'string')
      parts.push(record.__serverMessage);
    if (record.err) parts.push(`RPC error: ${json(record.err)}`);
    for (const key of ['cause', 'context', 'data', 'error'])
      visit(record[key], depth + 1);
  }
  visit(error, 0);
  return Array.from(new Set(parts)).join('\n').slice(0, 12000);
}
function status(message: string, error = false) {
  $('status').textContent = message;
  $('status').classList.toggle('error', error);
}
function signer() {
  if (localSigner) {
    if (value('network') !== 'local')
      throw new Error('Local test wallet is restricted to local validators.');
    return localSigner;
  }
  if (!account || !wallet) throw new Error('Connect a wallet first.');
  if (!account.chains.includes(chain()))
    throw new Error(
      `Wallet account does not support ${chain()}. Switch the wallet network or use a compatible wallet.`,
    );
  return createNoopSigner(address(account.address));
}
function refreshWallets() {
  const current = value('wallet');
  const candidates = getWallets()
    .get()
    .filter(
      (w) =>
        w.chains.some((c) => c.startsWith('solana:')) &&
        'standard:connect' in w.features &&
        'solana:signAndSendTransaction' in w.features,
    );
  $<HTMLSelectElement>('wallet').replaceChildren(
    ...candidates.map((w, i) => new Option(w.name, String(i))),
  );
  if (candidates.length === 0)
    $<HTMLSelectElement>('wallet').add(
      new Option('No supported wallet found', ''),
    );
  else if (current) $<HTMLSelectElement>('wallet').value = current;
  return candidates;
}
getWallets().on('register', refreshWallets);
getWallets().on('unregister', refreshWallets);
refreshWallets();
function requireMarket() {
  if (!marketData || !oracleData) throw new Error('Load a market first.');
  if (marketData.oracle !== value('oracle'))
    throw new Error('Oracle input changed; reload the market.');
  return {
    market: marketData,
    oracle: oracleData,
    marketAddress: address(value('market')),
  };
}
async function send(action: string, instructions: readonly Instruction[]) {
  if (value('network') === 'devnet')
    throw new Error(
      'Devnet transactions are disabled until the deployed stack is verified against the prediction refactor. Use a matching local validator.',
    );
  const payer = signer();
  const client = rpc();
  const blockhash = (
    await client.getLatestBlockhash({ commitment: 'confirmed' }).send()
  ).value;
  const message = pipe(
    createTransactionMessage({ version: 0 }),
    (tx) => setTransactionMessageFeePayerSigner(payer, tx),
    (tx) => setTransactionMessageLifetimeUsingBlockhash(blockhash, tx),
    (tx) => appendTransactionMessageInstructions(instructions, tx),
  );
  const versions = localSigner
    ? ['legacy', 0]
    : wallet!.features['solana:signAndSendTransaction']
        .supportedTransactionVersions;
  let transaction;
  if (getTransactionMessageSize(message) <= 1232 && versions.includes(0)) {
    transaction = await partiallySignTransactionMessageWithSigners(message);
  } else {
    const legacyMessage = pipe(
      createTransactionMessage({ version: 'legacy' }),
      (tx) => setTransactionMessageFeePayerSigner(payer, tx),
      (tx) => setTransactionMessageLifetimeUsingBlockhash(blockhash, tx),
      (tx) => appendTransactionMessageInstructions(instructions, tx),
    );
    if (
      getTransactionMessageSize(legacyMessage) <= 1232 &&
      versions.includes('legacy')
    ) {
      transaction =
        await partiallySignTransactionMessageWithSigners(legacyMessage);
    } else {
      if (!versions.includes(0))
        throw new Error(
          'This transaction requires a wallet supporting v0 address lookup tables.',
        );
      status(
        `${action}: preparing an address lookup table for transaction size…`,
      );
      const table = await buildAddressLookupTableSetupInstructions({
        authority: await generateKeyPairSigner(),
        payer,
        recentSlot: await client.getSlot({ commitment: 'finalized' }).send(),
        addresses: getInstructionLookupTableAddresses(instructions),
      });
      // Separate setup transactions stay below the packet limit, even for larger address sets.
      await send(`${action} · create lookup table`, [table.createInstruction]);
      for (const instruction of table.extendInstructions)
        await send(`${action} · extend lookup table`, [instruction]);
      const setupSlot = await client
        .getSlot({ commitment: 'confirmed' })
        .send();
      let ready = false;
      for (let attempt = 0; attempt < 40; attempt++) {
        if (
          (await client.getSlot({ commitment: 'confirmed' }).send()) > setupSlot
        ) {
          ready = true;
          break;
        }
        await new Promise((resolve) => setTimeout(resolve, 250));
      }
      if (!ready)
        throw new Error(
          'Lookup table is confirmed but its addresses have not activated. Wait for the validator to advance before retrying.',
        );
      const freshBlockhash = (
        await client.getLatestBlockhash({ commitment: 'confirmed' }).send()
      ).value;
      const compressed = compressTransactionMessageWithLookupTable(
        setTransactionMessageLifetimeUsingBlockhash(freshBlockhash, message),
        table,
      );
      if (getTransactionMessageSize(compressed) > 1232)
        throw new Error(
          'Transaction exceeds 1232 bytes even with a lookup table. Reduce instruction data.',
        );
      transaction =
        await partiallySignTransactionMessageWithSigners(compressed);
    }
  }
  let signature: string;
  if (localSigner) {
    await assertLocalValidator();
    status(`${action}: signing with the ephemeral local test wallet…`);
    signature = await client
      .sendTransaction(getBase64EncodedWireTransaction(transaction), {
        encoding: 'base64',
        preflightCommitment: 'confirmed',
        skipPreflight: false,
      })
      .send();
  } else {
    status(`${action}: waiting for wallet approval…`);
    const [result] = await wallet!.features[
      'solana:signAndSendTransaction'
    ].signAndSendTransaction({
      account: account!,
      chain: chain(),
      transaction: new Uint8Array(getTransactionEncoder().encode(transaction)),
      options: { preflightCommitment: 'confirmed' },
    });
    signature = getBase58Decoder().decode(result.signature);
  }
  receipts.push({ action, signature, network: value('network') });
  const receipt = document.createElement('p');
  receipt.textContent = `${action} · submitted ${signature}`;
  $('receipts').prepend(receipt);
  status(`${action}: submitted ${signature}; waiting for confirmation…`);
  for (let attempt = 0; attempt < 60; attempt++) {
    const s = (
      await client
        .getSignatureStatuses([
          signature as Parameters<
            typeof client.getSignatureStatuses
          >[0][number],
        ])
        .send()
    ).value[0];
    if (s?.err)
      throw new Error(`Transaction failed: ${json(s.err)} (${signature})`);
    if (
      s?.confirmationStatus === 'confirmed' ||
      s?.confirmationStatus === 'finalized'
    ) {
      receipt.textContent = `${action} · confirmed ${signature}`;
      status(`${action}: confirmed.`);
      return;
    }
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }
  throw new Error(
    `Confirmation timed out. Transaction may still land: ${signature}. Check the signature and refresh state before retrying.`,
  );
}
async function loadMarket() {
  const client = rpc();
  const {
    market,
    oracle,
    status: marketStatus,
  } = await prediction.fetchPredictionMarket(client, address(value('market')));
  marketData = market.data;
  oracleData = oracle.data;
  $<HTMLInputElement>('oracle').value = marketData.oracle;
  $<HTMLInputElement>('quote').value = marketData.quoteMint;
  launches = await fetchLaunchesByAuthority(client, marketData.creator, {
    commitment: 'confirmed',
  });
  const names = oracleData.outcomeIds.slice(0, oracleData.outcomeCount).map(
    (id, i) =>
      `${i + 1} · ${Array.from(id)
        .map((b) => b.toString(16).padStart(2, '0'))
        .join('')
        .slice(0, 16)}…`,
  );
  for (const id of ['outcome', 'winner']) {
    const prior = value(id);
    $<HTMLSelectElement>(id).replaceChildren(
      ...names.map((name, i) => new Option(name, String(i))),
    );
    if (Number(prior) < names.length) $<HTMLSelectElement>(id).value = prior;
  }
  $('state').textContent = json({
    market: marketData,
    oracle: oracleData,
    launches,
  });
  const registered = marketData.registeredBitmap
    .toString(2)
    .replace(/0/g, '').length;
  $('market-summary').textContent =
    `${registered}/${marketData.outcomeCount} outcomes registered · ${marketStatus.allEntriesSettled ? (marketData.isVoid ? 'Void: all outcomes settled; remaining holders can refund' : marketData.totalClaimed === marketData.totalPot ? 'Resolved: all outcomes settled and the current pot is fully paid' : 'Resolved: all outcomes settled; eligible holders and claim receipts can collect remaining proceeds') : marketData.isVoid ? 'Void: settle remaining outcomes for refunds' : marketData.isResolved ? 'Resolved: settle remaining entries and claim' : oracleData.isFinalized ? 'Oracle finalized: settle entries' : registered === marketData.outcomeCount ? 'Open for buying' : 'Registration incomplete'}. Pot received: ${marketData.totalPot} raw quote units. Paid: ${marketData.totalClaimed}.`;
  selectOutcome();
}
function selectOutcome() {
  if (!marketData) return;
  const mint = marketData.outcomeMints[Number(value('outcome'))];
  const launch = launches.find(
    (l) =>
      l.account.baseMint === mint && l.account.namespace === marketData!.oracle,
  );
  $<HTMLInputElement>('launch').value = launch?.address ?? '';
}
async function launchInput() {
  const { market, marketAddress } = requireMarket();
  const launch = address(value('launch'));
  const data = await fetchLaunch(rpc(), launch, { commitment: 'confirmed' });
  if (
    !data ||
    data.quoteMint !== market.quoteMint ||
    !market.outcomeMints.includes(data.baseMint) ||
    data.namespace !== market.oracle ||
    data.authority !== market.creator
  )
    throw new Error('Launch does not belong to this market.');
  const [[launchAuthority], [launchFeeState], [config]] = await Promise.all([
    getLaunchAuthorityAddress(launch),
    getLaunchFeeStateAddress(launch),
    getConfigAddress(),
  ]);
  return {
    ...data,
    launch,
    launchAuthority,
    launchFeeState,
    config,
    oracle: market.oracle,
    market: marketAddress,
    payer: signer(),
  };
}
function action(id: string, work: () => Promise<void>) {
  $(id).addEventListener('click', async () => {
    if (busy) return;
    busy = true;
    document
      .querySelectorAll<
        HTMLButtonElement | HTMLInputElement | HTMLSelectElement
      >('button, input, select')
      .forEach((b) => (b.disabled = true));
    try {
      await work();
    } catch (e) {
      status(describeError(e), true);
    } finally {
      busy = false;
      document
        .querySelectorAll<
          HTMLButtonElement | HTMLInputElement | HTMLSelectElement
        >('button, input, select')
        .forEach((b) => (b.disabled = false));
    }
  });
}
action('import', async () => {
  const file = $<HTMLInputElement>('manifest-file').files?.[0];
  if (!file)
    throw new Error(
      'Select a public CLI manifest or browser session JSON file.',
    );
  if (file.size > 1_000_000) throw new Error('Manifest exceeds 1 MB.');
  const data = JSON.parse(await file.text());
  if (!data || typeof data !== 'object' || Array.isArray(data))
    throw new Error('Invalid public manifest.');
  const oracle = address(data.oracle);
  const markets = Array.isArray(data.markets)
    ? data.markets.map((m: { market: string }) => address(m.market))
    : [address(data.market)];
  if (!markets.length) throw new Error('Manifest has no markets.');
  if (
    data.genesisHash &&
    data.genesisHash !== (await rpc().getGenesisHash().send())
  )
    throw new Error(
      'Manifest belongs to a different network. Select its network before importing.',
    );
  if (
    data.network &&
    ['devnet', 'local'].includes(data.network) &&
    data.network !== value('network')
  )
    throw new Error('Select the manifest network before importing.');
  $<HTMLInputElement>('oracle').value = oracle;
  $<HTMLSelectElement>('imported-market').replaceChildren(
    ...markets.map(
      (m: string, i: number) =>
        new Option(`Market ${i + 1} · ${m.slice(0, 12)}…`, m),
    ),
  );
  $<HTMLInputElement>('market').value = markets[0];
  marketData = undefined;
  oracleData = undefined;
  launches = [];
  await loadMarket();
  status('Imported public addresses and refreshed on-chain state.');
});
$('imported-market').addEventListener('change', () => {
  $<HTMLInputElement>('market').value = value('imported-market');
  marketData = undefined;
  oracleData = undefined;
  launches = [];
  status('Imported market selected. Load it to refresh state.');
});
action('local-wallet', async () => {
  if (localSigner) {
    await assertLocalValidator();
    status(
      `Using existing local test wallet ${localSigner.address}. Disconnect to discard it.`,
    );
    return;
  }
  const { client, genesis } = await assertLocalValidator();
  unsubscribe?.();
  account = undefined;
  wallet = undefined;
  clearLocalWallet();
  const generated = await generateKeyPairSigner();
  status('Requesting 10 SOL from the local validator faucet…');
  const signature = await client
    .requestAirdrop(generated.address, lamports(10_000_000_000n), {
      commitment: 'confirmed',
    })
    .send();
  for (let attempt = 0; attempt < 30; attempt++) {
    const result = (await client.getSignatureStatuses([signature]).send())
      .value[0];
    if (result?.err)
      throw new Error(`Local airdrop failed: ${json(result.err)}`);
    if (
      result?.confirmationStatus === 'confirmed' ||
      result?.confirmationStatus === 'finalized'
    ) {
      localSigner = generated;
      localGenesis = genesis;
      $('wallet-account').textContent =
        `Local test wallet · ${generated.address}`;
      status(
        `Local test wallet funded with 10 local SOL. Airdrop confirmed: ${signature}`,
      );
      return;
    }
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }
  throw new Error(
    `Local airdrop confirmation timed out: ${signature}. No test wallet retained.`,
  );
});
action('connect', async () => {
  clearLocalWallet();
  wallet = refreshWallets()[Number(value('wallet'))] as
    | SigningWallet
    | undefined;
  if (!wallet)
    throw new Error(
      'No supported wallet found. Install or enable a Solana Wallet Standard extension.',
    );
  const result = await wallet.features['standard:connect'].connect();
  account = result.accounts.find((a) => a.chains.includes(chain()));
  if (!account) throw new Error(`No wallet account supports ${chain()}.`);
  unsubscribe?.();
  unsubscribe = wallet.features['standard:events']?.on('change', (changes) => {
    if (changes.accounts) {
      account = changes.accounts.find((a) => a.chains.includes(chain()));
      $('wallet-account').textContent =
        account?.address ?? 'Wallet disconnected.';
    }
  });
  $('wallet-account').textContent = account.address;
  status('Wallet connected.');
});
action('disconnect', async () => {
  clearLocalWallet();
  unsubscribe?.();
  account = undefined;
  wallet = undefined;
  $('wallet-account').textContent = 'Wallet disconnected.';
  status('Wallet disconnected.');
});
action('inspect', async () => {
  await loadMarket();
  status('Market state refreshed from RPC.');
});
action('create-oracle', async () => {
  const plan = await prediction.prepareOracle({
    oracleAuthority: signer(),
    nonce: BigInt(value('nonce')),
    outcomeIds: value('labels')
      .split(',')
      .map((label) => prediction.outcomeIdFromLabel(label.trim())),
  });
  $<HTMLInputElement>('oracle').value = plan.oracle;
  await send('Create oracle', plan.instructions);
});
action('create-market', async () => {
  const plan = await prediction.prepareMarket({
    creator: signer(),
    oracle: address(value('oracle')),
    quoteMint: address(value('quote')),
  });
  $<HTMLInputElement>('market').value = plan.market;
  await send('Create market', plan.instructions);
  await loadMarket();
});
action('register', async () => {
  const { market, oracle } = requireMarket();
  const creator = signer();
  if (creator.address !== market.creator)
    throw new Error('Connect the market creator wallet to register outcomes.');
  const slot = Number(value('outcome'));
  if (market.registeredBitmap & (1 << slot))
    throw new Error('This outcome is already registered. Choose another slot.');
  const [baseMint, baseVault, quoteVault] = await Promise.all([
    generateKeyPairSigner(),
    generateKeyPairSigner(),
    generateKeyPairSigner(),
  ]);
  const plan = await prediction.prepareOutcomeLaunch({
    oracle: market.oracle,
    creator,
    outcomeId: new Uint8Array(oracle.outcomeIds[slot]),
    launch: {
      payer: creator,
      feeBeneficiaries: [{ wallet: creator.address, shareBps: 10_000 }],
      launchAccounts: {
        baseMint,
        baseVault,
        quoteVault,
        quoteMint: market.quoteMint,
      },
      supply: {
        baseDecimals: Number(value('decimals')),
        baseTotalSupply: BigInt(value('supply')),
        baseForDistribution: 0n,
        baseForLiquidity: 0n,
      },
      curve: {
        curveVirtualBase: BigInt(value('virtual-base')),
        curveVirtualQuote: BigInt(value('virtual-quote')),
        swapFeeBps: 0,
      },
    },
  });
  $<HTMLInputElement>('launch').value = plan.addresses.launch;
  await send('Register outcome', plan.instructions);
  await loadMarket();
});
action('quote-buy', async () => {
  await loadMarket();
  if (oracleData!.isFinalized)
    throw new Error('Buying is closed: the oracle is finalized.');
  if (marketData!.registeredBitmap !== (1 << marketData!.outcomeCount) - 1)
    throw new Error('Register every outcome before buying.');
  const launch = await launchInput();
  const client = rpc();
  const [base, quote, fees] = await Promise.all([
    fetchToken(client, launch.baseVault, { commitment: 'confirmed' }),
    fetchToken(client, launch.quoteVault, { commitment: 'confirmed' }),
    fetchLaunchFeeState(client, launch.launchFeeState, {
      commitment: 'confirmed',
    }),
  ]);
  const pendingBase =
    fees.data.cumulatedBaseFees -
    fees.data.distributedProtocolBaseFees -
    fees.data.distributedBaseByBeneficiary
      .slice(0, fees.data.beneficiaryLen)
      .reduce((a, b) => a + b, 0n);
  const pendingQuote =
    fees.data.cumulatedQuoteFees -
    fees.data.distributedProtocolQuoteFees -
    fees.data.distributedQuoteByBeneficiary
      .slice(0, fees.data.beneficiaryLen)
      .reduce((a, b) => a + b, 0n);
  const quoteResult = prediction.quoteBuy({
    amountIn: BigInt(value('amount')),
    baseReserve:
      base.data.amount -
      launch.baseForDistribution -
      launch.baseForLiquidity -
      pendingBase,
    quoteReserve: quote.data.amount - pendingQuote,
    virtualBase: launch.curveVirtualBase,
    virtualQuote: launch.curveVirtualQuote,
    swapFeeBps: launch.swapFeeBps,
    slippageBps: 50,
  });
  $<HTMLInputElement>('minimum').value = String(quoteResult.minAmountOut);
  $('buy-quote').textContent =
    `Estimated ${quoteResult.amountOut} raw tokens; minimum ${quoteResult.minAmountOut}. Fee ${quoteResult.feeAmount} raw quote units. Quote can change before confirmation.`;
  status('Buy quote refreshed from vault balances and pending fees.');
});
action('buy', async () => {
  const minAmountOut = BigInt(value('minimum'));
  if (minAmountOut <= 0n)
    throw new Error(
      'Enter a positive minimum token amount to protect your buy.',
    );
  const plan = await prediction.prepareBuy({
    ...(await launchInput()),
    amountIn: BigInt(value('amount')),
    minAmountOut,
    wrapSol: true,
  });
  await send('Buy outcome', plan.instructions);
  await loadMarket();
});
action('finalize', async () => {
  const { market, oracle } = requireMarket();
  const authority = signer();
  if (authority.address !== oracle.oracleAuthority)
    throw new Error('Connect the oracle authority wallet to finalize.');
  const plan = prediction.prepareFinalize({
    oracleAuthority: authority,
    oracle: market.oracle,
    winningOutcomeId: new Uint8Array(
      oracle.outcomeIds[Number(value('winner'))],
    ),
  });
  await send('Finalize oracle', plan.instructions);
  await loadMarket();
});
action('settle', async () => {
  const plan = await prediction.prepareSettlement(await launchInput());
  await send('Settle outcome', plan.instructions);
  await loadMarket();
});
action('preview-payout', async () => {
  await loadMarket();
  const { market, marketAddress } = requireMarket();
  const owner = signer().address;
  const client = rpc();
  const mint = market.isVoid
    ? market.outcomeMints[Number(value('outcome'))]
    : market.winnerMint;
  const [ata] = await findAssociatedTokenPda({
    owner,
    mint,
    tokenProgram: TOKEN_PROGRAM_ADDRESS,
  });
  const balance = await fetchMaybeToken(client, ata, {
    commitment: 'confirmed',
  });
  const amount = balance.exists ? balance.data.amount : 0n;
  const burnAmount = BigInt(value('burn'));
  if (burnAmount > amount)
    throw new Error(`Burn exceeds wallet balance (${amount} raw units).`);
  if (market.isVoid) {
    const [entryAddress] = await getPredictionEntryAddress(marketAddress, mint);
    const [entry, mintAccount] = await Promise.all([
      fetchEntry(client, entryAddress, { commitment: 'confirmed' }),
      fetchMint(client, mint, { commitment: 'confirmed' }),
    ]);
    const result = prediction.previewRefund({
      entry: entry.data,
      isVoid: true,
      burnAmount,
      currentMintSupply: mintAccount.data.supply,
    });
    $('payout-preview').textContent =
      `Wallet balance: ${amount} raw tokens. Current refund: ${result.refundAmount} raw quote units for burning ${burnAmount}.`;
  } else {
    const [receiptAddress] = await getPredictionClaimReceiptAddress(
      marketAddress,
      owner,
    );
    const receipt = await fetchMaybeClaimReceipt(client, receiptAddress, {
      commitment: 'confirmed',
    });
    const result = prediction.previewClaim({
      market,
      receipt: receipt.exists ? receipt.data : undefined,
      burnAmount,
    });
    $('payout-preview').textContent =
      `Wallet balance: ${amount} raw winner tokens. Claimable now: ${result.claimableNow} raw quote units for burning ${burnAmount}. Future unsettled contributions are excluded.`;
  }
  status('Payout preview refreshed from on-chain state.');
});
async function claim(harvest: boolean) {
  const { market, marketAddress } = requireMarket();
  const claimer = signer();
  const input = {
    market: marketAddress,
    potVault: market.potVault,
    winnerMint: market.winnerMint,
    quoteMint: market.quoteMint,
    claimer,
    payer: claimer,
  };
  const plan = harvest
    ? await prediction.prepareHarvest(input)
    : await prediction.prepareClaim({
        ...input,
        burnAmount: BigInt(value('burn')),
      });
  await send(
    harvest ? 'Harvest proceeds' : 'Claim winnings',
    plan.instructions,
  );
  await loadMarket();
}
action('claim', () => claim(false));
action('harvest', () => claim(true));
action('refund', async () => {
  const { market, marketAddress } = requireMarket();
  const refunder = signer();
  if (!market.isVoid) throw new Error('Refunds apply only to void markets.');
  const plan = await prediction.prepareRefund({
    market: marketAddress,
    potVault: market.potVault,
    baseMint: market.outcomeMints[Number(value('outcome'))],
    quoteMint: market.quoteMint,
    refunder,
    payer: refunder,
    burnAmount: BigInt(value('burn')),
  });
  await send('Refund void outcome', plan.instructions);
  await loadMarket();
});
action('export', async () => {
  const blob = new Blob(
    [
      json({
        network: value('network'),
        oracle: value('oracle'),
        market: value('market'),
        launch: value('launch'),
        receipts,
      }),
    ],
    { type: 'application/json' },
  );
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = 'prediction-session.json';
  link.click();
  URL.revokeObjectURL(url);
  status('Public session state downloaded.');
});
$('outcome').addEventListener('change', selectOutcome);
$('market').addEventListener('input', () => {
  marketData = undefined;
  oracleData = undefined;
  launches = [];
});
$('network').addEventListener('change', () => {
  clearLocalWallet();
  $('wallet-account').textContent = account?.address ?? 'No wallet connected.';
  $('deployment-gate').textContent =
    value('network') === 'devnet'
      ? 'Devnet transactions are disabled: the deployed stack has not been verified against the merged prediction ABI.'
      : 'Local validator: load freshly built matching programs and allowlists. Wallet submission runs preflight; program presence alone does not verify ABI compatibility.';
  $('deployment-gate').classList.toggle('error', value('network') === 'devnet');
  $<HTMLInputElement>('rpc').value =
    value('network') === 'devnet'
      ? 'https://api.devnet.solana.com'
      : 'http://127.0.0.1:8899';
  marketData = undefined;
  oracleData = undefined;
  launches = [];
  status('Network changed. Reload your market and check the wallet network.');
});

$('rpc').addEventListener('input', () => {
  clearLocalWallet();
  marketData = undefined;
  oracleData = undefined;
  launches = [];
  $('wallet-account').textContent = account?.address ?? 'No wallet connected.';
});
