'use client';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import type { DisplayMode } from './TimeframeSelector';
import { getTimeframeLabel, type Timeframe } from './TimeframeSelector';

export interface EnergyCardProps {
  title: string;
  description: string;
  value: number;
  displayMode: DisplayMode;
  timeframe: Timeframe;
  loading: boolean;
  error: string | null;
  color: string;
  settingsLoading?: boolean;
}

function formatValue(value: number, mode: DisplayMode): string {
  const sign = value >= 0 ? '+' : '';
  if (mode === 'cost') {
    return `${sign}€${Math.abs(value).toFixed(2)}`;
  }
  return `${sign}${value.toFixed(2)}`;
}

export function EnergyCard({
  title,
  description,
  value,
  displayMode,
  timeframe,
  loading,
  error,
  color,
  settingsLoading = false,
}: EnergyCardProps) {
  const isLoading = loading || (displayMode === 'cost' && settingsLoading);

  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent>
        {error ? (
          <div className="p-3 bg-destructive/10 text-destructive rounded-md">
            {error}
          </div>
        ) : isLoading ? (
          <p className="text-muted-foreground">Loading...</p>
        ) : (
          <div className="text-4xl font-bold">
            <span style={{ color }}>
              {formatValue(value, displayMode)} {displayMode === 'kwh' ? 'kWh' : ''}
            </span>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

