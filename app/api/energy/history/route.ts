import { NextRequest, NextResponse } from 'next/server';
import { getEnergyReadings } from '@/lib/db';

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    
    // Parse query parameters
    const limit = parseInt(searchParams.get('limit') || '100', 10);
    const offset = parseInt(searchParams.get('offset') || '0', 10);
    
    // Parse date range (Unix timestamps)
    const fromParam = searchParams.get('from');
    const toParam = searchParams.get('to');
    const from = fromParam ? parseInt(fromParam, 10) : undefined;
    const to = toParam ? parseInt(toParam, 10) : undefined;

    // Validate parameters
    if (isNaN(limit) || limit < 1 || limit > 1000) {
      return NextResponse.json(
        { error: 'Invalid limit parameter. Must be between 1 and 1000.' },
        { status: 400 }
      );
    }

    if (isNaN(offset) || offset < 0) {
      return NextResponse.json(
        { error: 'Invalid offset parameter. Must be >= 0.' },
        { status: 400 }
      );
    }

    if ((from !== undefined && isNaN(from)) || (to !== undefined && isNaN(to))) {
      return NextResponse.json(
        { error: 'Invalid date parameters. Must be Unix timestamps.' },
        { status: 400 }
      );
    }

    // Query database
    const readings = await getEnergyReadings(limit, offset, from, to);

    return NextResponse.json({
      data: readings,
      limit,
      offset,
      count: readings.length,
    });
  } catch (error) {
    console.error('Error fetching energy history:', error);
    return NextResponse.json(
      { error: 'Failed to fetch energy history' },
      { status: 500 }
    );
  }
}

