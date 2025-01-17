import { ReadContract, Drift, ReadAdapter, ReadWriteContract, ReadWriteAdapter, ContractWriteOptions, OnMinedParam } from '@delvtech/drift';
import { Address as Address$1 } from 'abitype';
import { PublicClient, WalletClient, TestClient, Address, Hash, Hex } from 'viem';
import { Price, Token } from '@uniswap/sdk-core';

declare const customRouterAbi: readonly [{
    readonly type: "constructor";
    readonly inputs: readonly [{
        readonly name: "swapRouter_";
        readonly type: "address";
        readonly internalType: "contract PoolSwapTest";
    }, {
        readonly name: "quoter_";
        readonly type: "address";
        readonly internalType: "contract Quoter";
    }];
    readonly stateMutability: "nonpayable";
}, {
    readonly type: "function";
    readonly name: "IS_TEST";
    readonly inputs: readonly [];
    readonly outputs: readonly [{
        readonly name: "";
        readonly type: "bool";
        readonly internalType: "bool";
    }];
    readonly stateMutability: "view";
}, {
    readonly type: "function";
    readonly name: "buy";
    readonly inputs: readonly [{
        readonly name: "key";
        readonly type: "tuple";
        readonly internalType: "struct PoolKey";
        readonly components: readonly [{
            readonly name: "currency0";
            readonly type: "address";
            readonly internalType: "Currency";
        }, {
            readonly name: "currency1";
            readonly type: "address";
            readonly internalType: "Currency";
        }, {
            readonly name: "fee";
            readonly type: "uint24";
            readonly internalType: "uint24";
        }, {
            readonly name: "tickSpacing";
            readonly type: "int24";
            readonly internalType: "int24";
        }, {
            readonly name: "hooks";
            readonly type: "address";
            readonly internalType: "contract IHooks";
        }];
    }, {
        readonly name: "amount";
        readonly type: "int256";
        readonly internalType: "int256";
    }];
    readonly outputs: readonly [{
        readonly name: "";
        readonly type: "uint256";
        readonly internalType: "uint256";
    }, {
        readonly name: "";
        readonly type: "uint256";
        readonly internalType: "uint256";
    }];
    readonly stateMutability: "payable";
}, {
    readonly type: "function";
    readonly name: "buyExactIn";
    readonly inputs: readonly [{
        readonly name: "key";
        readonly type: "tuple";
        readonly internalType: "struct PoolKey";
        readonly components: readonly [{
            readonly name: "currency0";
            readonly type: "address";
            readonly internalType: "Currency";
        }, {
            readonly name: "currency1";
            readonly type: "address";
            readonly internalType: "Currency";
        }, {
            readonly name: "fee";
            readonly type: "uint24";
            readonly internalType: "uint24";
        }, {
            readonly name: "tickSpacing";
            readonly type: "int24";
            readonly internalType: "int24";
        }, {
            readonly name: "hooks";
            readonly type: "address";
            readonly internalType: "contract IHooks";
        }];
    }, {
        readonly name: "amount";
        readonly type: "uint256";
        readonly internalType: "uint256";
    }];
    readonly outputs: readonly [{
        readonly name: "bought";
        readonly type: "uint256";
        readonly internalType: "uint256";
    }];
    readonly stateMutability: "payable";
}, {
    readonly type: "function";
    readonly name: "buyExactOut";
    readonly inputs: readonly [{
        readonly name: "key";
        readonly type: "tuple";
        readonly internalType: "struct PoolKey";
        readonly components: readonly [{
            readonly name: "currency0";
            readonly type: "address";
            readonly internalType: "Currency";
        }, {
            readonly name: "currency1";
            readonly type: "address";
            readonly internalType: "Currency";
        }, {
            readonly name: "fee";
            readonly type: "uint24";
            readonly internalType: "uint24";
        }, {
            readonly name: "tickSpacing";
            readonly type: "int24";
            readonly internalType: "int24";
        }, {
            readonly name: "hooks";
            readonly type: "address";
            readonly internalType: "contract IHooks";
        }];
    }, {
        readonly name: "amount";
        readonly type: "uint256";
        readonly internalType: "uint256";
    }];
    readonly outputs: readonly [{
        readonly name: "spent";
        readonly type: "uint256";
        readonly internalType: "uint256";
    }];
    readonly stateMutability: "payable";
}, {
    readonly type: "function";
    readonly name: "computeBuyExactOut";
    readonly inputs: readonly [{
        readonly name: "key";
        readonly type: "tuple";
        readonly internalType: "struct PoolKey";
        readonly components: readonly [{
            readonly name: "currency0";
            readonly type: "address";
            readonly internalType: "Currency";
        }, {
            readonly name: "currency1";
            readonly type: "address";
            readonly internalType: "Currency";
        }, {
            readonly name: "fee";
            readonly type: "uint24";
            readonly internalType: "uint24";
        }, {
            readonly name: "tickSpacing";
            readonly type: "int24";
            readonly internalType: "int24";
        }, {
            readonly name: "hooks";
            readonly type: "address";
            readonly internalType: "contract IHooks";
        }];
    }, {
        readonly name: "amountOut";
        readonly type: "uint256";
        readonly internalType: "uint256";
    }];
    readonly outputs: readonly [{
        readonly name: "";
        readonly type: "uint256";
        readonly internalType: "uint256";
    }];
    readonly stateMutability: "nonpayable";
}, {
    readonly type: "function";
    readonly name: "computeSellExactOut";
    readonly inputs: readonly [{
        readonly name: "key";
        readonly type: "tuple";
        readonly internalType: "struct PoolKey";
        readonly components: readonly [{
            readonly name: "currency0";
            readonly type: "address";
            readonly internalType: "Currency";
        }, {
            readonly name: "currency1";
            readonly type: "address";
            readonly internalType: "Currency";
        }, {
            readonly name: "fee";
            readonly type: "uint24";
            readonly internalType: "uint24";
        }, {
            readonly name: "tickSpacing";
            readonly type: "int24";
            readonly internalType: "int24";
        }, {
            readonly name: "hooks";
            readonly type: "address";
            readonly internalType: "contract IHooks";
        }];
    }, {
        readonly name: "amountOut";
        readonly type: "uint256";
        readonly internalType: "uint256";
    }];
    readonly outputs: readonly [{
        readonly name: "";
        readonly type: "uint256";
        readonly internalType: "uint256";
    }];
    readonly stateMutability: "nonpayable";
}, {
    readonly type: "function";
    readonly name: "excludeArtifacts";
    readonly inputs: readonly [];
    readonly outputs: readonly [{
        readonly name: "excludedArtifacts_";
        readonly type: "string[]";
        readonly internalType: "string[]";
    }];
    readonly stateMutability: "view";
}, {
    readonly type: "function";
    readonly name: "excludeContracts";
    readonly inputs: readonly [];
    readonly outputs: readonly [{
        readonly name: "excludedContracts_";
        readonly type: "address[]";
        readonly internalType: "address[]";
    }];
    readonly stateMutability: "view";
}, {
    readonly type: "function";
    readonly name: "excludeSelectors";
    readonly inputs: readonly [];
    readonly outputs: readonly [{
        readonly name: "excludedSelectors_";
        readonly type: "tuple[]";
        readonly internalType: "struct StdInvariant.FuzzSelector[]";
        readonly components: readonly [{
            readonly name: "addr";
            readonly type: "address";
            readonly internalType: "address";
        }, {
            readonly name: "selectors";
            readonly type: "bytes4[]";
            readonly internalType: "bytes4[]";
        }];
    }];
    readonly stateMutability: "view";
}, {
    readonly type: "function";
    readonly name: "excludeSenders";
    readonly inputs: readonly [];
    readonly outputs: readonly [{
        readonly name: "excludedSenders_";
        readonly type: "address[]";
        readonly internalType: "address[]";
    }];
    readonly stateMutability: "view";
}, {
    readonly type: "function";
    readonly name: "failed";
    readonly inputs: readonly [];
    readonly outputs: readonly [{
        readonly name: "";
        readonly type: "bool";
        readonly internalType: "bool";
    }];
    readonly stateMutability: "view";
}, {
    readonly type: "function";
    readonly name: "mintAndBuy";
    readonly inputs: readonly [{
        readonly name: "key";
        readonly type: "tuple";
        readonly internalType: "struct PoolKey";
        readonly components: readonly [{
            readonly name: "currency0";
            readonly type: "address";
            readonly internalType: "Currency";
        }, {
            readonly name: "currency1";
            readonly type: "address";
            readonly internalType: "Currency";
        }, {
            readonly name: "fee";
            readonly type: "uint24";
            readonly internalType: "uint24";
        }, {
            readonly name: "tickSpacing";
            readonly type: "int24";
            readonly internalType: "int24";
        }, {
            readonly name: "hooks";
            readonly type: "address";
            readonly internalType: "contract IHooks";
        }];
    }, {
        readonly name: "amount";
        readonly type: "int256";
        readonly internalType: "int256";
    }];
    readonly outputs: readonly [{
        readonly name: "";
        readonly type: "uint256";
        readonly internalType: "uint256";
    }, {
        readonly name: "";
        readonly type: "uint256";
        readonly internalType: "uint256";
    }];
    readonly stateMutability: "nonpayable";
}, {
    readonly type: "function";
    readonly name: "quoter";
    readonly inputs: readonly [];
    readonly outputs: readonly [{
        readonly name: "";
        readonly type: "address";
        readonly internalType: "contract Quoter";
    }];
    readonly stateMutability: "view";
}, {
    readonly type: "function";
    readonly name: "sell";
    readonly inputs: readonly [{
        readonly name: "key";
        readonly type: "tuple";
        readonly internalType: "struct PoolKey";
        readonly components: readonly [{
            readonly name: "currency0";
            readonly type: "address";
            readonly internalType: "Currency";
        }, {
            readonly name: "currency1";
            readonly type: "address";
            readonly internalType: "Currency";
        }, {
            readonly name: "fee";
            readonly type: "uint24";
            readonly internalType: "uint24";
        }, {
            readonly name: "tickSpacing";
            readonly type: "int24";
            readonly internalType: "int24";
        }, {
            readonly name: "hooks";
            readonly type: "address";
            readonly internalType: "contract IHooks";
        }];
    }, {
        readonly name: "amount";
        readonly type: "int256";
        readonly internalType: "int256";
    }];
    readonly outputs: readonly [{
        readonly name: "";
        readonly type: "uint256";
        readonly internalType: "uint256";
    }, {
        readonly name: "";
        readonly type: "uint256";
        readonly internalType: "uint256";
    }];
    readonly stateMutability: "nonpayable";
}, {
    readonly type: "function";
    readonly name: "sellExactIn";
    readonly inputs: readonly [{
        readonly name: "key";
        readonly type: "tuple";
        readonly internalType: "struct PoolKey";
        readonly components: readonly [{
            readonly name: "currency0";
            readonly type: "address";
            readonly internalType: "Currency";
        }, {
            readonly name: "currency1";
            readonly type: "address";
            readonly internalType: "Currency";
        }, {
            readonly name: "fee";
            readonly type: "uint24";
            readonly internalType: "uint24";
        }, {
            readonly name: "tickSpacing";
            readonly type: "int24";
            readonly internalType: "int24";
        }, {
            readonly name: "hooks";
            readonly type: "address";
            readonly internalType: "contract IHooks";
        }];
    }, {
        readonly name: "amount";
        readonly type: "uint256";
        readonly internalType: "uint256";
    }];
    readonly outputs: readonly [{
        readonly name: "received";
        readonly type: "uint256";
        readonly internalType: "uint256";
    }];
    readonly stateMutability: "nonpayable";
}, {
    readonly type: "function";
    readonly name: "sellExactOut";
    readonly inputs: readonly [{
        readonly name: "key";
        readonly type: "tuple";
        readonly internalType: "struct PoolKey";
        readonly components: readonly [{
            readonly name: "currency0";
            readonly type: "address";
            readonly internalType: "Currency";
        }, {
            readonly name: "currency1";
            readonly type: "address";
            readonly internalType: "Currency";
        }, {
            readonly name: "fee";
            readonly type: "uint24";
            readonly internalType: "uint24";
        }, {
            readonly name: "tickSpacing";
            readonly type: "int24";
            readonly internalType: "int24";
        }, {
            readonly name: "hooks";
            readonly type: "address";
            readonly internalType: "contract IHooks";
        }];
    }, {
        readonly name: "amount";
        readonly type: "uint256";
        readonly internalType: "uint256";
    }];
    readonly outputs: readonly [{
        readonly name: "sold";
        readonly type: "uint256";
        readonly internalType: "uint256";
    }];
    readonly stateMutability: "nonpayable";
}, {
    readonly type: "function";
    readonly name: "swapRouter";
    readonly inputs: readonly [];
    readonly outputs: readonly [{
        readonly name: "";
        readonly type: "address";
        readonly internalType: "contract PoolSwapTest";
    }];
    readonly stateMutability: "view";
}, {
    readonly type: "function";
    readonly name: "targetArtifactSelectors";
    readonly inputs: readonly [];
    readonly outputs: readonly [{
        readonly name: "targetedArtifactSelectors_";
        readonly type: "tuple[]";
        readonly internalType: "struct StdInvariant.FuzzArtifactSelector[]";
        readonly components: readonly [{
            readonly name: "artifact";
            readonly type: "string";
            readonly internalType: "string";
        }, {
            readonly name: "selectors";
            readonly type: "bytes4[]";
            readonly internalType: "bytes4[]";
        }];
    }];
    readonly stateMutability: "view";
}, {
    readonly type: "function";
    readonly name: "targetArtifacts";
    readonly inputs: readonly [];
    readonly outputs: readonly [{
        readonly name: "targetedArtifacts_";
        readonly type: "string[]";
        readonly internalType: "string[]";
    }];
    readonly stateMutability: "view";
}, {
    readonly type: "function";
    readonly name: "targetContracts";
    readonly inputs: readonly [];
    readonly outputs: readonly [{
        readonly name: "targetedContracts_";
        readonly type: "address[]";
        readonly internalType: "address[]";
    }];
    readonly stateMutability: "view";
}, {
    readonly type: "function";
    readonly name: "targetInterfaces";
    readonly inputs: readonly [];
    readonly outputs: readonly [{
        readonly name: "targetedInterfaces_";
        readonly type: "tuple[]";
        readonly internalType: "struct StdInvariant.FuzzInterface[]";
        readonly components: readonly [{
            readonly name: "addr";
            readonly type: "address";
            readonly internalType: "address";
        }, {
            readonly name: "artifacts";
            readonly type: "string[]";
            readonly internalType: "string[]";
        }];
    }];
    readonly stateMutability: "view";
}, {
    readonly type: "function";
    readonly name: "targetSelectors";
    readonly inputs: readonly [];
    readonly outputs: readonly [{
        readonly name: "targetedSelectors_";
        readonly type: "tuple[]";
        readonly internalType: "struct StdInvariant.FuzzSelector[]";
        readonly components: readonly [{
            readonly name: "addr";
            readonly type: "address";
            readonly internalType: "address";
        }, {
            readonly name: "selectors";
            readonly type: "bytes4[]";
            readonly internalType: "bytes4[]";
        }];
    }];
    readonly stateMutability: "view";
}, {
    readonly type: "function";
    readonly name: "targetSenders";
    readonly inputs: readonly [];
    readonly outputs: readonly [{
        readonly name: "targetedSenders_";
        readonly type: "address[]";
        readonly internalType: "address[]";
    }];
    readonly stateMutability: "view";
}, {
    readonly type: "event";
    readonly name: "log";
    readonly inputs: readonly [{
        readonly name: "";
        readonly type: "string";
        readonly indexed: false;
        readonly internalType: "string";
    }];
    readonly anonymous: false;
}, {
    readonly type: "event";
    readonly name: "log_address";
    readonly inputs: readonly [{
        readonly name: "";
        readonly type: "address";
        readonly indexed: false;
        readonly internalType: "address";
    }];
    readonly anonymous: false;
}, {
    readonly type: "event";
    readonly name: "log_array";
    readonly inputs: readonly [{
        readonly name: "val";
        readonly type: "uint256[]";
        readonly indexed: false;
        readonly internalType: "uint256[]";
    }];
    readonly anonymous: false;
}, {
    readonly type: "event";
    readonly name: "log_array";
    readonly inputs: readonly [{
        readonly name: "val";
        readonly type: "int256[]";
        readonly indexed: false;
        readonly internalType: "int256[]";
    }];
    readonly anonymous: false;
}, {
    readonly type: "event";
    readonly name: "log_array";
    readonly inputs: readonly [{
        readonly name: "val";
        readonly type: "address[]";
        readonly indexed: false;
        readonly internalType: "address[]";
    }];
    readonly anonymous: false;
}, {
    readonly type: "event";
    readonly name: "log_bytes";
    readonly inputs: readonly [{
        readonly name: "";
        readonly type: "bytes";
        readonly indexed: false;
        readonly internalType: "bytes";
    }];
    readonly anonymous: false;
}, {
    readonly type: "event";
    readonly name: "log_bytes32";
    readonly inputs: readonly [{
        readonly name: "";
        readonly type: "bytes32";
        readonly indexed: false;
        readonly internalType: "bytes32";
    }];
    readonly anonymous: false;
}, {
    readonly type: "event";
    readonly name: "log_int";
    readonly inputs: readonly [{
        readonly name: "";
        readonly type: "int256";
        readonly indexed: false;
        readonly internalType: "int256";
    }];
    readonly anonymous: false;
}, {
    readonly type: "event";
    readonly name: "log_named_address";
    readonly inputs: readonly [{
        readonly name: "key";
        readonly type: "string";
        readonly indexed: false;
        readonly internalType: "string";
    }, {
        readonly name: "val";
        readonly type: "address";
        readonly indexed: false;
        readonly internalType: "address";
    }];
    readonly anonymous: false;
}, {
    readonly type: "event";
    readonly name: "log_named_array";
    readonly inputs: readonly [{
        readonly name: "key";
        readonly type: "string";
        readonly indexed: false;
        readonly internalType: "string";
    }, {
        readonly name: "val";
        readonly type: "uint256[]";
        readonly indexed: false;
        readonly internalType: "uint256[]";
    }];
    readonly anonymous: false;
}, {
    readonly type: "event";
    readonly name: "log_named_array";
    readonly inputs: readonly [{
        readonly name: "key";
        readonly type: "string";
        readonly indexed: false;
        readonly internalType: "string";
    }, {
        readonly name: "val";
        readonly type: "int256[]";
        readonly indexed: false;
        readonly internalType: "int256[]";
    }];
    readonly anonymous: false;
}, {
    readonly type: "event";
    readonly name: "log_named_array";
    readonly inputs: readonly [{
        readonly name: "key";
        readonly type: "string";
        readonly indexed: false;
        readonly internalType: "string";
    }, {
        readonly name: "val";
        readonly type: "address[]";
        readonly indexed: false;
        readonly internalType: "address[]";
    }];
    readonly anonymous: false;
}, {
    readonly type: "event";
    readonly name: "log_named_bytes";
    readonly inputs: readonly [{
        readonly name: "key";
        readonly type: "string";
        readonly indexed: false;
        readonly internalType: "string";
    }, {
        readonly name: "val";
        readonly type: "bytes";
        readonly indexed: false;
        readonly internalType: "bytes";
    }];
    readonly anonymous: false;
}, {
    readonly type: "event";
    readonly name: "log_named_bytes32";
    readonly inputs: readonly [{
        readonly name: "key";
        readonly type: "string";
        readonly indexed: false;
        readonly internalType: "string";
    }, {
        readonly name: "val";
        readonly type: "bytes32";
        readonly indexed: false;
        readonly internalType: "bytes32";
    }];
    readonly anonymous: false;
}, {
    readonly type: "event";
    readonly name: "log_named_decimal_int";
    readonly inputs: readonly [{
        readonly name: "key";
        readonly type: "string";
        readonly indexed: false;
        readonly internalType: "string";
    }, {
        readonly name: "val";
        readonly type: "int256";
        readonly indexed: false;
        readonly internalType: "int256";
    }, {
        readonly name: "decimals";
        readonly type: "uint256";
        readonly indexed: false;
        readonly internalType: "uint256";
    }];
    readonly anonymous: false;
}, {
    readonly type: "event";
    readonly name: "log_named_decimal_uint";
    readonly inputs: readonly [{
        readonly name: "key";
        readonly type: "string";
        readonly indexed: false;
        readonly internalType: "string";
    }, {
        readonly name: "val";
        readonly type: "uint256";
        readonly indexed: false;
        readonly internalType: "uint256";
    }, {
        readonly name: "decimals";
        readonly type: "uint256";
        readonly indexed: false;
        readonly internalType: "uint256";
    }];
    readonly anonymous: false;
}, {
    readonly type: "event";
    readonly name: "log_named_int";
    readonly inputs: readonly [{
        readonly name: "key";
        readonly type: "string";
        readonly indexed: false;
        readonly internalType: "string";
    }, {
        readonly name: "val";
        readonly type: "int256";
        readonly indexed: false;
        readonly internalType: "int256";
    }];
    readonly anonymous: false;
}, {
    readonly type: "event";
    readonly name: "log_named_string";
    readonly inputs: readonly [{
        readonly name: "key";
        readonly type: "string";
        readonly indexed: false;
        readonly internalType: "string";
    }, {
        readonly name: "val";
        readonly type: "string";
        readonly indexed: false;
        readonly internalType: "string";
    }];
    readonly anonymous: false;
}, {
    readonly type: "event";
    readonly name: "log_named_uint";
    readonly inputs: readonly [{
        readonly name: "key";
        readonly type: "string";
        readonly indexed: false;
        readonly internalType: "string";
    }, {
        readonly name: "val";
        readonly type: "uint256";
        readonly indexed: false;
        readonly internalType: "uint256";
    }];
    readonly anonymous: false;
}, {
    readonly type: "event";
    readonly name: "log_string";
    readonly inputs: readonly [{
        readonly name: "";
        readonly type: "string";
        readonly indexed: false;
        readonly internalType: "string";
    }];
    readonly anonymous: false;
}, {
    readonly type: "event";
    readonly name: "log_uint";
    readonly inputs: readonly [{
        readonly name: "";
        readonly type: "uint256";
        readonly indexed: false;
        readonly internalType: "uint256";
    }];
    readonly anonymous: false;
}, {
    readonly type: "event";
    readonly name: "logs";
    readonly inputs: readonly [{
        readonly name: "";
        readonly type: "bytes";
        readonly indexed: false;
        readonly internalType: "bytes";
    }];
    readonly anonymous: false;
}];
declare const stateViewAbi: readonly [{
    readonly type: "constructor";
    readonly inputs: readonly [{
        readonly name: "_poolManager";
        readonly type: "address";
        readonly internalType: "contract IPoolManager";
    }];
    readonly stateMutability: "nonpayable";
}, {
    readonly type: "function";
    readonly name: "getFeeGrowthGlobals";
    readonly inputs: readonly [{
        readonly name: "poolId";
        readonly type: "bytes32";
        readonly internalType: "PoolId";
    }];
    readonly outputs: readonly [{
        readonly name: "feeGrowthGlobal0";
        readonly type: "uint256";
        readonly internalType: "uint256";
    }, {
        readonly name: "feeGrowthGlobal1";
        readonly type: "uint256";
        readonly internalType: "uint256";
    }];
    readonly stateMutability: "view";
}, {
    readonly type: "function";
    readonly name: "getFeeGrowthInside";
    readonly inputs: readonly [{
        readonly name: "poolId";
        readonly type: "bytes32";
        readonly internalType: "PoolId";
    }, {
        readonly name: "tickLower";
        readonly type: "int24";
        readonly internalType: "int24";
    }, {
        readonly name: "tickUpper";
        readonly type: "int24";
        readonly internalType: "int24";
    }];
    readonly outputs: readonly [{
        readonly name: "feeGrowthInside0X128";
        readonly type: "uint256";
        readonly internalType: "uint256";
    }, {
        readonly name: "feeGrowthInside1X128";
        readonly type: "uint256";
        readonly internalType: "uint256";
    }];
    readonly stateMutability: "view";
}, {
    readonly type: "function";
    readonly name: "getLiquidity";
    readonly inputs: readonly [{
        readonly name: "poolId";
        readonly type: "bytes32";
        readonly internalType: "PoolId";
    }];
    readonly outputs: readonly [{
        readonly name: "liquidity";
        readonly type: "uint128";
        readonly internalType: "uint128";
    }];
    readonly stateMutability: "view";
}, {
    readonly type: "function";
    readonly name: "getPositionInfo";
    readonly inputs: readonly [{
        readonly name: "poolId";
        readonly type: "bytes32";
        readonly internalType: "PoolId";
    }, {
        readonly name: "positionId";
        readonly type: "bytes32";
        readonly internalType: "bytes32";
    }];
    readonly outputs: readonly [{
        readonly name: "liquidity";
        readonly type: "uint128";
        readonly internalType: "uint128";
    }, {
        readonly name: "feeGrowthInside0LastX128";
        readonly type: "uint256";
        readonly internalType: "uint256";
    }, {
        readonly name: "feeGrowthInside1LastX128";
        readonly type: "uint256";
        readonly internalType: "uint256";
    }];
    readonly stateMutability: "view";
}, {
    readonly type: "function";
    readonly name: "getPositionInfo";
    readonly inputs: readonly [{
        readonly name: "poolId";
        readonly type: "bytes32";
        readonly internalType: "PoolId";
    }, {
        readonly name: "owner";
        readonly type: "address";
        readonly internalType: "address";
    }, {
        readonly name: "tickLower";
        readonly type: "int24";
        readonly internalType: "int24";
    }, {
        readonly name: "tickUpper";
        readonly type: "int24";
        readonly internalType: "int24";
    }, {
        readonly name: "salt";
        readonly type: "bytes32";
        readonly internalType: "bytes32";
    }];
    readonly outputs: readonly [{
        readonly name: "liquidity";
        readonly type: "uint128";
        readonly internalType: "uint128";
    }, {
        readonly name: "feeGrowthInside0LastX128";
        readonly type: "uint256";
        readonly internalType: "uint256";
    }, {
        readonly name: "feeGrowthInside1LastX128";
        readonly type: "uint256";
        readonly internalType: "uint256";
    }];
    readonly stateMutability: "view";
}, {
    readonly type: "function";
    readonly name: "getPositionLiquidity";
    readonly inputs: readonly [{
        readonly name: "poolId";
        readonly type: "bytes32";
        readonly internalType: "PoolId";
    }, {
        readonly name: "positionId";
        readonly type: "bytes32";
        readonly internalType: "bytes32";
    }];
    readonly outputs: readonly [{
        readonly name: "liquidity";
        readonly type: "uint128";
        readonly internalType: "uint128";
    }];
    readonly stateMutability: "view";
}, {
    readonly type: "function";
    readonly name: "getSlot0";
    readonly inputs: readonly [{
        readonly name: "poolId";
        readonly type: "bytes32";
        readonly internalType: "PoolId";
    }];
    readonly outputs: readonly [{
        readonly name: "sqrtPriceX96";
        readonly type: "uint160";
        readonly internalType: "uint160";
    }, {
        readonly name: "tick";
        readonly type: "int24";
        readonly internalType: "int24";
    }, {
        readonly name: "protocolFee";
        readonly type: "uint24";
        readonly internalType: "uint24";
    }, {
        readonly name: "lpFee";
        readonly type: "uint24";
        readonly internalType: "uint24";
    }];
    readonly stateMutability: "view";
}, {
    readonly type: "function";
    readonly name: "getTickBitmap";
    readonly inputs: readonly [{
        readonly name: "poolId";
        readonly type: "bytes32";
        readonly internalType: "PoolId";
    }, {
        readonly name: "tick";
        readonly type: "int16";
        readonly internalType: "int16";
    }];
    readonly outputs: readonly [{
        readonly name: "tickBitmap";
        readonly type: "uint256";
        readonly internalType: "uint256";
    }];
    readonly stateMutability: "view";
}, {
    readonly type: "function";
    readonly name: "getTickFeeGrowthOutside";
    readonly inputs: readonly [{
        readonly name: "poolId";
        readonly type: "bytes32";
        readonly internalType: "PoolId";
    }, {
        readonly name: "tick";
        readonly type: "int24";
        readonly internalType: "int24";
    }];
    readonly outputs: readonly [{
        readonly name: "feeGrowthOutside0X128";
        readonly type: "uint256";
        readonly internalType: "uint256";
    }, {
        readonly name: "feeGrowthOutside1X128";
        readonly type: "uint256";
        readonly internalType: "uint256";
    }];
    readonly stateMutability: "view";
}, {
    readonly type: "function";
    readonly name: "getTickInfo";
    readonly inputs: readonly [{
        readonly name: "poolId";
        readonly type: "bytes32";
        readonly internalType: "PoolId";
    }, {
        readonly name: "tick";
        readonly type: "int24";
        readonly internalType: "int24";
    }];
    readonly outputs: readonly [{
        readonly name: "liquidityGross";
        readonly type: "uint128";
        readonly internalType: "uint128";
    }, {
        readonly name: "liquidityNet";
        readonly type: "int128";
        readonly internalType: "int128";
    }, {
        readonly name: "feeGrowthOutside0X128";
        readonly type: "uint256";
        readonly internalType: "uint256";
    }, {
        readonly name: "feeGrowthOutside1X128";
        readonly type: "uint256";
        readonly internalType: "uint256";
    }];
    readonly stateMutability: "view";
}, {
    readonly type: "function";
    readonly name: "getTickLiquidity";
    readonly inputs: readonly [{
        readonly name: "poolId";
        readonly type: "bytes32";
        readonly internalType: "PoolId";
    }, {
        readonly name: "tick";
        readonly type: "int24";
        readonly internalType: "int24";
    }];
    readonly outputs: readonly [{
        readonly name: "liquidityGross";
        readonly type: "uint128";
        readonly internalType: "uint128";
    }, {
        readonly name: "liquidityNet";
        readonly type: "int128";
        readonly internalType: "int128";
    }];
    readonly stateMutability: "view";
}, {
    readonly type: "function";
    readonly name: "poolManager";
    readonly inputs: readonly [];
    readonly outputs: readonly [{
        readonly name: "";
        readonly type: "address";
        readonly internalType: "contract IPoolManager";
    }];
    readonly stateMutability: "view";
}];
declare const airlockAbi: readonly [{
    readonly type: "constructor";
    readonly inputs: readonly [{
        readonly name: "owner_";
        readonly type: "address";
        readonly internalType: "address";
    }];
    readonly stateMutability: "nonpayable";
}, {
    readonly type: "receive";
    readonly stateMutability: "payable";
}, {
    readonly type: "function";
    readonly name: "collectIntegratorFees";
    readonly inputs: readonly [{
        readonly name: "to";
        readonly type: "address";
        readonly internalType: "address";
    }, {
        readonly name: "token";
        readonly type: "address";
        readonly internalType: "address";
    }, {
        readonly name: "amount";
        readonly type: "uint256";
        readonly internalType: "uint256";
    }];
    readonly outputs: readonly [];
    readonly stateMutability: "nonpayable";
}, {
    readonly type: "function";
    readonly name: "collectProtocolFees";
    readonly inputs: readonly [{
        readonly name: "to";
        readonly type: "address";
        readonly internalType: "address";
    }, {
        readonly name: "token";
        readonly type: "address";
        readonly internalType: "address";
    }, {
        readonly name: "amount";
        readonly type: "uint256";
        readonly internalType: "uint256";
    }];
    readonly outputs: readonly [];
    readonly stateMutability: "nonpayable";
}, {
    readonly type: "function";
    readonly name: "create";
    readonly inputs: readonly [{
        readonly name: "createData";
        readonly type: "tuple";
        readonly internalType: "struct CreateParams";
        readonly components: readonly [{
            readonly name: "initialSupply";
            readonly type: "uint256";
            readonly internalType: "uint256";
        }, {
            readonly name: "numTokensToSell";
            readonly type: "uint256";
            readonly internalType: "uint256";
        }, {
            readonly name: "numeraire";
            readonly type: "address";
            readonly internalType: "address";
        }, {
            readonly name: "tokenFactory";
            readonly type: "address";
            readonly internalType: "contract ITokenFactory";
        }, {
            readonly name: "tokenFactoryData";
            readonly type: "bytes";
            readonly internalType: "bytes";
        }, {
            readonly name: "governanceFactory";
            readonly type: "address";
            readonly internalType: "contract IGovernanceFactory";
        }, {
            readonly name: "governanceFactoryData";
            readonly type: "bytes";
            readonly internalType: "bytes";
        }, {
            readonly name: "poolInitializer";
            readonly type: "address";
            readonly internalType: "contract IPoolInitializer";
        }, {
            readonly name: "poolInitializerData";
            readonly type: "bytes";
            readonly internalType: "bytes";
        }, {
            readonly name: "liquidityMigrator";
            readonly type: "address";
            readonly internalType: "contract ILiquidityMigrator";
        }, {
            readonly name: "liquidityMigratorData";
            readonly type: "bytes";
            readonly internalType: "bytes";
        }, {
            readonly name: "integrator";
            readonly type: "address";
            readonly internalType: "address";
        }, {
            readonly name: "salt";
            readonly type: "bytes32";
            readonly internalType: "bytes32";
        }];
    }];
    readonly outputs: readonly [{
        readonly name: "asset";
        readonly type: "address";
        readonly internalType: "address";
    }, {
        readonly name: "pool";
        readonly type: "address";
        readonly internalType: "address";
    }, {
        readonly name: "governance";
        readonly type: "address";
        readonly internalType: "address";
    }, {
        readonly name: "timelock";
        readonly type: "address";
        readonly internalType: "address";
    }, {
        readonly name: "migrationPool";
        readonly type: "address";
        readonly internalType: "address";
    }];
    readonly stateMutability: "nonpayable";
}, {
    readonly type: "function";
    readonly name: "getAssetData";
    readonly inputs: readonly [{
        readonly name: "asset";
        readonly type: "address";
        readonly internalType: "address";
    }];
    readonly outputs: readonly [{
        readonly name: "numeraire";
        readonly type: "address";
        readonly internalType: "address";
    }, {
        readonly name: "timelock";
        readonly type: "address";
        readonly internalType: "address";
    }, {
        readonly name: "governance";
        readonly type: "address";
        readonly internalType: "address";
    }, {
        readonly name: "liquidityMigrator";
        readonly type: "address";
        readonly internalType: "contract ILiquidityMigrator";
    }, {
        readonly name: "poolInitializer";
        readonly type: "address";
        readonly internalType: "contract IPoolInitializer";
    }, {
        readonly name: "pool";
        readonly type: "address";
        readonly internalType: "address";
    }, {
        readonly name: "migrationPool";
        readonly type: "address";
        readonly internalType: "address";
    }, {
        readonly name: "numTokensToSell";
        readonly type: "uint256";
        readonly internalType: "uint256";
    }, {
        readonly name: "totalSupply";
        readonly type: "uint256";
        readonly internalType: "uint256";
    }, {
        readonly name: "integrator";
        readonly type: "address";
        readonly internalType: "address";
    }];
    readonly stateMutability: "view";
}, {
    readonly type: "function";
    readonly name: "getModuleState";
    readonly inputs: readonly [{
        readonly name: "module";
        readonly type: "address";
        readonly internalType: "address";
    }];
    readonly outputs: readonly [{
        readonly name: "state";
        readonly type: "uint8";
        readonly internalType: "enum ModuleState";
    }];
    readonly stateMutability: "view";
}, {
    readonly type: "function";
    readonly name: "integratorFees";
    readonly inputs: readonly [{
        readonly name: "integrator";
        readonly type: "address";
        readonly internalType: "address";
    }, {
        readonly name: "token";
        readonly type: "address";
        readonly internalType: "address";
    }];
    readonly outputs: readonly [{
        readonly name: "amount";
        readonly type: "uint256";
        readonly internalType: "uint256";
    }];
    readonly stateMutability: "view";
}, {
    readonly type: "function";
    readonly name: "migrate";
    readonly inputs: readonly [{
        readonly name: "asset";
        readonly type: "address";
        readonly internalType: "address";
    }];
    readonly outputs: readonly [];
    readonly stateMutability: "nonpayable";
}, {
    readonly type: "function";
    readonly name: "owner";
    readonly inputs: readonly [];
    readonly outputs: readonly [{
        readonly name: "";
        readonly type: "address";
        readonly internalType: "address";
    }];
    readonly stateMutability: "view";
}, {
    readonly type: "function";
    readonly name: "protocolFees";
    readonly inputs: readonly [{
        readonly name: "token";
        readonly type: "address";
        readonly internalType: "address";
    }];
    readonly outputs: readonly [{
        readonly name: "amount";
        readonly type: "uint256";
        readonly internalType: "uint256";
    }];
    readonly stateMutability: "view";
}, {
    readonly type: "function";
    readonly name: "renounceOwnership";
    readonly inputs: readonly [];
    readonly outputs: readonly [];
    readonly stateMutability: "nonpayable";
}, {
    readonly type: "function";
    readonly name: "setModuleState";
    readonly inputs: readonly [{
        readonly name: "modules";
        readonly type: "address[]";
        readonly internalType: "address[]";
    }, {
        readonly name: "states";
        readonly type: "uint8[]";
        readonly internalType: "enum ModuleState[]";
    }];
    readonly outputs: readonly [];
    readonly stateMutability: "nonpayable";
}, {
    readonly type: "function";
    readonly name: "transferOwnership";
    readonly inputs: readonly [{
        readonly name: "newOwner";
        readonly type: "address";
        readonly internalType: "address";
    }];
    readonly outputs: readonly [];
    readonly stateMutability: "nonpayable";
}, {
    readonly type: "event";
    readonly name: "Collect";
    readonly inputs: readonly [{
        readonly name: "to";
        readonly type: "address";
        readonly indexed: true;
        readonly internalType: "address";
    }, {
        readonly name: "token";
        readonly type: "address";
        readonly indexed: true;
        readonly internalType: "address";
    }, {
        readonly name: "amount";
        readonly type: "uint256";
        readonly indexed: false;
        readonly internalType: "uint256";
    }];
    readonly anonymous: false;
}, {
    readonly type: "event";
    readonly name: "Create";
    readonly inputs: readonly [{
        readonly name: "asset";
        readonly type: "address";
        readonly indexed: false;
        readonly internalType: "address";
    }, {
        readonly name: "numeraire";
        readonly type: "address";
        readonly indexed: true;
        readonly internalType: "address";
    }, {
        readonly name: "initializer";
        readonly type: "address";
        readonly indexed: false;
        readonly internalType: "address";
    }, {
        readonly name: "poolOrHook";
        readonly type: "address";
        readonly indexed: false;
        readonly internalType: "address";
    }];
    readonly anonymous: false;
}, {
    readonly type: "event";
    readonly name: "Migrate";
    readonly inputs: readonly [{
        readonly name: "asset";
        readonly type: "address";
        readonly indexed: true;
        readonly internalType: "address";
    }, {
        readonly name: "pool";
        readonly type: "address";
        readonly indexed: true;
        readonly internalType: "address";
    }];
    readonly anonymous: false;
}, {
    readonly type: "event";
    readonly name: "OwnershipTransferred";
    readonly inputs: readonly [{
        readonly name: "previousOwner";
        readonly type: "address";
        readonly indexed: true;
        readonly internalType: "address";
    }, {
        readonly name: "newOwner";
        readonly type: "address";
        readonly indexed: true;
        readonly internalType: "address";
    }];
    readonly anonymous: false;
}, {
    readonly type: "event";
    readonly name: "SetModuleState";
    readonly inputs: readonly [{
        readonly name: "module";
        readonly type: "address";
        readonly indexed: true;
        readonly internalType: "address";
    }, {
        readonly name: "state";
        readonly type: "uint8";
        readonly indexed: true;
        readonly internalType: "enum ModuleState";
    }];
    readonly anonymous: false;
}, {
    readonly type: "error";
    readonly name: "ArrayLengthsMismatch";
    readonly inputs: readonly [];
}, {
    readonly type: "error";
    readonly name: "OwnableInvalidOwner";
    readonly inputs: readonly [{
        readonly name: "owner";
        readonly type: "address";
        readonly internalType: "address";
    }];
}, {
    readonly type: "error";
    readonly name: "OwnableUnauthorizedAccount";
    readonly inputs: readonly [{
        readonly name: "account";
        readonly type: "address";
        readonly internalType: "address";
    }];
}, {
    readonly type: "error";
    readonly name: "WrongModuleState";
    readonly inputs: readonly [{
        readonly name: "module";
        readonly type: "address";
        readonly internalType: "address";
    }, {
        readonly name: "expected";
        readonly type: "uint8";
        readonly internalType: "enum ModuleState";
    }, {
        readonly name: "actual";
        readonly type: "uint8";
        readonly internalType: "enum ModuleState";
    }];
}];
declare const derc20Abi: readonly [{
    readonly type: "constructor";
    readonly inputs: readonly [{
        readonly name: "name_";
        readonly type: "string";
        readonly internalType: "string";
    }, {
        readonly name: "symbol_";
        readonly type: "string";
        readonly internalType: "string";
    }, {
        readonly name: "initialSupply";
        readonly type: "uint256";
        readonly internalType: "uint256";
    }, {
        readonly name: "recipient";
        readonly type: "address";
        readonly internalType: "address";
    }, {
        readonly name: "owner_";
        readonly type: "address";
        readonly internalType: "address";
    }, {
        readonly name: "yearlyMintCap_";
        readonly type: "uint256";
        readonly internalType: "uint256";
    }, {
        readonly name: "vestingDuration_";
        readonly type: "uint256";
        readonly internalType: "uint256";
    }, {
        readonly name: "recipients_";
        readonly type: "address[]";
        readonly internalType: "address[]";
    }, {
        readonly name: "amounts_";
        readonly type: "uint256[]";
        readonly internalType: "uint256[]";
    }];
    readonly stateMutability: "nonpayable";
}, {
    readonly type: "function";
    readonly name: "CLOCK_MODE";
    readonly inputs: readonly [];
    readonly outputs: readonly [{
        readonly name: "";
        readonly type: "string";
        readonly internalType: "string";
    }];
    readonly stateMutability: "view";
}, {
    readonly type: "function";
    readonly name: "DOMAIN_SEPARATOR";
    readonly inputs: readonly [];
    readonly outputs: readonly [{
        readonly name: "";
        readonly type: "bytes32";
        readonly internalType: "bytes32";
    }];
    readonly stateMutability: "view";
}, {
    readonly type: "function";
    readonly name: "allowance";
    readonly inputs: readonly [{
        readonly name: "owner";
        readonly type: "address";
        readonly internalType: "address";
    }, {
        readonly name: "spender";
        readonly type: "address";
        readonly internalType: "address";
    }];
    readonly outputs: readonly [{
        readonly name: "";
        readonly type: "uint256";
        readonly internalType: "uint256";
    }];
    readonly stateMutability: "view";
}, {
    readonly type: "function";
    readonly name: "approve";
    readonly inputs: readonly [{
        readonly name: "spender";
        readonly type: "address";
        readonly internalType: "address";
    }, {
        readonly name: "value";
        readonly type: "uint256";
        readonly internalType: "uint256";
    }];
    readonly outputs: readonly [{
        readonly name: "";
        readonly type: "bool";
        readonly internalType: "bool";
    }];
    readonly stateMutability: "nonpayable";
}, {
    readonly type: "function";
    readonly name: "balanceOf";
    readonly inputs: readonly [{
        readonly name: "account";
        readonly type: "address";
        readonly internalType: "address";
    }];
    readonly outputs: readonly [{
        readonly name: "";
        readonly type: "uint256";
        readonly internalType: "uint256";
    }];
    readonly stateMutability: "view";
}, {
    readonly type: "function";
    readonly name: "checkpoints";
    readonly inputs: readonly [{
        readonly name: "account";
        readonly type: "address";
        readonly internalType: "address";
    }, {
        readonly name: "pos";
        readonly type: "uint32";
        readonly internalType: "uint32";
    }];
    readonly outputs: readonly [{
        readonly name: "";
        readonly type: "tuple";
        readonly internalType: "struct Checkpoints.Checkpoint208";
        readonly components: readonly [{
            readonly name: "_key";
            readonly type: "uint48";
            readonly internalType: "uint48";
        }, {
            readonly name: "_value";
            readonly type: "uint208";
            readonly internalType: "uint208";
        }];
    }];
    readonly stateMutability: "view";
}, {
    readonly type: "function";
    readonly name: "clock";
    readonly inputs: readonly [];
    readonly outputs: readonly [{
        readonly name: "";
        readonly type: "uint48";
        readonly internalType: "uint48";
    }];
    readonly stateMutability: "view";
}, {
    readonly type: "function";
    readonly name: "currentAnnualMint";
    readonly inputs: readonly [];
    readonly outputs: readonly [{
        readonly name: "";
        readonly type: "uint256";
        readonly internalType: "uint256";
    }];
    readonly stateMutability: "view";
}, {
    readonly type: "function";
    readonly name: "currentYearStart";
    readonly inputs: readonly [];
    readonly outputs: readonly [{
        readonly name: "";
        readonly type: "uint256";
        readonly internalType: "uint256";
    }];
    readonly stateMutability: "view";
}, {
    readonly type: "function";
    readonly name: "decimals";
    readonly inputs: readonly [];
    readonly outputs: readonly [{
        readonly name: "";
        readonly type: "uint8";
        readonly internalType: "uint8";
    }];
    readonly stateMutability: "view";
}, {
    readonly type: "function";
    readonly name: "delegate";
    readonly inputs: readonly [{
        readonly name: "delegatee";
        readonly type: "address";
        readonly internalType: "address";
    }];
    readonly outputs: readonly [];
    readonly stateMutability: "nonpayable";
}, {
    readonly type: "function";
    readonly name: "delegateBySig";
    readonly inputs: readonly [{
        readonly name: "delegatee";
        readonly type: "address";
        readonly internalType: "address";
    }, {
        readonly name: "nonce";
        readonly type: "uint256";
        readonly internalType: "uint256";
    }, {
        readonly name: "expiry";
        readonly type: "uint256";
        readonly internalType: "uint256";
    }, {
        readonly name: "v";
        readonly type: "uint8";
        readonly internalType: "uint8";
    }, {
        readonly name: "r";
        readonly type: "bytes32";
        readonly internalType: "bytes32";
    }, {
        readonly name: "s";
        readonly type: "bytes32";
        readonly internalType: "bytes32";
    }];
    readonly outputs: readonly [];
    readonly stateMutability: "nonpayable";
}, {
    readonly type: "function";
    readonly name: "delegates";
    readonly inputs: readonly [{
        readonly name: "account";
        readonly type: "address";
        readonly internalType: "address";
    }];
    readonly outputs: readonly [{
        readonly name: "";
        readonly type: "address";
        readonly internalType: "address";
    }];
    readonly stateMutability: "view";
}, {
    readonly type: "function";
    readonly name: "eip712Domain";
    readonly inputs: readonly [];
    readonly outputs: readonly [{
        readonly name: "fields";
        readonly type: "bytes1";
        readonly internalType: "bytes1";
    }, {
        readonly name: "name";
        readonly type: "string";
        readonly internalType: "string";
    }, {
        readonly name: "version";
        readonly type: "string";
        readonly internalType: "string";
    }, {
        readonly name: "chainId";
        readonly type: "uint256";
        readonly internalType: "uint256";
    }, {
        readonly name: "verifyingContract";
        readonly type: "address";
        readonly internalType: "address";
    }, {
        readonly name: "salt";
        readonly type: "bytes32";
        readonly internalType: "bytes32";
    }, {
        readonly name: "extensions";
        readonly type: "uint256[]";
        readonly internalType: "uint256[]";
    }];
    readonly stateMutability: "view";
}, {
    readonly type: "function";
    readonly name: "getPastTotalSupply";
    readonly inputs: readonly [{
        readonly name: "timepoint";
        readonly type: "uint256";
        readonly internalType: "uint256";
    }];
    readonly outputs: readonly [{
        readonly name: "";
        readonly type: "uint256";
        readonly internalType: "uint256";
    }];
    readonly stateMutability: "view";
}, {
    readonly type: "function";
    readonly name: "getPastVotes";
    readonly inputs: readonly [{
        readonly name: "account";
        readonly type: "address";
        readonly internalType: "address";
    }, {
        readonly name: "timepoint";
        readonly type: "uint256";
        readonly internalType: "uint256";
    }];
    readonly outputs: readonly [{
        readonly name: "";
        readonly type: "uint256";
        readonly internalType: "uint256";
    }];
    readonly stateMutability: "view";
}, {
    readonly type: "function";
    readonly name: "getVestingDataOf";
    readonly inputs: readonly [{
        readonly name: "account";
        readonly type: "address";
        readonly internalType: "address";
    }];
    readonly outputs: readonly [{
        readonly name: "totalAmount";
        readonly type: "uint256";
        readonly internalType: "uint256";
    }, {
        readonly name: "releasedAmount";
        readonly type: "uint256";
        readonly internalType: "uint256";
    }];
    readonly stateMutability: "view";
}, {
    readonly type: "function";
    readonly name: "getVotes";
    readonly inputs: readonly [{
        readonly name: "account";
        readonly type: "address";
        readonly internalType: "address";
    }];
    readonly outputs: readonly [{
        readonly name: "";
        readonly type: "uint256";
        readonly internalType: "uint256";
    }];
    readonly stateMutability: "view";
}, {
    readonly type: "function";
    readonly name: "isPoolUnlocked";
    readonly inputs: readonly [];
    readonly outputs: readonly [{
        readonly name: "";
        readonly type: "bool";
        readonly internalType: "bool";
    }];
    readonly stateMutability: "view";
}, {
    readonly type: "function";
    readonly name: "lockPool";
    readonly inputs: readonly [{
        readonly name: "pool_";
        readonly type: "address";
        readonly internalType: "address";
    }];
    readonly outputs: readonly [];
    readonly stateMutability: "nonpayable";
}, {
    readonly type: "function";
    readonly name: "mint";
    readonly inputs: readonly [{
        readonly name: "to";
        readonly type: "address";
        readonly internalType: "address";
    }, {
        readonly name: "value";
        readonly type: "uint256";
        readonly internalType: "uint256";
    }];
    readonly outputs: readonly [];
    readonly stateMutability: "nonpayable";
}, {
    readonly type: "function";
    readonly name: "mintStartDate";
    readonly inputs: readonly [];
    readonly outputs: readonly [{
        readonly name: "";
        readonly type: "uint256";
        readonly internalType: "uint256";
    }];
    readonly stateMutability: "view";
}, {
    readonly type: "function";
    readonly name: "name";
    readonly inputs: readonly [];
    readonly outputs: readonly [{
        readonly name: "";
        readonly type: "string";
        readonly internalType: "string";
    }];
    readonly stateMutability: "view";
}, {
    readonly type: "function";
    readonly name: "nonces";
    readonly inputs: readonly [{
        readonly name: "owner";
        readonly type: "address";
        readonly internalType: "address";
    }];
    readonly outputs: readonly [{
        readonly name: "";
        readonly type: "uint256";
        readonly internalType: "uint256";
    }];
    readonly stateMutability: "view";
}, {
    readonly type: "function";
    readonly name: "numCheckpoints";
    readonly inputs: readonly [{
        readonly name: "account";
        readonly type: "address";
        readonly internalType: "address";
    }];
    readonly outputs: readonly [{
        readonly name: "";
        readonly type: "uint32";
        readonly internalType: "uint32";
    }];
    readonly stateMutability: "view";
}, {
    readonly type: "function";
    readonly name: "owner";
    readonly inputs: readonly [];
    readonly outputs: readonly [{
        readonly name: "";
        readonly type: "address";
        readonly internalType: "address";
    }];
    readonly stateMutability: "view";
}, {
    readonly type: "function";
    readonly name: "permit";
    readonly inputs: readonly [{
        readonly name: "owner";
        readonly type: "address";
        readonly internalType: "address";
    }, {
        readonly name: "spender";
        readonly type: "address";
        readonly internalType: "address";
    }, {
        readonly name: "value";
        readonly type: "uint256";
        readonly internalType: "uint256";
    }, {
        readonly name: "deadline";
        readonly type: "uint256";
        readonly internalType: "uint256";
    }, {
        readonly name: "v";
        readonly type: "uint8";
        readonly internalType: "uint8";
    }, {
        readonly name: "r";
        readonly type: "bytes32";
        readonly internalType: "bytes32";
    }, {
        readonly name: "s";
        readonly type: "bytes32";
        readonly internalType: "bytes32";
    }];
    readonly outputs: readonly [];
    readonly stateMutability: "nonpayable";
}, {
    readonly type: "function";
    readonly name: "pool";
    readonly inputs: readonly [];
    readonly outputs: readonly [{
        readonly name: "";
        readonly type: "address";
        readonly internalType: "address";
    }];
    readonly stateMutability: "view";
}, {
    readonly type: "function";
    readonly name: "release";
    readonly inputs: readonly [{
        readonly name: "amount";
        readonly type: "uint256";
        readonly internalType: "uint256";
    }];
    readonly outputs: readonly [];
    readonly stateMutability: "nonpayable";
}, {
    readonly type: "function";
    readonly name: "renounceOwnership";
    readonly inputs: readonly [];
    readonly outputs: readonly [];
    readonly stateMutability: "nonpayable";
}, {
    readonly type: "function";
    readonly name: "symbol";
    readonly inputs: readonly [];
    readonly outputs: readonly [{
        readonly name: "";
        readonly type: "string";
        readonly internalType: "string";
    }];
    readonly stateMutability: "view";
}, {
    readonly type: "function";
    readonly name: "totalSupply";
    readonly inputs: readonly [];
    readonly outputs: readonly [{
        readonly name: "";
        readonly type: "uint256";
        readonly internalType: "uint256";
    }];
    readonly stateMutability: "view";
}, {
    readonly type: "function";
    readonly name: "transfer";
    readonly inputs: readonly [{
        readonly name: "to";
        readonly type: "address";
        readonly internalType: "address";
    }, {
        readonly name: "value";
        readonly type: "uint256";
        readonly internalType: "uint256";
    }];
    readonly outputs: readonly [{
        readonly name: "";
        readonly type: "bool";
        readonly internalType: "bool";
    }];
    readonly stateMutability: "nonpayable";
}, {
    readonly type: "function";
    readonly name: "transferFrom";
    readonly inputs: readonly [{
        readonly name: "from";
        readonly type: "address";
        readonly internalType: "address";
    }, {
        readonly name: "to";
        readonly type: "address";
        readonly internalType: "address";
    }, {
        readonly name: "value";
        readonly type: "uint256";
        readonly internalType: "uint256";
    }];
    readonly outputs: readonly [{
        readonly name: "";
        readonly type: "bool";
        readonly internalType: "bool";
    }];
    readonly stateMutability: "nonpayable";
}, {
    readonly type: "function";
    readonly name: "transferOwnership";
    readonly inputs: readonly [{
        readonly name: "newOwner";
        readonly type: "address";
        readonly internalType: "address";
    }];
    readonly outputs: readonly [];
    readonly stateMutability: "nonpayable";
}, {
    readonly type: "function";
    readonly name: "unlockPool";
    readonly inputs: readonly [];
    readonly outputs: readonly [];
    readonly stateMutability: "nonpayable";
}, {
    readonly type: "function";
    readonly name: "vestingDuration";
    readonly inputs: readonly [];
    readonly outputs: readonly [{
        readonly name: "";
        readonly type: "uint256";
        readonly internalType: "uint256";
    }];
    readonly stateMutability: "view";
}, {
    readonly type: "function";
    readonly name: "vestingStart";
    readonly inputs: readonly [];
    readonly outputs: readonly [{
        readonly name: "";
        readonly type: "uint256";
        readonly internalType: "uint256";
    }];
    readonly stateMutability: "view";
}, {
    readonly type: "function";
    readonly name: "yearlyMintCap";
    readonly inputs: readonly [];
    readonly outputs: readonly [{
        readonly name: "";
        readonly type: "uint256";
        readonly internalType: "uint256";
    }];
    readonly stateMutability: "view";
}, {
    readonly type: "event";
    readonly name: "Approval";
    readonly inputs: readonly [{
        readonly name: "owner";
        readonly type: "address";
        readonly indexed: true;
        readonly internalType: "address";
    }, {
        readonly name: "spender";
        readonly type: "address";
        readonly indexed: true;
        readonly internalType: "address";
    }, {
        readonly name: "value";
        readonly type: "uint256";
        readonly indexed: false;
        readonly internalType: "uint256";
    }];
    readonly anonymous: false;
}, {
    readonly type: "event";
    readonly name: "DelegateChanged";
    readonly inputs: readonly [{
        readonly name: "delegator";
        readonly type: "address";
        readonly indexed: true;
        readonly internalType: "address";
    }, {
        readonly name: "fromDelegate";
        readonly type: "address";
        readonly indexed: true;
        readonly internalType: "address";
    }, {
        readonly name: "toDelegate";
        readonly type: "address";
        readonly indexed: true;
        readonly internalType: "address";
    }];
    readonly anonymous: false;
}, {
    readonly type: "event";
    readonly name: "DelegateVotesChanged";
    readonly inputs: readonly [{
        readonly name: "delegate";
        readonly type: "address";
        readonly indexed: true;
        readonly internalType: "address";
    }, {
        readonly name: "previousVotes";
        readonly type: "uint256";
        readonly indexed: false;
        readonly internalType: "uint256";
    }, {
        readonly name: "newVotes";
        readonly type: "uint256";
        readonly indexed: false;
        readonly internalType: "uint256";
    }];
    readonly anonymous: false;
}, {
    readonly type: "event";
    readonly name: "EIP712DomainChanged";
    readonly inputs: readonly [];
    readonly anonymous: false;
}, {
    readonly type: "event";
    readonly name: "OwnershipTransferred";
    readonly inputs: readonly [{
        readonly name: "previousOwner";
        readonly type: "address";
        readonly indexed: true;
        readonly internalType: "address";
    }, {
        readonly name: "newOwner";
        readonly type: "address";
        readonly indexed: true;
        readonly internalType: "address";
    }];
    readonly anonymous: false;
}, {
    readonly type: "event";
    readonly name: "Transfer";
    readonly inputs: readonly [{
        readonly name: "from";
        readonly type: "address";
        readonly indexed: true;
        readonly internalType: "address";
    }, {
        readonly name: "to";
        readonly type: "address";
        readonly indexed: true;
        readonly internalType: "address";
    }, {
        readonly name: "value";
        readonly type: "uint256";
        readonly indexed: false;
        readonly internalType: "uint256";
    }];
    readonly anonymous: false;
}, {
    readonly type: "error";
    readonly name: "ArrayLengthsMismatch";
    readonly inputs: readonly [];
}, {
    readonly type: "error";
    readonly name: "CheckpointUnorderedInsertion";
    readonly inputs: readonly [];
}, {
    readonly type: "error";
    readonly name: "ECDSAInvalidSignature";
    readonly inputs: readonly [];
}, {
    readonly type: "error";
    readonly name: "ECDSAInvalidSignatureLength";
    readonly inputs: readonly [{
        readonly name: "length";
        readonly type: "uint256";
        readonly internalType: "uint256";
    }];
}, {
    readonly type: "error";
    readonly name: "ECDSAInvalidSignatureS";
    readonly inputs: readonly [{
        readonly name: "s";
        readonly type: "bytes32";
        readonly internalType: "bytes32";
    }];
}, {
    readonly type: "error";
    readonly name: "ERC20ExceededSafeSupply";
    readonly inputs: readonly [{
        readonly name: "increasedSupply";
        readonly type: "uint256";
        readonly internalType: "uint256";
    }, {
        readonly name: "cap";
        readonly type: "uint256";
        readonly internalType: "uint256";
    }];
}, {
    readonly type: "error";
    readonly name: "ERC20InsufficientAllowance";
    readonly inputs: readonly [{
        readonly name: "spender";
        readonly type: "address";
        readonly internalType: "address";
    }, {
        readonly name: "allowance";
        readonly type: "uint256";
        readonly internalType: "uint256";
    }, {
        readonly name: "needed";
        readonly type: "uint256";
        readonly internalType: "uint256";
    }];
}, {
    readonly type: "error";
    readonly name: "ERC20InsufficientBalance";
    readonly inputs: readonly [{
        readonly name: "sender";
        readonly type: "address";
        readonly internalType: "address";
    }, {
        readonly name: "balance";
        readonly type: "uint256";
        readonly internalType: "uint256";
    }, {
        readonly name: "needed";
        readonly type: "uint256";
        readonly internalType: "uint256";
    }];
}, {
    readonly type: "error";
    readonly name: "ERC20InvalidApprover";
    readonly inputs: readonly [{
        readonly name: "approver";
        readonly type: "address";
        readonly internalType: "address";
    }];
}, {
    readonly type: "error";
    readonly name: "ERC20InvalidReceiver";
    readonly inputs: readonly [{
        readonly name: "receiver";
        readonly type: "address";
        readonly internalType: "address";
    }];
}, {
    readonly type: "error";
    readonly name: "ERC20InvalidSender";
    readonly inputs: readonly [{
        readonly name: "sender";
        readonly type: "address";
        readonly internalType: "address";
    }];
}, {
    readonly type: "error";
    readonly name: "ERC20InvalidSpender";
    readonly inputs: readonly [{
        readonly name: "spender";
        readonly type: "address";
        readonly internalType: "address";
    }];
}, {
    readonly type: "error";
    readonly name: "ERC2612ExpiredSignature";
    readonly inputs: readonly [{
        readonly name: "deadline";
        readonly type: "uint256";
        readonly internalType: "uint256";
    }];
}, {
    readonly type: "error";
    readonly name: "ERC2612InvalidSigner";
    readonly inputs: readonly [{
        readonly name: "signer";
        readonly type: "address";
        readonly internalType: "address";
    }, {
        readonly name: "owner";
        readonly type: "address";
        readonly internalType: "address";
    }];
}, {
    readonly type: "error";
    readonly name: "ERC5805FutureLookup";
    readonly inputs: readonly [{
        readonly name: "timepoint";
        readonly type: "uint256";
        readonly internalType: "uint256";
    }, {
        readonly name: "clock";
        readonly type: "uint48";
        readonly internalType: "uint48";
    }];
}, {
    readonly type: "error";
    readonly name: "ERC6372InconsistentClock";
    readonly inputs: readonly [];
}, {
    readonly type: "error";
    readonly name: "ExceedsYearlyMintCap";
    readonly inputs: readonly [];
}, {
    readonly type: "error";
    readonly name: "InvalidAccountNonce";
    readonly inputs: readonly [{
        readonly name: "account";
        readonly type: "address";
        readonly internalType: "address";
    }, {
        readonly name: "currentNonce";
        readonly type: "uint256";
        readonly internalType: "uint256";
    }];
}, {
    readonly type: "error";
    readonly name: "InvalidShortString";
    readonly inputs: readonly [];
}, {
    readonly type: "error";
    readonly name: "MaxPreMintPerAddressExceeded";
    readonly inputs: readonly [{
        readonly name: "amount";
        readonly type: "uint256";
        readonly internalType: "uint256";
    }, {
        readonly name: "limit";
        readonly type: "uint256";
        readonly internalType: "uint256";
    }];
}, {
    readonly type: "error";
    readonly name: "MaxTotalPreMintExceeded";
    readonly inputs: readonly [{
        readonly name: "amount";
        readonly type: "uint256";
        readonly internalType: "uint256";
    }, {
        readonly name: "limit";
        readonly type: "uint256";
        readonly internalType: "uint256";
    }];
}, {
    readonly type: "error";
    readonly name: "MintingNotStartedYet";
    readonly inputs: readonly [];
}, {
    readonly type: "error";
    readonly name: "OwnableInvalidOwner";
    readonly inputs: readonly [{
        readonly name: "owner";
        readonly type: "address";
        readonly internalType: "address";
    }];
}, {
    readonly type: "error";
    readonly name: "OwnableUnauthorizedAccount";
    readonly inputs: readonly [{
        readonly name: "account";
        readonly type: "address";
        readonly internalType: "address";
    }];
}, {
    readonly type: "error";
    readonly name: "PoolLocked";
    readonly inputs: readonly [];
}, {
    readonly type: "error";
    readonly name: "ReleaseAmountInvalid";
    readonly inputs: readonly [];
}, {
    readonly type: "error";
    readonly name: "SafeCastOverflowedUintDowncast";
    readonly inputs: readonly [{
        readonly name: "bits";
        readonly type: "uint8";
        readonly internalType: "uint8";
    }, {
        readonly name: "value";
        readonly type: "uint256";
        readonly internalType: "uint256";
    }];
}, {
    readonly type: "error";
    readonly name: "StringTooLong";
    readonly inputs: readonly [{
        readonly name: "str";
        readonly type: "string";
        readonly internalType: "string";
    }];
}, {
    readonly type: "error";
    readonly name: "VotesExpiredSignature";
    readonly inputs: readonly [{
        readonly name: "expiry";
        readonly type: "uint256";
        readonly internalType: "uint256";
    }];
}];
declare const dopplerAbi: readonly [{
    readonly type: "constructor";
    readonly inputs: readonly [{
        readonly name: "_poolManager";
        readonly type: "address";
        readonly internalType: "contract IPoolManager";
    }, {
        readonly name: "_numTokensToSell";
        readonly type: "uint256";
        readonly internalType: "uint256";
    }, {
        readonly name: "_minimumProceeds";
        readonly type: "uint256";
        readonly internalType: "uint256";
    }, {
        readonly name: "_maximumProceeds";
        readonly type: "uint256";
        readonly internalType: "uint256";
    }, {
        readonly name: "_startingTime";
        readonly type: "uint256";
        readonly internalType: "uint256";
    }, {
        readonly name: "_endingTime";
        readonly type: "uint256";
        readonly internalType: "uint256";
    }, {
        readonly name: "_startingTick";
        readonly type: "int24";
        readonly internalType: "int24";
    }, {
        readonly name: "_endingTick";
        readonly type: "int24";
        readonly internalType: "int24";
    }, {
        readonly name: "_epochLength";
        readonly type: "uint256";
        readonly internalType: "uint256";
    }, {
        readonly name: "_gamma";
        readonly type: "int24";
        readonly internalType: "int24";
    }, {
        readonly name: "_isToken0";
        readonly type: "bool";
        readonly internalType: "bool";
    }, {
        readonly name: "_numPDSlugs";
        readonly type: "uint256";
        readonly internalType: "uint256";
    }, {
        readonly name: "initializer_";
        readonly type: "address";
        readonly internalType: "address";
    }];
    readonly stateMutability: "nonpayable";
}, {
    readonly type: "receive";
    readonly stateMutability: "payable";
}, {
    readonly type: "function";
    readonly name: "afterAddLiquidity";
    readonly inputs: readonly [{
        readonly name: "";
        readonly type: "address";
        readonly internalType: "address";
    }, {
        readonly name: "";
        readonly type: "tuple";
        readonly internalType: "struct PoolKey";
        readonly components: readonly [{
            readonly name: "currency0";
            readonly type: "address";
            readonly internalType: "Currency";
        }, {
            readonly name: "currency1";
            readonly type: "address";
            readonly internalType: "Currency";
        }, {
            readonly name: "fee";
            readonly type: "uint24";
            readonly internalType: "uint24";
        }, {
            readonly name: "tickSpacing";
            readonly type: "int24";
            readonly internalType: "int24";
        }, {
            readonly name: "hooks";
            readonly type: "address";
            readonly internalType: "contract IHooks";
        }];
    }, {
        readonly name: "";
        readonly type: "tuple";
        readonly internalType: "struct IPoolManager.ModifyLiquidityParams";
        readonly components: readonly [{
            readonly name: "tickLower";
            readonly type: "int24";
            readonly internalType: "int24";
        }, {
            readonly name: "tickUpper";
            readonly type: "int24";
            readonly internalType: "int24";
        }, {
            readonly name: "liquidityDelta";
            readonly type: "int256";
            readonly internalType: "int256";
        }, {
            readonly name: "salt";
            readonly type: "bytes32";
            readonly internalType: "bytes32";
        }];
    }, {
        readonly name: "";
        readonly type: "int256";
        readonly internalType: "BalanceDelta";
    }, {
        readonly name: "";
        readonly type: "int256";
        readonly internalType: "BalanceDelta";
    }, {
        readonly name: "";
        readonly type: "bytes";
        readonly internalType: "bytes";
    }];
    readonly outputs: readonly [{
        readonly name: "";
        readonly type: "bytes4";
        readonly internalType: "bytes4";
    }, {
        readonly name: "";
        readonly type: "int256";
        readonly internalType: "BalanceDelta";
    }];
    readonly stateMutability: "nonpayable";
}, {
    readonly type: "function";
    readonly name: "afterDonate";
    readonly inputs: readonly [{
        readonly name: "";
        readonly type: "address";
        readonly internalType: "address";
    }, {
        readonly name: "";
        readonly type: "tuple";
        readonly internalType: "struct PoolKey";
        readonly components: readonly [{
            readonly name: "currency0";
            readonly type: "address";
            readonly internalType: "Currency";
        }, {
            readonly name: "currency1";
            readonly type: "address";
            readonly internalType: "Currency";
        }, {
            readonly name: "fee";
            readonly type: "uint24";
            readonly internalType: "uint24";
        }, {
            readonly name: "tickSpacing";
            readonly type: "int24";
            readonly internalType: "int24";
        }, {
            readonly name: "hooks";
            readonly type: "address";
            readonly internalType: "contract IHooks";
        }];
    }, {
        readonly name: "";
        readonly type: "uint256";
        readonly internalType: "uint256";
    }, {
        readonly name: "";
        readonly type: "uint256";
        readonly internalType: "uint256";
    }, {
        readonly name: "";
        readonly type: "bytes";
        readonly internalType: "bytes";
    }];
    readonly outputs: readonly [{
        readonly name: "";
        readonly type: "bytes4";
        readonly internalType: "bytes4";
    }];
    readonly stateMutability: "nonpayable";
}, {
    readonly type: "function";
    readonly name: "afterInitialize";
    readonly inputs: readonly [{
        readonly name: "sender";
        readonly type: "address";
        readonly internalType: "address";
    }, {
        readonly name: "key";
        readonly type: "tuple";
        readonly internalType: "struct PoolKey";
        readonly components: readonly [{
            readonly name: "currency0";
            readonly type: "address";
            readonly internalType: "Currency";
        }, {
            readonly name: "currency1";
            readonly type: "address";
            readonly internalType: "Currency";
        }, {
            readonly name: "fee";
            readonly type: "uint24";
            readonly internalType: "uint24";
        }, {
            readonly name: "tickSpacing";
            readonly type: "int24";
            readonly internalType: "int24";
        }, {
            readonly name: "hooks";
            readonly type: "address";
            readonly internalType: "contract IHooks";
        }];
    }, {
        readonly name: "";
        readonly type: "uint160";
        readonly internalType: "uint160";
    }, {
        readonly name: "tick";
        readonly type: "int24";
        readonly internalType: "int24";
    }];
    readonly outputs: readonly [{
        readonly name: "";
        readonly type: "bytes4";
        readonly internalType: "bytes4";
    }];
    readonly stateMutability: "nonpayable";
}, {
    readonly type: "function";
    readonly name: "afterRemoveLiquidity";
    readonly inputs: readonly [{
        readonly name: "";
        readonly type: "address";
        readonly internalType: "address";
    }, {
        readonly name: "";
        readonly type: "tuple";
        readonly internalType: "struct PoolKey";
        readonly components: readonly [{
            readonly name: "currency0";
            readonly type: "address";
            readonly internalType: "Currency";
        }, {
            readonly name: "currency1";
            readonly type: "address";
            readonly internalType: "Currency";
        }, {
            readonly name: "fee";
            readonly type: "uint24";
            readonly internalType: "uint24";
        }, {
            readonly name: "tickSpacing";
            readonly type: "int24";
            readonly internalType: "int24";
        }, {
            readonly name: "hooks";
            readonly type: "address";
            readonly internalType: "contract IHooks";
        }];
    }, {
        readonly name: "";
        readonly type: "tuple";
        readonly internalType: "struct IPoolManager.ModifyLiquidityParams";
        readonly components: readonly [{
            readonly name: "tickLower";
            readonly type: "int24";
            readonly internalType: "int24";
        }, {
            readonly name: "tickUpper";
            readonly type: "int24";
            readonly internalType: "int24";
        }, {
            readonly name: "liquidityDelta";
            readonly type: "int256";
            readonly internalType: "int256";
        }, {
            readonly name: "salt";
            readonly type: "bytes32";
            readonly internalType: "bytes32";
        }];
    }, {
        readonly name: "";
        readonly type: "int256";
        readonly internalType: "BalanceDelta";
    }, {
        readonly name: "";
        readonly type: "int256";
        readonly internalType: "BalanceDelta";
    }, {
        readonly name: "";
        readonly type: "bytes";
        readonly internalType: "bytes";
    }];
    readonly outputs: readonly [{
        readonly name: "";
        readonly type: "bytes4";
        readonly internalType: "bytes4";
    }, {
        readonly name: "";
        readonly type: "int256";
        readonly internalType: "BalanceDelta";
    }];
    readonly stateMutability: "nonpayable";
}, {
    readonly type: "function";
    readonly name: "afterSwap";
    readonly inputs: readonly [{
        readonly name: "";
        readonly type: "address";
        readonly internalType: "address";
    }, {
        readonly name: "key";
        readonly type: "tuple";
        readonly internalType: "struct PoolKey";
        readonly components: readonly [{
            readonly name: "currency0";
            readonly type: "address";
            readonly internalType: "Currency";
        }, {
            readonly name: "currency1";
            readonly type: "address";
            readonly internalType: "Currency";
        }, {
            readonly name: "fee";
            readonly type: "uint24";
            readonly internalType: "uint24";
        }, {
            readonly name: "tickSpacing";
            readonly type: "int24";
            readonly internalType: "int24";
        }, {
            readonly name: "hooks";
            readonly type: "address";
            readonly internalType: "contract IHooks";
        }];
    }, {
        readonly name: "swapParams";
        readonly type: "tuple";
        readonly internalType: "struct IPoolManager.SwapParams";
        readonly components: readonly [{
            readonly name: "zeroForOne";
            readonly type: "bool";
            readonly internalType: "bool";
        }, {
            readonly name: "amountSpecified";
            readonly type: "int256";
            readonly internalType: "int256";
        }, {
            readonly name: "sqrtPriceLimitX96";
            readonly type: "uint160";
            readonly internalType: "uint160";
        }];
    }, {
        readonly name: "swapDelta";
        readonly type: "int256";
        readonly internalType: "BalanceDelta";
    }, {
        readonly name: "";
        readonly type: "bytes";
        readonly internalType: "bytes";
    }];
    readonly outputs: readonly [{
        readonly name: "";
        readonly type: "bytes4";
        readonly internalType: "bytes4";
    }, {
        readonly name: "";
        readonly type: "int128";
        readonly internalType: "int128";
    }];
    readonly stateMutability: "nonpayable";
}, {
    readonly type: "function";
    readonly name: "beforeAddLiquidity";
    readonly inputs: readonly [{
        readonly name: "caller";
        readonly type: "address";
        readonly internalType: "address";
    }, {
        readonly name: "";
        readonly type: "tuple";
        readonly internalType: "struct PoolKey";
        readonly components: readonly [{
            readonly name: "currency0";
            readonly type: "address";
            readonly internalType: "Currency";
        }, {
            readonly name: "currency1";
            readonly type: "address";
            readonly internalType: "Currency";
        }, {
            readonly name: "fee";
            readonly type: "uint24";
            readonly internalType: "uint24";
        }, {
            readonly name: "tickSpacing";
            readonly type: "int24";
            readonly internalType: "int24";
        }, {
            readonly name: "hooks";
            readonly type: "address";
            readonly internalType: "contract IHooks";
        }];
    }, {
        readonly name: "";
        readonly type: "tuple";
        readonly internalType: "struct IPoolManager.ModifyLiquidityParams";
        readonly components: readonly [{
            readonly name: "tickLower";
            readonly type: "int24";
            readonly internalType: "int24";
        }, {
            readonly name: "tickUpper";
            readonly type: "int24";
            readonly internalType: "int24";
        }, {
            readonly name: "liquidityDelta";
            readonly type: "int256";
            readonly internalType: "int256";
        }, {
            readonly name: "salt";
            readonly type: "bytes32";
            readonly internalType: "bytes32";
        }];
    }, {
        readonly name: "";
        readonly type: "bytes";
        readonly internalType: "bytes";
    }];
    readonly outputs: readonly [{
        readonly name: "";
        readonly type: "bytes4";
        readonly internalType: "bytes4";
    }];
    readonly stateMutability: "view";
}, {
    readonly type: "function";
    readonly name: "beforeDonate";
    readonly inputs: readonly [{
        readonly name: "";
        readonly type: "address";
        readonly internalType: "address";
    }, {
        readonly name: "";
        readonly type: "tuple";
        readonly internalType: "struct PoolKey";
        readonly components: readonly [{
            readonly name: "currency0";
            readonly type: "address";
            readonly internalType: "Currency";
        }, {
            readonly name: "currency1";
            readonly type: "address";
            readonly internalType: "Currency";
        }, {
            readonly name: "fee";
            readonly type: "uint24";
            readonly internalType: "uint24";
        }, {
            readonly name: "tickSpacing";
            readonly type: "int24";
            readonly internalType: "int24";
        }, {
            readonly name: "hooks";
            readonly type: "address";
            readonly internalType: "contract IHooks";
        }];
    }, {
        readonly name: "";
        readonly type: "uint256";
        readonly internalType: "uint256";
    }, {
        readonly name: "";
        readonly type: "uint256";
        readonly internalType: "uint256";
    }, {
        readonly name: "";
        readonly type: "bytes";
        readonly internalType: "bytes";
    }];
    readonly outputs: readonly [{
        readonly name: "";
        readonly type: "bytes4";
        readonly internalType: "bytes4";
    }];
    readonly stateMutability: "pure";
}, {
    readonly type: "function";
    readonly name: "beforeInitialize";
    readonly inputs: readonly [{
        readonly name: "";
        readonly type: "address";
        readonly internalType: "address";
    }, {
        readonly name: "key";
        readonly type: "tuple";
        readonly internalType: "struct PoolKey";
        readonly components: readonly [{
            readonly name: "currency0";
            readonly type: "address";
            readonly internalType: "Currency";
        }, {
            readonly name: "currency1";
            readonly type: "address";
            readonly internalType: "Currency";
        }, {
            readonly name: "fee";
            readonly type: "uint24";
            readonly internalType: "uint24";
        }, {
            readonly name: "tickSpacing";
            readonly type: "int24";
            readonly internalType: "int24";
        }, {
            readonly name: "hooks";
            readonly type: "address";
            readonly internalType: "contract IHooks";
        }];
    }, {
        readonly name: "";
        readonly type: "uint160";
        readonly internalType: "uint160";
    }];
    readonly outputs: readonly [{
        readonly name: "";
        readonly type: "bytes4";
        readonly internalType: "bytes4";
    }];
    readonly stateMutability: "nonpayable";
}, {
    readonly type: "function";
    readonly name: "beforeRemoveLiquidity";
    readonly inputs: readonly [{
        readonly name: "";
        readonly type: "address";
        readonly internalType: "address";
    }, {
        readonly name: "";
        readonly type: "tuple";
        readonly internalType: "struct PoolKey";
        readonly components: readonly [{
            readonly name: "currency0";
            readonly type: "address";
            readonly internalType: "Currency";
        }, {
            readonly name: "currency1";
            readonly type: "address";
            readonly internalType: "Currency";
        }, {
            readonly name: "fee";
            readonly type: "uint24";
            readonly internalType: "uint24";
        }, {
            readonly name: "tickSpacing";
            readonly type: "int24";
            readonly internalType: "int24";
        }, {
            readonly name: "hooks";
            readonly type: "address";
            readonly internalType: "contract IHooks";
        }];
    }, {
        readonly name: "";
        readonly type: "tuple";
        readonly internalType: "struct IPoolManager.ModifyLiquidityParams";
        readonly components: readonly [{
            readonly name: "tickLower";
            readonly type: "int24";
            readonly internalType: "int24";
        }, {
            readonly name: "tickUpper";
            readonly type: "int24";
            readonly internalType: "int24";
        }, {
            readonly name: "liquidityDelta";
            readonly type: "int256";
            readonly internalType: "int256";
        }, {
            readonly name: "salt";
            readonly type: "bytes32";
            readonly internalType: "bytes32";
        }];
    }, {
        readonly name: "";
        readonly type: "bytes";
        readonly internalType: "bytes";
    }];
    readonly outputs: readonly [{
        readonly name: "";
        readonly type: "bytes4";
        readonly internalType: "bytes4";
    }];
    readonly stateMutability: "nonpayable";
}, {
    readonly type: "function";
    readonly name: "beforeSwap";
    readonly inputs: readonly [{
        readonly name: "";
        readonly type: "address";
        readonly internalType: "address";
    }, {
        readonly name: "key";
        readonly type: "tuple";
        readonly internalType: "struct PoolKey";
        readonly components: readonly [{
            readonly name: "currency0";
            readonly type: "address";
            readonly internalType: "Currency";
        }, {
            readonly name: "currency1";
            readonly type: "address";
            readonly internalType: "Currency";
        }, {
            readonly name: "fee";
            readonly type: "uint24";
            readonly internalType: "uint24";
        }, {
            readonly name: "tickSpacing";
            readonly type: "int24";
            readonly internalType: "int24";
        }, {
            readonly name: "hooks";
            readonly type: "address";
            readonly internalType: "contract IHooks";
        }];
    }, {
        readonly name: "swapParams";
        readonly type: "tuple";
        readonly internalType: "struct IPoolManager.SwapParams";
        readonly components: readonly [{
            readonly name: "zeroForOne";
            readonly type: "bool";
            readonly internalType: "bool";
        }, {
            readonly name: "amountSpecified";
            readonly type: "int256";
            readonly internalType: "int256";
        }, {
            readonly name: "sqrtPriceLimitX96";
            readonly type: "uint160";
            readonly internalType: "uint160";
        }];
    }, {
        readonly name: "";
        readonly type: "bytes";
        readonly internalType: "bytes";
    }];
    readonly outputs: readonly [{
        readonly name: "";
        readonly type: "bytes4";
        readonly internalType: "bytes4";
    }, {
        readonly name: "";
        readonly type: "int256";
        readonly internalType: "BeforeSwapDelta";
    }, {
        readonly name: "";
        readonly type: "uint24";
        readonly internalType: "uint24";
    }];
    readonly stateMutability: "nonpayable";
}, {
    readonly type: "function";
    readonly name: "earlyExit";
    readonly inputs: readonly [];
    readonly outputs: readonly [{
        readonly name: "";
        readonly type: "bool";
        readonly internalType: "bool";
    }];
    readonly stateMutability: "view";
}, {
    readonly type: "function";
    readonly name: "getHookPermissions";
    readonly inputs: readonly [];
    readonly outputs: readonly [{
        readonly name: "";
        readonly type: "tuple";
        readonly internalType: "struct Hooks.Permissions";
        readonly components: readonly [{
            readonly name: "beforeInitialize";
            readonly type: "bool";
            readonly internalType: "bool";
        }, {
            readonly name: "afterInitialize";
            readonly type: "bool";
            readonly internalType: "bool";
        }, {
            readonly name: "beforeAddLiquidity";
            readonly type: "bool";
            readonly internalType: "bool";
        }, {
            readonly name: "afterAddLiquidity";
            readonly type: "bool";
            readonly internalType: "bool";
        }, {
            readonly name: "beforeRemoveLiquidity";
            readonly type: "bool";
            readonly internalType: "bool";
        }, {
            readonly name: "afterRemoveLiquidity";
            readonly type: "bool";
            readonly internalType: "bool";
        }, {
            readonly name: "beforeSwap";
            readonly type: "bool";
            readonly internalType: "bool";
        }, {
            readonly name: "afterSwap";
            readonly type: "bool";
            readonly internalType: "bool";
        }, {
            readonly name: "beforeDonate";
            readonly type: "bool";
            readonly internalType: "bool";
        }, {
            readonly name: "afterDonate";
            readonly type: "bool";
            readonly internalType: "bool";
        }, {
            readonly name: "beforeSwapReturnDelta";
            readonly type: "bool";
            readonly internalType: "bool";
        }, {
            readonly name: "afterSwapReturnDelta";
            readonly type: "bool";
            readonly internalType: "bool";
        }, {
            readonly name: "afterAddLiquidityReturnDelta";
            readonly type: "bool";
            readonly internalType: "bool";
        }, {
            readonly name: "afterRemoveLiquidityReturnDelta";
            readonly type: "bool";
            readonly internalType: "bool";
        }];
    }];
    readonly stateMutability: "pure";
}, {
    readonly type: "function";
    readonly name: "initializer";
    readonly inputs: readonly [];
    readonly outputs: readonly [{
        readonly name: "";
        readonly type: "address";
        readonly internalType: "address";
    }];
    readonly stateMutability: "view";
}, {
    readonly type: "function";
    readonly name: "insufficientProceeds";
    readonly inputs: readonly [];
    readonly outputs: readonly [{
        readonly name: "";
        readonly type: "bool";
        readonly internalType: "bool";
    }];
    readonly stateMutability: "view";
}, {
    readonly type: "function";
    readonly name: "isInitialized";
    readonly inputs: readonly [];
    readonly outputs: readonly [{
        readonly name: "";
        readonly type: "bool";
        readonly internalType: "bool";
    }];
    readonly stateMutability: "view";
}, {
    readonly type: "function";
    readonly name: "migrate";
    readonly inputs: readonly [{
        readonly name: "recipient";
        readonly type: "address";
        readonly internalType: "address";
    }];
    readonly outputs: readonly [{
        readonly name: "sqrtPriceX96";
        readonly type: "uint160";
        readonly internalType: "uint160";
    }, {
        readonly name: "token0";
        readonly type: "address";
        readonly internalType: "address";
    }, {
        readonly name: "fees0";
        readonly type: "uint128";
        readonly internalType: "uint128";
    }, {
        readonly name: "balance0";
        readonly type: "uint128";
        readonly internalType: "uint128";
    }, {
        readonly name: "token1";
        readonly type: "address";
        readonly internalType: "address";
    }, {
        readonly name: "fees1";
        readonly type: "uint128";
        readonly internalType: "uint128";
    }, {
        readonly name: "balance1";
        readonly type: "uint128";
        readonly internalType: "uint128";
    }];
    readonly stateMutability: "nonpayable";
}, {
    readonly type: "function";
    readonly name: "poolKey";
    readonly inputs: readonly [];
    readonly outputs: readonly [{
        readonly name: "currency0";
        readonly type: "address";
        readonly internalType: "Currency";
    }, {
        readonly name: "currency1";
        readonly type: "address";
        readonly internalType: "Currency";
    }, {
        readonly name: "fee";
        readonly type: "uint24";
        readonly internalType: "uint24";
    }, {
        readonly name: "tickSpacing";
        readonly type: "int24";
        readonly internalType: "int24";
    }, {
        readonly name: "hooks";
        readonly type: "address";
        readonly internalType: "contract IHooks";
    }];
    readonly stateMutability: "view";
}, {
    readonly type: "function";
    readonly name: "poolManager";
    readonly inputs: readonly [];
    readonly outputs: readonly [{
        readonly name: "";
        readonly type: "address";
        readonly internalType: "contract IPoolManager";
    }];
    readonly stateMutability: "view";
}, {
    readonly type: "function";
    readonly name: "positions";
    readonly inputs: readonly [{
        readonly name: "salt";
        readonly type: "bytes32";
        readonly internalType: "bytes32";
    }];
    readonly outputs: readonly [{
        readonly name: "tickLower";
        readonly type: "int24";
        readonly internalType: "int24";
    }, {
        readonly name: "tickUpper";
        readonly type: "int24";
        readonly internalType: "int24";
    }, {
        readonly name: "liquidity";
        readonly type: "uint128";
        readonly internalType: "uint128";
    }, {
        readonly name: "salt";
        readonly type: "uint8";
        readonly internalType: "uint8";
    }];
    readonly stateMutability: "view";
}, {
    readonly type: "function";
    readonly name: "state";
    readonly inputs: readonly [];
    readonly outputs: readonly [{
        readonly name: "lastEpoch";
        readonly type: "uint40";
        readonly internalType: "uint40";
    }, {
        readonly name: "tickAccumulator";
        readonly type: "int256";
        readonly internalType: "int256";
    }, {
        readonly name: "totalTokensSold";
        readonly type: "uint256";
        readonly internalType: "uint256";
    }, {
        readonly name: "totalProceeds";
        readonly type: "uint256";
        readonly internalType: "uint256";
    }, {
        readonly name: "totalTokensSoldLastEpoch";
        readonly type: "uint256";
        readonly internalType: "uint256";
    }, {
        readonly name: "feesAccrued";
        readonly type: "int256";
        readonly internalType: "BalanceDelta";
    }];
    readonly stateMutability: "view";
}, {
    readonly type: "function";
    readonly name: "unlockCallback";
    readonly inputs: readonly [{
        readonly name: "data";
        readonly type: "bytes";
        readonly internalType: "bytes";
    }];
    readonly outputs: readonly [{
        readonly name: "";
        readonly type: "bytes";
        readonly internalType: "bytes";
    }];
    readonly stateMutability: "nonpayable";
}, {
    readonly type: "event";
    readonly name: "EarlyExit";
    readonly inputs: readonly [{
        readonly name: "epoch";
        readonly type: "uint256";
        readonly indexed: false;
        readonly internalType: "uint256";
    }];
    readonly anonymous: false;
}, {
    readonly type: "event";
    readonly name: "InsufficientProceeds";
    readonly inputs: readonly [];
    readonly anonymous: false;
}, {
    readonly type: "event";
    readonly name: "Rebalance";
    readonly inputs: readonly [{
        readonly name: "currentTick";
        readonly type: "int24";
        readonly indexed: false;
        readonly internalType: "int24";
    }, {
        readonly name: "tickLower";
        readonly type: "int24";
        readonly indexed: false;
        readonly internalType: "int24";
    }, {
        readonly name: "tickUpper";
        readonly type: "int24";
        readonly indexed: false;
        readonly internalType: "int24";
    }, {
        readonly name: "epoch";
        readonly type: "uint256";
        readonly indexed: false;
        readonly internalType: "uint256";
    }];
    readonly anonymous: false;
}, {
    readonly type: "event";
    readonly name: "Swap";
    readonly inputs: readonly [{
        readonly name: "currentTick";
        readonly type: "int24";
        readonly indexed: false;
        readonly internalType: "int24";
    }, {
        readonly name: "totalProceeds";
        readonly type: "uint256";
        readonly indexed: false;
        readonly internalType: "uint256";
    }, {
        readonly name: "totalTokensSold";
        readonly type: "uint256";
        readonly indexed: false;
        readonly internalType: "uint256";
    }];
    readonly anonymous: false;
}, {
    readonly type: "error";
    readonly name: "AlreadyInitialized";
    readonly inputs: readonly [];
}, {
    readonly type: "error";
    readonly name: "CannotAddLiquidity";
    readonly inputs: readonly [];
}, {
    readonly type: "error";
    readonly name: "CannotDonate";
    readonly inputs: readonly [];
}, {
    readonly type: "error";
    readonly name: "CannotMigrate";
    readonly inputs: readonly [];
}, {
    readonly type: "error";
    readonly name: "CannotSwapBeforeStartTime";
    readonly inputs: readonly [];
}, {
    readonly type: "error";
    readonly name: "HookNotImplemented";
    readonly inputs: readonly [];
}, {
    readonly type: "error";
    readonly name: "InvalidEpochLength";
    readonly inputs: readonly [];
}, {
    readonly type: "error";
    readonly name: "InvalidGamma";
    readonly inputs: readonly [];
}, {
    readonly type: "error";
    readonly name: "InvalidNumPDSlugs";
    readonly inputs: readonly [];
}, {
    readonly type: "error";
    readonly name: "InvalidPool";
    readonly inputs: readonly [];
}, {
    readonly type: "error";
    readonly name: "InvalidProceedLimits";
    readonly inputs: readonly [];
}, {
    readonly type: "error";
    readonly name: "InvalidStartTime";
    readonly inputs: readonly [];
}, {
    readonly type: "error";
    readonly name: "InvalidSwapAfterMaturityInsufficientProceeds";
    readonly inputs: readonly [];
}, {
    readonly type: "error";
    readonly name: "InvalidSwapAfterMaturitySufficientProceeds";
    readonly inputs: readonly [];
}, {
    readonly type: "error";
    readonly name: "InvalidTickRange";
    readonly inputs: readonly [];
}, {
    readonly type: "error";
    readonly name: "InvalidTickSpacing";
    readonly inputs: readonly [];
}, {
    readonly type: "error";
    readonly name: "InvalidTimeRange";
    readonly inputs: readonly [];
}, {
    readonly type: "error";
    readonly name: "LockFailure";
    readonly inputs: readonly [];
}, {
    readonly type: "error";
    readonly name: "MaximumProceedsReached";
    readonly inputs: readonly [];
}, {
    readonly type: "error";
    readonly name: "NotPoolManager";
    readonly inputs: readonly [];
}, {
    readonly type: "error";
    readonly name: "NotSelf";
    readonly inputs: readonly [];
}, {
    readonly type: "error";
    readonly name: "SenderNotInitializer";
    readonly inputs: readonly [];
}, {
    readonly type: "error";
    readonly name: "SenderNotPoolManager";
    readonly inputs: readonly [];
}, {
    readonly type: "error";
    readonly name: "SwapBelowRange";
    readonly inputs: readonly [];
}];

