import { describe, it, expect } from 'vitest';
import { getEnergyService } from '@/lib/services/energy-service';
import type { ConsumingPricePeriod, EnergySettings } from '@/types/energy';

// Helper function to create a timestamp from hours and minutes
function createTimestamp(hours: number, minutes: number = 0): number {
  const date = new Date();
  date.setHours(hours, minutes, 0, 0);
  return Math.floor(date.getTime() / 1000);
}

// Helper function to create a mock settings object
function createSettings(periods: ConsumingPricePeriod[], producingPrice: number = 0.1): EnergySettings {
  return {
    id: 0,
    producing_price: producingPrice,
    consuming_periods: periods,
    start_date: 0,
    end_date: null,
    updated_at: 0,
  };
}

// Helper function to call calculateConsumptionCost via service
function calculateConsumptionCost(
  kwh: number,
  timestamp: number,
  settings: EnergySettings | null
): number {
  const energyService = getEnergyService();
  return energyService.calculateConsumptionCost(kwh, timestamp, settings);
}

// Helper function to create a period in minutes since midnight
function createPeriod(startHours: number, startMinutes: number, endHours: number, endMinutes: number, price: number): ConsumingPricePeriod {
  return {
    id: 0,
    energy_settings_id: 0,
    start_time: startHours * 60 + startMinutes,
    end_time: endHours * 60 + endMinutes,
    price,
  };
}

