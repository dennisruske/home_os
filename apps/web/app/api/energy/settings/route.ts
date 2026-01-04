import { NextRequest, NextResponse } from 'next/server';
import { createServiceContainer } from '@/lib/services/service-container';

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const atParam = searchParams.get('at');
    
    // If 'at' parameter is provided, get settings for that specific timestamp
    const timestamp = atParam ? parseInt(atParam, 10) : undefined;
    
    if (atParam && (isNaN(timestamp!) || timestamp! < 0)) {
      return NextResponse.json(
        { error: 'Invalid timestamp parameter' },
        { status: 400 }
      );
    }

    const { energySettingsService } = createServiceContainer();
    const settings = await energySettingsService.getActiveSettings(timestamp);
    
    if (!settings) {
      return NextResponse.json(
        { producing_price: 0, consuming_periods: [] },
        { status: 200 }
      );
    }

    return NextResponse.json({
      producing_price: settings.producing_price,
      consuming_periods: settings.consuming_periods || [],
      start_date: settings.start_date,
      end_date: settings.end_date,
    });
  } catch (error) {
    console.error('Error fetching energy settings:', error);
    return NextResponse.json(
      { error: 'Failed to fetch energy settings' },
      { status: 500 }
    );
  }
}

export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    console.log('PUT request body:', body);
    const { producing_price, consuming_periods, start_date } = body;

    // Validate producing_price
    if (
      typeof producing_price !== 'number' ||
      isNaN(producing_price)
    ) {
      console.error('Validation failed:', { producing_price, type: typeof producing_price });
      return NextResponse.json(
        { error: 'Invalid input: producing_price must be a number' },
        { status: 400 }
      );
    }

    if (producing_price < 0) {
      console.error('Negative producing price rejected:', { producing_price });
      return NextResponse.json(
        { error: 'Producing price must be non-negative' },
        { status: 400 }
      );
    }

    // Validate consuming_periods
    if (!Array.isArray(consuming_periods) || consuming_periods.length === 0) {
      return NextResponse.json(
        { error: 'Invalid input: consuming_periods must be a non-empty array' },
        { status: 400 }
      );
    }

    // Validate each period
    for (const period of consuming_periods) {
      if (
        typeof period.start_time !== 'number' ||
        typeof period.end_time !== 'number' ||
        typeof period.price !== 'number' ||
        isNaN(period.start_time) ||
        isNaN(period.end_time) ||
        isNaN(period.price)
      ) {
        return NextResponse.json(
          { error: 'Invalid period: start_time, end_time, and price must be numbers' },
          { status: 400 }
        );
      }

      if (period.start_time < 0 || period.start_time > 1439 ||
          period.end_time < 0 || period.end_time > 1439) {
        return NextResponse.json(
          { error: 'Time values must be between 0 and 1439 (minutes since midnight)' },
          { status: 400 }
        );
      }

      if (period.price < 0) {
        return NextResponse.json(
          { error: 'Prices must be non-negative' },
          { status: 400 }
        );
      }
    }

    // Validate start_date if provided
    let effectiveStartDate: number | undefined;
    if (start_date !== undefined) {
      if (typeof start_date !== 'number' || isNaN(start_date) || start_date < 0) {
        return NextResponse.json(
          { error: 'Invalid start_date: must be a valid Unix timestamp' },
          { status: 400 }
        );
      }
      effectiveStartDate = start_date;
    }

    console.log('Calling updateSettings with:', { producing_price, consuming_periods, start_date: effectiveStartDate });
    const { energySettingsService } = createServiceContainer();
    const settings = await energySettingsService.updateSettings(producing_price, consuming_periods, effectiveStartDate);
    console.log('Settings updated successfully:', settings);

    return NextResponse.json({
      producing_price: settings.producing_price,
      consuming_periods: settings.consuming_periods || [],
      start_date: settings.start_date,
      end_date: settings.end_date,
      updated_at: settings.updated_at,
    });
  } catch (error) {
    console.error('Error updating energy settings:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    const errorStack = error instanceof Error ? error.stack : undefined;
    console.error('Error details:', { errorMessage, errorStack });
    return NextResponse.json(
      { error: 'Failed to update energy settings', details: errorMessage },
      { status: 500 }
    );
  }
}

