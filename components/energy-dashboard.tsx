'use client';

import { useState, useMemo } from 'react';
import { useEnergyData } from '@/hooks/useEnergyData';
import { useEnergySettings } from '@/hooks/useEnergySettings';
import { getEnergyService } from '@/lib/services/energy-service';
import { TimeframeSelector, getTimeframeLabel, type Timeframe, type DisplayMode } from './energy-dashboard/TimeframeSelector';
import { EnergyCard } from './energy-dashboard/EnergyCard';
import { EnergyChart } from './energy-dashboard/EnergyChart';

export function EnergyDashboard() {
  const [timeframe, setTimeframe] = useState<Timeframe>('day');
  const [displayMode, setDisplayMode] = useState<DisplayMode>('kwh');

  // Fetch all energy data
  const { consumption, feedIn, car, solar } = useEnergyData(timeframe);

  // Fetch settings only when in cost mode
  const { settings, loading: settingsLoading } = useEnergySettings(displayMode);

  // Get energy service instance for cost calculations
  const energyService = getEnergyService();

  // Calculate costs for consumption chart data
  const consumptionChartData = useMemo(() => {
    return consumption.data.map((point) => {
      const value = displayMode === 'cost' 
        ? energyService.calculateConsumptionCost(
            point.kwh,
            point.timestamp,
            settings
          )
        : point.kwh;
      return {
        ...point,
        value,
      };
    });
  }, [consumption.data, displayMode, settings, energyService]);

  // Calculate consumption total value: sum costs of all data points in cost mode, otherwise use total kWh
  const consumptionTotalValue = useMemo(() => {
    return displayMode === 'cost'
      ? consumptionChartData.reduce((sum, point) => sum + point.value, 0)
      : consumption.total;
  }, [displayMode, consumptionChartData, consumption.total]);

  // Calculate costs for feed-in chart data
  const feedInChartData = useMemo(() => {
    return feedIn.data.map((point) => {
      const value = displayMode === 'cost' 
        ? energyService.calculateFeedInCost(
            point.kwh,
            settings
          )
        : point.kwh;
      return {
        ...point,
        value,
      };
    });
  }, [feedIn.data, displayMode, settings, energyService]);

  // Calculate feed-in total value: sum costs of all data points in cost mode, otherwise use total kWh
  const feedInTotalValue = useMemo(() => {
    return displayMode === 'cost'
      ? feedInChartData.reduce((sum, point) => sum + point.value, 0)
      : feedIn.total;
  }, [displayMode, feedInChartData, feedIn.total]);

  // Calculate car energy costs if in cost mode
  const carChartData = useMemo(() => {
    return car.data.map((point) => {
      // Car consumption is always positive, so use consuming price
      const value = displayMode === 'cost' 
        ? energyService.calculateConsumptionCost(
            point.kwh,
            point.timestamp,
            settings
          )
        : point.kwh;
      return {
        ...point,
        value,
      };
    });
  }, [car.data, displayMode, settings, energyService]);

  // Calculate car total value: sum costs of all data points in cost mode, otherwise use total kWh
  const carTotalValue = useMemo(() => {
    return displayMode === 'cost'
      ? carChartData.reduce((sum, point) => sum + point.value, 0)
      : car.total;
  }, [displayMode, carChartData, car.total]);

  // Calculate solar energy costs if in cost mode
  // Solar production is always positive, so use producing_price
  const solarChartData = useMemo(() => {
    return solar.data.map((point) => {
      const value = displayMode === 'cost' 
        ? energyService.calculateFeedInCost(
            point.kwh,
            settings
          )
        : point.kwh;
      return {
        ...point,
        value,
      };
    });
  }, [solar.data, displayMode, settings, energyService]);

  // Calculate solar total value: sum costs of all data points in cost mode, otherwise use total kWh
  const solarTotalValue = useMemo(() => {
    return displayMode === 'cost'
      ? solarChartData.reduce((sum, point) => sum + point.value, 0)
      : solar.total;
  }, [displayMode, solarChartData, solar.total]);

  const timeframeLabel = getTimeframeLabel(timeframe);

  return (
    <div className="container mx-auto p-6 max-w-6xl">
      <TimeframeSelector
        timeframe={timeframe}
        displayMode={displayMode}
        onTimeframeChange={setTimeframe}
        onDisplayModeChange={setDisplayMode}
      />

      {/* Total Energy Cards - Side by Side */}
      <div className="mb-6 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <EnergyCard
          title="Grid Energy Consumption"
          description={
            displayMode === 'cost' 
              ? `Total cost for energy consumed from the grid for ${timeframeLabel.toLowerCase()}`
              : `Total energy consumed from the grid for ${timeframeLabel.toLowerCase()}`
          }
          value={consumptionTotalValue}
          displayMode={displayMode}
          timeframe={timeframe}
          loading={consumption.loading}
          error={consumption.error}
          color="hsl(var(--chart-1))"
          settingsLoading={settingsLoading}
        />

        <EnergyCard
          title="Grid Energy Feed-In"
          description={
            displayMode === 'cost' 
              ? `Total cost for energy fed back to the grid for ${timeframeLabel.toLowerCase()}`
              : `Total energy fed back to the grid for ${timeframeLabel.toLowerCase()}`
          }
          value={feedInTotalValue}
          displayMode={displayMode}
          timeframe={timeframe}
          loading={feedIn.loading}
          error={feedIn.error}
          color="hsl(var(--chart-2))"
          settingsLoading={settingsLoading}
        />

        <EnergyCard
          title="Car Energy Consumption"
          description={
            displayMode === 'cost' 
              ? `Total cost for car energy consumption for ${timeframeLabel.toLowerCase()}`
              : `Total car energy consumption for ${timeframeLabel.toLowerCase()}`
          }
          value={carTotalValue}
          displayMode={displayMode}
          timeframe={timeframe}
          loading={car.loading}
          error={car.error}
          color="hsl(var(--chart-1))"
          settingsLoading={settingsLoading}
        />

        <EnergyCard
          title="Solar Energy Production"
          description={
            displayMode === 'cost' 
              ? `Total cost for solar energy production for ${timeframeLabel.toLowerCase()}`
              : `Total solar energy production for ${timeframeLabel.toLowerCase()}`
          }
          value={solarTotalValue}
          displayMode={displayMode}
          timeframe={timeframe}
          loading={solar.loading}
          error={solar.error}
          color="hsl(var(--chart-1))"
          settingsLoading={settingsLoading}
        />
      </div>

      {/* Bar Chart Card */}
      <EnergyChart
        data={consumptionChartData}
        displayMode={displayMode}
        timeframe={timeframe}
        loading={consumption.loading}
        error={consumption.error}
        title="Grid Energy Consumption Overview"
        description={
          displayMode === 'cost' 
            ? 'Cost for energy consumed from the grid'
            : 'Energy consumed from the grid'
        }
      />
    </div>
  );
}
