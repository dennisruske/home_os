import { NextRequest, NextResponse } from 'next/server';
import { getEnergyReadingsForRange } from '@/lib/db';
import {
  getTimeframeBounds,
  aggregateByHour,
  aggregateByDay,
  calculateTotalEnergy,
} from '@/lib/energy-aggregation';
import type { AggregatedDataPoint } from '@/types/energy';

function aggregateByHourConsumption(
  readings: Array<{ timestamp: number; grid: number }>
): AggregatedDataPoint[] {
  return aggregateByHour(readings, (r) => r.grid, (grid) => grid >= 0);
}

function aggregateByHourFeedIn(
  readings: Array<{ timestamp: number; grid: number }>
): AggregatedDataPoint[] {
  // For feed-in, we process negative values but convert them to positive for display
  const feedInReadings = readings.map((r) => ({
    timestamp: r.timestamp,
    grid: r.grid < 0 ? Math.abs(r.grid) : 0, // Convert negative to positive, ignore positive
  }));
  return aggregateByHour(feedInReadings, (r) => r.grid, (grid) => grid > 0);
}

function aggregateByDayConsumption(
  readings: Array<{ timestamp: number; grid: number }>
): AggregatedDataPoint[] {
  return aggregateByDay(readings, (r) => r.grid, (grid) => grid >= 0);
}

function aggregateByDayFeedIn(
  readings: Array<{ timestamp: number; grid: number }>
): AggregatedDataPoint[] {
  // For feed-in, we process negative values but convert them to positive for display
  const feedInReadings = readings.map((r) => ({
    timestamp: r.timestamp,
    grid: r.grid < 0 ? Math.abs(r.grid) : 0, // Convert negative to positive, ignore positive
  }));
  return aggregateByDay(feedInReadings, (r) => r.grid, (grid) => grid > 0);
}

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
      return NextResponse.json({
        consumption: { data: [], total: 0 },
        feedIn: { data: [], total: 0 },
      });
    }

    // Prepare feed-in readings (convert negative to positive, ignore positive)
    const feedInReadings = readings.map((r) => ({
      timestamp: r.timestamp,
      grid: r.grid < 0 ? Math.abs(r.grid) : 0,
    }));

    // Calculate totals: consumption (positive only) and feed-in (absolute of negative)
    const consumptionTotal = calculateTotalEnergy(readings, (r) => r.grid, (grid) => grid >= 0);
    const feedInTotal = calculateTotalEnergy(feedInReadings, (r) => r.grid, (grid) => grid > 0);

    // Aggregate based on timeframe
    let consumptionAggregated: AggregatedDataPoint[];
    let feedInAggregated: AggregatedDataPoint[];

    if (timeframe === 'day' || timeframe === 'yesterday') {
      consumptionAggregated = aggregateByHourConsumption(readings);
      feedInAggregated = aggregateByHourFeedIn(readings);
    } else {
      // week or month - aggregate by day
      consumptionAggregated = aggregateByDayConsumption(readings);
      feedInAggregated = aggregateByDayFeedIn(readings);
    }

    return NextResponse.json({
      consumption: {
        data: consumptionAggregated,
        total: consumptionTotal,
      },
      feedIn: {
        data: feedInAggregated,
        total: feedInTotal,
      },
    });
  } catch (error) {
    console.error('Error aggregating energy data:', error);
    return NextResponse.json(
      { error: 'Failed to aggregate energy data' },
      { status: 500 }
    );
  }
}

