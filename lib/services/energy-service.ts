import type { 
  EnergyReading, 
  EnergySettings, 
  AggregatedDataPoint,
  AggregatedResponse,
  GridAggregatedResponse,
  EnergyBucket
} from '@/types/energy';
import {
  getTimeframeBounds,
  aggregateByHour,
  aggregateByDay,
  calculateTotalEnergy,
  integratePartialBucket,
} from '@/lib/energy-aggregation';
import type { EnergyRepository } from '@/lib/repositories/energy-repository';
import type { EnergyBucketRepository } from '@/lib/repositories/energy-bucket-repository';
import type { Cache } from '@/lib/cache/cache-interface';

/**
 * Service for energy cost calculations and data aggregation.
 * Provides business logic for calculating energy costs and aggregating energy data.
 */
export class EnergyService {
  constructor(
    private repository?: EnergyRepository,
    private bucketRepository?: EnergyBucketRepository,
    private cache?: Cache
  ) {}
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

  /**
   * Gets energy readings with pagination and optional date range filtering.
   * Provides a service layer abstraction for data access.
   *
   * @param limit - Maximum number of readings to return
   * @param offset - Number of readings to skip
   * @param from - Optional start timestamp (Unix seconds)
   * @param to - Optional end timestamp (Unix seconds)
   * @returns Promise resolving to array of EnergyReading
   * @throws Error if repository is not provided
   */
  async getReadings(
    limit: number = 100,
    offset: number = 0,
    from?: number,
    to?: number
  ): Promise<EnergyReading[]> {
    if (!this.repository) {
      throw new Error('EnergyRepository is required for getReadings');
    }
    return this.repository.getEnergyReadings(limit, offset, from, to);
  }

  /**
   * Gets energy readings for a specific time range.
   * Provides a service layer abstraction for data access.
   *
   * @param from - Start timestamp (Unix seconds)
   * @param to - End timestamp (Unix seconds)
   * @returns Promise resolving to array of EnergyReading
   * @throws Error if repository is not provided
   */
  async getReadingsForRange(from: number, to: number): Promise<EnergyReading[]> {
    if (!this.repository) {
      throw new Error('EnergyRepository is required for getReadingsForRange');
    }
    return this.repository.getEnergyReadingsForRange(from, to);
  }

  /**
   * Gets aggregated energy data with caching and optimized bucket-based queries.
   * Uses bucket table for large time ranges, raw table for small ranges, and cache for performance.
   *
   * @param from - Start timestamp (Unix seconds)
   * @param to - End timestamp (Unix seconds)
   * @param timeframe - Timeframe string: 'day', 'yesterday', 'week', or 'month' (used for aggregation granularity)
   * @param type - Type of energy: 'grid', 'car', or 'solar'
   * @returns Promise resolving to aggregated response
   */
  async getAggregatedEnergyData(
    from: number,
    to: number,
    timeframe: string,
    type: 'grid' | 'car' | 'solar'
  ): Promise<AggregatedResponse | GridAggregatedResponse> {
    // Generate cache key
    const cacheKey = `energy:aggregated:${type}:${timeframe}:${from}:${to}`;

    // Check cache first
    if (this.cache) {
      const cached = await this.cache.get<AggregatedResponse | GridAggregatedResponse>(cacheKey);
      if (cached !== null) {
        console.log("cached result found");
        return cached;
      }
      console.log("no cached result found");
    }

    // Determine query strategy based on time range
    const timeRangeSeconds = to - from;
    const useBuckets = timeRangeSeconds >= 3600; // Use buckets for ranges >= 1 hour

    let result: AggregatedResponse | GridAggregatedResponse;

    if (useBuckets && this.bucketRepository && this.repository) {
      // Use bucket table + partial integration for high precision
      console.log("using bucket table + partial integration for high precision");
      result = await this.aggregateEnergyDataFromBuckets(from, to, timeframe, type);
    } else if (this.repository) {
      // Use raw table for small ranges or when bucket repository is not available
      console.log("using raw table for small ranges or when bucket repository is not available");
      const readings = await this.repository.getEnergyReadingsForRange(from, to);
      result = this.aggregateEnergyData(readings, timeframe, type);
    } else {
      throw new Error('EnergyRepository is required for getAggregatedEnergyData');
    }

    // Store in cache
    if (this.cache) {
      await this.cache.set(cacheKey, result);
    }

    return result;
  }

