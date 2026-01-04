'use client';

import { useState } from 'react';
import { useEnergyData } from '@/hooks/useEnergyData';
import { useEnergySettings } from '@/hooks/useEnergySettings';
import { useEnergyCostCalculations } from '@/hooks/useEnergyCostCalculations';
import { createClientEnergyService } from '@/lib/services/energy-service';
import { TimeframeSelector, getTimeframeLabel, type Timeframe, type DisplayMode } from './energy-dashboard/TimeframeSelector';
import { EnergyCard } from './energy-dashboard/EnergyCard';
import { EnergyChart } from './energy-dashboard/EnergyChart';
import { Button } from './ui/button';

export function EnergyDashboard() {
  const [timeframe, setTimeframe] = useState<Timeframe>('day');
  const [displayMode, setDisplayMode] = useState<DisplayMode>('kwh');



  // Fetch all energy data
  const { consumption, feedIn, car, solar } = useEnergyData(timeframe);

  // Fetch settings only when in cost mode
  const { settings, loading: settingsLoading } = useEnergySettings(displayMode);

  // Get energy service instance for cost calculations (client-safe, no database access needed)
  const energyService = createClientEnergyService();

  // Transform energy data and calculate costs/totals
  const {
    consumptionChartData,
    consumptionTotalValue,
    feedInTotalValue,
    carChartData,
    carTotalValue,
    solarChartData,
    solarTotalValue,
  } = useEnergyCostCalculations(
    consumption,
    feedIn,
    car,
    solar,
    displayMode,
    settings,
    energyService
  );

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

      {/* Bar Chart Cards */}
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