interface Clients {
    publicClient: PublicClient;
    walletClient?: WalletClient;
    testClient?: TestClient;
}
interface DopplerV4Addresses {
    airlock: Address;
    tokenFactory: Address;
    v4Initializer: Address;
    v3Initializer?: Address;
    governanceFactory: Address;
    migrator: Address;
    stateView: Address;
    quoter: Address;
    customRouter: Address;
    poolManager: Address;
    dopplerDeployer: Address;
    uniRouter: Address;
}
interface TokenConfig {
    name: string;
    symbol: string;
    totalSupply: bigint;
}
interface DeploymentConfigParams {
    assetToken: Address;
    quoteToken: Address;
    startTime: number;
    endTime: number;
    epochLength: number;
    startTick: number;
    endTick: number;
    gamma: number;
    minProceeds: bigint;
    maxProceeds: bigint;
    numTokensToSell: bigint;
    numPdSlugs: number;
}
type ViewOverrides = {
    blockNumber?: bigint;
    blockTag?: 'latest' | 'earliest' | 'pending' | 'safe' | 'finalized';
};
interface PoolKey {
    currency0: Address;
    currency1: Address;
    fee: number;
    tickSpacing: number;
    hooks: Address;
}
interface PriceRange {
    startPrice: number;
    endPrice: number;
}
interface DopplerPreDeploymentConfig {
    name: string;
    symbol: string;
    totalSupply: bigint;
    numTokensToSell: bigint;
    blockTimestamp: number;
    startTimeOffset: number;
    duration: number;
    epochLength: number;
    priceRange: PriceRange;
    tickSpacing: number;
    fee: number;
    minProceeds: bigint;
    maxProceeds: bigint;
    numPdSlugs?: number;
}
interface AssetData {
    numeraire: Address;
    poolInitializer: Address;
    timelock: Address;
    governance: Address;
    liquidityMigrator: Address;
    migrationPool: Address;
    integrator: Address;
    totalSupply: bigint;
}
interface PoolConfig {
    tickSpacing: number;
    fee: number;
}
interface DopplerDeploymentConfig {
    salt: Hash;
    dopplerAddress: Address;
    poolKey: PoolKey;
    token: TokenConfig;
    hook: DeploymentConfigParams;
    pool: PoolConfig;
}
interface DeployerParams {
    publicClient: PublicClient;
    walletClient: WalletClient;
    addresses?: DopplerV4Addresses;
}

