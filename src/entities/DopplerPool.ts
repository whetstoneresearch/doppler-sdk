import { Doppler, DopplerState } from '../types';
import { Clients } from '../DopplerSDK';
import { DopplerAddressProvider } from '../AddressProvider';
import { fetchDopplerState, fetchTokensRemaining } from '../fetch/DopplerState';

export class DopplerPool {
  public readonly doppler: Doppler;
  private readonly clients: Clients;
  private readonly addressProvider: DopplerAddressProvider;

  constructor(doppler: Doppler, clients: Clients, addressProvider: DopplerAddressProvider) {
    this.doppler = doppler;
    this.clients = clients;
    this.addressProvider = addressProvider;
  }

  async getState(): Promise<DopplerState> {
    return fetchDopplerState(
      this.doppler.address,
      this.doppler.poolId,
      this.addressProvider,
      this.clients.public
    );
  }

  async getTokensRemaining(): Promise<bigint> {
    return fetchTokensRemaining(this.doppler.address, this.clients.public);
  }

  async getDistanceFromMaxProceeds(): Promise<bigint> {
    const state = await this.getState();
    const maxProceeds = await this.clients.public.readContract({
      address: this.doppler.address,
      abi: [{
        name: 'maximumProceeds',
        type: 'function',
        stateMutability: 'view',
        inputs: [],
        outputs: [{ type: 'uint256' }]
      }],
      functionName: 'maximumProceeds'
    });
    return maxProceeds - state.totalProceeds;
  }
}