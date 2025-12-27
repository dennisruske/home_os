import { PrismaClient } from '@prisma/client';
import type { EnergyData, EnergySettings, ConsumingPricePeriod, EnergyReading } from '@/types/energy';

// Prisma Client singleton
const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === 'development' ? ['error', 'warn'] : ['error'],
  });

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma;

export async function insertEnergyReading(data: EnergyData): Promise<void> {
  if (!data.timestamp) {
    return; // Skip if timestamp is not available
  }

  try {
    await prisma.energyReading.create({
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

export async function getEnergyReadings(
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

    const readings = await prisma.energyReading.findMany({
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

export async function getEnergyReadingsForRange(
  from: number,
  to: number
): Promise<EnergyReading[]> {
  try {
    const readings = await prisma.energyReading.findMany({
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

export async function getAllEnergySettings(): Promise<EnergySettings[]> {
  try {
    const settings = await prisma.energySettings.findMany({
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
 */
export async function updateEnergySettingsEndDate(
  settingsId: number,
  endDate: number
): Promise<void> {
  try {
    await prisma.energySettings.update({
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
 */
export async function createEnergySettings(
  producingPrice: number,
  consumingPeriods: ConsumingPricePeriod[],
  startDate: number,
  endDate: number | null = null
): Promise<EnergySettings> {
  try {
    const now = Math.floor(Date.now() / 1000);
    const created = await prisma.energySettings.create({
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
 */
export async function findActiveEnergySettings(timestamp: number): Promise<EnergySettings | null> {
  try {
    const settings = await prisma.energySettings.findFirst({
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

