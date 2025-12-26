import type { EnergyReading } from '@/lib/db';
import type { EnergySettings, AggregatedDataPoint } from '@/types/energy';
import {
  getTimeframeBounds,
  aggregateByHour,
  aggregateByDay,
  calculateTotalEnergy,
} from '@/lib/energy-aggregation';

export interface AggregatedResponse {
  data: AggregatedDataPoint[];
  total: number;
}

export interface GridAggregatedResponse {
  consumption: AggregatedResponse;
  feedIn: AggregatedResponse;
}

/**
 * Service for energy cost calculations and data aggregation.
 * Provides business logic for calculating energy costs and aggregating energy data.
 */
export class EnergyService {
  /**
   * Calculates the cost for energy consumption based on kWh, timestamp, and settings.
   * Uses time-of-day pricing periods to determine the appropriate price.
   *
   * @param kwh - Energy consumption in kWh (must be positive)
   * @param timestamp - Unix timestamp in seconds
   * @param settings - Energy settings containing consuming price periods
   * @returns Cost in euros, or 0 if kwh <= 0 or no settings provided
   */
  calculateConsumptionCost(
    kwh: number,
    timestamp: number,
    settings: EnergySettings | null
  ): number {
    if (!settings || kwh <= 0) {
      return 0;
    }

    // For positive kWh (consuming), find the appropriate price based on time of day
    const date = new Date(timestamp * 1000);
    const minutes = date.getHours() * 60 + date.getMinutes();

    // Find the period that contains this time
    if (settings.consuming_periods) {
      for (const period of settings.consuming_periods) {
        if (period.start_time <= minutes && minutes < period.end_time) {
          return kwh * period.price;
        }
        // Handle wrap-around (e.g., 22:00 to 06:00)
        if (period.start_time > period.end_time) {
          if (minutes >= period.start_time || minutes < period.end_time) {
            return kwh * period.price;
          }
        }
      }

      // If no period matches, use the first period's price as fallback
      const fallbackPrice = settings.consuming_periods[0]?.price ?? 0;
      return kwh * fallbackPrice;
    }

    return 0;
  }

  /**
   * Calculates the cost for energy feed-in (energy fed back to the grid).
   * Always uses the producing_price from settings.
   *
   * @param kwh - Energy feed-in in kWh (must be positive)
   * @param settings - Energy settings containing producing price
   * @returns Cost in euros, or 0 if kwh <= 0 or no settings provided
   */
  calculateFeedInCost(kwh: number, settings: EnergySettings | null): number {
    if (!settings || kwh <= 0) {
      return 0;
    }
    // Feed-in always uses producing_price
    return kwh * settings.producing_price;
  }

  /**
   * Aggregates energy readings by timeframe and type.
   * Handles grid (consumption/feed-in split), car, and solar energy types.
   * Note: Readings should already be filtered to the desired time range by the caller.
   *
   * @param readings - Array of energy readings (should already be filtered to time range)
   * @param timeframe - Timeframe string: 'day', 'yesterday', 'week', or 'month' (used for aggregation granularity)
   * @param type - Type of energy: 'grid', 'car', or 'solar'
   * @returns Aggregated response (format depends on type)
   */
  aggregateEnergyData(
    readings: EnergyReading[],
    timeframe: string,
    type: 'grid' | 'car' | 'solar'
  ): AggregatedResponse | GridAggregatedResponse {
    if (readings.length === 0) {
      if (type === 'grid') {
        return {
          consumption: { data: [], total: 0 },
          feedIn: { data: [], total: 0 },
        };
      }
      return { data: [], total: 0 };
    }

    // Handle grid type (consumption and feed-in)
    if (type === 'grid') {
      // Consumption: positive grid values
      const consumptionReadings = readings.map((r) => ({
        timestamp: r.timestamp,
        grid: r.grid,
      }));

      // Feed-in: negative grid values converted to positive
      const feedInReadings = readings.map((r) => ({
        timestamp: r.timestamp,
        grid: r.grid < 0 ? Math.abs(r.grid) : 0,
      }));

      // Calculate totals
      const consumptionTotal = calculateTotalEnergy(
        consumptionReadings,
        (r) => r.grid,
        (grid) => grid >= 0
      );
      const feedInTotal = calculateTotalEnergy(
        feedInReadings,
        (r) => r.grid,
        (grid) => grid > 0
      );

      // Aggregate based on timeframe
      let consumptionAggregated: AggregatedDataPoint[];
      let feedInAggregated: AggregatedDataPoint[];

      if (timeframe === 'day' || timeframe === 'yesterday') {
        consumptionAggregated = aggregateByHour(
          consumptionReadings,
          (r) => r.grid,
          (grid) => grid >= 0
        );
        feedInAggregated = aggregateByHour(
          feedInReadings,
          (r) => r.grid,
          (grid) => grid > 0
        );
      } else {
        // week or month - aggregate by day
        consumptionAggregated = aggregateByDay(
          consumptionReadings,
          (r) => r.grid,
          (grid) => grid >= 0
        );
        feedInAggregated = aggregateByDay(
          feedInReadings,
          (r) => r.grid,
          (grid) => grid > 0
        );
      }

      return {
        consumption: {
          data: consumptionAggregated,
          total: consumptionTotal,
        },
        feedIn: {
          data: feedInAggregated,
          total: feedInTotal,
        },
      };
    }

    // Handle car type (only positive values)
    if (type === 'car') {
      const carReadings = readings.map((r) => ({
        timestamp: r.timestamp,
        car: r.car,
      }));

      const total = calculateTotalEnergy(
        carReadings,
        (r) => r.car,
        (car) => car > 0
      );

      let aggregated: AggregatedDataPoint[];
      if (timeframe === 'day' || timeframe === 'yesterday') {
        aggregated = aggregateByHour(carReadings, (r) => r.car, (car) => car > 0);
      } else {
        aggregated = aggregateByDay(carReadings, (r) => r.car, (car) => car > 0);
      }

      return { data: aggregated, total };
    }

    // Handle solar type (only positive values)
    if (type === 'solar') {
      const solarReadings = readings.map((r) => ({
        timestamp: r.timestamp,
        solar: r.solar,
      }));

      const total = calculateTotalEnergy(
        solarReadings,
        (r) => r.solar,
        (solar) => solar > 0
      );

      let aggregated: AggregatedDataPoint[];
      if (timeframe === 'day' || timeframe === 'yesterday') {
        aggregated = aggregateByHour(solarReadings, (r) => r.solar, (solar) => solar > 0);
      } else {
        aggregated = aggregateByDay(solarReadings, (r) => r.solar, (solar) => solar > 0);
      }

      return { data: aggregated, total };
    }

    // This should never be reached due to TypeScript, but included for safety
    throw new Error(`Unknown energy type: ${type}`);
  }
}

// Singleton instance
let energyServiceInstance: EnergyService | null = null;

/**
 * Gets the singleton instance of EnergyService.
 * @returns EnergyService instance
 */
export function getEnergyService(): EnergyService {
  if (!energyServiceInstance) {
    energyServiceInstance = new EnergyService();
  }
  return energyServiceInstance;
}

