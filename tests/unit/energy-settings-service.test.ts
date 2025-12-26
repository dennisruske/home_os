import { describe, it, expect, beforeEach, vi } from 'vitest';
import { EnergySettingsService, getEnergySettingsService } from '@/lib/services/energy-settings-service';
import { getEnergySettings } from '@/lib/db';
import type { EnergySettings } from '@/types/energy';

// Mock the db module
vi.mock('@/lib/db', () => ({
  getEnergySettings: vi.fn(),
}));

describe('EnergySettingsService', () => {
  let service: EnergySettingsService;

  beforeEach(() => {
    service = new EnergySettingsService();
    vi.clearAllMocks();
  });

  describe('getActiveSettings', () => {
    it('should return settings for current time when no timestamp provided', async () => {
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
            start_time: 0,
            end_time: 1440,
            price: 0.25,
          },
        ],
      };

      vi.mocked(getEnergySettings).mockResolvedValue(mockSettings);

      const result = await service.getActiveSettings();

      expect(result).toEqual(mockSettings);
      expect(getEnergySettings).toHaveBeenCalledWith(undefined);
    });

    it('should return settings for specific timestamp', async () => {
      const timestamp = 1000000;
      const mockSettings: EnergySettings = {
        id: 1,
        producing_price: 0.12,
        start_date: timestamp,
        end_date: null,
        updated_at: timestamp,
        consuming_periods: [],
      };

      vi.mocked(getEnergySettings).mockResolvedValue(mockSettings);

      const result = await service.getActiveSettings(timestamp);

      expect(result).toEqual(mockSettings);
      expect(getEnergySettings).toHaveBeenCalledWith(timestamp);
    });

    it('should return null when no settings found', async () => {
      vi.mocked(getEnergySettings).mockResolvedValue(null);

      const result = await service.getActiveSettings();

      expect(result).toBeNull();
    });
  });

  describe('calculatePriceAt', () => {
    it('should return producing price for producing type', async () => {
      const mockSettings: EnergySettings = {
        id: 1,
        producing_price: 0.12,
        start_date: 1000000,
        end_date: null,
        updated_at: 1000000,
        consuming_periods: [],
      };

      vi.mocked(getEnergySettings).mockResolvedValue(mockSettings);

      const timestamp = 1000000;
      const result = await service.calculatePriceAt(timestamp, 'producing');

      expect(result).toBe(0.12);
      expect(getEnergySettings).toHaveBeenCalledWith(timestamp);
    });

    it('should return consuming price based on time of day', async () => {
      const timestamp = Math.floor(new Date('2024-01-01T14:30:00Z').getTime() / 1000);
      // 14:30 = 14 * 60 + 30 = 870 minutes
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

      vi.mocked(getEnergySettings).mockResolvedValue(mockSettings);

      const result = await service.calculatePriceAt(timestamp, 'consuming');

      expect(result).toBe(0.30); // Should match the second period (08:00-24:00)
    });

    it('should handle wrap-around periods (e.g., 22:00 to 06:00)', async () => {
      const timestamp = Math.floor(new Date('2024-01-01T02:00:00Z').getTime() / 1000);
      // 02:00 = 120 minutes
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

      vi.mocked(getEnergySettings).mockResolvedValue(mockSettings);

      const result = await service.calculatePriceAt(timestamp, 'consuming');

      expect(result).toBe(0.15); // Should match the wrap-around period (22:00-06:00)
    });

    it('should return fallback price when no period matches', async () => {
      const timestamp = Math.floor(new Date('2024-01-01T14:30:00Z').getTime() / 1000);
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
            start_time: 0,
            end_time: 480,
            price: 0.20,
          },
        ],
      };

      vi.mocked(getEnergySettings).mockResolvedValue(mockSettings);

      const result = await service.calculatePriceAt(timestamp, 'consuming');

      expect(result).toBe(0.20); // Should use first period as fallback
    });

    it('should return null when no settings found', async () => {
      vi.mocked(getEnergySettings).mockResolvedValue(null);

      const timestamp = 1000000;
      const result = await service.calculatePriceAt(timestamp, 'consuming');

      expect(result).toBeNull();
    });

    it('should return null when no consuming periods available', async () => {
      const mockSettings: EnergySettings = {
        id: 1,
        producing_price: 0.12,
        start_date: 1000000,
        end_date: null,
        updated_at: 1000000,
        consuming_periods: [],
      };

      vi.mocked(getEnergySettings).mockResolvedValue(mockSettings);

      const timestamp = 1000000;
      const result = await service.calculatePriceAt(timestamp, 'consuming');

      expect(result).toBeNull();
    });

    it('should return null when consuming_periods is undefined', async () => {
      const mockSettings: EnergySettings = {
        id: 1,
        producing_price: 0.12,
        start_date: 1000000,
        end_date: null,
        updated_at: 1000000,
      };

      vi.mocked(getEnergySettings).mockResolvedValue(mockSettings);

      const timestamp = 1000000;
      const result = await service.calculatePriceAt(timestamp, 'consuming');

      expect(result).toBeNull();
    });
  });

  describe('getEnergySettingsService (singleton)', () => {
    it('should return the same instance on multiple calls', () => {
      const instance1 = getEnergySettingsService();
      const instance2 = getEnergySettingsService();

      expect(instance1).toBe(instance2);
    });
  });
});

