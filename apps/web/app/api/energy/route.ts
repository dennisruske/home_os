import { NextRequest } from 'next/server';
import { createServiceContainer } from '@/lib/services/service-container';

export async function GET(request: NextRequest) {
  const services = createServiceContainer();
  const { energyService } = services;

  // Create a readable stream for SSE
  const stream = new ReadableStream({
    start(controller) {
      const encoder = new TextEncoder();

      // Send initial data (current state and history from database)
      const sendData = async () => {
        try {
          // Fetch recent history from database (last 100 entries)
          const history = await energyService.getReadings(100, 0);

          // Use the latest reading from history as "current"
          // If no history, default to zeros
          const latestReading = history.length > 0 ? history[0] : null;

          const currentData = {
            timestamp: latestReading?.timestamp ?? Math.floor(Date.now() / 1000),
            home: latestReading?.home ?? 0,
            grid: latestReading?.grid ?? 0,
            car: latestReading?.car ?? 0,
            solar: latestReading?.solar ?? 0,
          };

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
          controller.close();
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
