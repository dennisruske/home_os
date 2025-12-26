import { 
  getEnergySettings, 
  findActiveEnergySettings,
  updateEnergySettingsEndDate,
  createEnergySettings,
  getAllEnergySettings
} from '@/lib/db';
import type { EnergySettings, ConsumingPricePeriod } from '@/types/energy';

/**
 * Service for managing energy settings and price calculations.
 * Provides a clean abstraction layer for business logic related to energy pricing.
 */
export class EnergySettingsService {
  /**
   * Gets the active energy settings for a given timestamp.
   * If no timestamp is provided, returns settings for the current time.
   *
   * @param timestamp - Unix timestamp in seconds (optional, defaults to current time)
   * @returns Promise resolving to EnergySettings or null if no settings found
   */
  async getActiveSettings(timestamp?: number): Promise<EnergySettings | null> {
    return getEnergySettings(timestamp);
  }

  /**
   * Calculates the price per kWh for a given timestamp and type.
   *
   * @param timestamp - Unix timestamp in seconds
   * @param type - 'consuming' for consumption price, 'producing' for feed-in price
   * @returns Promise resolving to price per kWh, or null if no settings found
   */
  async calculatePriceAt(
    timestamp: number,
    type: 'consuming' | 'producing'
  ): Promise<number | null> {
    const settings = await this.getActiveSettings(timestamp);
    
    if (!settings) {
      return null;
    }

    if (type === 'producing') {
      return settings.producing_price;
    }

    // For consuming, find the appropriate price based on time of day
    if (!settings.consuming_periods || settings.consuming_periods.length === 0) {
      return null;
    }

    const date = new Date(timestamp * 1000);
    const minutes = date.getHours() * 60 + date.getMinutes();

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
  }

  /**
   * Updates energy settings with business logic for handling active settings transitions.
   * This method handles validation, active settings detection, and period ending logic.
   *
   * @param producingPrice - Price per kWh for energy production (feed-in)
   * @param consumingPeriods - Array of time-based consuming price periods
   * @param startDate - Optional start date for the new settings (defaults to current time)
   * @returns Promise resolving to the created EnergySettings
   */
  async updateSettings(
    producingPrice: number,
    consumingPeriods: ConsumingPricePeriod[],
    startDate?: number
  ): Promise<EnergySettings> {
    console.log('updateSettings called with:', { producingPrice, consumingPeriods, startDate });
    
    const now = Math.floor(Date.now() / 1000);
    const effectiveStartDate = startDate ?? now;

    // Business logic: Validate consuming periods
    if (!consumingPeriods || consumingPeriods.length === 0) {
      throw new Error('At least one consuming price period is required');
    }

    // Business logic: Validate time ranges (0-1439 minutes)
    for (const period of consumingPeriods) {
      if (period.start_time < 0 || period.start_time > 1439 || 
          period.end_time < 0 || period.end_time > 1439) {
        throw new Error('Time values must be between 0 and 1439 (minutes since midnight)');
      }
      if (period.price < 0) {
        throw new Error('Prices must be non-negative');
      }
    }

    // Business logic: Find the currently active settings (if any)
    const activeSettings = await findActiveEnergySettings(now);

    // Business logic: Handle period transitions
    if (activeSettings) {
      if (effectiveStartDate > now) {
        // New settings start in the future - end current period just before new one starts
        console.log('Ending current active settings period at:', effectiveStartDate);
        await updateEnergySettingsEndDate(activeSettings.id, effectiveStartDate - 1);
      } else {
        // New settings start now - end current period immediately
        console.log('Ending current active settings period now');
        await updateEnergySettingsEndDate(activeSettings.id, now);
      }
    }

    // Create new settings record
    console.log('Creating new settings record with start_date:', effectiveStartDate);
    const created = await createEnergySettings(
      producingPrice,
      consumingPeriods,
      effectiveStartDate,
      null // Currently active (no end date)
    );

    console.log('Settings created successfully:', created);
    return created;
  }

  /**
   * Gets all energy settings (including past, current, and future).
   * Provides a service layer abstraction for data access.
   *
   * @returns Promise resolving to array of all EnergySettings
   */
  async getAllSettings(): Promise<EnergySettings[]> {
    return getAllEnergySettings();
  }
}

// Singleton instance
let energySettingsServiceInstance: EnergySettingsService | null = null;

/**
 * Gets the singleton instance of EnergySettingsService.
 * @returns EnergySettingsService instance
 */
export function getEnergySettingsService(): EnergySettingsService {
  if (!energySettingsServiceInstance) {
    energySettingsServiceInstance = new EnergySettingsService();
  }
  return energySettingsServiceInstance;
}

