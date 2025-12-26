'use client';

import { useEffect, useState } from 'react';
import type { 
  AggregatedDataPoint,
  AggregatedResponse,
  GridAggregatedResponse
} from '@/types/energy';

export type Timeframe = 'day' | 'yesterday' | 'week' | 'month';

export interface EnergyDataState {
  data: AggregatedDataPoint[];
  total: number;
  loading: boolean;
  error: string | null;
}

export interface UseEnergyDataReturn {
  consumption: EnergyDataState;
  feedIn: EnergyDataState;
  car: EnergyDataState;
  solar: EnergyDataState;
}

/**
 * Custom hook to fetch all energy data (consumption, feed-in, car, solar) in parallel.
 * All API calls are made when the timeframe changes.
 */
export function useEnergyData(timeframe: Timeframe): UseEnergyDataReturn {
  const [consumption, setConsumption] = useState<EnergyDataState>({
    data: [],
    total: 0,
    loading: true,
    error: null,
  });
  const [feedIn, setFeedIn] = useState<EnergyDataState>({
    data: [],
    total: 0,
    loading: true,
    error: null,
  });
  const [car, setCar] = useState<EnergyDataState>({
    data: [],
    total: 0,
    loading: true,
    error: null,
  });
  const [solar, setSolar] = useState<EnergyDataState>({
    data: [],
    total: 0,
    loading: true,
    error: null,
  });

  useEffect(() => {
    // Fetch all data in parallel
    const fetchAllData = async () => {
      // Reset loading and error states
      setConsumption((prev) => ({ ...prev, loading: true, error: null }));
      setFeedIn((prev) => ({ ...prev, loading: true, error: null }));
      setCar((prev) => ({ ...prev, loading: true, error: null }));
      setSolar((prev) => ({ ...prev, loading: true, error: null }));

      // Fetch grid data (consumption and feed-in)
      const gridPromise = fetch(`/api/energy/aggregated?timeframe=${timeframe}`)
        .then(async (response) => {
          if (!response.ok) {
            throw new Error('Failed to fetch aggregated data');
          }
          const result = (await response.json()) as GridAggregatedResponse;
          setConsumption({
            data: result.consumption.data,
            total: result.consumption.total,
            loading: false,
            error: null,
          });
          setFeedIn({
            data: result.feedIn.data,
            total: result.feedIn.total,
            loading: false,
            error: null,
          });
        })
        .catch((err) => {
          const errorMessage = err instanceof Error ? err.message : 'Failed to load data';
          setConsumption((prev) => ({ ...prev, loading: false, error: errorMessage }));
          setFeedIn((prev) => ({ ...prev, loading: false, error: errorMessage }));
        });

      // Fetch car data
      const carPromise = fetch(`/api/energy/aggregated/car?timeframe=${timeframe}`)
        .then(async (response) => {
          if (!response.ok) {
            throw new Error('Failed to fetch car energy data');
          }
          const result = (await response.json()) as AggregatedResponse;
          setCar({
            data: result.data,
            total: result.total,
            loading: false,
            error: null,
          });
        })
        .catch((err) => {
          const errorMessage = err instanceof Error ? err.message : 'Failed to load car energy data';
          setCar((prev) => ({ ...prev, loading: false, error: errorMessage }));
        });

      // Fetch solar data
      const solarPromise = fetch(`/api/energy/aggregated/solar?timeframe=${timeframe}`)
        .then(async (response) => {
          if (!response.ok) {
            throw new Error('Failed to fetch solar energy data');
          }
          const result = (await response.json()) as AggregatedResponse;
          setSolar({
            data: result.data,
            total: result.total,
            loading: false,
            error: null,
          });
        })
        .catch((err) => {
          const errorMessage = err instanceof Error ? err.message : 'Failed to load solar energy data';
          setSolar((prev) => ({ ...prev, loading: false, error: errorMessage }));
        });

      // Wait for all requests to complete (use allSettled to handle individual errors)
      await Promise.allSettled([gridPromise, carPromise, solarPromise]);
    };

    fetchAllData();
  }, [timeframe]);

  return {
    consumption,
    feedIn,
    car,
    solar,
  };
}

