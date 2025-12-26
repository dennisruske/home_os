import { NextRequest, NextResponse } from 'next/server';
import { getEnergyReadingsForRange } from '@/lib/db';
import { getEnergyService } from '@/lib/services/energy-service';

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const timeframe = searchParams.get('timeframe') || 'day';
    const customStart = searchParams.get('start');
    const customEnd = searchParams.get('end');

    let start: number | undefined;
    let end: number | undefined;

    if (customStart && customEnd) {
      start = parseInt(customStart, 10);
      end = parseInt(customEnd, 10);
    }

    // Determine time bounds
    let startTimestamp: number;
    let endTimestamp: number;

    if (start !== undefined && end !== undefined) {
      startTimestamp = start;
      endTimestamp = end;
    } else {
      const { getTimeframeBounds } = await import('@/lib/energy-aggregation');
      const bounds = getTimeframeBounds(timeframe);
      startTimestamp = bounds.start;
      endTimestamp = bounds.end;
    }

    // Fetch readings for the time range
    const readings = await getEnergyReadingsForRange(startTimestamp, endTimestamp);

    // Use EnergyService to aggregate data
    const energyService = getEnergyService();
    const result = energyService.aggregateEnergyData(readings, timeframe, 'grid');

    return NextResponse.json(result);
  } catch (error) {
    console.error('Error aggregating energy data:', error);
    return NextResponse.json(
      { error: 'Failed to aggregate energy data' },
      { status: 500 }
    );
  }
}

