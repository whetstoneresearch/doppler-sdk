import {
  ReadContract,
  ReadAdapter,
  Drift,
  createDrift,
  FunctionReturn,
} from '@delvtech/drift';
import { Address } from 'abitype';
import { dopplerLensAbi } from '@/abis';
import { Hex } from 'viem';
import { PoolKey } from '@/types';

type DopplerLensABI = typeof dopplerLensAbi;

interface QuoteExactSingleParams {
  poolKey: PoolKey;
  zeroForOne: boolean;
  exactAmount: bigint;
  hookData: Hex;
}

export class ReadDopplerLens {
  drift: Drift<ReadAdapter>;
  dopplerLens: ReadContract<DopplerLensABI>;
  dopplerLensAddress: Address;

  constructor(
    address: Hex,
    drift: Drift<ReadAdapter> = createDrift(),
  ) {
    this.dopplerLensAddress = address;
    this.dopplerLens = drift.contract({
      abi: dopplerLensAbi,
      address: address,
    });
    this.drift = drift;
  }

  public async poolManager(): Promise<FunctionReturn<DopplerLensABI, 'poolManager'>> {
    return this.dopplerLens.read('poolManager');
  }

  public async stateView(): Promise<FunctionReturn<DopplerLensABI, 'stateView'>> {
    return this.dopplerLens.read('stateView');
  }

  public async quoteDopplerLensData(
    params: QuoteExactSingleParams,
  ): Promise<FunctionReturn<DopplerLensABI, 'quoteDopplerLensData'>> {
    return this.dopplerLens.simulateWrite('quoteDopplerLensData', { params });
  }
}
