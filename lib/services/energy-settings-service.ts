import { getEnergySettings } from '@/lib/db';
import type { EnergySettings } from '@/types/energy';

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

