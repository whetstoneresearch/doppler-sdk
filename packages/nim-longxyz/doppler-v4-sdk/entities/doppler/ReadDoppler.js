import { Drift } from '@delvtech/drift';
import { dopplerAbi, stateViewAbi } from '@/abis';
import { encodePacked, keccak256 } from 'viem';
import { ReadDerc20 } from '../token/derc20/ReadDerc20';
import { ReadEth } from '../token/eth/ReadEth';
import { ETH_ADDRESS } from '@/constants';
export class ReadDoppler {
    constructor(dopplerAddress, stateViewAddress, drift = new Drift()) {
        this.address = dopplerAddress;
        this.doppler = drift.contract({
            abi: dopplerAbi,
            address: dopplerAddress,
        });
        this.stateView = drift.contract({
            abi: stateViewAbi,
            address: stateViewAddress,
        });
    }
    async getState() {
        return this.doppler.read('state');
    }
    async getPosition(salt) {
        return this.doppler.read('positions', { salt });
    }
    async getSlot0(id) {
        return this.stateView.read('getSlot0', { poolId: id });
    }
    async getCurrentPrice() {
        const { sqrtPriceX96 } = await this.getSlot0(this.poolId);
        return (sqrtPriceX96 * sqrtPriceX96) / BigInt(2 ** 192);
    }
    async getPoolKey() {
        return this.doppler.read('poolKey');
    }
    async getPoolId() {
        const poolKey = await this.getPoolKey();
        const tokenA = poolKey.currency0.toLowerCase() > poolKey.currency1.toLowerCase()
            ? poolKey.currency1
            : poolKey.currency0;
        const tokenB = poolKey.currency0.toLowerCase() > poolKey.currency1.toLowerCase()
            ? poolKey.currency0
            : poolKey.currency1;
        const poolId = keccak256(encodePacked(['address', 'address', 'uint24', 'uint24', 'address'], [tokenA, tokenB, poolKey.fee, poolKey.tickSpacing, poolKey.hooks]));
        return poolId;
    }
    async getAssetToken() {
        const poolKey = await this.getPoolKey();
        return new ReadDerc20(poolKey.currency1, this.drift);
    }
    async getQuoteToken() {
        const poolKey = await this.getPoolKey();
        return poolKey.currency0.toLowerCase() === ETH_ADDRESS.toLowerCase()
            ? new ReadEth(this.drift)
            : new ReadDerc20(poolKey.currency0, this.drift);
    }
    async getInsufficientProceeds() {
        return this.doppler.read('insufficientProceeds');
    }
    async getEarlyExit() {
        return this.doppler.read('earlyExit');
    }
}
//# sourceMappingURL=ReadDoppler.js.map