import { PrismaClient } from '@repo/database';
import type { EnergyData, EnergySettings, ConsumingPricePeriod, EnergyReading } from '../types/energy';

/**
 * Repository for energy data access operations.
 * Encapsulates database access logic and accepts PrismaClient via dependency injection.
 */
export class EnergyRepository {
  constructor(private prisma: PrismaClient) { }

  /**
   * Inserts a new energy reading into the database.
   * @param data - Energy data to insert
   */
  async insertEnergyReading(data: EnergyData): Promise<void> {
    if (!data.timestamp) {
      return; // Skip if timestamp is not available
    }

    try {
      await this.prisma.energyReading.create({
        data: {
          timestamp: data.timestamp,
          home: data.home,
          grid: data.grid,
          car: data.car,
          solar: data.solar,
          created_at: Math.floor(Date.now() / 1000),
        },
      });
    } catch (error) {
      console.error('Error inserting energy reading:', error);
      // Don't throw - we want to continue processing even if DB write fails
    }
  }

  /**
   * Gets energy readings with pagination and optional date range filtering.
   * @param limit - Maximum number of readings to return
   * @param offset - Number of readings to skip
   * @param from - Optional start timestamp (Unix seconds)
   * @param to - Optional end timestamp (Unix seconds)
   * @returns Promise resolving to array of EnergyReading
   */
  async getEnergyReadings(
    limit: number = 100,
    offset: number = 0,
    from?: number,
    to?: number
  ): Promise<EnergyReading[]> {
    try {
      const where: {
        timestamp?: {
          gte?: number;
          lte?: number;
        };
      } = {};

      if (from || to) {
        where.timestamp = {};
        if (from !== undefined) {
          where.timestamp.gte = from;
        }
        if (to !== undefined) {
          where.timestamp.lte = to;
        }
      }

      const readings = await this.prisma.energyReading.findMany({
        where: Object.keys(where).length > 0 ? where : undefined,
        orderBy: {
          timestamp: 'desc',
        },
        take: limit,
        skip: offset,
      });

      return readings.map((reading) => ({
        id: reading.id,
        timestamp: reading.timestamp,
        home: reading.home,
        grid: reading.grid,
        car: reading.car,
        solar: reading.solar,
        created_at: reading.created_at,
      }));
    } catch (error) {
      console.error('Error querying energy readings:', error);
      throw error;
    }
  }

  /**
   * Gets energy readings for a specific time range.
   * @param from - Start timestamp (Unix seconds)
   * @param to - End timestamp (Unix seconds)
   * @returns Promise resolving to array of EnergyReading
   */
  async getEnergyReadingsForRange(from: number, to: number): Promise<EnergyReading[]> {
    try {
      const readings = await this.prisma.energyReading.findMany({
        where: {
          timestamp: {
            gte: from,
            lte: to,
          },
        },
        orderBy: {
          timestamp: 'asc', // Ascending order needed for integration
        },
      });

      return readings.map((reading) => ({
        id: reading.id,
        timestamp: reading.timestamp,
        home: reading.home,
        grid: reading.grid,
        car: reading.car,
        solar: reading.solar,
        created_at: reading.created_at,
      }));
    } catch (error) {
      console.error('Error querying energy readings for range:', error);
      throw error;
    }
  }

  /**
   * Gets all energy settings (including past, current, and future).
   * @returns Promise resolving to array of all EnergySettings
   */
  async getAllEnergySettings(): Promise<EnergySettings[]> {
    try {
      const settings = await this.prisma.energySettings.findMany({
        include: {
          consuming_periods: {
            orderBy: {
              start_time: 'asc',
            },
          },
        },
        orderBy: {
          start_date: 'desc',
        },
      });

      return settings.map((setting) => ({
        id: setting.id,
        producing_price: setting.producing_price,
        start_date: setting.start_date,
        end_date: setting.end_date,
        updated_at: setting.updated_at,
        consuming_periods: setting.consuming_periods.map((period) => ({
          id: period.id,
          energy_settings_id: period.energy_settings_id,
          start_time: period.start_time,
          end_time: period.end_time,
          price: period.price,
        })),
      }));
    } catch (error) {
      console.error('Error querying all energy settings:', error);
      throw error;
    }
  }

