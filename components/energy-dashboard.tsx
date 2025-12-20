'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from '@/components/ui/chart';
import { Bar, BarChart, XAxis, YAxis, Cell } from 'recharts';
import type { EnergySettings, ConsumingPricePeriod } from '@/types/energy';

interface AggregatedDataPoint {
  label: string;
  kwh: number;
  timestamp: number;
}

interface AggregatedResponse {
  data: AggregatedDataPoint[];
  total: number;
}

interface GridAggregatedResponse {
  consumption: {
    data: AggregatedDataPoint[];
    total: number;
  };
  feedIn: {
    data: AggregatedDataPoint[];
    total: number;
  };
}

type Timeframe = 'day' | 'yesterday' | 'week' | 'month';
type DisplayMode = 'kwh' | 'cost';

export interface EnergySettingsResponse {
  producing_price: number;
  consuming_periods: ConsumingPricePeriod[];
  start_date: number;
  end_date: number | null;
}

const chartConfig = {
  kwh: {
    label: 'Energy (kWh)',
    color: 'hsl(var(--chart-1))',
  },
  cost: {
    label: 'Cost (€)',
    color: 'hsl(var(--chart-1))',
  },
} satisfies Record<string, { label: string; color: string }>;

// Calculate cost for consumption (positive kWh) from timestamp using energy settings
export function calculateConsumptionCost(
  kwh: number,
  timestamp: number,
  settings: EnergySettingsResponse | null
): number {
  if (!settings || kwh <= 0) {
    return 0;
  }

  // For positive kWh (consuming), find the appropriate price based on time of day
  const date = new Date(timestamp * 1000);
  const minutes = date.getHours() * 60 + date.getMinutes();

  // Find the period that contains this time
  for (const period of settings.consuming_periods) {
    if (period.start_time <= minutes && minutes < period.end_time) {
      return kwh * period.price;
    }
    // Handle wrap-around (e.g., 22:00 to 06:00)
    if (period.start_time > period.end_time) {
      if (minutes >= period.start_time || minutes < period.end_time) {
        return kwh * period.price;
      }
    }
  }

  // If no period matches, use the first period's price as fallback
  const fallbackPrice = settings.consuming_periods[0]?.price ?? 0;
  return kwh * fallbackPrice;
}

// Calculate cost for feed-in (positive kWh representing energy fed back) using producing price
function calculateFeedInCost(
  kwh: number,
  settings: EnergySettingsResponse | null
): number {
  if (!settings || kwh <= 0) {
    return 0;
  }
  // Feed-in always uses producing_price
  return kwh * settings.producing_price;
}

