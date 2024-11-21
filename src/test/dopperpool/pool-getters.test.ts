
import { describe, it, expect, beforeAll } from 'vitest';
import { setupTestEnvironment } from '../deploy/setup';
import { parseEther } from 'viem';
import { buyAssetExactIn } from '../../trade/buyAsset';
import { DopplerAddressProvider } from '../../AddressProvider';

describe('Doppler Pool Getters', () => {
    let testEnv: Awaited<ReturnType<typeof setupTestEnvironment>>;

    beforeAll(async () => {
        testEnv = await setupTestEnvironment();

    });

    it('should get pool state', async () => {
        const state = await testEnv.pool.getState();
        expect(state.totalTokensSold).toBeDefined();
        expect(state.totalProceeds).toBeDefined();
        expect(state.currentTick).toBeDefined();
    });

    it('should get tokens remaining', async () => {
        const remaining = await testEnv.pool.getTokensRemaining();
        expect(remaining).toEqual(parseEther('1000'));
        const addressProvider = new DopplerAddressProvider(
            31337,
            testEnv.addressProvider.getAddresses()
        );
        // Buy some tokens to change remaining amount
        if (testEnv.clients.wallet) {
            await buyAssetExactIn(
                testEnv.pool.doppler,
                addressProvider,
                parseEther('0.0005'),
                testEnv.clients.wallet
            );

            const newRemaining = await testEnv.pool.getTokensRemaining();
            expect(newRemaining).toBeLessThan(remaining);
        }
    });

    it('should get distance from max proceeds', async () => {
        const distance = await testEnv.pool.getDistanceFromMaxProceeds();
        expect(distance).toEqual(parseEther('600')); // Initial distance
        const addressProvider = new DopplerAddressProvider(
            31337,
            testEnv.addressProvider.getAddresses()
        );
        // Buy some tokens to change proceeds
        if (testEnv.clients.wallet) {
            await buyAssetExactIn(
                testEnv.pool.doppler,
                addressProvider,
                parseEther('0.0005'),
                testEnv.clients.wallet
            );

            const newDistance = await testEnv.pool.getDistanceFromMaxProceeds();
            expect(newDistance).toBeLessThan(distance);
        }
    });
});