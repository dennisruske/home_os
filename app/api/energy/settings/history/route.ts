import { NextResponse } from 'next/server';
import { getEnergySettingsService } from '@/lib/services/energy-settings-service';

export async function GET() {
  try {
    const service = getEnergySettingsService();
    const allSettings = await service.getAllSettings();
    
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





