import { Drift } from '@delvtech/drift';
import { customRouterAbi } from '@/abis';
export class ReadWriteRouter {
    constructor(address, drift = new Drift()) {
        this.contract = drift.contract({
            abi: customRouterAbi,
            address,
        });
    }
    async buyExactIn(params) {
        return this.contract.write('buyExactIn', params);
    }
    async buyExactOut(params) {
        return this.contract.write('buyExactOut', params);
    }
    async sellExactIn(params) {
        return this.contract.write('sellExactIn', params);
    }
    async sellExactOut(params) {
        return this.contract.write('sellExactOut', params);
    }
}
//# sourceMappingURL=ReadWriteRouter.js.map