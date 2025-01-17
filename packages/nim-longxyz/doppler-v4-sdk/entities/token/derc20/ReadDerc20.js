import { Drift } from '@delvtech/drift';
import { derc20Abi } from '@/abis';
export class ReadDerc20 {
    constructor(address, drift = new Drift()) {
        this.contract = drift.contract({ abi: derc20Abi, address });
    }
    async getName() {
        return this.contract.read('name');
    }
    async getSymbol() {
        return this.contract.read('symbol');
    }
    async getDecimals() {
        return this.contract.read('decimals');
    }
    async getAllowance(owner, spender) {
        return this.contract.read('allowance', { owner, spender });
    }
    async getBalanceOf(account) {
        return this.contract.read('balanceOf', { account });
    }
}
//# sourceMappingURL=ReadDerc20.js.map