type Derc20ABI = typeof derc20Abi;
declare class ReadDerc20 {
    contract: ReadContract<Derc20ABI>;
    constructor(address: `0x${string}`, drift?: Drift<ReadAdapter>);
    getName(): Promise<string>;
    getSymbol(): Promise<string>;
    getDecimals(): Promise<number>;
    getAllowance(owner: Address$1, spender: Address$1): Promise<bigint>;
    getBalanceOf(account: Address$1): Promise<bigint>;
}

declare class ReadEth {
    drift: Drift<ReadAdapter>;
    static address: string;
    constructor(drift?: Drift<ReadAdapter>);
    getName(): Promise<string>;
    getSymbol(): Promise<string>;
    getDecimals(): Promise<number>;
    getAllowance(): Promise<bigint>;
    getBalanceOf(account: Address$1): Promise<bigint>;
}

type DopplerABI = typeof dopplerAbi;
type StateViewABI = typeof stateViewAbi;
declare class ReadDoppler {
    drift: Drift<ReadAdapter>;
    address: Address$1;
    doppler: ReadContract<DopplerABI>;
    stateView: ReadContract<StateViewABI>;
    poolId: Hex;
    constructor(dopplerAddress: `0x${string}`, stateViewAddress: `0x${string}`, drift?: Drift<ReadAdapter>);
    getState(): Promise<{
        lastEpoch: number;
        tickAccumulator: bigint;
        totalTokensSold: bigint;
        totalProceeds: bigint;
        totalTokensSoldLastEpoch: bigint;
        feesAccrued: bigint;
    }>;
    getPosition(salt: Hex): Promise<{
        tickLower: number;
        tickUpper: number;
    }>;
    getSlot0(id: Hex): Promise<{
        tick: number;
        sqrtPriceX96: bigint;
        protocolFee: number;
        lpFee: number;
    }>;
    getCurrentPrice(): Promise<bigint>;
    getPoolKey(): Promise<PoolKey>;
    getPoolId(): Promise<Hex>;
    getAssetToken(): Promise<ReadDerc20>;
    getQuoteToken(): Promise<ReadDerc20 | ReadEth>;
    getInsufficientProceeds(): Promise<boolean>;
    getEarlyExit(): Promise<boolean>;
}

