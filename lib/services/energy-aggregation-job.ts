import { PrismaClient } from '@prisma/client';
import type { Cache } from '@/lib/cache/cache-interface';

/**
 * Service for aggregating raw energy readings into pre-aggregated buckets.
 * Uses SQL window functions for efficient database-level aggregation.
 */
export class EnergyAggregationJob {
  constructor(
    private prisma: PrismaClient,
    private cache?: Cache
  ) {}

  /**
   * Aggregates raw readings for a specific 1-minute bucket.
   * Calculates trapezoidal integrals for each metric (home, grid, car, solar).
   * @param bucketStart - Start timestamp of the bucket (Unix seconds, rounded to minute)
   */
  async aggregateMinuteBucket(bucketStart: number): Promise<void> {
    const bucketEnd = bucketStart + 60;
    console.log("aggregating minute bucket from", bucketStart, "to", bucketEnd);

    console.log("########################################################");
    const dateStart = new Date(bucketStart * 1000);
    const dateEnd = new Date(bucketEnd * 1000);
    console.log(dateStart.toString(), "to", dateEnd.toString());
    console.log("########################################################");
    // Fetch readings for this bucket
    const readings = await this.prisma.energyReading.findMany({
      where: {
        timestamp: {
          gte: bucketStart,
          lt: bucketEnd,
        },
      },
      orderBy: {
        timestamp: 'asc',
      },
    });

    if (readings.length < 2) {
      // Not enough readings for integration, skip this bucket
      console.log("not enough readings for integration, skipping bucket");
      return;
    }

    // Calculate trapezoidal integrals
    let homeKwh = 0;
    let gridKwh = 0;
    let carKwh = 0;
    let solarKwh = 0;

    for (let i = 0; i < readings.length - 1; i++) {
      const r1 = readings[i];
      const r2 = readings[i + 1];
      const timeDelta = r2.timestamp - r1.timestamp; // seconds

      // Trapezoidal integration: ((power1 + power2) / 2) * time_delta / 3600 (convert to kWh)
      homeKwh += ((r1.home + r2.home) / 2) * timeDelta / 3600 / 1000; // Convert watts to kW, seconds to hours
      gridKwh += ((r1.grid + r2.grid) / 2) * timeDelta / 3600 / 1000;
      carKwh += ((r1.car + r2.car) / 2) * timeDelta / 3600 / 1000;
      solarKwh += ((r1.solar + r2.solar) / 2) * timeDelta / 3600 / 1000;
    }

    console.log("homeKwh:", homeKwh, "gridKwh:", gridKwh, "carKwh:", carKwh, "solarKwh:", solarKwh);

    const firstReading = readings[0];
    const lastReading = readings[readings.length - 1];

    // Upsert bucket
    await this.prisma.energyBucket.upsert({
      where: { bucket_start: bucketStart },
      create: {
        bucket_start: bucketStart,
        bucket_end: bucketEnd,
        home_kwh: homeKwh,
        grid_kwh: gridKwh,
        car_kwh: carKwh,
        solar_kwh: solarKwh,
        readings_count: readings.length,
        first_timestamp: firstReading.timestamp,
        last_timestamp: lastReading.timestamp,
        first_home: firstReading.home,
        first_grid: firstReading.grid,
        first_car: firstReading.car,
        first_solar: firstReading.solar,
        last_home: lastReading.home,
        last_grid: lastReading.grid,
        last_car: lastReading.car,
        last_solar: lastReading.solar,
      },
      update: {
        bucket_end: bucketEnd,
        home_kwh: homeKwh,
        grid_kwh: gridKwh,
        car_kwh: carKwh,
        solar_kwh: solarKwh,
        readings_count: readings.length,
        first_timestamp: firstReading.timestamp,
        last_timestamp: lastReading.timestamp,
        first_home: firstReading.home,
        first_grid: firstReading.grid,
        first_car: firstReading.car,
        first_solar: firstReading.solar,
        last_home: lastReading.home,
        last_grid: lastReading.grid,
        last_car: lastReading.car,
        last_solar: lastReading.solar,
      },
    });
  }

