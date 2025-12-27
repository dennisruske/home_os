import { describe, it, expect, beforeEach } from 'vitest';
import { EnergyService, createEnergyService } from '@/lib/services/energy-service';
import type { EnergyReading, EnergySettings } from '@/types/energy';

describe('EnergyService', () => {
  let service: EnergyService;

  beforeEach(() => {
    // Create service without repository for methods that don't need it
    service = createEnergyService();
  });

  describe('calculateConsumptionCost', () => {
    const mockSettings: EnergySettings = {
      id: 1,
      producing_price: 0.12,
      start_date: 1000000,
      end_date: null,
      updated_at: 1000000,
      consuming_periods: [
        {
          id: 1,
          energy_settings_id: 1,
          start_time: 0, // 00:00
          end_time: 480, // 08:00
          price: 0.20,
        },
        {
          id: 2,
          energy_settings_id: 1,
          start_time: 480, // 08:00
          end_time: 1440, // 24:00
          price: 0.30,
        },
      ],
    };

    it('should return 0 for zero or negative kWh', () => {
      const timestamp = Math.floor(new Date('2024-01-01T14:30:00Z').getTime() / 1000);
      expect(service.calculateConsumptionCost(0, timestamp, mockSettings)).toBe(0);
      expect(service.calculateConsumptionCost(-5, timestamp, mockSettings)).toBe(0);
    });

    it('should return 0 when no settings provided', () => {
      const timestamp = Math.floor(new Date('2024-01-01T14:30:00Z').getTime() / 1000);
      expect(service.calculateConsumptionCost(10, timestamp, null)).toBe(0);
    });

    it('should calculate cost based on time of day period', () => {
      // 14:30 = 870 minutes (should match second period: 08:00-24:00)
      const timestamp = Math.floor(new Date('2024-01-01T14:30:00Z').getTime() / 1000);
      const kwh = 10;
      const result = service.calculateConsumptionCost(kwh, timestamp, mockSettings);

      expect(result).toBe(3.0); // 10 kWh * 0.30 €/kWh
    });

    it('should handle wrap-around periods', () => {
      const wrapAroundSettings: EnergySettings = {
        id: 1,
        producing_price: 0.12,
        start_date: 1000000,
        end_date: null,
        updated_at: 1000000,
        consuming_periods: [
          {
            id: 1,
            energy_settings_id: 1,
            start_time: 1320, // 22:00
            end_time: 360, // 06:00 (next day)
            price: 0.15,
          },
          {
            id: 2,
            energy_settings_id: 1,
            start_time: 360, // 06:00
            end_time: 1320, // 22:00
            price: 0.25,
          },
        ],
      };

      // 02:00 = 120 minutes (should match wrap-around period: 22:00-06:00)
      const timestamp = Math.floor(new Date('2024-01-01T02:00:00Z').getTime() / 1000);
      const kwh = 10;
      const result = service.calculateConsumptionCost(kwh, timestamp, wrapAroundSettings);

      expect(result).toBe(1.5); // 10 kWh * 0.15 €/kWh
    });

    it('should use fallback price when no period matches', () => {
      const timestamp = Math.floor(new Date('2024-01-01T14:30:00Z').getTime() / 1000);
      const settingsWithSinglePeriod: EnergySettings = {
        id: 1,
        producing_price: 0.12,
        start_date: 1000000,
        end_date: null,
        updated_at: 1000000,
        consuming_periods: [
          {
            id: 1,
            energy_settings_id: 1,
            start_time: 0,
            end_time: 480,
            price: 0.20,
          },
        ],
      };

      const kwh = 10;
      const result = service.calculateConsumptionCost(kwh, timestamp, settingsWithSinglePeriod);

      expect(result).toBe(2.0); // 10 kWh * 0.20 €/kWh (fallback)
    });

    it('should return 0 when no consuming periods available', () => {
      const timestamp = Math.floor(new Date('2024-01-01T14:30:00Z').getTime() / 1000);
      const settingsWithoutPeriods: EnergySettings = {
        id: 1,
        producing_price: 0.12,
        start_date: 1000000,
        end_date: null,
        updated_at: 1000000,
        consuming_periods: [],
      };

      const kwh = 10;
      const result = service.calculateConsumptionCost(kwh, timestamp, settingsWithoutPeriods);

      expect(result).toBe(0);
    });
  });

  describe('calculateFeedInCost', () => {
    const mockSettings: EnergySettings = {
      id: 1,
      producing_price: 0.12,
      start_date: 1000000,
      end_date: null,
      updated_at: 1000000,
      consuming_periods: [],
    };

    it('should return 0 for zero or negative kWh', () => {
      expect(service.calculateFeedInCost(0, mockSettings)).toBe(0);
      expect(service.calculateFeedInCost(-5, mockSettings)).toBe(0);
    });

    it('should return 0 when no settings provided', () => {
      expect(service.calculateFeedInCost(10, null)).toBe(0);
    });

    it('should calculate cost using producing_price', () => {
      const kwh = 10;
      const result = service.calculateFeedInCost(kwh, mockSettings);

      expect(result).toBe(1.2); // 10 kWh * 0.12 €/kWh
    });

    it('should handle different producing prices', () => {
      const settingsWithDifferentPrice: EnergySettings = {
        id: 1,
        producing_price: 0.08,
        start_date: 1000000,
        end_date: null,
        updated_at: 1000000,
        consuming_periods: [],
      };

      const kwh = 15;
      const result = service.calculateFeedInCost(kwh, settingsWithDifferentPrice);

      expect(result).toBe(1.2); // 15 kWh * 0.08 €/kWh
    });
  });

  describe('aggregateEnergyData', () => {
    const baseTimestamp = Math.floor(new Date('2024-01-01T10:00:00Z').getTime() / 1000);
    const hourKey = Math.floor(baseTimestamp / 3600) * 3600;

    const mockReadings: EnergyReading[] = [
      {
        id: 1,
        timestamp: baseTimestamp,
        home: 1000,
        grid: 2000,
        car: 500,
        solar: 3000,
        created_at: baseTimestamp,
      },
      {
        id: 2,
        timestamp: baseTimestamp + 600,
        home: 1200,
        grid: 2200,
        car: 600,
        solar: 3200,
        created_at: baseTimestamp + 600,
      },
      {
        id: 3,
        timestamp: baseTimestamp + 1200,
        home: 1100,
        grid: 2100,
        car: 550,
        solar: 3100,
        created_at: baseTimestamp + 1200,
      },
    ];

    it('should return empty data for empty readings (grid)', () => {
      const result = service.aggregateEnergyData([], 'day', 'grid');

      expect(result).toEqual({
        consumption: { data: [], total: 0 },
        feedIn: { data: [], total: 0 },
      });
    });

    it('should return empty data for empty readings (car)', () => {
      const result = service.aggregateEnergyData([], 'day', 'car');

      expect(result).toEqual({ data: [], total: 0 });
    });

    it('should return empty data for empty readings (solar)', () => {
      const result = service.aggregateEnergyData([], 'day', 'solar');

      expect(result).toEqual({ data: [], total: 0 });
    });

    it('should aggregate grid data by hour for day timeframe', () => {
      const result = service.aggregateEnergyData(mockReadings, 'day', 'grid');

      expect('consumption' in result).toBe(true);
      expect('feedIn' in result).toBe(true);
      if ('consumption' in result) {
        expect(result.consumption.data.length).toBeGreaterThan(0);
        expect(result.consumption.total).toBeGreaterThan(0);
        expect(result.feedIn.total).toBeGreaterThanOrEqual(0);
      }
    });

    it('should aggregate grid data by day for week timeframe', () => {
      const result = service.aggregateEnergyData(mockReadings, 'week', 'grid');

      expect('consumption' in result).toBe(true);
      expect('feedIn' in result).toBe(true);
      if ('consumption' in result) {
        expect(result.consumption.data.length).toBeGreaterThanOrEqual(0);
      }
    });

    it('should aggregate car data by hour for day timeframe', () => {
      const result = service.aggregateEnergyData(mockReadings, 'day', 'car');

      expect('data' in result).toBe(true);
      expect('total' in result).toBe(true);
      if ('data' in result) {
        expect(Array.isArray(result.data)).toBe(true);
        expect(result.total).toBeGreaterThanOrEqual(0);
      }
    });

    it('should aggregate solar data by hour for day timeframe', () => {
      const result = service.aggregateEnergyData(mockReadings, 'day', 'solar');

      expect('data' in result).toBe(true);
      expect('total' in result).toBe(true);
      if ('data' in result) {
        expect(Array.isArray(result.data)).toBe(true);
        expect(result.total).toBeGreaterThanOrEqual(0);
      }
    });

    it('should handle negative grid values for feed-in', () => {
      const readingsWithFeedIn: EnergyReading[] = [
        {
          id: 1,
          timestamp: baseTimestamp,
          home: 1000,
          grid: -500, // Feed-in
          car: 0,
          solar: 0,
          created_at: baseTimestamp,
        },
        {
          id: 2,
          timestamp: baseTimestamp + 600,
          home: 1200,
          grid: -600, // Feed-in
          car: 0,
          solar: 0,
          created_at: baseTimestamp + 600,
        },
      ];

      const result = service.aggregateEnergyData(readingsWithFeedIn, 'day', 'grid');

      expect('feedIn' in result).toBe(true);
      if ('feedIn' in result) {
        expect(result.feedIn.total).toBeGreaterThan(0);
        expect(result.consumption.total).toBe(0); // No positive grid values
      }
    });

    it('should throw error for unknown energy type', () => {
      expect(() => {
        service.aggregateEnergyData(mockReadings, 'day', 'unknown' as any);
      }).toThrow('Unknown energy type: unknown');
    });
  });

  describe('createEnergyService', () => {
    it('should create a new instance without repository', () => {
      const instance = createEnergyService();
      expect(instance).toBeInstanceOf(EnergyService);
    });
  });
});

