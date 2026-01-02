import { NextRequest, NextResponse } from 'next/server';
import { createServiceContainer } from '@/lib/services/service-container';

/**
 * API route for running the energy aggregation job.
 * This endpoint should be called periodically (e.g., every minute via cron) to aggregate raw readings into buckets.
 * 
 * In production, protect this endpoint with:
 * - API key authentication
 * - Internal network restrictions
 * - Or use Vercel Cron with secret header validation
 */
export async function POST(request: NextRequest): Promise<NextResponse> {
    
    try {
    // Optional: Validate request (e.g., check for API key or secret header)
    // const authHeader = request.headers.get('authorization');
    // if (authHeader !== `Bearer ${process.env.AGGREGATION_JOB_SECRET}`) {
    //   return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    // }
    
    const { aggregationJob } = createServiceContainer();
    
    await aggregationJob.run();


    return NextResponse.json({ 
      status: 'success',
      message: 'Aggregation job completed successfully',
      timestamp: Math.floor(Date.now() / 1000),
    });
  } catch (error) {
    console.error('Error running aggregation job:', error);
    return NextResponse.json(
      { 
        status: 'error',
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

// Also support GET for easy testing
export async function GET(request: NextRequest): Promise<NextResponse> {
    console.log("test");
  return POST(request);
}


