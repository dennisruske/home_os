import { describe, it, expect, beforeEach } from 'vitest';
import {
  getTimeframeBounds,
  aggregateByHour,
  aggregateByDay,
  calculateTotalEnergy,
} from '@/lib/energy-aggregation';

describe('getTimeframeBounds', () => {
  it('should calculate bounds for "day" timeframe', () => {
    const bounds = getTimeframeBounds('day');
    const now = new Date();
    const startOfDay = new Date(now);
    startOfDay.setHours(0, 0, 0, 0);
    const expectedStart = Math.floor(startOfDay.getTime() / 1000);
    const expectedEnd = Math.floor(now.getTime() / 1000);

    expect(bounds.start).toBe(expectedStart);
    expect(bounds.end).toBeGreaterThanOrEqual(expectedEnd);
  });

  it('should calculate bounds for "yesterday" timeframe', () => {
    const bounds = getTimeframeBounds('yesterday');
    const now = new Date();
    const yesterday = new Date(now);
    yesterday.setDate(yesterday.getDate() - 1);
    yesterday.setHours(0, 0, 0, 0);
    const expectedStart = Math.floor(yesterday.getTime() / 1000);
    const startOfToday = new Date(now);
    startOfToday.setHours(0, 0, 0, 0);
    const expectedEnd = Math.floor(startOfToday.getTime() / 1000);

    expect(bounds.start).toBe(expectedStart);
    expect(bounds.end).toBe(expectedEnd);
  });

  it('should calculate bounds for "week" timeframe', () => {
    const bounds = getTimeframeBounds('week');
    const now = new Date();
    const sevenDaysAgo = new Date(now);
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    sevenDaysAgo.setHours(0, 0, 0, 0);
    const expectedStart = Math.floor(sevenDaysAgo.getTime() / 1000);
    const expectedEnd = Math.floor(now.getTime() / 1000);

    expect(bounds.start).toBe(expectedStart);
    expect(bounds.end).toBeGreaterThanOrEqual(expectedEnd);
  });

  it('should calculate bounds for "month" timeframe', () => {
    const bounds = getTimeframeBounds('month');
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    startOfMonth.setHours(0, 0, 0, 0);
    const expectedStart = Math.floor(startOfMonth.getTime() / 1000);
    const expectedEnd = Math.floor(now.getTime() / 1000);

    expect(bounds.start).toBe(expectedStart);
    expect(bounds.end).toBeGreaterThanOrEqual(expectedEnd);
  });

  it('should throw error for invalid timeframe', () => {
    expect(() => getTimeframeBounds('invalid')).toThrow('Invalid timeframe: invalid');
  });
});

describe('aggregateByHour', () => {
  interface TestReading {
    timestamp: number;
    value: number;
  }

  it('should return empty array for empty readings', () => {
    const result = aggregateByHour<TestReading>([], (r) => r.value);
    expect(result).toEqual([]);
  });

  it('should return empty array when all readings are filtered out', () => {
    const readings: TestReading[] = [
      { timestamp: 1000, value: -10 },
      { timestamp: 2000, value: -5 },
    ];
    const result = aggregateByHour(readings, (r) => r.value, (v) => v > 0);
    expect(result).toEqual([]);
  });

  it('should aggregate readings by hour', () => {
    const baseTimestamp = Math.floor(new Date('2024-01-01T10:00:00Z').getTime() / 1000);
    const hourKey = Math.floor(baseTimestamp / 3600) * 3600; // Round down to hour
    const readings: TestReading[] = [
      { timestamp: baseTimestamp, value: 1000 },
      { timestamp: baseTimestamp + 600, value: 2000 },
      { timestamp: baseTimestamp + 1200, value: 1500 },
      { timestamp: baseTimestamp + 1800, value: 1000 },
    ];

    const result = aggregateByHour(readings, (r) => r.value);

    expect(result.length).toBe(1);
    expect(result[0].timestamp).toBe(hourKey);
    // Label should match the hour of the hourKey timestamp
    const hourDate = new Date(hourKey * 1000);
    const expectedHour = hourDate.getHours();
    expect(result[0].label).toBe(`${expectedHour.toString().padStart(2, '0')}:00`);
    expect(result[0].kwh).toBeGreaterThan(0);
  });

  it('should filter readings when filter function is provided', () => {
    const baseTimestamp = Math.floor(new Date('2024-01-01T10:00:00Z').getTime() / 1000);
    const readings: TestReading[] = [
      { timestamp: baseTimestamp, value: 1000 }, // positive
      { timestamp: baseTimestamp + 600, value: -500 }, // negative, should be filtered
      { timestamp: baseTimestamp + 1200, value: 2000 }, // positive
    ];

    const result = aggregateByHour(readings, (r) => r.value, (v) => v > 0);

    expect(result.length).toBe(1);
    // Should only use positive values (1000 and 2000)
    expect(result[0].kwh).toBeGreaterThan(0);
  });

  it('should skip hours with less than 2 readings', () => {
    const baseTimestamp = Math.floor(new Date('2024-01-01T10:00:00Z').getTime() / 1000);
    const readings: TestReading[] = [
      { timestamp: baseTimestamp, value: 1000 }, // Only one reading in this hour
    ];

    const result = aggregateByHour(readings, (r) => r.value);

    expect(result).toEqual([]);
  });

  it('should handle multiple hours', () => {
    const baseTimestamp = Math.floor(new Date('2024-01-01T10:00:00Z').getTime() / 1000);
    const hour1Start = baseTimestamp - (baseTimestamp % 3600);
    const hour2Start = hour1Start + 3600;

    const readings: TestReading[] = [
      { timestamp: hour1Start, value: 1000 },
      { timestamp: hour1Start + 600, value: 2000 },
      { timestamp: hour2Start, value: 1500 },
      { timestamp: hour2Start + 600, value: 1800 },
    ];

    const result = aggregateByHour(readings, (r) => r.value);

    expect(result.length).toBe(2);
    expect(result[0].timestamp).toBe(hour1Start);
    expect(result[1].timestamp).toBe(hour2Start);
    expect(result[0].timestamp).toBeLessThan(result[1].timestamp); // Should be sorted
  });
});

