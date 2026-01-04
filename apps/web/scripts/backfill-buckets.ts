#!/usr/bin/env tsx

/**
 * Backfill script to process all historical raw energy readings into buckets.
 * This should be run once after the buckets table migration is applied.
 * 
 * Usage:
 *   pnpm tsx scripts/backfill-buckets.ts
 * 
 * Or with ts-node:
 *   ts-node scripts/backfill-buckets.ts
 */

import { getPrismaClient } from '../lib/db';
import { createEnergyAggregationJob } from '../lib/services/energy-aggregation-job';

async function backfillBuckets() {
  console.log('Starting bucket backfill...');

  const prisma = getPrismaClient();
  const aggregationJob = createEnergyAggregationJob(prisma);

  try {
    // Get earliest and latest timestamps from raw readings
    const earliestReading = await prisma.energyReading.findFirst({
      orderBy: { timestamp: 'asc' },
      select: { timestamp: true },
    });

    const latestReading = await prisma.energyReading.findFirst({
      orderBy: { timestamp: 'desc' },
      select: { timestamp: true },
    });

    if (!earliestReading || !latestReading) {
      console.log('No readings found in database. Nothing to backfill.');
      return;
    }

    console.log(`Found readings from ${new Date(earliestReading.timestamp * 1000).toISOString()} to ${new Date(latestReading.timestamp * 1000).toISOString()}`);

    // Round to minute boundaries
    const firstBucketStart = Math.floor(earliestReading.timestamp / 60) * 60;
    const lastBucketStart = Math.floor(latestReading.timestamp / 60) * 60;

    console.log(`Processing buckets from ${new Date(firstBucketStart * 1000).toISOString()} to ${new Date(lastBucketStart * 1000).toISOString()}`);

    let currentBucketStart = firstBucketStart;
    let processedCount = 0;
    const totalBuckets = Math.floor((lastBucketStart - firstBucketStart) / 60) + 1;

    console.log(`Total buckets to process: ${totalBuckets}`);

    // Process buckets in batches
    while (currentBucketStart <= lastBucketStart) {
      try {
        await aggregationJob.aggregateBucket(currentBucketStart);
        processedCount++;

        // Log progress every 100 buckets
        if (processedCount % 100 === 0) {
          const progress = ((processedCount / totalBuckets) * 100).toFixed(1);
          console.log(`Progress: ${processedCount}/${totalBuckets} buckets (${progress}%)`);
        }
      } catch (error) {
        console.error(`Error processing bucket ${currentBucketStart}:`, error);
        // Continue with next bucket
      }

      currentBucketStart += 60;
    }

    console.log(`Backfill complete! Processed ${processedCount} buckets.`);

    // Refresh materialized views
    console.log('Refreshing materialized views...');
    await aggregationJob.refreshMaterializedViews();
    console.log('Materialized views refreshed.');

  } catch (error) {
    console.error('Error during backfill:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

// Run the backfill
backfillBuckets()
  .then(() => {
    console.log('Backfill script completed successfully.');
    process.exit(0);
  })
  .catch((error) => {
    console.error('Backfill script failed:', error);
    process.exit(1);
  });