export function EnergyDashboard() {
  const [timeframe, setTimeframe] = useState<Timeframe>('day');
  const [displayMode, setDisplayMode] = useState<DisplayMode>('kwh');
  // Grid consumption state (positive values)
  const [consumptionData, setConsumptionData] = useState<AggregatedDataPoint[]>([]);
  const [consumptionTotal, setConsumptionTotal] = useState<number>(0);
  const [consumptionLoading, setConsumptionLoading] = useState(true);
  const [consumptionError, setConsumptionError] = useState<string | null>(null);
  // Grid feed-in state (negative values, displayed as positive)
  const [feedInData, setFeedInData] = useState<AggregatedDataPoint[]>([]);
  const [feedInTotal, setFeedInTotal] = useState<number>(0);
  const [feedInLoading, setFeedInLoading] = useState(true);
  const [feedInError, setFeedInError] = useState<string | null>(null);
  const [energySettings, setEnergySettings] = useState<EnergySettingsResponse | null>(null);
  const [settingsLoading, setSettingsLoading] = useState(false);
  // Car energy state
  const [carData, setCarData] = useState<AggregatedDataPoint[]>([]);
  const [carTotal, setCarTotal] = useState<number>(0);
  const [carLoading, setCarLoading] = useState(true);
  const [carError, setCarError] = useState<string | null>(null);
  // Solar energy state
  const [solarData, setSolarData] = useState<AggregatedDataPoint[]>([]);
  const [solarTotal, setSolarTotal] = useState<number>(0);
  const [solarLoading, setSolarLoading] = useState(true);
  const [solarError, setSolarError] = useState<string | null>(null);

  // Fetch energy settings when cost mode is active
  useEffect(() => {
    if (displayMode === 'cost') {
      const fetchSettings = async () => {
        setSettingsLoading(true);
        try {
          const response = await fetch('/api/energy/settings');
          if (!response.ok) {
            throw new Error('Failed to fetch energy settings');
          }
          const settings = (await response.json()) as EnergySettingsResponse;
          setEnergySettings(settings);
        } catch (err) {
          console.error('Error fetching energy settings:', err);
        } finally {
          setSettingsLoading(false);
        }
      };

      fetchSettings();
    }
  }, [displayMode]);

  useEffect(() => {
    const fetchData = async () => {
      setConsumptionLoading(true);
      setFeedInLoading(true);
      setConsumptionError(null);
      setFeedInError(null);

      try {
        const response = await fetch(`/api/energy/aggregated?timeframe=${timeframe}`);
        if (!response.ok) {
          throw new Error('Failed to fetch aggregated data');
        }
        const result = (await response.json()) as GridAggregatedResponse;
        setConsumptionData(result.consumption.data);
        setConsumptionTotal(result.consumption.total);
        setFeedInData(result.feedIn.data);
        setFeedInTotal(result.feedIn.total);
      } catch (err) {
        console.error('Error fetching aggregated data:', err);
        const errorMessage = err instanceof Error ? err.message : 'Failed to load data';
        setConsumptionError(errorMessage);
        setFeedInError(errorMessage);
      } finally {
        setConsumptionLoading(false);
        setFeedInLoading(false);
      }
    };

    fetchData();
  }, [timeframe]);

  // Fetch car energy data
  useEffect(() => {
    const fetchCarData = async () => {
      setCarLoading(true);
      setCarError(null);

      try {
        const response = await fetch(`/api/energy/aggregated/car?timeframe=${timeframe}`);
        if (!response.ok) {
          throw new Error('Failed to fetch car energy data');
        }
        const result = (await response.json()) as AggregatedResponse;
        setCarData(result.data);
        setCarTotal(result.total);
      } catch (err) {
        console.error('Error fetching car energy data:', err);
        setCarError(err instanceof Error ? err.message : 'Failed to load car energy data');
      } finally {
        setCarLoading(false);
      }
    };

    fetchCarData();
  }, [timeframe]);

  // Fetch solar energy data
  useEffect(() => {
    const fetchSolarData = async () => {
      setSolarLoading(true);
      setSolarError(null);

      try {
        const response = await fetch(`/api/energy/aggregated/solar?timeframe=${timeframe}`);
        if (!response.ok) {
          throw new Error('Failed to fetch solar energy data');
        }
        const result = (await response.json()) as AggregatedResponse;
        setSolarData(result.data);
        setSolarTotal(result.total);
      } catch (err) {
        console.error('Error fetching solar energy data:', err);
        setSolarError(err instanceof Error ? err.message : 'Failed to load solar energy data');
      } finally {
        setSolarLoading(false);
      }
    };

    fetchSolarData();
  }, [timeframe]);

  const formatValue = (value: number, mode: DisplayMode): string => {
    const sign = value >= 0 ? '+' : '';
    if (mode === 'cost') {
      return `${sign}€${Math.abs(value).toFixed(2)}`;
    }
    return `${sign}${value.toFixed(2)}`;
  };

  const getTimeframeLabel = (tf: Timeframe): string => {
    switch (tf) {
      case 'day':
        return 'Current Day';
      case 'yesterday':
        return 'Yesterday';
      case 'week':
        return 'Last 7 Days';
      case 'month':
        return 'Current Month';
    }
  };

  // Calculate costs for consumption chart data
  const consumptionChartData = consumptionData.map((point) => {
    const value = displayMode === 'cost' 
      ? calculateConsumptionCost(point.kwh, point.timestamp, energySettings)
      : point.kwh;
    return {
      ...point,
      value,
    };
  });

  // Calculate consumption total value: sum costs of all data points in cost mode, otherwise use total kWh
  const consumptionTotalValue = displayMode === 'cost'
    ? consumptionChartData.reduce((sum, point) => sum + point.value, 0)
    : consumptionTotal;

  // Calculate costs for feed-in chart data
  const feedInChartData = feedInData.map((point) => {
    const value = displayMode === 'cost' 
      ? calculateFeedInCost(point.kwh, energySettings)
      : point.kwh;
    return {
      ...point,
      value,
    };
  });

  // Calculate feed-in total value: sum costs of all data points in cost mode, otherwise use total kWh
  const feedInTotalValue = displayMode === 'cost'
    ? feedInChartData.reduce((sum, point) => sum + point.value, 0)
    : feedInTotal;

  // Calculate car energy costs if in cost mode
  const carChartData = carData.map((point) => {
    // Car consumption is always positive, so use consuming price
    const value = displayMode === 'cost' 
      ? calculateConsumptionCost(point.kwh, point.timestamp, energySettings)
      : point.kwh;
    return {
      ...point,
      value,
    };
  });

  // Calculate car total value: sum costs of all data points in cost mode, otherwise use total kWh
  const carTotalValue = displayMode === 'cost'
    ? carChartData.reduce((sum, point) => sum + point.value, 0)
    : carTotal;

  // Calculate solar energy costs if in cost mode
  // Solar production is always positive, so use producing_price
  const solarChartData = solarData.map((point) => {
    const value = displayMode === 'cost' 
      ? point.kwh * (energySettings?.producing_price ?? 0)
      : point.kwh;
    return {
      ...point,
      value,
    };
  });

  // Calculate solar total value: sum costs of all data points in cost mode, otherwise use total kWh
  const solarTotalValue = displayMode === 'cost'
    ? solarChartData.reduce((sum, point) => sum + point.value, 0)
    : solarTotal;

  return (
    <div className="container mx-auto p-6 max-w-6xl">
      {/* Timeframe Selector and Display Mode Toggle */}
      <div className="mb-6 flex justify-between items-center">
        <div className="flex gap-2">
          {(['kwh', 'cost'] as DisplayMode[]).map((mode) => (
            <button
              key={mode}
              onClick={() => setDisplayMode(mode)}
              className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                displayMode === mode
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-muted text-muted-foreground hover:bg-muted/80'
              }`}
            >
              {mode === 'kwh' ? 'kWh' : '€'}
            </button>
          ))}
        </div>
        <div className="flex gap-2">
          {(['day', 'yesterday', 'week', 'month'] as Timeframe[]).map((tf) => (
            <button
              key={tf}
              onClick={() => setTimeframe(tf)}
              className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                timeframe === tf
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-muted text-muted-foreground hover:bg-muted/80'
              }`}
            >
              {getTimeframeLabel(tf)}
            </button>
          ))}
        </div>
      </div>

      {/* Total Energy Cards - Side by Side */}
      <div className="mb-6 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {/* Grid Energy Consumption Card */}
        <Card>
          <CardHeader>
            <CardTitle>Grid Energy Consumption</CardTitle>
            <CardDescription>
              {displayMode === 'cost' 
                ? `Total cost for energy consumed from the grid for ${getTimeframeLabel(timeframe).toLowerCase()}`
                : `Total energy consumed from the grid for ${getTimeframeLabel(timeframe).toLowerCase()}`
              }
            </CardDescription>
          </CardHeader>
          <CardContent>
            {consumptionError ? (
              <div className="p-3 bg-destructive/10 text-destructive rounded-md">
                {consumptionError}
              </div>
            ) : consumptionLoading || (displayMode === 'cost' && settingsLoading) ? (
              <p className="text-muted-foreground">Loading...</p>
            ) : (
              <div className="text-4xl font-bold">
                <span 
                  style={{ 
                    color: 'hsl(var(--chart-1))'
                  }}
                >
                  {formatValue(consumptionTotalValue, displayMode)} {displayMode === 'kwh' ? 'kWh' : ''}
                </span>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Grid Energy Feed-In Card */}
        <Card>
          <CardHeader>
            <CardTitle>Grid Energy Feed-In</CardTitle>
            <CardDescription>
              {displayMode === 'cost' 
                ? `Total cost for energy fed back to the grid for ${getTimeframeLabel(timeframe).toLowerCase()}`
                : `Total energy fed back to the grid for ${getTimeframeLabel(timeframe).toLowerCase()}`
              }
            </CardDescription>
          </CardHeader>
          <CardContent>
            {feedInError ? (
              <div className="p-3 bg-destructive/10 text-destructive rounded-md">
                {feedInError}
              </div>
            ) : feedInLoading || (displayMode === 'cost' && settingsLoading) ? (
              <p className="text-muted-foreground">Loading...</p>
            ) : (
              <div className="text-4xl font-bold">
                <span 
                  style={{ 
                    color: 'hsl(var(--chart-2))'
                  }}
                >
                  {formatValue(feedInTotalValue, displayMode)} {displayMode === 'kwh' ? 'kWh' : ''}
                </span>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Car Energy Consumption Card */}
        <Card>
          <CardHeader>
            <CardTitle>Car Energy Consumption</CardTitle>
            <CardDescription>
              {displayMode === 'cost' 
                ? `Total cost for car energy consumption for ${getTimeframeLabel(timeframe).toLowerCase()}`
                : `Total car energy consumption for ${getTimeframeLabel(timeframe).toLowerCase()}`
              }
            </CardDescription>
          </CardHeader>
          <CardContent>
            {carError ? (
              <div className="p-3 bg-destructive/10 text-destructive rounded-md">
                {carError}
              </div>
            ) : carLoading || (displayMode === 'cost' && settingsLoading) ? (
              <p className="text-muted-foreground">Loading...</p>
            ) : (
              <div className="text-4xl font-bold">
                <span 
                  style={{ 
                    color: 'hsl(var(--chart-1))' // Car consumption is always positive
                  }}
                >
                  {formatValue(carTotalValue, displayMode)} {displayMode === 'kwh' ? 'kWh' : ''}
                </span>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Solar Energy Production Card */}
        <Card>
          <CardHeader>
            <CardTitle>Solar Energy Production</CardTitle>
            <CardDescription>
              {displayMode === 'cost' 
                ? `Total cost for solar energy production for ${getTimeframeLabel(timeframe).toLowerCase()}`
                : `Total solar energy production for ${getTimeframeLabel(timeframe).toLowerCase()}`
              }
            </CardDescription>
          </CardHeader>
          <CardContent>
            {solarError ? (
              <div className="p-3 bg-destructive/10 text-destructive rounded-md">
                {solarError}
              </div>
            ) : solarLoading || (displayMode === 'cost' && settingsLoading) ? (
              <p className="text-muted-foreground">Loading...</p>
            ) : (
              <div className="text-4xl font-bold">
                <span 
                  style={{ 
                    color: 'hsl(var(--chart-1))' // Solar production is always positive
                  }}
                >
                  {formatValue(solarTotalValue, displayMode)} {displayMode === 'kwh' ? 'kWh' : ''}
                </span>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Bar Chart Card */}
      <Card>
        <CardHeader>
          <div>
            <CardTitle>Grid Energy Consumption</CardTitle>
            <CardDescription>
              {displayMode === 'cost' 
                ? 'Cost for energy consumed from the grid'
                : 'Energy consumed from the grid'
              }
            </CardDescription>
          </div>
        </CardHeader>
        <CardContent>
          {consumptionError && (
            <div className="mb-4 p-3 bg-destructive/10 text-destructive rounded-md">
              {consumptionError}
            </div>
          )}
          {consumptionLoading ? (
            <div className="flex items-center justify-center h-[400px]">
              <p className="text-muted-foreground">Loading data...</p>
            </div>
          ) : consumptionChartData.length === 0 ? (
            <div className="flex items-center justify-center h-[400px]">
              <p className="text-muted-foreground">No data available for the selected timeframe</p>
            </div>
          ) : (
            <ChartContainer config={chartConfig} className="h-[400px]">
              <BarChart
                data={consumptionChartData}
                margin={{ top: 20, right: 30, left: 20, bottom: 5 }}
              >
                <XAxis
                  dataKey="label"
                  tickLine={false}
                  axisLine={false}
                  tickMargin={8}
                  angle={timeframe === 'day' || timeframe === 'yesterday' ? 0 : -45}
                  textAnchor={timeframe === 'day' || timeframe === 'yesterday' ? 'middle' : 'end'}
                  height={timeframe === 'day' || timeframe === 'yesterday' ? 30 : 60}
                />
                <YAxis
                  tickLine={false}
                  axisLine={false}
                  tickMargin={8}
                  tickFormatter={(value) => {
                    if (displayMode === 'cost') {
                      return `€${value.toFixed(2)}`;
                    }
                    return `${value.toFixed(1)}`;
                  }}
                  label={displayMode === 'cost' ? { value: 'Cost (€)', angle: -90, position: 'insideLeft' } : undefined}
                />
                <ChartTooltip
                  content={(props) => {
                    if (!props.active || !props.payload || props.payload.length === 0) {
                      return null;
                    }
                    // Destructure content out to avoid type conflicts when spreading props
                    const { content, ...tooltipProps } = props;
                    return (
                      <ChartTooltipContent
                        {...(tooltipProps as any)}
                        labelFormatter={(value) => {
                          // Get the label from the payload
                          const payload = props.payload?.[0]?.payload as (AggregatedDataPoint & { value: number }) | undefined;
                          return payload?.label || (typeof value === 'string' ? value : String(value));
                        }}
                        formatter={(value, name, item, index, payload) => {
                          // The payload parameter is actually item.payload (the data point), not the payload array
                          const data = (payload as unknown) as (AggregatedDataPoint & { value: number }) | undefined;
                          const formattedValue = formatValue(value as number, displayMode);
                          const unit = displayMode === 'kwh' ? 'kWh' : '';
                          
                          return (
                            <div className="flex items-baseline gap-2">
                              <span className="text-muted-foreground text-xs">
                                {displayMode === 'cost' ? 'Cost:' : 'Energy:'}
                              </span>
                              <span 
                                className="font-mono font-bold text-base"
                                style={{ color: 'hsl(var(--chart-1))' }}
                              >
                                {formattedValue} {unit}
                              </span>
                            </div>
                          );
                        }}
                      />
                    );
                  }}
                />
                <Bar
                  dataKey="value"
                  name={displayMode === 'cost' ? 'Cost' : 'Energy'}
                  radius={[4, 4, 0, 0]}
                  fill="hsl(var(--chart-1))"
                />
              </BarChart>
            </ChartContainer>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

