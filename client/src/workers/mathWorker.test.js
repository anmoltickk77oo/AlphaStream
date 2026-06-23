import { describe, it, expect } from 'vitest';
import { calculateEMA, calculateVolatility } from './mathWorker';

describe('MathWorker Offloading Logic', () => {

    describe('calculateEMA (Exponential Moving Average)', () => {
        it('should return an empty array if given no prices', () => {
            expect(calculateEMA([], 10)).toEqual([]);
        });

        it('should correctly calculate the 3-period EMA for a steady uptrend', () => {
            const prices = [10, 12, 14, 16];
            // Period = 3, k = 2 / (3 + 1) = 0.5
            // EMA[0] = 10
            // EMA[1] = (12 - 10) * 0.5 + 10 = 11
            // EMA[2] = (14 - 11) * 0.5 + 11 = 12.5
            // EMA[3] = (16 - 12.5) * 0.5 + 12.5 = 14.25
            
            const expectedEMA = [10, 11, 12.5, 14.25];
            const result = calculateEMA(prices, 3);
            
            expect(result).toEqual(expectedEMA);
        });
    });

    describe('calculateVolatility (Standard Deviation)', () => {
        it('should return 0 if there are less than 2 prices', () => {
            expect(calculateVolatility([100])).toBe(0);
        });

        it('should correctly calculate the population standard deviation', () => {
            const prices = [10, 12, 23, 23, 16, 23, 21, 16];
            // Mean = 18
            // Variance = [64, 36, 25, 25, 4, 25, 9, 4] sum = 192 / 8 = 24
            // StdDev = sqrt(24) = 4.898979...
            
            const result = calculateVolatility(prices);
            expect(result).toBeCloseTo(4.898979, 5);
        });
    });

});