  /**
   * Aggregates energy data from buckets with high-precision partial bucket integration.
   * @param from - Start timestamp (Unix seconds)
   * @param to - End timestamp (Unix seconds)
   * @param timeframe - Timeframe string
   * @param type - Type of energy: 'grid', 'car', or 'solar'
   * @returns Aggregated response
   */
  private async aggregateEnergyDataFromBuckets(
    from: number,
    to: number,
    timeframe: string,
    type: 'grid' | 'car' | 'solar'
  ): Promise<AggregatedResponse | GridAggregatedResponse> {
    if (!this.bucketRepository || !this.repository) {
      throw new Error('Both bucketRepository and repository are required for bucket-based aggregation');
    }

    // Round timestamps to minute boundaries for bucket queries
    const firstBucketStart = Math.floor(from / 60) * 60;
    const lastBucketStart = Math.floor(to / 60) * 60;

    // Determine if we need to integrate partial buckets
    const needsPartialFirst = firstBucketStart < from;
    const needsPartialLast = lastBucketStart < to;

    // Get full buckets (from first full bucket to last full bucket)
    const fullBucketStart = needsPartialFirst ? firstBucketStart + 60 : firstBucketStart;
    const fullBucketEnd = needsPartialLast ? lastBucketStart : lastBucketStart + 60;

    const buckets: EnergyBucket[] = [];
    if (fullBucketStart < fullBucketEnd) {
      if (timeframe === 'day' || timeframe === 'yesterday') {
        // For hourly aggregation, use 1-minute buckets
        buckets.push(...(await this.bucketRepository.getBucketsForRange(fullBucketStart, fullBucketEnd)));
      } else {
        // For daily aggregation, use hourly or daily materialized views if available
        // For now, use 1-minute buckets (can be optimized later)
        buckets.push(...(await this.bucketRepository.getBucketsForRange(fullBucketStart, fullBucketEnd)));
      }
    }

    // Get partial bucket readings if needed
    let partialFirstReadings: EnergyReading[] = [];
    let partialLastReadings: EnergyReading[] = [];

    if (needsPartialFirst) {
      const readingBefore = await this.bucketRepository.getFirstReadingBefore(from);
      const readingsInRange = await this.repository.getEnergyReadingsForRange(
        Math.max(firstBucketStart, from - 300), // Include some readings before for integration
        Math.min(firstBucketStart + 60, to)
      );
      if (readingBefore) {
        partialFirstReadings = [readingBefore, ...readingsInRange];
      } else {
        partialFirstReadings = readingsInRange;
      }
    }

    if (needsPartialLast && lastBucketStart !== firstBucketStart) {
      partialLastReadings = await this.repository.getEnergyReadingsForRange(
        lastBucketStart,
        to
      );
      const readingAfter = await this.bucketRepository.getFirstReadingAfter(to);
      if (readingAfter) {
        partialLastReadings.push(readingAfter);
      }
    }

    // Convert buckets to readings-like format for aggregation functions
    // For now, use the existing aggregateEnergyData with combined data
    // This is a simplified approach - can be optimized later to sum buckets directly
    const allReadings: EnergyReading[] = [];

    // Add partial first bucket readings
    allReadings.push(...partialFirstReadings);

    // Convert buckets to readings (using first/last values from buckets)
    for (const bucket of buckets) {
      // Create a reading from bucket's first values
      allReadings.push({
        id: 0, // Not used
        timestamp: bucket.first_timestamp,
        home: bucket.first_home,
        grid: bucket.first_grid,
        car: bucket.first_car,
        solar: bucket.first_solar,
        created_at: 0,
      });
      // Create a reading from bucket's last values
      allReadings.push({
        id: 0,
        timestamp: bucket.last_timestamp,
        home: bucket.last_home,
        grid: bucket.last_grid,
        car: bucket.last_car,
        solar: bucket.last_solar,
        created_at: 0,
      });
    }

    // Add partial last bucket readings
    allReadings.push(...partialLastReadings);

    // Sort by timestamp
    allReadings.sort((a, b) => a.timestamp - b.timestamp);

    // Use existing aggregation logic
    return this.aggregateEnergyData(allReadings, timeframe, type);
  }
}

/**
 * Factory function to create an EnergyService instance.
 * @param repository - Optional EnergyRepository instance (required for methods that access the database)
 * @param bucketRepository - Optional EnergyBucketRepository instance (for optimized bucket queries)
 * @param cache - Optional Cache instance (for caching aggregated results)
 * @returns EnergyService instance
 */
export function createEnergyService(
  repository?: EnergyRepository,
  bucketRepository?: EnergyBucketRepository,
  cache?: Cache
): EnergyService {
  return new EnergyService(repository, bucketRepository, cache);
}

/**
 * Factory function to create a client-safe EnergyService instance.
 * This instance does not require a repository since it only uses pure business logic methods.
 * @returns EnergyService instance (without database access)
 */
export function createClientEnergyService(): EnergyService {
  return new EnergyService();
}

// Singleton instance for backward compatibility (deprecated - use createEnergyService instead)
let energyServiceInstance: EnergyService | null = null;

/**
 * Gets the singleton instance of EnergyService.
 * @deprecated Use createEnergyService() instead for dependency injection
 * @returns EnergyService instance
 */
export function getEnergyService(): EnergyService {
  if (!energyServiceInstance) {
    // Import here to avoid circular dependencies
    const { getPrismaClient } = require('@/lib/db');
    const { createEnergyRepository } = require('@/lib/repositories/energy-repository');
    const prisma = getPrismaClient();
    const repository = createEnergyRepository(prisma);
    energyServiceInstance = new EnergyService(repository);
  }
  return energyServiceInstance;
}

