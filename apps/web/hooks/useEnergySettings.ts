'use client';

import { useEffect, useState } from 'react';
import type { EnergySettings, ConsumingPricePeriod } from '@/types/energy';

export interface EnergySettingsResponse {
  producing_price: number;
  consuming_periods: ConsumingPricePeriod[];
  start_date: number;
  end_date: number | null;
}

export interface UseEnergySettingsReturn {
  settings: EnergySettings | null;
  loading: boolean;
  error: string | null;
}

/**
 * Helper function to convert EnergySettingsResponse to EnergySettings
 */
function convertToEnergySettings(
  settings: EnergySettingsResponse | null
): EnergySettings | null {
  if (!settings) {
    return null;
  }
  return {
    id: 0, // Not used for cost calculations
    producing_price: settings.producing_price,
    start_date: settings.start_date,
    end_date: settings.end_date ?? null,
    updated_at: settings.start_date,
    consuming_periods: settings.consuming_periods,
  };
}

/**
 * Custom hook to fetch energy settings conditionally.
 * Only fetches when displayMode is 'cost' to avoid unnecessary API calls.
 */
export function useEnergySettings(displayMode: 'kwh' | 'cost'): UseEnergySettingsReturn {
  const [settings, setSettings] = useState<EnergySettings | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (displayMode === 'cost') {
      const fetchSettings = async () => {
        setLoading(true);
        setError(null);
        try {
          const response = await fetch('/api/energy/settings');
          if (!response.ok) {
            throw new Error('Failed to fetch energy settings');
          }
          const settingsResponse = (await response.json()) as EnergySettingsResponse;
          setSettings(convertToEnergySettings(settingsResponse));
        } catch (err) {
          console.error('Error fetching energy settings:', err);
          const errorMessage = err instanceof Error ? err.message : 'Failed to fetch energy settings';
          setError(errorMessage);
        } finally {
          setLoading(false);
        }
      };

      fetchSettings();
    } else {
      // Clear settings when not in cost mode
      setSettings(null);
      setError(null);
      setLoading(false);
    }
  }, [displayMode]);

  return {
    settings,
    loading,
    error,
  };
}

