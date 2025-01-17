import { DopplerPreDeploymentConfig } from '@/types';
import { DopplerAddresses } from '@/types';
import { Price, Token } from '@uniswap/sdk-core';
import { CreateParams } from '@/entities/factory';
/**
 * Validates and builds pool configuration from user-friendly parameters
 */
export declare function buildConfig(params: DopplerPreDeploymentConfig, addresses: DopplerAddresses): CreateParams;
export declare function priceToClosestTick(price: Price<Token, Token>): number;
