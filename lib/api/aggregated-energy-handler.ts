import { NextRequest, NextResponse } from 'next/server';
import { createServiceContainer } from '@/lib/services/service-container';

/**
 * Handles aggregated energy data requests for grid, car, or solar energy types.
 * Extracts common request processing logic from route handlers.
 *
 * @param request - Next.js request object
 * @param type - Energy type: 'grid', 'car', or 'solar'
 * @returns NextResponse with aggregated energy data or error
 */
export async function handleAggregatedEnergyRequest(
  request: NextRequest,
  type: 'grid' | 'car' | 'solar'
): Promise<NextResponse> {
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

    // Use EnergyService to get aggregated data (with caching and bucket optimization)
    const { energyService } = createServiceContainer();
    const result = await energyService.getAggregatedEnergyData(startTimestamp, endTimestamp, timeframe, type);

    return NextResponse.json(result);
  } catch (error) {
    console.error(`Error aggregating ${type} energy data:`, error);
    return NextResponse.json(
      { error: `Failed to aggregate ${type} energy data` },
      { status: 500 }
    );
  }
}

