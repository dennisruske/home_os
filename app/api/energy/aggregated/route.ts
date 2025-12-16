import { NextRequest, NextResponse } from 'next/server';
import { getEnergyReadingsForRange } from '@/lib/db';

interface AggregatedDataPoint {
  label: string;
  kwh: number;
  timestamp: number;
}

function getTimeframeBounds(timeframe: string): { start: number; end: number } {
  const now = new Date();
  let end = Math.floor(now.getTime() / 1000); // Current time in Unix seconds

  let start: number;

  switch (timeframe) {
    case 'day': {
      // Start of current day (00:00:00)
      const startOfDay = new Date(now);
      startOfDay.setHours(0, 0, 0, 0);
      start = Math.floor(startOfDay.getTime() / 1000);
      break;
    }
    case 'yesterday': {
      // Start of yesterday (00:00:00 yesterday)
      const yesterday = new Date(now);
      yesterday.setDate(yesterday.getDate() - 1);
      yesterday.setHours(0, 0, 0, 0);
      start = Math.floor(yesterday.getTime() / 1000);
      // End of yesterday (start of today)
      const startOfToday = new Date(now);
      startOfToday.setHours(0, 0, 0, 0);
      end = Math.floor(startOfToday.getTime() / 1000);
      break;
    }
    case 'week': {
      // 7 days ago
      const sevenDaysAgo = new Date(now);
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
      sevenDaysAgo.setHours(0, 0, 0, 0);
      start = Math.floor(sevenDaysAgo.getTime() / 1000);
      break;
    }
    case 'month': {
      // Start of current month
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
      startOfMonth.setHours(0, 0, 0, 0);
      start = Math.floor(startOfMonth.getTime() / 1000);
      break;
    }
    default:
      throw new Error(`Invalid timeframe: ${timeframe}`);
  }

  return { start, end };
}

function aggregateByHour(
  readings: Array<{ timestamp: number; grid: number }>,
  filterFn?: (grid: number) => boolean
): AggregatedDataPoint[] {
  if (readings.length === 0) {
    return [];
  }

  // Filter readings if filter function is provided
  const filteredReadings = filterFn
    ? readings.filter((r) => filterFn(r.grid))
    : readings;

  if (filteredReadings.length === 0) {
    return [];
  }

  // Group readings by hour
  const hourBuckets = new Map<number, Array<{ timestamp: number; grid: number }>>();

  for (const reading of filteredReadings) {
    const date = new Date(reading.timestamp * 1000);
    const hour = date.getHours();
    const hourKey = Math.floor(reading.timestamp / 3600) * 3600; // Round down to hour

    if (!hourBuckets.has(hourKey)) {
      hourBuckets.set(hourKey, []);
    }
    hourBuckets.get(hourKey)!.push(reading);
  }

  const result: AggregatedDataPoint[] = [];

  // Process each hour bucket
  for (const [hourTimestamp, bucketReadings] of hourBuckets.entries()) {
    if (bucketReadings.length < 2) {
      // Not enough data for integration, skip or use single value
      continue;
    }

    // Sort readings by timestamp within the bucket
    bucketReadings.sort((a, b) => a.timestamp - b.timestamp);

    // Trapezoidal integration
    let totalEnergyWh = 0;

    for (let i = 0; i < bucketReadings.length - 1; i++) {
      const power1 = bucketReadings[i].grid; // watts
      const power2 = bucketReadings[i + 1].grid; // watts
      const timeDelta = bucketReadings[i + 1].timestamp - bucketReadings[i].timestamp; // seconds

      // Average power * time = energy (watt-seconds)
      const energyWs = ((power1 + power2) / 2) * timeDelta;
      totalEnergyWh += energyWs / 3600; // Convert to watt-hours
    }

    const kwh = totalEnergyWh / 1000; // Convert to kilowatt-hours

    const date = new Date(hourTimestamp * 1000);
    const hour = date.getHours();
    result.push({
      label: `${hour.toString().padStart(2, '0')}:00`,
      kwh,
      timestamp: hourTimestamp,
    });
  }

  // Sort by timestamp
  result.sort((a, b) => a.timestamp - b.timestamp);

  return result;
}

function aggregateByHourConsumption(
  readings: Array<{ timestamp: number; grid: number }>
): AggregatedDataPoint[] {
  return aggregateByHour(readings, (grid) => grid >= 0);
}

function aggregateByHourFeedIn(
  readings: Array<{ timestamp: number; grid: number }>
): AggregatedDataPoint[] {
  // For feed-in, we process negative values but convert them to positive for display
  const feedInReadings = readings.map((r) => ({
    timestamp: r.timestamp,
    grid: r.grid < 0 ? Math.abs(r.grid) : 0, // Convert negative to positive, ignore positive
  }));
  return aggregateByHour(feedInReadings, (grid) => grid > 0);
}

