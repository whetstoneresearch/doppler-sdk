import { Drift } from '@delvtech/drift';
import { ETH_ADDRESS } from '@/constants';
export class ReadEth {
    constructor(drift = new Drift()) {
        this.drift = drift;
    }
    async getName() {
        return 'Ether';
    }
    async getSymbol() {
        return 'ETH';
    }
    async getDecimals() {
        return 18;
    }
    async getAllowance() {
        return 2n ** 256n - 1n;
    }
    async getBalanceOf(account) {
        return this.drift.getBalance({ address: account });
    }
}
ReadEth.address = ETH_ADDRESS;
//# sourceMappingURL=ReadEth.js.map