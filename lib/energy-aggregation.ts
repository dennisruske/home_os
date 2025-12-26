import type { AggregatedDataPoint } from '@/types/energy';

/**
 * Calculates the start and end timestamps for a given timeframe.
 * @param timeframe - One of 'day', 'yesterday', 'week', 'month'
 * @returns Object with start and end timestamps (Unix seconds)
 */
export function getTimeframeBounds(timeframe: string): { start: number; end: number } {
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

/**
 * Aggregates readings by hour using trapezoidal integration.
 * @param readings - Array of reading objects with timestamp
 * @param extractor - Function to extract the numeric value from each reading
 * @param filterFn - Optional function to filter readings by their extracted value
 * @returns Array of aggregated data points with hourly labels
 */
export function aggregateByHour<T>(
  readings: T[],
  extractor: (reading: T) => number,
  filterFn?: (value: number) => boolean
): AggregatedDataPoint[] {
  if (readings.length === 0) {
    return [];
  }

  // Filter readings if filter function is provided
  const filteredReadings = filterFn
    ? readings.filter((r) => {
        const value = extractor(r);
        return filterFn(value);
      })
    : readings;

  if (filteredReadings.length === 0) {
    return [];
  }

  // Group readings by hour
  const hourBuckets = new Map<number, T[]>();

  for (const reading of filteredReadings) {
    const timestamp = (reading as any).timestamp as number;
    const hourKey = Math.floor(timestamp / 3600) * 3600; // Round down to hour

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
    bucketReadings.sort((a, b) => {
      const timestampA = (a as any).timestamp as number;
      const timestampB = (b as any).timestamp as number;
      return timestampA - timestampB;
    });

    // Trapezoidal integration
    let totalEnergyWh = 0;

    for (let i = 0; i < bucketReadings.length - 1; i++) {
      const power1 = extractor(bucketReadings[i]); // watts
      const power2 = extractor(bucketReadings[i + 1]); // watts
      const timestamp1 = (bucketReadings[i] as any).timestamp as number;
      const timestamp2 = (bucketReadings[i + 1] as any).timestamp as number;
      const timeDelta = timestamp2 - timestamp1; // seconds

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

/**
 * Aggregates readings by day using trapezoidal integration.
 * @param readings - Array of reading objects with timestamp
 * @param extractor - Function to extract the numeric value from each reading
 * @param filterFn - Optional function to filter readings by their extracted value
 * @returns Array of aggregated data points with daily labels
 */
export function aggregateByDay<T>(
  readings: T[],
  extractor: (reading: T) => number,
  filterFn?: (value: number) => boolean
): AggregatedDataPoint[] {
  if (readings.length === 0) {
    return [];
  }

  // Filter readings if filter function is provided
  const filteredReadings = filterFn
    ? readings.filter((r) => {
        const value = extractor(r);
        return filterFn(value);
      })
    : readings;

  if (filteredReadings.length === 0) {
    return [];
  }

  // Group readings by day
  const dayBuckets = new Map<number, T[]>();

  for (const reading of filteredReadings) {
    const timestamp = (reading as any).timestamp as number;
    const date = new Date(timestamp * 1000);
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
    bucketReadings.sort((a, b) => {
      const timestampA = (a as any).timestamp as number;
      const timestampB = (b as any).timestamp as number;
      return timestampA - timestampB;
    });

    // Trapezoidal integration
    let totalEnergyWh = 0;

    for (let i = 0; i < bucketReadings.length - 1; i++) {
      const power1 = extractor(bucketReadings[i]); // watts
      const power2 = extractor(bucketReadings[i + 1]); // watts
      const timestamp1 = (bucketReadings[i] as any).timestamp as number;
      const timestamp2 = (bucketReadings[i + 1] as any).timestamp as number;
      const timeDelta = timestamp2 - timestamp1; // seconds

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

/**
 * Calculates total energy using trapezoidal integration over all readings.
 * @param readings - Array of reading objects with timestamp
 * @param extractor - Function to extract the numeric value from each reading
 * @param filterFn - Optional function to filter readings by their extracted value
 * @returns Total energy in kWh
 */
export function calculateTotalEnergy<T>(
  readings: T[],
  extractor: (reading: T) => number,
  filterFn?: (value: number) => boolean
): number {
  if (readings.length < 2) {
    return 0;
  }

  // Filter readings if filter function is provided
  const filteredReadings = filterFn
    ? readings.filter((r) => {
        const value = extractor(r);
        return filterFn(value);
      })
    : readings;

  if (filteredReadings.length < 2) {
    return 0;
  }

  // Sort readings by timestamp
  const sortedReadings = [...filteredReadings].sort((a, b) => {
    const timestampA = (a as any).timestamp as number;
    const timestampB = (b as any).timestamp as number;
    return timestampA - timestampB;
  });

  // Trapezoidal integration over all readings
  let totalEnergyWh = 0;

  for (let i = 0; i < sortedReadings.length - 1; i++) {
    const power1 = extractor(sortedReadings[i]); // watts
    const power2 = extractor(sortedReadings[i + 1]); // watts
    const timestamp1 = (sortedReadings[i] as any).timestamp as number;
    const timestamp2 = (sortedReadings[i + 1] as any).timestamp as number;
    const timeDelta = timestamp2 - timestamp1; // seconds

    // Average power * time = energy (watt-seconds)
    const energyWs = ((power1 + power2) / 2) * timeDelta;
    totalEnergyWh += energyWs / 3600; // Convert to watt-hours
  }

  const kwh = totalEnergyWh / 1000; // Convert to kilowatt-hours
  return kwh;
}