type AirlockABI = typeof airlockAbi;
declare enum ModuleState {
    NotWhitelisted = 0,
    TokenFactory = 1,
    GovernanceFactory = 2,
    HookFactory = 3,
    Migrator = 4
}
declare class ReadFactory {
    airlock: ReadContract<AirlockABI>;
    constructor(address: Address, drift?: Drift<ReadAdapter>);
    getModuleState(module: Address): Promise<ModuleState>;
    getAssetData(asset: Address): Promise<AssetData>;
}

interface CreateParams {
    initialSupply: bigint;
    numTokensToSell: bigint;
    numeraire: Address;
    tokenFactory: Address;
    tokenFactoryData: Hex;
    governanceFactory: Address;
    governanceFactoryData: Hex;
    poolInitializer: Address;
    poolInitializerData: Hex;
    liquidityMigrator: Address;
    liquidityMigratorData: Hex;
    integrator: Address;
    salt: Hex;
}
declare class ReadWriteFactory extends ReadFactory {
    airlock: ReadWriteContract<AirlockABI>;
    constructor(address: Address, drift: Drift<ReadWriteAdapter>);
    create(params: CreateParams, options?: ContractWriteOptions & OnMinedParam): Promise<Hex>;
}

/**
 * Validates and builds pool configuration from user-friendly parameters
 */
