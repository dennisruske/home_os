import { NextResponse } from 'next/server';
import { createServiceContainer } from '@/lib/services/service-container';

export async function GET() {
  try {
    const { energySettingsService } = createServiceContainer();
    const allSettings = await energySettingsService.getAllSettings();
    
    return NextResponse.json({
      settings: allSettings,
    });
  } catch (error) {
    console.error('Error fetching energy settings history:', error);
    return NextResponse.json(
      { error: 'Failed to fetch energy settings history' },
      { status: 500 }
    );
  }
}





