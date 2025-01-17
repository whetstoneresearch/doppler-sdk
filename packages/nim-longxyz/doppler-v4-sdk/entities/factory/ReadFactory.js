import { Drift } from '@delvtech/drift';
import { airlockAbi } from '@/abis';
export var ModuleState;
(function (ModuleState) {
    ModuleState[ModuleState["NotWhitelisted"] = 0] = "NotWhitelisted";
    ModuleState[ModuleState["TokenFactory"] = 1] = "TokenFactory";
    ModuleState[ModuleState["GovernanceFactory"] = 2] = "GovernanceFactory";
    ModuleState[ModuleState["HookFactory"] = 3] = "HookFactory";
    ModuleState[ModuleState["Migrator"] = 4] = "Migrator";
})(ModuleState || (ModuleState = {}));
export class ReadFactory {
    constructor(address, drift = new Drift()) {
        this.airlock = drift.contract({
            abi: airlockAbi,
            address,
        });
    }
    async getModuleState(module) {
        return this.airlock.read('getModuleState', {
            module,
        });
    }
    async getAssetData(asset) {
        return this.airlock.read('getAssetData', {
            asset,
        });
    }
}
//# sourceMappingURL=ReadFactory.js.map