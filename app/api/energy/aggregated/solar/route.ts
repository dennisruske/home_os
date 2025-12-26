import { NextRequest, NextResponse } from 'next/server';
import { getEnergyReadingsForRange } from '@/lib/db';
import {
  getTimeframeBounds,
  aggregateByHour,
  aggregateByDay,
  calculateTotalEnergy,
} from '@/lib/energy-aggregation';
import type { AggregatedDataPoint } from '@/types/energy';

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const timeframe = searchParams.get('timeframe') || 'day';
    const customStart = searchParams.get('start');
    const customEnd = searchParams.get('end');

    let start: number;
    let end: number;

    if (customStart && customEnd) {
      start = parseInt(customStart, 10);
      end = parseInt(customEnd, 10);
    } else {
      const bounds = getTimeframeBounds(timeframe);
      start = bounds.start;
      end = bounds.end;
    }

    // Fetch readings for the time range
    const readings = await getEnergyReadingsForRange(start, end);

    if (readings.length === 0) {
      return NextResponse.json({ data: [], total: 0 });
    }

    // Map to solar readings
    const solarReadings = readings.map((r) => ({
      timestamp: r.timestamp,
      solar: r.solar,
    }));

    // Calculate total energy production using trapezoidal integration (only positive)
    const total = calculateTotalEnergy(solarReadings, (r) => r.solar, (solar) => solar > 0);

    // Aggregate based on timeframe
    let aggregated: AggregatedDataPoint[];

    if (timeframe === 'day' || timeframe === 'yesterday') {
      aggregated = aggregateByHour(solarReadings, (r) => r.solar, (solar) => solar > 0);
    } else {
      // week or month - aggregate by day
      aggregated = aggregateByDay(solarReadings, (r) => r.solar, (solar) => solar > 0);
    }

    return NextResponse.json({ data: aggregated, total });
  } catch (error) {
    console.error('Error aggregating solar energy data:', error);
    return NextResponse.json(
      { error: 'Failed to aggregate solar energy data' },
      { status: 500 }
    );
  }
}