declare function buildConfig(params: DopplerPreDeploymentConfig, addresses: DopplerV4Addresses): CreateParams;
declare function priceToClosestTick(price: Price<Token, Token>): number;

interface MineV4Params {
    airlock: Address;
    poolManager: Address;
    deployer: Address;
    initialSupply: bigint;
    numTokensToSell: bigint;
    numeraire: Address;
    tokenFactory: Address;
    tokenFactoryData: TokenFactoryData;
    poolInitializer: Address;
    poolInitializerData: DopplerData;
}
interface DopplerData {
    initialPrice: bigint;
    minimumProceeds: bigint;
    maximumProceeds: bigint;
    startingTime: bigint;
    endingTime: bigint;
    startingTick: number;
    endingTick: number;
    epochLength: bigint;
    gamma: number;
    isToken0: boolean;
    numPDSlugs: bigint;
}
interface TokenFactoryData {
    name: string;
    symbol: string;
    airlock: Address;
    initialSupply: bigint;
    yearlyMintCap: bigint;
    vestingDuration: bigint;
    recipients: Address[];
    amounts: bigint[];
}
declare function mine(params: MineV4Params): [Hash, Address, Address, Hex, Hex];

interface TradeParams {
    key: PoolKey;
    amount: bigint;
}
type CustomRouterABI = typeof customRouterAbi;
declare class ReadWriteRouter {
    contract: ReadWriteContract<CustomRouterABI>;
    constructor(address: Address, drift?: Drift<ReadWriteAdapter>);
    buyExactIn(params: TradeParams): Promise<Hex>;
    buyExactOut(params: TradeParams): Promise<Hex>;
    sellExactIn(params: TradeParams): Promise<Hex>;
    sellExactOut(params: TradeParams): Promise<Hex>;
}

