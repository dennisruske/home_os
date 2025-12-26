'use client';

import { useMemo } from 'react';
import type { AggregatedDataPoint } from '@/types/energy';
import type { EnergySettings } from '@/types/energy';
import type { EnergyService } from '@/lib/services/energy-service';
import type { EnergyDataState } from './useEnergyData';
import type { DisplayMode } from '@/components/energy-dashboard/TimeframeSelector';

export interface ChartDataPoint extends AggregatedDataPoint {
  value: number;
}

export interface EnergyCostCalculationsReturn {
  consumptionChartData: ChartDataPoint[];
  consumptionTotalValue: number;
  feedInChartData: ChartDataPoint[];
  feedInTotalValue: number;
  carChartData: ChartDataPoint[];
  carTotalValue: number;
  solarChartData: ChartDataPoint[];
  solarTotalValue: number;
}

type CalculationMethod = 'consumption' | 'feedIn';

interface EnergyTypeConfig {
  calculationMethod: CalculationMethod;
  requiresTimestamp: boolean;
}

const ENERGY_TYPE_CONFIG: Record<
  'consumption' | 'feedIn' | 'car' | 'solar',
  EnergyTypeConfig
> = {
  consumption: { calculationMethod: 'consumption', requiresTimestamp: true },
  feedIn: { calculationMethod: 'feedIn', requiresTimestamp: false },
  car: { calculationMethod: 'consumption', requiresTimestamp: true },
  solar: { calculationMethod: 'feedIn', requiresTimestamp: false },
};

/**
 * Transforms energy data points to chart data with value field.
 * In 'kwh' mode, value equals kwh. In 'cost' mode, calculates cost using energy service.
 */
function transformDataPoints(
  data: AggregatedDataPoint[],
  displayMode: DisplayMode,
  settings: EnergySettings | null,
  energyService: EnergyService,
  config: EnergyTypeConfig
): ChartDataPoint[] {
  return data.map((point) => {
    if (displayMode === 'kwh') {
      return {
        ...point,
        value: point.kwh,
      };
    }

    // Calculate cost
    let cost = 0;
    if (settings) {
      if (config.calculationMethod === 'consumption') {
        cost = energyService.calculateConsumptionCost(
          point.kwh,
          point.timestamp,
          settings
        );
      } else {
        // feedIn
        cost = energyService.calculateFeedInCost(point.kwh, settings);
      }
    }

    return {
      ...point,
      value: cost,
    };
  });
}

/**
 * Calculates total value based on display mode.
 * In 'kwh' mode, returns the original total. In 'cost' mode, sums all chart data values.
 */
function calculateTotalValue(
  chartData: ChartDataPoint[],
  originalTotal: number,
  displayMode: DisplayMode
): number {
  if (displayMode === 'kwh') {
    return originalTotal;
  }
  return chartData.reduce((sum, point) => sum + point.value, 0);
}

/**
 * Custom hook to transform energy data and calculate costs/totals based on display mode.
 * Handles all 4 energy types (consumption, feedIn, car, solar) with appropriate cost calculations.
 */
export function useEnergyCostCalculations(
  consumption: EnergyDataState,
  feedIn: EnergyDataState,
  car: EnergyDataState,
  solar: EnergyDataState,
  displayMode: DisplayMode,
  settings: EnergySettings | null,
  energyService: EnergyService
): EnergyCostCalculationsReturn {
  // Transform consumption data
  const consumptionChartData = useMemo(
    () =>
      transformDataPoints(
        consumption.data,
        displayMode,
        settings,
        energyService,
        ENERGY_TYPE_CONFIG.consumption
      ),
    [consumption.data, displayMode, settings, energyService]
  );

  const consumptionTotalValue = useMemo(
    () =>
      calculateTotalValue(
        consumptionChartData,
        consumption.total,
        displayMode
      ),
    [consumptionChartData, consumption.total, displayMode]
  );

  // Transform feedIn data
  const feedInChartData = useMemo(
    () =>
      transformDataPoints(
        feedIn.data,
        displayMode,
        settings,
        energyService,
        ENERGY_TYPE_CONFIG.feedIn
      ),
    [feedIn.data, displayMode, settings, energyService]
  );

  const feedInTotalValue = useMemo(
    () => calculateTotalValue(feedInChartData, feedIn.total, displayMode),
    [feedInChartData, feedIn.total, displayMode]
  );

  // Transform car data
  const carChartData = useMemo(
    () =>
      transformDataPoints(
        car.data,
        displayMode,
        settings,
        energyService,
        ENERGY_TYPE_CONFIG.car
      ),
    [car.data, displayMode, settings, energyService]
  );

  const carTotalValue = useMemo(
    () => calculateTotalValue(carChartData, car.total, displayMode),
    [carChartData, car.total, displayMode]
  );

  // Transform solar data
  const solarChartData = useMemo(
    () =>
      transformDataPoints(
        solar.data,
        displayMode,
        settings,
        energyService,
        ENERGY_TYPE_CONFIG.solar
      ),
    [solar.data, displayMode, settings, energyService]
  );

  const solarTotalValue = useMemo(
    () => calculateTotalValue(solarChartData, solar.total, displayMode),
    [solarChartData, solar.total, displayMode]
  );

  return {
    consumptionChartData,
    consumptionTotalValue,
    feedInChartData,
    feedInTotalValue,
    carChartData,
    carTotalValue,
    solarChartData,
    solarTotalValue,
  };
}

