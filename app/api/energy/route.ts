import { NextRequest } from 'next/server';
import { getMqttService } from '@/lib/services/mqtt-service';
import { getEnergyService } from '@/lib/services/energy-service';

export async function GET(request: NextRequest) {
  // Get MQTT service (connection happens automatically on first use)
  const mqttService = getMqttService();

  // Create a readable stream for SSE
  const stream = new ReadableStream({
    start(controller) {
      const encoder = new TextEncoder();

      // Send initial data (current state and history from database)
      const sendData = async () => {
        try {
          // Fetch recent history from database (last 100 entries)
          const energyService = getEnergyService();
          const history = await energyService.getReadings(100, 0);
          const currentData = mqttService.getCurrentData();
          const data = JSON.stringify({
            current: currentData,
            history: history.map((entry) => ({
              timestamp: entry.timestamp,
              home: entry.home,
              grid: entry.grid,
              car: entry.car,
              solar: entry.solar,
            })),
          });
          controller.enqueue(encoder.encode(`data: ${data}\n\n`));
        } catch (error) {
          console.error('Error fetching history from database:', error);
          // Send current data even if history fetch fails
          const currentData = mqttService.getCurrentData();
          const data = JSON.stringify({
            current: currentData,
            history: [],
          });
          controller.enqueue(encoder.encode(`data: ${data}\n\n`));
        }
      };

      // Send data immediately
      sendData();

      // Send updates every second
      const interval = setInterval(() => {
        sendData().catch((error) => {
          console.error('Error sending SSE data:', error);
          clearInterval(interval);
          controller.close();
        });
      }, 1000);

      // Cleanup on close
      request.signal.addEventListener('abort', () => {
        clearInterval(interval);
        controller.close();
      });
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
    },
  });
}