declare class ReadWriteDerc20 extends ReadDerc20 {
    contract: ReadWriteContract<Derc20ABI>;
    constructor(address: Address, drift?: Drift<ReadWriteAdapter>);
    approve(spender: Address, value: bigint): Promise<Hex>;
}

declare const DOPPLER_V4_ADDRESSES: {
    [chainId: number]: DopplerV4Addresses;
};

declare const MAX_TICK_SPACING = 30;
declare const DEFAULT_PD_SLUGS = 5;
declare const DAY_SECONDS: number;
declare const ETH_ADDRESS = "0x0000000000000000000000000000000000000000";

export { type AirlockABI, type AssetData, type Clients, type CreateParams, DAY_SECONDS, DEFAULT_PD_SLUGS, DOPPLER_V4_ADDRESSES, type DeployerParams, type DeploymentConfigParams, type Derc20ABI, type DopplerData, type DopplerDeploymentConfig, type DopplerPreDeploymentConfig, type DopplerV4Addresses, ETH_ADDRESS, MAX_TICK_SPACING, type MineV4Params, ModuleState, type PoolConfig, type PoolKey, type PriceRange, ReadDerc20, ReadDoppler, ReadEth, ReadFactory, ReadWriteDerc20, ReadWriteFactory, ReadWriteRouter, type TokenConfig, type TokenFactoryData, type ViewOverrides, buildConfig, mine, priceToClosestTick };
