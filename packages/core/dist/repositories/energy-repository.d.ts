import { PrismaClient } from '@repo/database';
import type { EnergyData, EnergySettings, ConsumingPricePeriod, EnergyReading } from '../types/energy';
/**
 * Repository for energy data access operations.
 * Encapsulates database access logic and accepts PrismaClient via dependency injection.
 */
export declare class EnergyRepository {
    private prisma;
    constructor(prisma: PrismaClient);
    /**
     * Inserts a new energy reading into the database.
     * @param data - Energy data to insert
     */
    insertEnergyReading(data: EnergyData): Promise<void>;
    /**
     * Gets energy readings with pagination and optional date range filtering.
     * @param limit - Maximum number of readings to return
     * @param offset - Number of readings to skip
     * @param from - Optional start timestamp (Unix seconds)
     * @param to - Optional end timestamp (Unix seconds)
     * @returns Promise resolving to array of EnergyReading
     */
    getEnergyReadings(limit?: number, offset?: number, from?: number, to?: number): Promise<EnergyReading[]>;
    /**
     * Gets energy readings for a specific time range.
     * @param from - Start timestamp (Unix seconds)
     * @param to - End timestamp (Unix seconds)
     * @returns Promise resolving to array of EnergyReading
     */
    getEnergyReadingsForRange(from: number, to: number): Promise<EnergyReading[]>;
    /**
     * Gets all energy settings (including past, current, and future).
     * @returns Promise resolving to array of all EnergySettings
     */
    getAllEnergySettings(): Promise<EnergySettings[]>;
    /**
     * Updates the end_date of an existing energy settings record.
     * Pure data access function - no business logic.
     * @param settingsId - ID of the settings record to update
     * @param endDate - New end date (Unix timestamp)
     */
    updateEnergySettingsEndDate(settingsId: number, endDate: number): Promise<void>;
    /**
     * Creates a new energy settings record with consuming periods.
     * Pure data access function - no business logic.
     * @param producingPrice - Price per kWh for energy production
     * @param consumingPeriods - Array of time-based consuming price periods
     * @param startDate - Start date for the settings (Unix timestamp)
     * @param endDate - Optional end date (Unix timestamp, null for currently active)
     * @returns Promise resolving to the created EnergySettings
     */
    createEnergySettings(producingPrice: number, consumingPeriods: ConsumingPricePeriod[], startDate: number, endDate?: number | null): Promise<EnergySettings>;
    /**
     * Finds the currently active energy settings at a given timestamp.
     * Pure data access function - no business logic.
     * @param timestamp - Unix timestamp in seconds
     * @returns Promise resolving to EnergySettings or null if no settings found
     */
    findActiveEnergySettings(timestamp: number): Promise<EnergySettings | null>;
}
/**
 * Factory function to create an EnergyRepository instance.
 * @param prisma - PrismaClient instance
 * @returns EnergyRepository instance
 */
export declare function createEnergyRepository(prisma: PrismaClient): EnergyRepository;
