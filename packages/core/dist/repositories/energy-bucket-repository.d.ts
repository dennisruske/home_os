import { PrismaClient } from '@repo/database';
import type { EnergyBucket, EnergyReading } from '../types/energy';
/**
 * Repository for energy bucket data access operations.
 * Encapsulates database access logic for pre-aggregated energy buckets and accepts PrismaClient via dependency injection.
 */
export declare class EnergyBucketRepository {
    private prisma;
    constructor(prisma: PrismaClient);
    /**
     * Gets energy buckets for a specific time range.
     * @param from - Start timestamp (Unix seconds)
     * @param to - End timestamp (Unix seconds)
     * @returns Promise resolving to array of EnergyBucket
     */
    getBucketsForRange(from: number, to: number): Promise<EnergyBucket[]>;
    /**
     * Gets the last reading before a given timestamp (for partial first bucket integration).
     * @param timestamp - Timestamp to find reading before (Unix seconds)
     * @returns Promise resolving to EnergyReading or null if not found
     */
    getFirstReadingBefore(timestamp: number): Promise<EnergyReading | null>;
    /**
     * Gets the first reading after a given timestamp (for partial last bucket integration).
     * @param timestamp - Timestamp to find reading after (Unix seconds)
     * @returns Promise resolving to EnergyReading or null if not found
     */
    getFirstReadingAfter(timestamp: number): Promise<EnergyReading | null>;
    /**
     * Gets the latest bucket timestamp.
     * @returns Promise resolving to latest bucket timestamp or null if no buckets exist
     */
    getLatestBucketTimestamp(): Promise<number | null>;
    /**
     * Gets hourly aggregated buckets for a time range from materialized view.
     * @param from - Start timestamp (Unix seconds)
     * @param to - End timestamp (Unix seconds)
     * @returns Promise resolving to array of EnergyBucket (hourly aggregated)
     */
    getHourlyBucketsForRange(from: number, to: number): Promise<EnergyBucket[]>;
    /**
     * Gets daily aggregated buckets for a time range from materialized view.
     * @param from - Start timestamp (Unix seconds)
     * @param to - End timestamp (Unix seconds)
     * @returns Promise resolving to array of EnergyBucket (daily aggregated)
     */
    getDailyBucketsForRange(from: number, to: number): Promise<EnergyBucket[]>;
}
/**
 * Factory function to create an EnergyBucketRepository instance.
 * @param prisma - PrismaClient instance
 * @returns EnergyBucketRepository instance
 */
export declare function createEnergyBucketRepository(prisma: PrismaClient): EnergyBucketRepository;
