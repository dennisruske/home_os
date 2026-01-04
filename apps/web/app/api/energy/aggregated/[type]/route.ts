import { NextRequest, NextResponse } from 'next/server';
import { handleAggregatedEnergyRequest } from '@/lib/api/aggregated-energy-handler';

/**
 * Dynamic route handler for aggregated energy data by type.
 * Handles requests to /api/energy/aggregated/[type]
 * where type must be 'grid', 'car', or 'solar'
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ type: string }> }
) {
  const { type } = await params;

  // Validate type parameter
  if (type !== 'grid' && type !== 'car' && type !== 'solar') {
    return NextResponse.json(
      { error: `Invalid energy type: ${type}. Must be 'grid', 'car', or 'solar'` },
      { status: 400 }
    );
  }

  return handleAggregatedEnergyRequest(request, type);
}

