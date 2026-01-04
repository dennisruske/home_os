import { PrismaClient } from '@prisma/client';
import type { EnergyBucket, EnergyReading } from '@/types/energy';

/**
 * Repository for energy bucket data access operations.
 * Encapsulates database access logic for pre-aggregated energy buckets and accepts PrismaClient via dependency injection.
 */
export class EnergyBucketRepository {
  constructor(private prisma: PrismaClient) {}

  /**
   * Gets energy buckets for a specific time range.
   * @param from - Start timestamp (Unix seconds)
   * @param to - End timestamp (Unix seconds)
   * @returns Promise resolving to array of EnergyBucket
   */
  async getBucketsForRange(from: number, to: number): Promise<EnergyBucket[]> {
    try {
      const buckets = await this.prisma.energyBucket.findMany({
        where: {
          bucket_start: {
            gte: from,
            lt: to, // Use lt to avoid overlap
          },
        },
        orderBy: {
          bucket_start: 'asc',
        },
      });

      return buckets.map((bucket) => ({
        bucket_start: bucket.bucket_start,
        bucket_end: bucket.bucket_end,
        home_kwh: bucket.home_kwh,
        grid_kwh: bucket.grid_kwh,
        car_kwh: bucket.car_kwh,
        solar_kwh: bucket.solar_kwh,
        readings_count: bucket.readings_count,
        first_timestamp: bucket.first_timestamp,
        last_timestamp: bucket.last_timestamp,
        first_home: bucket.first_home,
        first_grid: bucket.first_grid,
        first_car: bucket.first_car,
        first_solar: bucket.first_solar,
        last_home: bucket.last_home,
        last_grid: bucket.last_grid,
        last_car: bucket.last_car,
        last_solar: bucket.last_solar,
      }));
    } catch (error) {
      console.error('Error querying energy buckets for range:', error);
      throw error;
    }
  }

  /**
   * Gets the last reading before a given timestamp (for partial first bucket integration).
   * @param timestamp - Timestamp to find reading before (Unix seconds)
   * @returns Promise resolving to EnergyReading or null if not found
   */
  async getFirstReadingBefore(timestamp: number): Promise<EnergyReading | null> {
    try {
      const reading = await this.prisma.energyReading.findFirst({
        where: {
          timestamp: {
            lt: timestamp,
          },
        },
        orderBy: {
          timestamp: 'desc',
        },
      });

      if (!reading) {
        return null;
      }

      return {
        id: reading.id,
        timestamp: reading.timestamp,
        home: reading.home,
        grid: reading.grid,
        car: reading.car,
        solar: reading.solar,
        created_at: reading.created_at,
      };
    } catch (error) {
      console.error('Error querying first reading before timestamp:', error);
      throw error;
    }
  }

  /**
   * Gets the first reading after a given timestamp (for partial last bucket integration).
   * @param timestamp - Timestamp to find reading after (Unix seconds)
   * @returns Promise resolving to EnergyReading or null if not found
   */
  async getFirstReadingAfter(timestamp: number): Promise<EnergyReading | null> {
    try {
      const reading = await this.prisma.energyReading.findFirst({
        where: {
          timestamp: {
            gt: timestamp,
          },
        },
        orderBy: {
          timestamp: 'asc',
        },
      });

      if (!reading) {
        return null;
      }

      return {
        id: reading.id,
        timestamp: reading.timestamp,
        home: reading.home,
        grid: reading.grid,
        car: reading.car,
        solar: reading.solar,
        created_at: reading.created_at,
      };
    } catch (error) {
      console.error('Error querying first reading after timestamp:', error);
      throw error;
    }
  }

  /**
   * Gets the latest bucket timestamp.
   * @returns Promise resolving to latest bucket timestamp or null if no buckets exist
   */
  async getLatestBucketTimestamp(): Promise<number | null> {
    try {
      const bucket = await this.prisma.energyBucket.findFirst({
        orderBy: {
          bucket_start: 'desc',
        },
        select: {
          bucket_start: true,
        },
      });

      return bucket?.bucket_start ?? null;
    } catch (error) {
      console.error('Error querying latest bucket timestamp:', error);
      throw error;
    }
  }

