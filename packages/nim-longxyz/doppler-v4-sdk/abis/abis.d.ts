export declare const customRouterAbi: readonly [{
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
export declare const poolManagerAbi: readonly [{
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
    }, {
        readonly name: "id";
        readonly type: "uint256";
        readonly internalType: "uint256";
    }];
    readonly outputs: readonly [{
        readonly name: "amount";
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
        readonly name: "id";
        readonly type: "uint256";
        readonly internalType: "uint256";
    }, {
        readonly name: "amount";
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
        readonly name: "owner";
        readonly type: "address";
        readonly internalType: "address";
    }, {
        readonly name: "id";
        readonly type: "uint256";
        readonly internalType: "uint256";
    }];
    readonly outputs: readonly [{
        readonly name: "balance";
        readonly type: "uint256";
        readonly internalType: "uint256";
    }];
    readonly stateMutability: "view";
}, {
    readonly type: "function";
    readonly name: "burn";
    readonly inputs: readonly [{
        readonly name: "from";
        readonly type: "address";
        readonly internalType: "address";
    }, {
        readonly name: "id";
        readonly type: "uint256";
        readonly internalType: "uint256";
    }, {
        readonly name: "amount";
        readonly type: "uint256";
        readonly internalType: "uint256";
    }];
    readonly outputs: readonly [];
    readonly stateMutability: "nonpayable";
}, {
    readonly type: "function";
    readonly name: "clear";
    readonly inputs: readonly [{
        readonly name: "currency";
        readonly type: "address";
        readonly internalType: "Currency";
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
        readonly name: "recipient";
        readonly type: "address";
        readonly internalType: "address";
    }, {
        readonly name: "currency";
        readonly type: "address";
        readonly internalType: "Currency";
    }, {
        readonly name: "amount";
        readonly type: "uint256";
        readonly internalType: "uint256";
    }];
    readonly outputs: readonly [{
        readonly name: "amountCollected";
        readonly type: "uint256";
        readonly internalType: "uint256";
    }];
    readonly stateMutability: "nonpayable";
}, {
    readonly type: "function";
    readonly name: "donate";
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
        readonly name: "amount0";
        readonly type: "uint256";
        readonly internalType: "uint256";
    }, {
        readonly name: "amount1";
        readonly type: "uint256";
        readonly internalType: "uint256";
    }, {
        readonly name: "hookData";
        readonly type: "bytes";
        readonly internalType: "bytes";
    }];
    readonly outputs: readonly [{
        readonly name: "delta";
        readonly type: "int256";
        readonly internalType: "BalanceDelta";
    }];
    readonly stateMutability: "nonpayable";
}, {
    readonly type: "function";
    readonly name: "extsload";
    readonly inputs: readonly [{
        readonly name: "slot";
        readonly type: "bytes32";
        readonly internalType: "bytes32";
    }];
    readonly outputs: readonly [{
        readonly name: "";
        readonly type: "bytes32";
        readonly internalType: "bytes32";
    }];
    readonly stateMutability: "view";
}, {
    readonly type: "function";
    readonly name: "extsload";
    readonly inputs: readonly [{
        readonly name: "startSlot";
        readonly type: "bytes32";
        readonly internalType: "bytes32";
    }, {
        readonly name: "nSlots";
        readonly type: "uint256";
        readonly internalType: "uint256";
    }];
    readonly outputs: readonly [{
        readonly name: "";
        readonly type: "bytes32[]";
        readonly internalType: "bytes32[]";
    }];
    readonly stateMutability: "view";
}, {
    readonly type: "function";
    readonly name: "extsload";
    readonly inputs: readonly [{
        readonly name: "slots";
        readonly type: "bytes32[]";
        readonly internalType: "bytes32[]";
    }];
    readonly outputs: readonly [{
        readonly name: "";
        readonly type: "bytes32[]";
        readonly internalType: "bytes32[]";
    }];
    readonly stateMutability: "view";
}, {
    readonly type: "function";
    readonly name: "exttload";
    readonly inputs: readonly [{
        readonly name: "slots";
        readonly type: "bytes32[]";
        readonly internalType: "bytes32[]";
    }];
    readonly outputs: readonly [{
        readonly name: "";
        readonly type: "bytes32[]";
        readonly internalType: "bytes32[]";
    }];
    readonly stateMutability: "view";
}, {
    readonly type: "function";
    readonly name: "exttload";
    readonly inputs: readonly [{
        readonly name: "slot";
        readonly type: "bytes32";
        readonly internalType: "bytes32";
    }];
    readonly outputs: readonly [{
        readonly name: "";
        readonly type: "bytes32";
        readonly internalType: "bytes32";
    }];
    readonly stateMutability: "view";
}, {
    readonly type: "function";
    readonly name: "initialize";
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
        readonly name: "sqrtPriceX96";
        readonly type: "uint160";
        readonly internalType: "uint160";
    }, {
        readonly name: "hookData";
        readonly type: "bytes";
        readonly internalType: "bytes";
    }];
    readonly outputs: readonly [{
        readonly name: "tick";
        readonly type: "int24";
        readonly internalType: "int24";
    }];
    readonly stateMutability: "nonpayable";
}, {
    readonly type: "function";
    readonly name: "isOperator";
    readonly inputs: readonly [{
        readonly name: "owner";
        readonly type: "address";
        readonly internalType: "address";
    }, {
        readonly name: "operator";
        readonly type: "address";
        readonly internalType: "address";
    }];
    readonly outputs: readonly [{
        readonly name: "isOperator";
        readonly type: "bool";
        readonly internalType: "bool";
    }];
    readonly stateMutability: "view";
}, {
    readonly type: "function";
    readonly name: "mint";
    readonly inputs: readonly [{
        readonly name: "to";
        readonly type: "address";
        readonly internalType: "address";
    }, {
        readonly name: "id";
        readonly type: "uint256";
        readonly internalType: "uint256";
    }, {
        readonly name: "amount";
        readonly type: "uint256";
        readonly internalType: "uint256";
    }];
    readonly outputs: readonly [];
    readonly stateMutability: "nonpayable";
}, {
    readonly type: "function";
    readonly name: "modifyLiquidity";
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
        readonly name: "params";
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
        readonly name: "hookData";
        readonly type: "bytes";
        readonly internalType: "bytes";
    }];
    readonly outputs: readonly [{
        readonly name: "callerDelta";
        readonly type: "int256";
        readonly internalType: "BalanceDelta";
    }, {
        readonly name: "feesAccrued";
        readonly type: "int256";
        readonly internalType: "BalanceDelta";
    }];
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
    readonly name: "protocolFeeController";
    readonly inputs: readonly [];
    readonly outputs: readonly [{
        readonly name: "";
        readonly type: "address";
        readonly internalType: "contract IProtocolFeeController";
    }];
    readonly stateMutability: "view";
}, {
    readonly type: "function";
    readonly name: "protocolFeesAccrued";
    readonly inputs: readonly [{
        readonly name: "currency";
        readonly type: "address";
        readonly internalType: "Currency";
    }];
    readonly outputs: readonly [{
        readonly name: "amount";
        readonly type: "uint256";
        readonly internalType: "uint256";
    }];
    readonly stateMutability: "view";
}, {
    readonly type: "function";
    readonly name: "setOperator";
    readonly inputs: readonly [{
        readonly name: "operator";
        readonly type: "address";
        readonly internalType: "address";
    }, {
        readonly name: "approved";
        readonly type: "bool";
        readonly internalType: "bool";
    }];
    readonly outputs: readonly [{
        readonly name: "";
        readonly type: "bool";
        readonly internalType: "bool";
    }];
    readonly stateMutability: "nonpayable";
}, {
    readonly type: "function";
    readonly name: "setProtocolFee";
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
        readonly name: "newProtocolFee";
        readonly type: "uint24";
        readonly internalType: "uint24";
    }];
    readonly outputs: readonly [];
    readonly stateMutability: "nonpayable";
}, {
    readonly type: "function";
    readonly name: "setProtocolFeeController";
    readonly inputs: readonly [{
        readonly name: "controller";
        readonly type: "address";
        readonly internalType: "contract IProtocolFeeController";
    }];
    readonly outputs: readonly [];
    readonly stateMutability: "nonpayable";
}, {
    readonly type: "function";
    readonly name: "settle";
    readonly inputs: readonly [];
    readonly outputs: readonly [{
        readonly name: "";
        readonly type: "uint256";
        readonly internalType: "uint256";
    }];
    readonly stateMutability: "payable";
}, {
    readonly type: "function";
    readonly name: "settleFor";
    readonly inputs: readonly [{
        readonly name: "recipient";
        readonly type: "address";
        readonly internalType: "address";
    }];
    readonly outputs: readonly [{
        readonly name: "";
        readonly type: "uint256";
        readonly internalType: "uint256";
    }];
    readonly stateMutability: "payable";
}, {
    readonly type: "function";
    readonly name: "supportsInterface";
    readonly inputs: readonly [{
        readonly name: "interfaceId";
        readonly type: "bytes4";
        readonly internalType: "bytes4";
    }];
    readonly outputs: readonly [{
        readonly name: "";
        readonly type: "bool";
        readonly internalType: "bool";
    }];
    readonly stateMutability: "view";
}, {
    readonly type: "function";
    readonly name: "swap";
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
        readonly name: "params";
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
        readonly name: "hookData";
        readonly type: "bytes";
        readonly internalType: "bytes";
    }];
    readonly outputs: readonly [{
        readonly name: "swapDelta";
        readonly type: "int256";
        readonly internalType: "BalanceDelta";
    }];
    readonly stateMutability: "nonpayable";
}, {
    readonly type: "function";
    readonly name: "sync";
    readonly inputs: readonly [{
        readonly name: "currency";
        readonly type: "address";
        readonly internalType: "Currency";
    }];
    readonly outputs: readonly [];
    readonly stateMutability: "nonpayable";
}, {
    readonly type: "function";
    readonly name: "take";
    readonly inputs: readonly [{
        readonly name: "currency";
        readonly type: "address";
        readonly internalType: "Currency";
    }, {
        readonly name: "to";
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
    readonly name: "transfer";
    readonly inputs: readonly [{
        readonly name: "receiver";
        readonly type: "address";
        readonly internalType: "address";
    }, {
        readonly name: "id";
        readonly type: "uint256";
        readonly internalType: "uint256";
    }, {
        readonly name: "amount";
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
        readonly name: "sender";
        readonly type: "address";
        readonly internalType: "address";
    }, {
        readonly name: "receiver";
        readonly type: "address";
        readonly internalType: "address";
    }, {
        readonly name: "id";
        readonly type: "uint256";
        readonly internalType: "uint256";
    }, {
        readonly name: "amount";
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
    readonly name: "unlock";
    readonly inputs: readonly [{
        readonly name: "data";
        readonly type: "bytes";
        readonly internalType: "bytes";
    }];
    readonly outputs: readonly [{
        readonly name: "result";
        readonly type: "bytes";
        readonly internalType: "bytes";
    }];
    readonly stateMutability: "nonpayable";
}, {
    readonly type: "function";
    readonly name: "updateDynamicLPFee";
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
        readonly name: "newDynamicLPFee";
        readonly type: "uint24";
        readonly internalType: "uint24";
    }];
    readonly outputs: readonly [];
    readonly stateMutability: "nonpayable";
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
        readonly name: "id";
        readonly type: "uint256";
        readonly indexed: true;
        readonly internalType: "uint256";
    }, {
        readonly name: "amount";
        readonly type: "uint256";
        readonly indexed: false;
        readonly internalType: "uint256";
    }];
    readonly anonymous: false;
}, {
    readonly type: "event";
    readonly name: "Donate";
    readonly inputs: readonly [{
        readonly name: "id";
        readonly type: "bytes32";
        readonly indexed: true;
        readonly internalType: "PoolId";
    }, {
        readonly name: "sender";
        readonly type: "address";
        readonly indexed: true;
        readonly internalType: "address";
    }, {
        readonly name: "amount0";
        readonly type: "uint256";
        readonly indexed: false;
        readonly internalType: "uint256";
    }, {
        readonly name: "amount1";
        readonly type: "uint256";
        readonly indexed: false;
        readonly internalType: "uint256";
    }];
    readonly anonymous: false;
}, {
    readonly type: "event";
    readonly name: "Initialize";
    readonly inputs: readonly [{
        readonly name: "id";
        readonly type: "bytes32";
        readonly indexed: true;
        readonly internalType: "PoolId";
    }, {
        readonly name: "currency0";
        readonly type: "address";
        readonly indexed: true;
        readonly internalType: "Currency";
    }, {
        readonly name: "currency1";
        readonly type: "address";
        readonly indexed: true;
        readonly internalType: "Currency";
    }, {
        readonly name: "fee";
        readonly type: "uint24";
        readonly indexed: false;
        readonly internalType: "uint24";
    }, {
        readonly name: "tickSpacing";
        readonly type: "int24";
        readonly indexed: false;
        readonly internalType: "int24";
    }, {
        readonly name: "hooks";
        readonly type: "address";
        readonly indexed: false;
        readonly internalType: "contract IHooks";
    }, {
        readonly name: "sqrtPriceX96";
        readonly type: "uint160";
        readonly indexed: false;
        readonly internalType: "uint160";
    }, {
        readonly name: "tick";
        readonly type: "int24";
        readonly indexed: false;
        readonly internalType: "int24";
    }];
    readonly anonymous: false;
}, {
    readonly type: "event";
    readonly name: "ModifyLiquidity";
    readonly inputs: readonly [{
        readonly name: "id";
        readonly type: "bytes32";
        readonly indexed: true;
        readonly internalType: "PoolId";
    }, {
        readonly name: "sender";
        readonly type: "address";
        readonly indexed: true;
        readonly internalType: "address";
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
        readonly name: "liquidityDelta";
        readonly type: "int256";
        readonly indexed: false;
        readonly internalType: "int256";
    }, {
        readonly name: "salt";
        readonly type: "bytes32";
        readonly indexed: false;
        readonly internalType: "bytes32";
    }];
    readonly anonymous: false;
}, {
    readonly type: "event";
    readonly name: "OperatorSet";
    readonly inputs: readonly [{
        readonly name: "owner";
        readonly type: "address";
        readonly indexed: true;
        readonly internalType: "address";
    }, {
        readonly name: "operator";
        readonly type: "address";
        readonly indexed: true;
        readonly internalType: "address";
    }, {
        readonly name: "approved";
        readonly type: "bool";
        readonly indexed: false;
        readonly internalType: "bool";
    }];
    readonly anonymous: false;
}, {
    readonly type: "event";
    readonly name: "OwnershipTransferred";
    readonly inputs: readonly [{
        readonly name: "user";
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
    readonly name: "ProtocolFeeControllerUpdated";
    readonly inputs: readonly [{
        readonly name: "protocolFeeController";
        readonly type: "address";
        readonly indexed: true;
        readonly internalType: "address";
    }];
    readonly anonymous: false;
}, {
    readonly type: "event";
    readonly name: "ProtocolFeeUpdated";
    readonly inputs: readonly [{
        readonly name: "id";
        readonly type: "bytes32";
        readonly indexed: true;
        readonly internalType: "PoolId";
    }, {
        readonly name: "protocolFee";
        readonly type: "uint24";
        readonly indexed: false;
        readonly internalType: "uint24";
    }];
    readonly anonymous: false;
}, {
    readonly type: "event";
    readonly name: "Swap";
    readonly inputs: readonly [{
        readonly name: "id";
        readonly type: "bytes32";
        readonly indexed: true;
        readonly internalType: "PoolId";
    }, {
        readonly name: "sender";
        readonly type: "address";
        readonly indexed: true;
        readonly internalType: "address";
    }, {
        readonly name: "amount0";
        readonly type: "int128";
        readonly indexed: false;
        readonly internalType: "int128";
    }, {
        readonly name: "amount1";
        readonly type: "int128";
        readonly indexed: false;
        readonly internalType: "int128";
    }, {
        readonly name: "sqrtPriceX96";
        readonly type: "uint160";
        readonly indexed: false;
        readonly internalType: "uint160";
    }, {
        readonly name: "liquidity";
        readonly type: "uint128";
        readonly indexed: false;
        readonly internalType: "uint128";
    }, {
        readonly name: "tick";
        readonly type: "int24";
        readonly indexed: false;
        readonly internalType: "int24";
    }, {
        readonly name: "fee";
        readonly type: "uint24";
        readonly indexed: false;
        readonly internalType: "uint24";
    }];
    readonly anonymous: false;
}, {
    readonly type: "event";
    readonly name: "Transfer";
    readonly inputs: readonly [{
        readonly name: "caller";
        readonly type: "address";
        readonly indexed: false;
        readonly internalType: "address";
    }, {
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
        readonly name: "id";
        readonly type: "uint256";
        readonly indexed: true;
        readonly internalType: "uint256";
    }, {
        readonly name: "amount";
        readonly type: "uint256";
        readonly indexed: false;
        readonly internalType: "uint256";
    }];
    readonly anonymous: false;
}, {
    readonly type: "error";
    readonly name: "AlreadyUnlocked";
    readonly inputs: readonly [];
}, {
    readonly type: "error";
    readonly name: "ContractUnlocked";
    readonly inputs: readonly [];
}, {
    readonly type: "error";
    readonly name: "CurrenciesOutOfOrderOrEqual";
    readonly inputs: readonly [{
        readonly name: "currency0";
        readonly type: "address";
        readonly internalType: "address";
    }, {
        readonly name: "currency1";
        readonly type: "address";
        readonly internalType: "address";
    }];
}, {
    readonly type: "error";
    readonly name: "CurrencyNotSettled";
    readonly inputs: readonly [];
}, {
    readonly type: "error";
    readonly name: "DelegateCallNotAllowed";
    readonly inputs: readonly [];
}, {
    readonly type: "error";
    readonly name: "InvalidBips";
    readonly inputs: readonly [];
}, {
    readonly type: "error";
    readonly name: "InvalidCaller";
    readonly inputs: readonly [];
}, {
    readonly type: "error";
    readonly name: "ManagerLocked";
    readonly inputs: readonly [];
}, {
    readonly type: "error";
    readonly name: "MustClearExactPositiveDelta";
    readonly inputs: readonly [];
}, {
    readonly type: "error";
    readonly name: "NonzeroNativeValue";
    readonly inputs: readonly [];
}, {
    readonly type: "error";
    readonly name: "PoolNotInitialized";
    readonly inputs: readonly [];
}, {
    readonly type: "error";
    readonly name: "ProtocolFeeCannotBeFetched";
    readonly inputs: readonly [];
}, {
    readonly type: "error";
    readonly name: "ProtocolFeeTooLarge";
    readonly inputs: readonly [{
        readonly name: "fee";
        readonly type: "uint24";
        readonly internalType: "uint24";
    }];
}, {
    readonly type: "error";
    readonly name: "SwapAmountCannotBeZero";
    readonly inputs: readonly [];
}, {
    readonly type: "error";
    readonly name: "TickSpacingTooLarge";
    readonly inputs: readonly [{
        readonly name: "tickSpacing";
        readonly type: "int24";
        readonly internalType: "int24";
    }];
}, {
    readonly type: "error";
    readonly name: "TickSpacingTooSmall";
    readonly inputs: readonly [{
        readonly name: "tickSpacing";
        readonly type: "int24";
        readonly internalType: "int24";
    }];
}, {
    readonly type: "error";
    readonly name: "UnauthorizedDynamicLPFeeUpdate";
    readonly inputs: readonly [];
}];
export declare const stateViewAbi: readonly [{
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
export declare const airlockAbi: readonly [{
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
export declare const derc20Abi: readonly [{
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
    readonly name: "getVestingOf";
    readonly inputs: readonly [{
        readonly name: "account";
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
    readonly name: "vestingEnd";
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
    readonly name: "CannotReleaseYet";
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
export declare const dopplerAbi: readonly [{
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
        readonly name: "airlock_";
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
    readonly name: "airlock";
    readonly inputs: readonly [];
    readonly outputs: readonly [{
        readonly name: "";
        readonly type: "address";
        readonly internalType: "address";
    }];
    readonly stateMutability: "view";
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
    readonly stateMutability: "nonpayable";
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
        readonly name: "";
        readonly type: "uint256";
        readonly internalType: "uint256";
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
    readonly type: "error";
    readonly name: "AlreadyInitialized";
    readonly inputs: readonly [];
}, {
    readonly type: "error";
    readonly name: "BeforeStartTime";
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
    readonly name: "InvalidTime";
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
    readonly name: "SenderNotAirlock";
    readonly inputs: readonly [];
}, {
    readonly type: "error";
    readonly name: "SenderNotPoolManager";
    readonly inputs: readonly [];
}, {
    readonly type: "error";
    readonly name: "SwapBelowRange";
    readonly inputs: readonly [];
}, {
    readonly type: "error";
    readonly name: "Unauthorized";
    readonly inputs: readonly [];
}];
export declare const governanceFactoryAbi: readonly [{
    readonly type: "constructor";
    readonly inputs: readonly [{
        readonly name: "airlock_";
        readonly type: "address";
        readonly internalType: "address";
    }];
    readonly stateMutability: "nonpayable";
}, {
    readonly type: "function";
    readonly name: "airlock";
    readonly inputs: readonly [];
    readonly outputs: readonly [{
        readonly name: "";
        readonly type: "address";
        readonly internalType: "address";
    }];
    readonly stateMutability: "view";
}, {
    readonly type: "function";
    readonly name: "create";
    readonly inputs: readonly [{
        readonly name: "asset";
        readonly type: "address";
        readonly internalType: "address";
    }, {
        readonly name: "data";
        readonly type: "bytes";
        readonly internalType: "bytes";
    }];
    readonly outputs: readonly [{
        readonly name: "";
        readonly type: "address";
        readonly internalType: "address";
    }, {
        readonly name: "";
        readonly type: "address";
        readonly internalType: "address";
    }];
    readonly stateMutability: "nonpayable";
}, {
    readonly type: "function";
    readonly name: "timelockFactory";
    readonly inputs: readonly [];
    readonly outputs: readonly [{
        readonly name: "";
        readonly type: "address";
        readonly internalType: "contract TimelockFactory";
    }];
    readonly stateMutability: "view";
}, {
    readonly type: "error";
    readonly name: "NotAirlock";
    readonly inputs: readonly [];
}];
export declare const uniswapRouterAbi: readonly [{
    readonly type: "constructor";
    readonly inputs: readonly [{
        readonly name: "_manager";
        readonly type: "address";
        readonly internalType: "contract IPoolManager";
    }];
    readonly stateMutability: "nonpayable";
}, {
    readonly type: "function";
    readonly name: "manager";
    readonly inputs: readonly [];
    readonly outputs: readonly [{
        readonly name: "";
        readonly type: "address";
        readonly internalType: "contract IPoolManager";
    }];
    readonly stateMutability: "view";
}, {
    readonly type: "function";
    readonly name: "swap";
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
        readonly name: "params";
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
        readonly name: "testSettings";
        readonly type: "tuple";
        readonly internalType: "struct PoolSwapTest.TestSettings";
        readonly components: readonly [{
            readonly name: "takeClaims";
            readonly type: "bool";
            readonly internalType: "bool";
        }, {
            readonly name: "settleUsingBurn";
            readonly type: "bool";
            readonly internalType: "bool";
        }];
    }, {
        readonly name: "hookData";
        readonly type: "bytes";
        readonly internalType: "bytes";
    }];
    readonly outputs: readonly [{
        readonly name: "delta";
        readonly type: "int256";
        readonly internalType: "BalanceDelta";
    }];
    readonly stateMutability: "payable";
}, {
    readonly type: "function";
    readonly name: "unlockCallback";
    readonly inputs: readonly [{
        readonly name: "rawData";
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
    readonly type: "error";
    readonly name: "NoSwapOccurred";
    readonly inputs: readonly [];
}];
export declare const uniswapV4InitializerAbi: readonly [{
    readonly type: "constructor";
    readonly inputs: readonly [{
        readonly name: "airlock_";
        readonly type: "address";
        readonly internalType: "address";
    }, {
        readonly name: "poolManager_";
        readonly type: "address";
        readonly internalType: "contract IPoolManager";
    }, {
        readonly name: "deployer_";
        readonly type: "address";
        readonly internalType: "contract DopplerDeployer";
    }];
    readonly stateMutability: "nonpayable";
}, {
    readonly type: "function";
    readonly name: "airlock";
    readonly inputs: readonly [];
    readonly outputs: readonly [{
        readonly name: "";
        readonly type: "address";
        readonly internalType: "address";
    }];
    readonly stateMutability: "view";
}, {
    readonly type: "function";
    readonly name: "deployer";
    readonly inputs: readonly [];
    readonly outputs: readonly [{
        readonly name: "";
        readonly type: "address";
        readonly internalType: "contract DopplerDeployer";
    }];
    readonly stateMutability: "view";
}, {
    readonly type: "function";
    readonly name: "exitLiquidity";
    readonly inputs: readonly [{
        readonly name: "asset";
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
    readonly name: "initialize";
    readonly inputs: readonly [{
        readonly name: "asset";
        readonly type: "address";
        readonly internalType: "address";
    }, {
        readonly name: "numeraire";
        readonly type: "address";
        readonly internalType: "address";
    }, {
        readonly name: "numTokensToSell";
        readonly type: "uint256";
        readonly internalType: "uint256";
    }, {
        readonly name: "salt";
        readonly type: "bytes32";
        readonly internalType: "bytes32";
    }, {
        readonly name: "data";
        readonly type: "bytes";
        readonly internalType: "bytes";
    }];
    readonly outputs: readonly [{
        readonly name: "";
        readonly type: "address";
        readonly internalType: "address";
    }];
    readonly stateMutability: "nonpayable";
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
    readonly type: "error";
    readonly name: "NotAirlock";
    readonly inputs: readonly [];
}];
