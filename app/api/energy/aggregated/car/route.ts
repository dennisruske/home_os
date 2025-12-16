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
  readings: Array<{ timestamp: number; car: number }>
): AggregatedDataPoint[] {
  if (readings.length === 0) {
    return [];
  }

  // Group readings by hour
  const hourBuckets = new Map<number, Array<{ timestamp: number; car: number }>>();

  for (const reading of readings) {
    // Only process positive car consumption
    if (reading.car <= 0) {
      continue;
    }

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
      // Not enough data for integration, skip
      continue;
    }

    // Sort readings by timestamp within the bucket
    bucketReadings.sort((a, b) => a.timestamp - b.timestamp);

    // Trapezoidal integration - only for positive values
    let totalEnergyWh = 0;

    for (let i = 0; i < bucketReadings.length - 1; i++) {
      const power1 = Math.max(0, bucketReadings[i].car); // watts, ensure positive
      const power2 = Math.max(0, bucketReadings[i + 1].car); // watts, ensure positive
      const timeDelta = bucketReadings[i + 1].timestamp - bucketReadings[i].timestamp; // seconds

      // Average power * time = energy (watt-seconds)
      const energyWs = ((power1 + power2) / 2) * timeDelta;
      totalEnergyWh += energyWs / 3600; // Convert to watt-hours
    }

    const kwh = totalEnergyWh / 1000; // Convert to kilowatt-hours

    // Only add positive consumption
    if (kwh > 0) {
      const date = new Date(hourTimestamp * 1000);
      const hour = date.getHours();
      result.push({
        label: `${hour.toString().padStart(2, '0')}:00`,
        kwh,
        timestamp: hourTimestamp,
      });
    }
  }

  // Sort by timestamp
  result.sort((a, b) => a.timestamp - b.timestamp);

  return result;
}

function aggregateByDay(
  readings: Array<{ timestamp: number; car: number }>
): AggregatedDataPoint[] {
  if (readings.length === 0) {
    return [];
  }

  // Group readings by day
  const dayBuckets = new Map<number, Array<{ timestamp: number; car: number }>>();

  for (const reading of readings) {
    // Only process positive car consumption
    if (reading.car <= 0) {
      continue;
    }

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

    // Trapezoidal integration - only for positive values
    let totalEnergyWh = 0;

    for (let i = 0; i < bucketReadings.length - 1; i++) {
      const power1 = Math.max(0, bucketReadings[i].car); // watts, ensure positive
      const power2 = Math.max(0, bucketReadings[i + 1].car); // watts, ensure positive
      const timeDelta = bucketReadings[i + 1].timestamp - bucketReadings[i].timestamp; // seconds

      // Average power * time = energy (watt-seconds)
      const energyWs = ((power1 + power2) / 2) * timeDelta;
      totalEnergyWh += energyWs / 3600; // Convert to watt-hours
    }

    const kwh = totalEnergyWh / 1000; // Convert to kilowatt-hours

    // Only add positive consumption
    if (kwh > 0) {
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
  }

  // Sort by timestamp
  result.sort((a, b) => a.timestamp - b.timestamp);

  return result;
}

function calculateTotalEnergy(
  readings: Array<{ timestamp: number; car: number }>
): number {
  // Filter for positive car consumption only
  const positiveReadings = readings.filter((r) => r.car > 0);

  if (positiveReadings.length < 2) {
    return 0;
  }

  // Sort readings by timestamp
  const sortedReadings = [...positiveReadings].sort((a, b) => a.timestamp - b.timestamp);

  // Trapezoidal integration over all readings - only positive values
  let totalEnergyWh = 0;

  for (let i = 0; i < sortedReadings.length - 1; i++) {
    const power1 = Math.max(0, sortedReadings[i].car); // watts, ensure positive
    const power2 = Math.max(0, sortedReadings[i + 1].car); // watts, ensure positive
    const timeDelta = sortedReadings[i + 1].timestamp - sortedReadings[i].timestamp; // seconds

    // Average power * time = energy (watt-seconds)
    const energyWs = ((power1 + power2) / 2) * timeDelta;
    totalEnergyWh += energyWs / 3600; // Convert to watt-hours
  }

  const kwh = totalEnergyWh / 1000; // Convert to kilowatt-hours
  return Math.max(0, kwh); // Ensure non-negative
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
      return NextResponse.json({ data: [], total: 0 });
    }

    // Map to car readings
    const carReadings = readings.map((r) => ({
      timestamp: r.timestamp,
      car: r.car,
    }));

    // Calculate total energy consumption using trapezoidal integration (only positive)
    const total = calculateTotalEnergy(carReadings);

    // Aggregate based on timeframe
    let aggregated: AggregatedDataPoint[];

    if (timeframe === 'day' || timeframe === 'yesterday') {
      aggregated = aggregateByHour(carReadings);
    } else {
      // week or month - aggregate by day
      aggregated = aggregateByDay(carReadings);
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