describe('aggregateByDay', () => {
  interface TestReading {
    timestamp: number;
    value: number;
  }

  it('should return empty array for empty readings', () => {
    const result = aggregateByDay<TestReading>([], (r) => r.value);
    expect(result).toEqual([]);
  });

  it('should return empty array when all readings are filtered out', () => {
    const readings: TestReading[] = [
      { timestamp: 1000, value: -10 },
      { timestamp: 2000, value: -5 },
    ];
    const result = aggregateByDay(readings, (r) => r.value, (v) => v > 0);
    expect(result).toEqual([]);
  });

  it('should aggregate readings by day', () => {
    const baseDate = new Date('2024-01-01T10:00:00Z');
    const dayStart = new Date(baseDate.getFullYear(), baseDate.getMonth(), baseDate.getDate());
    dayStart.setHours(0, 0, 0, 0);
    const dayStartTimestamp = Math.floor(dayStart.getTime() / 1000);

    const readings: TestReading[] = [
      { timestamp: dayStartTimestamp + 3600, value: 1000 }, // 01:00
      { timestamp: dayStartTimestamp + 7200, value: 2000 }, // 02:00
      { timestamp: dayStartTimestamp + 10800, value: 1500 }, // 03:00
      { timestamp: dayStartTimestamp + 14400, value: 1000 }, // 04:00
    ];

    const result = aggregateByDay(readings, (r) => r.value);

    expect(result.length).toBe(1);
    expect(result[0].timestamp).toBe(dayStartTimestamp);
    expect(result[0].kwh).toBeGreaterThan(0);
    expect(result[0].label).toMatch(/Jan/); // Should have date label
  });

  it('should filter readings when filter function is provided', () => {
    const baseDate = new Date('2024-01-01T10:00:00Z');
    const dayStart = new Date(baseDate.getFullYear(), baseDate.getMonth(), baseDate.getDate());
    dayStart.setHours(0, 0, 0, 0);
    const dayStartTimestamp = Math.floor(dayStart.getTime() / 1000);

    const readings: TestReading[] = [
      { timestamp: dayStartTimestamp + 3600, value: 1000 }, // positive
      { timestamp: dayStartTimestamp + 7200, value: -500 }, // negative, should be filtered
      { timestamp: dayStartTimestamp + 10800, value: 2000 }, // positive
    ];

    const result = aggregateByDay(readings, (r) => r.value, (v) => v > 0);

    expect(result.length).toBe(1);
    expect(result[0].kwh).toBeGreaterThan(0);
  });

  it('should skip days with less than 2 readings', () => {
    const baseDate = new Date('2024-01-01T10:00:00Z');
    const dayStart = new Date(baseDate.getFullYear(), baseDate.getMonth(), baseDate.getDate());
    dayStart.setHours(0, 0, 0, 0);
    const dayStartTimestamp = Math.floor(dayStart.getTime() / 1000);

    const readings: TestReading[] = [
      { timestamp: dayStartTimestamp + 3600, value: 1000 }, // Only one reading
    ];

    const result = aggregateByDay(readings, (r) => r.value);

    expect(result).toEqual([]);
  });

  it('should handle multiple days', () => {
    const baseDate = new Date('2024-01-01T10:00:00Z');
    const day1Start = new Date(baseDate.getFullYear(), baseDate.getMonth(), baseDate.getDate());
    day1Start.setHours(0, 0, 0, 0);
    const day1StartTimestamp = Math.floor(day1Start.getTime() / 1000);
    const day2StartTimestamp = day1StartTimestamp + 86400; // Next day

    const readings: TestReading[] = [
      { timestamp: day1StartTimestamp + 3600, value: 1000 },
      { timestamp: day1StartTimestamp + 7200, value: 2000 },
      { timestamp: day2StartTimestamp + 3600, value: 1500 },
      { timestamp: day2StartTimestamp + 7200, value: 1800 },
    ];

    const result = aggregateByDay(readings, (r) => r.value);

    expect(result.length).toBe(2);
    expect(result[0].timestamp).toBe(day1StartTimestamp);
    expect(result[1].timestamp).toBe(day2StartTimestamp);
    expect(result[0].timestamp).toBeLessThan(result[1].timestamp); // Should be sorted
  });
});

