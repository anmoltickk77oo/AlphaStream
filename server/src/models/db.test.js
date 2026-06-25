import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import pool from '../config/db';
import Wallet from './Wallet';

describe('Atomic PostgreSQL Wallet Transactions', () => {
    const TEST_USER_ID = '00000000-0000-0000-0000-000000000001';

    beforeAll(async () => {
        // Ensure schemas are initialized and seeded
        await Wallet.initializeSchema();
    });

    afterAll(async () => {
        // Clean up connection pool after all tests finish
        await pool.end();
    });

    it('should successfully execute a BUY trade and decrease USD / increase BTC balance', async () => {
        // Seed usd balance so we have enough
        await pool.query(
            `UPDATE wallets SET usd_balance = 1000.00, btc_balance = 0.00 WHERE user_id = $1`,
            [TEST_USER_ID]
        );

        const startBalances = await Wallet.getBalances(TEST_USER_ID);
        const startUsd = parseFloat(startBalances.usd_balance);
        const startBtc = parseFloat(startBalances.btc_balance);

        const tradeAmount = 100.0;
        const executionPrice = 50000.0;
        const btcExpected = tradeAmount / executionPrice;

        const result = await Wallet.executeTrade(TEST_USER_ID, 'BUY', tradeAmount, executionPrice);

        expect(result.status).toBe('SUCCESS');
        expect(parseFloat(result.newBalances.usd_balance)).toBeCloseTo(startUsd - tradeAmount, 4);
        expect(parseFloat(result.newBalances.btc_balance)).toBeCloseTo(startBtc + btcExpected, 4);
    });

    it('should throw an error and rollback if USD balance is insufficient', async () => {
        // Attempt a trade exceeding the wallet size
        const hugeAmount = 9999999.0;
        const executionPrice = 50000.0;

        await expect(Wallet.executeTrade(TEST_USER_ID, 'BUY', hugeAmount, executionPrice))
            .rejects
            .toThrow('Insufficient USD funds');
    });

    it('should successfully execute a SELL trade and increase USD / decrease BTC balance', async () => {
        // Setup initial balance: 500 USD, 0.01 BTC
        await pool.query(
            `UPDATE wallets SET usd_balance = 500.00, btc_balance = 0.01 WHERE user_id = $1`,
            [TEST_USER_ID]
        );

        const startBalances = await Wallet.getBalances(TEST_USER_ID);
        const startUsd = parseFloat(startBalances.usd_balance);
        const startBtc = parseFloat(startBalances.btc_balance);

        const tradeAmount = 50.0;
        const executionPrice = 50000.0;
        const btcToSell = tradeAmount / executionPrice;

        expect(startBtc).toBeGreaterThanOrEqual(btcToSell);

        const result = await Wallet.executeTrade(TEST_USER_ID, 'SELL', tradeAmount, executionPrice);

        expect(result.status).toBe('SUCCESS');
        expect(parseFloat(result.newBalances.usd_balance)).toBeCloseTo(startUsd + tradeAmount, 4);
        expect(parseFloat(result.newBalances.btc_balance)).toBeCloseTo(startBtc - btcToSell, 4);
    });

    it('should handle concurrent BUY orders and prevent double-spending / race conditions', async () => {
        // Seed user balance to exactly $150
        await pool.query(
            `UPDATE wallets SET usd_balance = 150.00, btc_balance = 0.00 WHERE user_id = $1`,
            [TEST_USER_ID]
        );

        // Run 2 parallel buy orders of $100. One should succeed, the other should fail.
        const order1 = Wallet.executeTrade(TEST_USER_ID, 'BUY', 100.00, 50000.0);
        const order2 = Wallet.executeTrade(TEST_USER_ID, 'BUY', 100.00, 50000.0);

        const results = await Promise.allSettled([order1, order2]);

        const fulfilled = results.filter(r => r.status === 'fulfilled');
        const rejected = results.filter(r => r.status === 'rejected');

        expect(fulfilled.length).toBe(1);
        expect(rejected.length).toBe(1);
        expect(rejected[0].reason.message).toBe('Insufficient USD funds');

        const finalBalances = await Wallet.getBalances(TEST_USER_ID);
        expect(parseFloat(finalBalances.usd_balance)).toBe(50.00);
        expect(parseFloat(finalBalances.btc_balance)).toBe(100.00 / 50000.0);
    });
});
