import { describe, expect, it } from 'vitest';
import { getAddress, isAddress } from 'viem';
import { getAddresses } from '@/addresses';
import { feeClaimsInitializerAbi } from '@/abis';
import { findMulticurveInitializerForPool } from '@/entities/auction/multicurve/multicurveInitializerDiscovery';
import {
  DopplerSDK,
  LockablePoolStatus,
  SUPPORTED_CHAIN_IDS,
  isSupportedChainId,
} from '@/index';
import { computePoolId } from '@/utils/poolKey';
import { getRpcEnvVar, getTestClient, hasRpcUrl } from '../utils';

const REQUIRED_ENV_VARS = [
  'PENDING_FEES_LIVE_CHAIN_ID',
  'PENDING_FEES_LIVE_ASSET',
  'PENDING_FEES_LIVE_BENEFICIARY',
] as const;

describe('Multicurve fees live tests', () => {
  const missingEnvVars = REQUIRED_ENV_VARS.filter((name) => !process.env[name]);

  if (missingEnvVars.length > 0) {
    console.info(
      `Skipping live multicurve fees tests: requires ${missingEnvVars.join(', ')}`,
    );
    it.skip(`requires ${missingEnvVars.join(', ')}`);
    return;
  }

  const parsedChainId = Number(process.env.PENDING_FEES_LIVE_CHAIN_ID);
  if (!Number.isInteger(parsedChainId) || !isSupportedChainId(parsedChainId)) {
    it('requires PENDING_FEES_LIVE_CHAIN_ID to be a supported chain id', () => {
      throw new Error(
        `PENDING_FEES_LIVE_CHAIN_ID must be one of ${SUPPORTED_CHAIN_IDS.join(', ')}`,
      );
    });
    return;
  }

  const asset = process.env.PENDING_FEES_LIVE_ASSET;
  const beneficiary = process.env.PENDING_FEES_LIVE_BENEFICIARY;
  if (!asset || !isAddress(asset)) {
    it('requires PENDING_FEES_LIVE_ASSET to be an address', () => {
      throw new Error('PENDING_FEES_LIVE_ASSET must be a valid EVM address');
    });
    return;
  }
  if (!beneficiary || !isAddress(beneficiary)) {
    it('requires PENDING_FEES_LIVE_BENEFICIARY to be an address', () => {
      throw new Error(
        'PENDING_FEES_LIVE_BENEFICIARY must be a valid EVM address',
      );
    });
    return;
  }

  if (!hasRpcUrl(parsedChainId)) {
    console.info(
      `Skipping live multicurve fees tests: requires ${getRpcEnvVar(parsedChainId)} or ALCHEMY_API_KEY for chain ${parsedChainId}`,
    );
    it.skip(
      `requires ${getRpcEnvVar(parsedChainId)} or ALCHEMY_API_KEY for chain ${parsedChainId}`,
    );
    return;
  }

  it('previews pending fees and simulates the beneficiary claim', async () => {
    const chainId = parsedChainId;
    const assetAddress = getAddress(asset);
    const beneficiaryAddress = getAddress(beneficiary);
    const publicClient = getTestClient(chainId, {
      retryCount: 3,
      retryDelay: 1000,
    });
    const sdk = new DopplerSDK({ publicClient, chainId });
    const pool = await sdk.getMulticurvePool(assetAddress);
    const state = await pool.getState();
    const { initializerAddress } = await findMulticurveInitializerForPool({
      client: publicClient,
      tokenAddress: assetAddress,
      addresses: getAddresses(chainId),
    });

    expect(state.asset.toLowerCase()).toBe(assetAddress.toLowerCase());
    expect(state.status).toBe(LockablePoolStatus.Locked);

    const pendingFees = await pool.getPendingFees(beneficiaryAddress);
    expect(pendingFees.fees0 >= 0n).toBe(true);
    expect(pendingFees.fees1 >= 0n).toBe(true);

    await publicClient.simulateContract({
      address: initializerAddress,
      abi: feeClaimsInitializerAbi,
      functionName: 'collectFees',
      args: [computePoolId(state.poolKey)],
      account: beneficiaryAddress,
    });

    console.info(
      `live multicurve fees asset=${asset} beneficiary=${beneficiary} pending0=${pendingFees.fees0} pending1=${pendingFees.fees1}`,
    );
  });
});