function aggregateByDay(
  readings: Array<{ timestamp: number; grid: number }>,
  filterFn?: (grid: number) => boolean
): AggregatedDataPoint[] {
  if (readings.length === 0) {
    return [];
  }

  // Filter readings if filter function is provided
  const filteredReadings = filterFn
    ? readings.filter((r) => filterFn(r.grid))
    : readings;

  if (filteredReadings.length === 0) {
    return [];
  }

  // Group readings by day
  const dayBuckets = new Map<number, Array<{ timestamp: number; grid: number }>>();

  for (const reading of filteredReadings) {
    const date = new Date(reading.timestamp * 1000);
    // Get start of day timestamp
    const dayStart = new Date(date.getFullYear(), date.getMonth(), date.getDate());
    const dayKey = Math.floor(dayStart.getTime() / 1000);

    if (!dayBuckets.has(dayKey)) {
      dayBuckets.set(dayKey, []);
    }
    dayBuckets.get(dayKey)!.push(reading);
  }

  const result: AggregatedDataPoint[] = [];

  // Process each day bucket
  for (const [dayTimestamp, bucketReadings] of dayBuckets.entries()) {
    if (bucketReadings.length < 2) {
      // Not enough data for integration, skip
      continue;
    }

    // Sort readings by timestamp within the bucket
    bucketReadings.sort((a, b) => a.timestamp - b.timestamp);

    // Trapezoidal integration
    let totalEnergyWh = 0;

    for (let i = 0; i < bucketReadings.length - 1; i++) {
      const power1 = bucketReadings[i].grid; // watts
      const power2 = bucketReadings[i + 1].grid; // watts
      const timeDelta = bucketReadings[i + 1].timestamp - bucketReadings[i].timestamp; // seconds

      // Average power * time = energy (watt-seconds)
      const energyWs = ((power1 + power2) / 2) * timeDelta;
      totalEnergyWh += energyWs / 3600; // Convert to watt-hours
    }

    const kwh = totalEnergyWh / 1000; // Convert to kilowatt-hours

    const date = new Date(dayTimestamp * 1000);
    const dayLabel = date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
    });

    result.push({
      label: dayLabel,
      kwh,
      timestamp: dayTimestamp,
    });
  }

  // Sort by timestamp
  result.sort((a, b) => a.timestamp - b.timestamp);

  return result;
}

function aggregateByDayConsumption(
  readings: Array<{ timestamp: number; grid: number }>
): AggregatedDataPoint[] {
  return aggregateByDay(readings, (grid) => grid >= 0);
}

function aggregateByDayFeedIn(
  readings: Array<{ timestamp: number; grid: number }>
): AggregatedDataPoint[] {
  // For feed-in, we process negative values but convert them to positive for display
  const feedInReadings = readings.map((r) => ({
    timestamp: r.timestamp,
    grid: r.grid < 0 ? Math.abs(r.grid) : 0, // Convert negative to positive, ignore positive
  }));
  return aggregateByDay(feedInReadings, (grid) => grid > 0);
}

function calculateTotalEnergy(
  readings: Array<{ timestamp: number; grid: number }>,
  filterFn?: (grid: number) => boolean
): number {
  if (readings.length < 2) {
    return 0;
  }

  // Filter readings if filter function is provided
  const filteredReadings = filterFn
    ? readings.filter((r) => filterFn(r.grid))
    : readings;

  if (filteredReadings.length < 2) {
    return 0;
  }

  // Sort readings by timestamp
  const sortedReadings = [...filteredReadings].sort((a, b) => a.timestamp - b.timestamp);

  // Trapezoidal integration over all readings
  let totalEnergyWh = 0;

  for (let i = 0; i < sortedReadings.length - 1; i++) {
    const power1 = sortedReadings[i].grid; // watts
    const power2 = sortedReadings[i + 1].grid; // watts
    const timeDelta = sortedReadings[i + 1].timestamp - sortedReadings[i].timestamp; // seconds

    // Average power * time = energy (watt-seconds)
    const energyWs = ((power1 + power2) / 2) * timeDelta;
    totalEnergyWh += energyWs / 3600; // Convert to watt-hours
  }

  const kwh = totalEnergyWh / 1000; // Convert to kilowatt-hours
  return kwh;
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
    const consumptionTotal = calculateTotalEnergy(readings, (grid) => grid >= 0);
    const feedInTotal = calculateTotalEnergy(feedInReadings, (grid) => grid > 0);

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

