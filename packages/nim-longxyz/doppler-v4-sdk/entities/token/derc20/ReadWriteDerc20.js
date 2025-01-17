import { Drift } from '@delvtech/drift';
import { ReadDerc20 } from './ReadDerc20';
export class ReadWriteDerc20 extends ReadDerc20 {
    constructor(address, drift = new Drift()) {
        super(address, drift);
    }
    async approve(spender, value) {
        return this.contract.write('approve', { spender, value }, {
            onMined: () => {
                this.contract.invalidateReadsMatching('allowance');
            },
        });
    }
}
//# sourceMappingURL=ReadWriteDerc20.js.map