  /**
   * Updates the end_date of an existing energy settings record.
   * Pure data access function - no business logic.
   * @param settingsId - ID of the settings record to update
   * @param endDate - New end date (Unix timestamp)
   */
  async updateEnergySettingsEndDate(settingsId: number, endDate: number): Promise<void> {
    try {
      await this.prisma.energySettings.update({
        where: { id: settingsId },
        data: { end_date: endDate },
      });
    } catch (error) {
      console.error('Error updating energy settings end date:', error);
      throw error;
    }
  }

  /**
   * Creates a new energy settings record with consuming periods.
   * Pure data access function - no business logic.
   * @param producingPrice - Price per kWh for energy production
   * @param consumingPeriods - Array of time-based consuming price periods
   * @param startDate - Start date for the settings (Unix timestamp)
   * @param endDate - Optional end date (Unix timestamp, null for currently active)
   * @returns Promise resolving to the created EnergySettings
   */
  async createEnergySettings(
    producingPrice: number,
    consumingPeriods: ConsumingPricePeriod[],
    startDate: number,
    endDate: number | null = null
  ): Promise<EnergySettings> {
    try {
      const now = Math.floor(Date.now() / 1000);
      const created = await this.prisma.energySettings.create({
        data: {
          producing_price: producingPrice,
          start_date: startDate,
          end_date: endDate,
          updated_at: now,
          consuming_periods: {
            create: consumingPeriods.map((period) => ({
              start_time: period.start_time,
              end_time: period.end_time,
              price: period.price,
            })),
          },
        },
        include: {
          consuming_periods: {
            orderBy: {
              start_time: 'asc',
            },
          },
        },
      });

      return {
        id: created.id,
        producing_price: created.producing_price,
        start_date: created.start_date,
        end_date: created.end_date,
        updated_at: created.updated_at,
        consuming_periods: created.consuming_periods.map((period) => ({
          id: period.id,
          energy_settings_id: period.energy_settings_id,
          start_time: period.start_time,
          end_time: period.end_time,
          price: period.price,
        })),
      };
    } catch (error) {
      console.error('Error creating energy settings:', error);
      throw error;
    }
  }

  /**
   * Finds the currently active energy settings at a given timestamp.
   * Pure data access function - no business logic.
   * @param timestamp - Unix timestamp in seconds
   * @returns Promise resolving to EnergySettings or null if no settings found
   */
  async findActiveEnergySettings(timestamp: number): Promise<EnergySettings | null> {
    try {
      const settings = await this.prisma.energySettings.findFirst({
        where: {
          AND: [
            { start_date: { lte: timestamp } },
            {
              OR: [
                { end_date: null },
                { end_date: { gt: timestamp } },
              ],
            },
          ],
        },
        include: {
          consuming_periods: {
            orderBy: {
              start_time: 'asc',
            },
          },
        },
        orderBy: {
          start_date: 'desc',
        },
      });

      if (!settings) {
        return null;
      }

      return {
        id: settings.id,
        producing_price: settings.producing_price,
        start_date: settings.start_date,
        end_date: settings.end_date,
        updated_at: settings.updated_at,
        consuming_periods: settings.consuming_periods.map((period) => ({
          id: period.id,
          energy_settings_id: period.energy_settings_id,
          start_time: period.start_time,
          end_time: period.end_time,
          price: period.price,
        })),
      };
    } catch (error) {
      console.error('Error finding active energy settings:', error);
      throw error;
    }
  }
}

/**
 * Factory function to create an EnergyRepository instance.
 * @param prisma - PrismaClient instance
 * @returns EnergyRepository instance
 */
export function createEnergyRepository(prisma: PrismaClient): EnergyRepository {
  return new EnergyRepository(prisma);
}

