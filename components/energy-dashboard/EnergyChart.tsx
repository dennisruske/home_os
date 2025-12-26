'use client';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from '@/components/ui/chart';
import { Bar, BarChart, XAxis, YAxis } from 'recharts';
import type { AggregatedDataPoint } from '@/types/energy';
import type { DisplayMode, Timeframe } from './TimeframeSelector';

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

function formatValue(value: number, mode: DisplayMode): string {
  const sign = value >= 0 ? '+' : '';
  if (mode === 'cost') {
    return `${sign}€${Math.abs(value).toFixed(2)}`;
  }
  return `${sign}${value.toFixed(2)}`;
}

export interface EnergyChartProps {
  data: (AggregatedDataPoint & { value: number })[];
  displayMode: DisplayMode;
  timeframe: Timeframe;
  loading: boolean;
  error: string | null;
  title: string;
  description: string;
}

export function EnergyChart({
  data,
  displayMode,
  timeframe,
  loading,
  error,
  title,
  description,
}: EnergyChartProps) {
  return (
    <Card>
      <CardHeader>
        <div>
          <CardTitle>{title}</CardTitle>
          <CardDescription>{description}</CardDescription>
        </div>
      </CardHeader>
      <CardContent>
        {error && (
          <div className="mb-4 p-3 bg-destructive/10 text-destructive rounded-md">
            {error}
          </div>
        )}
        {loading ? (
          <div className="flex items-center justify-center h-[400px]">
            <p className="text-muted-foreground">Loading data...</p>
          </div>
        ) : data.length === 0 ? (
          <div className="flex items-center justify-center h-[400px]">
            <p className="text-muted-foreground">No data available for the selected timeframe</p>
          </div>
        ) : (
          <ChartContainer config={chartConfig} className="h-[400px]">
            <BarChart
              data={data}
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
  );
}