  /**
   * Processes all unprocessed 1-minute buckets since the last run.
   * Finds the last processed timestamp and processes buckets up to now.
   */
  async processLatest(): Promise<void> {
    
    const now = Math.floor(Date.now() / 1000);
    const nowBucketStart = Math.floor(now / 60) * 60; // Round down to minute

    // Get or create job status
    let jobStatus = await this.prisma.energyBucketAggregationJob.findUnique({
      where: { id: 1 },
    });

    if (!jobStatus) {
      // Initialize job status - start from earliest reading or 24 hours ago
      const earliestReading = await this.prisma.energyReading.findFirst({
        orderBy: { timestamp: 'asc' },
        select: { timestamp: true },
      });

      const startTimestamp = earliestReading
        ? Math.floor(earliestReading.timestamp / 60) * 60
        : nowBucketStart - 86400; // 24 hours ago if no readings

      jobStatus = await this.prisma.energyBucketAggregationJob.create({
        data: {
          id: 1,
          last_processed_timestamp: startTimestamp,
          last_run_at: now,
          status: 'running',
        },
      });
    }

    const lastProcessed = jobStatus.last_processed_timestamp;
    let currentBucketStart = lastProcessed + 60; // Start from next bucket after last processed

    // Update status to running
    await this.prisma.energyBucketAggregationJob.update({
      where: { id: 1 },
      data: { status: 'running', last_run_at: now },
    });

    try {
      let processedCount = 0;

      // Process buckets up to now (but not including current minute)
      while (currentBucketStart < nowBucketStart) {
        await this.aggregateMinuteBucket(currentBucketStart);
        currentBucketStart += 60;
        processedCount++;

        // Update status every 10 buckets to show progress
        if (processedCount % 10 === 0) {
          await this.prisma.energyBucketAggregationJob.update({
            where: { id: 1 },
            data: { last_processed_timestamp: currentBucketStart - 60 },
          });
        }
      }

      // Update final status
      await this.prisma.energyBucketAggregationJob.update({
        where: { id: 1 },
        data: {
          last_processed_timestamp: currentBucketStart - 60,
          status: 'completed',
          last_run_at: now,
        },
      });

      // Invalidate cache for affected time range
      if (this.cache) {
        await this.cache.invalidatePattern('energy:aggregated:*');
      }

      // Refresh materialized views
      await this.refreshMaterializedViews();
    } catch (error) {
      console.error('Error processing aggregation job:', error);
      await this.prisma.energyBucketAggregationJob.update({
        where: { id: 1 },
        data: { status: 'error', last_run_at: now },
      });
      throw error;
    }
  }

  /**
   * Refreshes PostgreSQL materialized views for hourly and daily aggregations.
   */
  async refreshMaterializedViews(): Promise<void> {
    try {
      // Refresh hourly buckets materialized view
      /*await this.prisma.$executeRawUnsafe(
        'REFRESH MATERIALIZED VIEW CONCURRENTLY IF EXISTS energy_hourly_buckets'
      );*/
      await this.prisma.$executeRawUnsafe(`
        DO $$
        BEGIN
          IF EXISTS (
            SELECT 1
            FROM pg_matviews
            WHERE matviewname = 'energy_hourly_buckets'
          ) THEN
            REFRESH MATERIALIZED VIEW CONCURRENTLY energy_hourly_buckets;
          END IF;
        END $$;
      `);
    } catch (error) {
      // Materialized view might not exist yet, that's okay
      console.warn('Could not refresh energy_hourly_buckets materialized view:', error);
    }

    try {
      // Refresh daily buckets materialized view
      /*await this.prisma.$executeRawUnsafe(
        'REFRESH MATERIALIZED VIEW CONCURRENTLY IF EXISTS energy_daily_buckets'
      );*/
      await this.prisma.$executeRawUnsafe(`
        DO $$
        BEGIN
          IF EXISTS (
            SELECT 1
            FROM pg_matviews
            WHERE matviewname = 'energy_daily_buckets'
          ) THEN
            REFRESH MATERIALIZED VIEW CONCURRENTLY energy_daily_buckets;
          END IF;
        END $$;
      `);
    } catch (error) {
      // Materialized view might not exist yet, that's okay
      console.warn('Could not refresh energy_daily_buckets materialized view:', error);
    }
  }

  /**
   * Main entry point for the aggregation job.
   * Processes all unprocessed buckets since last run.
   */
  async run(): Promise<void> {
    if (process.env.AGGREGATION_JOB_ENABLED === 'false') {
      console.log('Aggregation job is disabled');
      return;
    }

    await this.processLatest();
  }

  /**
   * Public method to aggregate a single bucket (used by backfill script).
   * @param bucketStart - Start timestamp of the bucket (Unix seconds, rounded to minute)
   */
  async aggregateBucket(bucketStart: number): Promise<void> {
    return this.aggregateMinuteBucket(bucketStart);
  }
}

/**
 * Factory function to create an EnergyAggregationJob instance.
 * @param prisma - PrismaClient instance
 * @param cache - Optional Cache instance for cache invalidation
 * @returns EnergyAggregationJob instance
 */
export function createEnergyAggregationJob(
  prisma: PrismaClient,
  cache?: Cache
): EnergyAggregationJob {
  return new EnergyAggregationJob(prisma, cache);
}

