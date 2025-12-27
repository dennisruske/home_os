import { PrismaClient } from '@prisma/client';
import type { EnergyData, EnergySettings, ConsumingPricePeriod, EnergyReading } from '@/types/energy';
import { EnergyRepository, createEnergyRepository } from './repositories/energy-repository';

// Prisma Client singleton (needed for Next.js hot reload)
const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

const prismaInstance =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === 'development' ? ['error', 'warn'] : ['error'],
  });

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prismaInstance;

/**
 * Gets the PrismaClient singleton instance.
 * This function provides controlled access to the PrismaClient for dependency injection.
 * @returns PrismaClient instance
 */
export function getPrismaClient(): PrismaClient {
  return prismaInstance;
}

// Export prisma for backward compatibility (deprecated - use getPrismaClient instead)
export const prisma = prismaInstance;

// Create a repository instance for backward compatibility
const repository = createEnergyRepository(prismaInstance);

/**
 * Inserts a new energy reading into the database.
 * @deprecated Use EnergyRepository.insertEnergyReading() instead
 */
export async function insertEnergyReading(data: EnergyData): Promise<void> {
  return repository.insertEnergyReading(data);
}

/**
 * Gets energy readings with pagination and optional date range filtering.
 * @deprecated Use EnergyRepository.getEnergyReadings() instead
 */
export async function getEnergyReadings(
  limit: number = 100,
  offset: number = 0,
  from?: number,
  to?: number
): Promise<EnergyReading[]> {
  return repository.getEnergyReadings(limit, offset, from, to);
}

/**
 * Gets energy readings for a specific time range.
 * @deprecated Use EnergyRepository.getEnergyReadingsForRange() instead
 */
export async function getEnergyReadingsForRange(
  from: number,
  to: number
): Promise<EnergyReading[]> {
  return repository.getEnergyReadingsForRange(from, to);
}

/**
 * Gets all energy settings (including past, current, and future).
 * @deprecated Use EnergyRepository.getAllEnergySettings() instead
 */
export async function getAllEnergySettings(): Promise<EnergySettings[]> {
  return repository.getAllEnergySettings();
}

/**
 * Updates the end_date of an existing energy settings record.
 * Pure data access function - no business logic.
 * @deprecated Use EnergyRepository.updateEnergySettingsEndDate() instead
 */
export async function updateEnergySettingsEndDate(
  settingsId: number,
  endDate: number
): Promise<void> {
  return repository.updateEnergySettingsEndDate(settingsId, endDate);
}

/**
 * Creates a new energy settings record with consuming periods.
 * Pure data access function - no business logic.
 * @deprecated Use EnergyRepository.createEnergySettings() instead
 */
export async function createEnergySettings(
  producingPrice: number,
  consumingPeriods: ConsumingPricePeriod[],
  startDate: number,
  endDate: number | null = null
): Promise<EnergySettings> {
  return repository.createEnergySettings(producingPrice, consumingPeriods, startDate, endDate);
}

/**
 * Finds the currently active energy settings at a given timestamp.
 * Pure data access function - no business logic.
 * @deprecated Use EnergyRepository.findActiveEnergySettings() instead
 */
export async function findActiveEnergySettings(timestamp: number): Promise<EnergySettings | null> {
  return repository.findActiveEnergySettings(timestamp);
}

