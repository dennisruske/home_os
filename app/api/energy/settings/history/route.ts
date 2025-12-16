import { NextResponse } from 'next/server';
import { getAllEnergySettings } from '@/lib/db';

export async function GET() {
  try {
    const allSettings = await getAllEnergySettings();
    
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