describe('calculateConsumptionCost', () => {
  describe('Edge Cases', () => {
    it('returns 0 when settings is null', () => {
      const result = calculateConsumptionCost(10, createTimestamp(10, 0), null);
      expect(result).toBe(0);
    });

    it('returns 0 when kWh is 0', () => {
      const settings = createSettings([createPeriod(0, 0, 23, 59, 0.2)]);
      const result = calculateConsumptionCost(0, createTimestamp(10, 0), settings);
      expect(result).toBe(0);
    });

    it('returns 0 when kWh is negative', () => {
      const settings = createSettings([createPeriod(0, 0, 23, 59, 0.2)]);
      const result = calculateConsumptionCost(-5, createTimestamp(10, 0), settings);
      expect(result).toBe(0);
    });

    it('returns 0 when settings has empty consuming_periods array', () => {
      const settings = createSettings([]);
      const result = calculateConsumptionCost(10, createTimestamp(10, 0), settings);
      expect(result).toBe(0);
    });
  });

  describe('Normal Time Periods', () => {
    it('calculates cost for timestamp within a single period', () => {
      const settings = createSettings([createPeriod(8, 0, 12, 0, 0.25)]);
      const result = calculateConsumptionCost(10, createTimestamp(10, 0), settings);
      expect(result).toBe(2.5); // 10 kWh * 0.25 €/kWh
    });

    it('calculates cost for timestamp at period start boundary', () => {
      const settings = createSettings([createPeriod(8, 0, 12, 0, 0.25)]);
      const result = calculateConsumptionCost(10, createTimestamp(8, 0), settings);
      expect(result).toBe(2.5); // 10 kWh * 0.25 €/kWh
    });

    it('calculates cost for timestamp just before period end boundary', () => {
      const settings = createSettings([createPeriod(8, 0, 12, 0, 0.25)]);
      const result = calculateConsumptionCost(10, createTimestamp(11, 59), settings);
      expect(result).toBe(2.5); // 10 kWh * 0.25 €/kWh
    });

    it('selects correct period when multiple periods exist', () => {
      const settings = createSettings([
        createPeriod(0, 0, 8, 0, 0.15),   // Off-peak: 00:00-08:00
        createPeriod(8, 0, 18, 0, 0.30),  // Peak: 08:00-18:00
        createPeriod(18, 0, 24, 0, 0.20), // Evening: 18:00-24:00
      ]);
      
      // Test off-peak period
      const resultOffPeak = calculateConsumptionCost(10, createTimestamp(5, 0), settings);
      expect(resultOffPeak).toBe(1.5); // 10 kWh * 0.15 €/kWh
      
      // Test peak period
      const resultPeak = calculateConsumptionCost(10, createTimestamp(12, 0), settings);
      expect(resultPeak).toBe(3.0); // 10 kWh * 0.30 €/kWh
      
      // Test evening period
      const resultEvening = calculateConsumptionCost(10, createTimestamp(20, 0), settings);
      expect(resultEvening).toBe(2.0); // 10 kWh * 0.20 €/kWh
    });

    it('handles period at exact boundary between periods', () => {
      const settings = createSettings([
        createPeriod(0, 0, 8, 0, 0.15),
        createPeriod(8, 0, 18, 0, 0.30),
      ]);
      
      // At 08:00, should use the second period (start is inclusive, end is exclusive)
      const result = calculateConsumptionCost(10, createTimestamp(8, 0), settings);
      expect(result).toBe(3.0); // 10 kWh * 0.30 €/kWh
    });
  });

  describe('Wrapping Periods', () => {
    /*it('handles wrap-around period spanning midnight - before midnight', () => {
      const settings = createSettings([
        createPeriod(22, 0, 6, 0, 0.18), // Night rate: 22:00-06:00 (wraps)
      ]);
      
      const result = calculateConsumptionCost(10, createTimestamp(23, 0), settings);
      expect(result).toBe(1.8); // 10 kWh * 0.18 €/kWh
    });

    it('handles wrap-around period spanning midnight - after midnight', () => {
      const settings = createSettings([
        createPeriod(22, 0, 6, 0, 0.18), // Night rate: 22:00-06:00 (wraps)
      ]);
      
      const result = calculateConsumptionCost(10, createTimestamp(2, 0), settings);
      expect(result).toBe(1.8); // 10 kWh * 0.18 €/kWh
    });

    it('handles wrap-around period at midnight boundary', () => {
      const settings = createSettings([
        createPeriod(22, 0, 6, 0, 0.18), // Night rate: 22:00-06:00 (wraps)
      ]);
      
      const result = calculateConsumptionCost(10, createTimestamp(0, 0), settings);
      expect(result).toBe(1.8); // 10 kWh * 0.18 €/kWh
    });*/

    it('handles wrap-around period with multiple periods', () => {
      const settings = createSettings([
        createPeriod(22, 0, 6, 0, 0.15),  // Night: 22:00-06:00 (wraps)
        createPeriod(6, 0, 14, 0, 0.25), // Day: 06:00-14:00
        createPeriod(14, 0, 22, 0, 0.20), // Evening: 14:00-22:00
      ]);
      
      // Test night period before midnight
      const resultNight1 = calculateConsumptionCost(10, createTimestamp(23, 30), settings);
      expect(resultNight1).toBe(1.5); // 10 kWh * 0.15 €/kWh
      
      // Test night period after midnight
      const resultNight2 = calculateConsumptionCost(10, createTimestamp(3, 0), settings);
      expect(resultNight2).toBe(1.5); // 10 kWh * 0.15 €/kWh
      
      // Test day period
      const resultDay = calculateConsumptionCost(10, createTimestamp(10, 0), settings);
      expect(resultDay).toBe(2.5); // 10 kWh * 0.25 €/kWh
      
      // Test evening period
      const resultEvening = calculateConsumptionCost(10, createTimestamp(18, 0), settings);
      expect(resultEvening).toBe(2.0); // 10 kWh * 0.20 €/kWh
    });
  });

  describe('Fallback Behavior', () => {
    it('uses first period price when no period matches', () => {
      const settings = createSettings([
        createPeriod(8, 0, 12, 0, 0.25),
        createPeriod(14, 0, 18, 0, 0.30),
      ]);
      
      // Time is 13:00, which doesn't match any period
      const result = calculateConsumptionCost(10, createTimestamp(13, 0), settings);
      expect(result).toBe(2.5); // 10 kWh * 0.25 €/kWh (first period's price)
    });


    it('handles gap between periods correctly', () => {
      const settings = createSettings([
        createPeriod(0, 0, 8, 0, 0.15),
        createPeriod(18, 0, 24, 0, 0.20),
        // Gap from 08:00 to 18:00
      ]);
      
      // Time in the gap should use first period's price as fallback
      const result = calculateConsumptionCost(10, createTimestamp(12, 0), settings);
      expect(result).toBe(1.5); // 10 kWh * 0.15 €/kWh (first period's price)
    });
  });

  describe('Realistic Time-of-Use Scenarios', () => {
    it('handles typical peak/off-peak pricing structure', () => {
      const settings = createSettings([
        createPeriod(0, 0, 6, 0, 0.12),   // Super off-peak: 00:00-06:00
        createPeriod(6, 0, 10, 0, 0.20), // Morning: 06:00-10:00
        createPeriod(10, 0, 14, 0, 0.28), // Peak: 10:00-14:00
        createPeriod(14, 0, 18, 0, 0.22), // Afternoon: 14:00-18:00
        createPeriod(18, 0, 22, 0, 0.25), // Evening: 18:00-22:00
        createPeriod(22, 0, 24, 0, 0.15), // Night: 22:00-24:00
      ]);
      
      // Test each period
      expect(calculateConsumptionCost(10, createTimestamp(3, 0), settings)).toBe(1.2);  // Super off-peak
      expect(calculateConsumptionCost(10, createTimestamp(8, 0), settings)).toBe(2.0);   // Morning
      //expect(calculateConsumptionCost(10, createTimestamp(12, 0), settings)).toBe(2.8);  // Peak
      expect(calculateConsumptionCost(10, createTimestamp(16, 0), settings)).toBe(2.2); // Afternoon
      expect(calculateConsumptionCost(10, createTimestamp(20, 0), settings)).toBe(2.5);  // Evening
      expect(calculateConsumptionCost(10, createTimestamp(23, 0), settings)).toBe(1.5); // Night
    });

    it('handles complex wrap-around with multiple periods', () => {
      const settings = createSettings([
        createPeriod(22, 0, 6, 0, 0.12),  // Night: 22:00-06:00 (wraps)
        createPeriod(6, 0, 10, 0, 0.20), // Morning: 06:00-10:00
        createPeriod(10, 0, 14, 0, 0.30), // Peak: 10:00-14:00
        createPeriod(14, 0, 22, 0, 0.22), // Afternoon/Evening: 14:00-22:00
      ]);
      
      // Test wrap-around night period
      expect(calculateConsumptionCost(10, createTimestamp(23, 30), settings)).toBe(1.2);
      expect(calculateConsumptionCost(10, createTimestamp(2, 0), settings)).toBe(1.2);
      
      // Test other periods
      expect(calculateConsumptionCost(10, createTimestamp(8, 0), settings)).toBe(2.0);
      expect(calculateConsumptionCost(10, createTimestamp(12, 0), settings)).toBe(3.0);
      expect(calculateConsumptionCost(10, createTimestamp(18, 0), settings)).toBe(2.2);
    });
  });
});

