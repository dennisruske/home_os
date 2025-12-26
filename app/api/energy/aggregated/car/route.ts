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

    // Map to car readings
    const carReadings = readings.map((r) => ({
      timestamp: r.timestamp,
      car: r.car,
    }));

    // Calculate total energy consumption using trapezoidal integration (only positive)
    const total = calculateTotalEnergy(carReadings, (r) => r.car, (car) => car > 0);

    // Aggregate based on timeframe
    let aggregated: AggregatedDataPoint[];

    if (timeframe === 'day' || timeframe === 'yesterday') {
      aggregated = aggregateByHour(carReadings, (r) => r.car, (car) => car > 0);
    } else {
      // week or month - aggregate by day
      aggregated = aggregateByDay(carReadings, (r) => r.car, (car) => car > 0);
    }

    return NextResponse.json({ data: aggregated, total });
  } catch (error) {
    console.error('Error aggregating car energy data:', error);
    return NextResponse.json(
      { error: 'Failed to aggregate car energy data' },
      { status: 500 }
    );
  }
}
