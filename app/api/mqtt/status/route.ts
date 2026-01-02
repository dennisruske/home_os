import { NextResponse } from 'next/server';
import { createServiceContainer } from '@/lib/services/service-container';

export async function GET() {
  try {
    const services = createServiceContainer();
    const { mqttService } = services;

    const isConnected = mqttService.isConnected();
    const lastMessageTimestamp = mqttService.getLastMessageTimestamp();

    return NextResponse.json({
      connected: isConnected,
      lastMessageTimestamp: lastMessageTimestamp,
    });
  } catch (error) {
    console.error('Error fetching MQTT status:', error);
    return NextResponse.json(
      { error: 'Failed to fetch MQTT status' },
      { status: 500 }
    );
  }
}