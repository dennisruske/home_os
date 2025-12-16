import { PrismaClient } from '@prisma/client';
import type { EnergyData, EnergySettings, ConsumingPricePeriod } from '@/types/energy';

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

export interface EnergyReading {
  id: number;
  timestamp: number;
  home: number;
  grid: number;
  car: number;
  solar: number;
  created_at: number;
}

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

export async function getEnergySettings(timestamp?: number): Promise<EnergySettings | null> {
  try {
    const queryTime = timestamp ?? Math.floor(Date.now() / 1000);
    
    const settings = await prisma.energySettings.findFirst({
      where: {
        AND: [
          { start_date: { lte: queryTime } },
          {
            OR: [
              { end_date: null },
              { end_date: { gt: queryTime } },
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
    console.error('Error querying energy settings:', error);
    throw error;
  }
}

export async function getConsumingPriceAt(
  timestamp: number,
  timeOfDayMinutes?: number
): Promise<number | null> {
  try {
    const settings = await getEnergySettings(timestamp);
    if (!settings || !settings.consuming_periods || settings.consuming_periods.length === 0) {
      return null;
    }

    // If timeOfDayMinutes not provided, calculate from timestamp
    let minutes: number;
    if (timeOfDayMinutes !== undefined) {
      minutes = timeOfDayMinutes;
    } else {
      const date = new Date(timestamp * 1000);
      minutes = date.getHours() * 60 + date.getMinutes();
    }

    // Find the period that contains this time
    for (const period of settings.consuming_periods) {
      if (period.start_time <= minutes && minutes < period.end_time) {
        return period.price;
      }
      // Handle wrap-around (e.g., 22:00 to 06:00)
      if (period.start_time > period.end_time) {
        if (minutes >= period.start_time || minutes < period.end_time) {
          return period.price;
        }
      }
    }

    // If no period matches, return the first period's price as fallback
    return settings.consuming_periods[0]?.price ?? null;
  } catch (error) {
    console.error('Error getting consuming price at time:', error);
    throw error;
  }
}

export async function getEnergySettingsAt(timestamp: number): Promise<EnergySettings | null> {
  return getEnergySettings(timestamp);
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

export async function updateEnergySettings(
  producingPrice: number,
  consumingPeriods: ConsumingPricePeriod[],
  startDate?: number
): Promise<EnergySettings> {
  try {
    console.log('updateEnergySettings called with:', { producingPrice, consumingPeriods, startDate });
    
    // Verify Prisma client is properly initialized
    if (!prisma || !prisma.energySettings) {
      console.error('Prisma client not properly initialized');
      throw new Error('Database connection error. Please restart the server.');
    }
    
    const now = Math.floor(Date.now() / 1000);
    const effectiveStartDate = startDate ?? now;

    // Validate consuming periods
    if (!consumingPeriods || consumingPeriods.length === 0) {
      throw new Error('At least one consuming price period is required');
    }

    // Validate time ranges (0-1439 minutes)
    for (const period of consumingPeriods) {
      if (period.start_time < 0 || period.start_time > 1439 || 
          period.end_time < 0 || period.end_time > 1439) {
        throw new Error('Time values must be between 0 and 1439 (minutes since midnight)');
      }
      if (period.price < 0) {
        throw new Error('Prices must be non-negative');
      }
    }

    // Find the currently active settings (if any)
    const activeSettings = await prisma.energySettings.findFirst({
      where: {
        AND: [
          { start_date: { lte: now } },
          {
            OR: [
              { end_date: null },
              { end_date: { gt: now } },
            ],
          },
        ],
      },
      orderBy: {
        start_date: 'desc',
      },
    });

    // If there's an active setting and the new start date is in the future,
    // end the current period at the new start date
    if (activeSettings && effectiveStartDate > now) {
      console.log('Ending current active settings period at:', effectiveStartDate);
      await prisma.energySettings.update({
        where: { id: activeSettings.id },
        data: {
          end_date: effectiveStartDate - 1, // End one second before new period starts
        },
      });
    } else if (activeSettings && effectiveStartDate <= now) {
      // If updating for current time, end the current period now
      console.log('Ending current active settings period now');
      await prisma.energySettings.update({
        where: { id: activeSettings.id },
        data: {
          end_date: now,
        },
      });
    }

    // Create new settings record with consuming periods
    console.log('Creating new settings record with start_date:', effectiveStartDate);
    const created = await prisma.energySettings.create({
      data: {
        producing_price: producingPrice,
        start_date: effectiveStartDate,
        end_date: null, // Currently active
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

    console.log('Settings created successfully:', created);
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
    console.error('Error updating energy settings:', error);
    const errorDetails = error instanceof Error ? { message: error.message, stack: error.stack } : error;
    console.error('Error details:', errorDetails);
    throw error;
  }
}