describe('calculateTotalEnergy', () => {
  interface TestReading {
    timestamp: number;
    value: number;
  }

  it('should return 0 for empty readings', () => {
    const result = calculateTotalEnergy<TestReading>([], (r) => r.value);
    expect(result).toBe(0);
  });

  it('should return 0 for single reading', () => {
    const readings: TestReading[] = [{ timestamp: 1000, value: 1000 }];
    const result = calculateTotalEnergy(readings, (r) => r.value);
    expect(result).toBe(0);
  });

  it('should return 0 when all readings are filtered out', () => {
    const readings: TestReading[] = [
      { timestamp: 1000, value: -10 },
      { timestamp: 2000, value: -5 },
    ];
    const result = calculateTotalEnergy(readings, (r) => r.value, (v) => v > 0);
    expect(result).toBe(0);
  });

  it('should calculate total energy using trapezoidal integration', () => {
    // Simple case: constant power over time
    // 1000W for 3600 seconds = 1 kWh
    const baseTimestamp = 1000;
    const readings: TestReading[] = [
      { timestamp: baseTimestamp, value: 1000 }, // 1000W at t=0
      { timestamp: baseTimestamp + 3600, value: 1000 }, // 1000W at t=3600s (1 hour)
    ];

    const result = calculateTotalEnergy(readings, (r) => r.value);

    // Trapezoidal integration: average(1000, 1000) * 3600 / 3600 / 1000 = 1 kWh
    expect(result).toBeCloseTo(1.0, 3);
  });

  it('should handle variable power', () => {
    const baseTimestamp = 1000;
    const readings: TestReading[] = [
      { timestamp: baseTimestamp, value: 1000 }, // 1000W at t=0
      { timestamp: baseTimestamp + 1800, value: 2000 }, // 2000W at t=1800s (30 min)
      { timestamp: baseTimestamp + 3600, value: 1000 }, // 1000W at t=3600s (1 hour)
    ];

    const result = calculateTotalEnergy(readings, (r) => r.value);

    // First interval: (1000+2000)/2 * 1800 / 3600 / 1000 = 0.75 kWh
    // Second interval: (2000+1000)/2 * 1800 / 3600 / 1000 = 0.75 kWh
    // Total: 1.5 kWh
    expect(result).toBeCloseTo(1.5, 3);
  });

  it('should filter readings when filter function is provided', () => {
    const baseTimestamp = 1000;
    const readings: TestReading[] = [
      { timestamp: baseTimestamp, value: 1000 }, // positive
      { timestamp: baseTimestamp + 1800, value: -500 }, // negative, should be filtered
      { timestamp: baseTimestamp + 3600, value: 2000 }, // positive
    ];

    const result = calculateTotalEnergy(readings, (r) => r.value, (v) => v > 0);

    // Should only use positive values (1000 and 2000)
    expect(result).toBeGreaterThan(0);
    // Result should be less than if negative value was included
    const resultWithoutFilter = calculateTotalEnergy(readings, (r) => r.value);
    expect(result).not.toBe(resultWithoutFilter);
  });

  it('should handle readings out of order', () => {
    const baseTimestamp = 1000;
    const readings: TestReading[] = [
      { timestamp: baseTimestamp + 3600, value: 1000 }, // Later
      { timestamp: baseTimestamp, value: 1000 }, // Earlier
    ];

    const result = calculateTotalEnergy(readings, (r) => r.value);

    // Should sort by timestamp first, so result should be same as if in order
    expect(result).toBeCloseTo(1.0, 3);
  });
});