  /**
   * Gets hourly aggregated buckets for a time range from materialized view.
   * @param from - Start timestamp (Unix seconds)
   * @param to - End timestamp (Unix seconds)
   * @returns Promise resolving to array of EnergyBucket (hourly aggregated)
   */
  async getHourlyBucketsForRange(from: number, to: number): Promise<EnergyBucket[]> {
    try {
      // Round timestamps to hour boundaries for materialized view query
      const fromHour = Math.floor(from / 3600) * 3600;
      const toHour = Math.ceil(to / 3600) * 3600;

      const result = await this.prisma.$queryRaw<Array<{
        bucket_start: bigint;
        bucket_end: bigint;
        home_kwh: number;
        grid_kwh: number;
        car_kwh: number;
        solar_kwh: number;
        readings_count: bigint;
        first_timestamp: bigint;
        last_timestamp: bigint;
        first_home: number;
        first_grid: number;
        first_car: number;
        first_solar: number;
        last_home: number;
        last_grid: number;
        last_car: number;
        last_solar: number;
      }>>`
        SELECT 
          bucket_start,
          bucket_end,
          home_kwh,
          grid_kwh,
          car_kwh,
          solar_kwh,
          readings_count,
          first_timestamp,
          last_timestamp,
          first_home,
          first_grid,
          first_car,
          first_solar,
          last_home,
          last_grid,
          last_car,
          last_solar
        FROM energy_hourly_buckets
        WHERE bucket_start >= ${fromHour}
          AND bucket_start < ${toHour}
        ORDER BY bucket_start ASC
      `;

      return result.map((row) => ({
        bucket_start: Number(row.bucket_start),
        bucket_end: Number(row.bucket_end),
        home_kwh: row.home_kwh,
        grid_kwh: row.grid_kwh,
        car_kwh: row.car_kwh,
        solar_kwh: row.solar_kwh,
        readings_count: Number(row.readings_count),
        first_timestamp: Number(row.first_timestamp),
        last_timestamp: Number(row.last_timestamp),
        first_home: row.first_home,
        first_grid: row.first_grid,
        first_car: row.first_car,
        first_solar: row.first_solar,
        last_home: row.last_home,
        last_grid: row.last_grid,
        last_car: row.last_car,
        last_solar: row.last_solar,
      }));
    } catch (error) {
      console.error('Error querying hourly buckets for range:', error);
      // If materialized view doesn't exist yet, return empty array
      if (error instanceof Error && error.message.includes('does not exist')) {
        return [];
      }
      throw error;
    }
  }

  /**
   * Gets daily aggregated buckets for a time range from materialized view.
   * @param from - Start timestamp (Unix seconds)
   * @param to - End timestamp (Unix seconds)
   * @returns Promise resolving to array of EnergyBucket (daily aggregated)
   */
  async getDailyBucketsForRange(from: number, to: number): Promise<EnergyBucket[]> {
    try {
      // Round timestamps to day boundaries for materialized view query
      const fromDate = new Date(from * 1000);
      fromDate.setHours(0, 0, 0, 0);
      const fromDay = Math.floor(fromDate.getTime() / 1000);

      const toDate = new Date(to * 1000);
      toDate.setHours(0, 0, 0, 0);
      const toDay = Math.ceil(toDate.getTime() / 1000);

      const result = await this.prisma.$queryRaw<Array<{
        bucket_start: bigint;
        bucket_end: bigint;
        home_kwh: number;
        grid_kwh: number;
        car_kwh: number;
        solar_kwh: number;
        readings_count: bigint;
        first_timestamp: bigint;
        last_timestamp: bigint;
        first_home: number;
        first_grid: number;
        first_car: number;
        first_solar: number;
        last_home: number;
        last_grid: number;
        last_car: number;
        last_solar: number;
      }>>`
        SELECT 
          bucket_start,
          bucket_end,
          home_kwh,
          grid_kwh,
          car_kwh,
          solar_kwh,
          readings_count,
          first_timestamp,
          last_timestamp,
          first_home,
          first_grid,
          first_car,
          first_solar,
          last_home,
          last_grid,
          last_car,
          last_solar
        FROM energy_daily_buckets
        WHERE bucket_start >= ${fromDay}
          AND bucket_start < ${toDay}
        ORDER BY bucket_start ASC
      `;

      return result.map((row) => ({
        bucket_start: Number(row.bucket_start),
        bucket_end: Number(row.bucket_end),
        home_kwh: row.home_kwh,
        grid_kwh: row.grid_kwh,
        car_kwh: row.car_kwh,
        solar_kwh: row.solar_kwh,
        readings_count: Number(row.readings_count),
        first_timestamp: Number(row.first_timestamp),
        last_timestamp: Number(row.last_timestamp),
        first_home: row.first_home,
        first_grid: row.first_grid,
        first_car: row.first_car,
        first_solar: row.first_solar,
        last_home: row.last_home,
        last_grid: row.last_grid,
        last_car: row.last_car,
        last_solar: row.last_solar,
      }));
    } catch (error) {
      console.error('Error querying daily buckets for range:', error);
      // If materialized view doesn't exist yet, return empty array
      if (error instanceof Error && error.message.includes('does not exist')) {
        return [];
      }
      throw error;
    }
  }
}

/**
 * Factory function to create an EnergyBucketRepository instance.
 * @param prisma - PrismaClient instance
 * @returns EnergyBucketRepository instance
 */
export function createEnergyBucketRepository(prisma: PrismaClient): EnergyBucketRepository {
  return new EnergyBucketRepository(prisma);
}



