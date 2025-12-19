import { NextRequest } from 'next/server';
import mqtt from 'mqtt';
import type { EnergyData } from '@/types/energy';
import { insertEnergyReading, getEnergyReadings } from '@/lib/db';

// Singleton MQTT client
let mqttClient: mqtt.MqttClient | null = null;
let currentEnergyData: EnergyData = {
  timestamp: null,
  home: 0,
  grid: 0,
  car: 0,
  solar: 0,
};

let lastHistoryTimestamp: number | null = null;


// Initialize MQTT connection
function initializeMqtt() {
  // Check if client exists and is connected
  if (mqttClient && mqttClient.connected) {
    return mqttClient;
  }

  // If client exists but is disconnected, clean it up
  if (mqttClient) {
    try {
      mqttClient.end(true);
    } catch (error) {
      console.error('Error ending existing MQTT client:', error);
    }
    mqttClient = null;
  }

  // Get MQTT URL from environment variable
  const mqttUrl = process.env.MQTT_URL;
  
  if (!mqttUrl) {
    throw new Error(
      'MQTT_URL environment variable is not set. ' +
      'Please set MQTT_URL to your MQTT broker URL (e.g., mqtt://localhost:1883 or mqtt://username:password@broker.example.com:1883)'
    );
  }

  // Log connection attempt without exposing credentials
  const logUrl = mqttUrl.replace(/\/\/([^:]+):([^@]+)@/, '//***:***@');
  console.log(`Connecting to MQTT broker at ${logUrl}...`);
  
  const client = mqtt.connect(mqttUrl, {
    reconnectPeriod: 5000, // Reconnect every 5 seconds
    connectTimeout: 10000, // 10 second connection timeout
    keepalive: 60,
  });

  client.on('connect', () => {
    console.log('Connected to MQTT broker');
    try {
      client.subscribe('go-eController/916791/ccp', (err) => {
        if (err) {
          console.error('Error subscribing to ccp topic:', err);
        } else {
          console.log('Subscribed to go-eController/916791/ccp');
        }
      });
      client.subscribe('go-eController/916791/utc', (err) => {
        if (err) {
          console.error('Error subscribing to utc topic:', err);
        } else {
          console.log('Subscribed to go-eController/916791/utc');
        }
      });
    } catch (error) {
      console.error('Error during subscription:', error);
    }
  });

  client.on('message', (topic, message) => {
    try {
      if (topic === 'go-eController/916791/ccp') {
        // Parse energy data array: [Home, Grid, Car, Relais, Solar, ...]
        const data = JSON.parse(message.toString()) as number[];
        if (Array.isArray(data) && data.length >= 5) {
          currentEnergyData.home = data[0] || 0;
          currentEnergyData.grid = data[1] || 0;
          currentEnergyData.car = data[2] || 0;
          currentEnergyData.solar = data[4] || 0; // Index 4 is Solar
          
          // Persist to database if we have a valid timestamp
          if (currentEnergyData.timestamp !== null && 
              typeof currentEnergyData.timestamp === 'number' &&
              !isNaN(currentEnergyData.timestamp) &&
              currentEnergyData.timestamp !== lastHistoryTimestamp) {
            // Persist to database
            insertEnergyReading(currentEnergyData).catch((error) => {
              console.error('Error persisting energy reading:', error);
            });
            lastHistoryTimestamp = currentEnergyData.timestamp;
          }
        }
      } else if (topic === 'go-eController/916791/utc') {
        // Parse timestamp - UTC topic sends ISO 8601 string like "2025-12-08T16:53:26.407"
        const timestampString = JSON.parse(message.toString()) as string;
        
        // Convert ISO 8601 string to Unix timestamp in seconds
        const date = new Date(timestampString);
        if (isNaN(date.getTime())) {
          console.error('Invalid UTC timestamp format:', timestampString);
        } else {
          const timestamp = Math.floor(date.getTime() / 1000); // Convert to Unix seconds
          currentEnergyData.timestamp = timestamp;
          
          // Persist to database if we have complete energy data
          if (timestamp !== lastHistoryTimestamp && 
              (currentEnergyData.home !== 0 || currentEnergyData.grid !== 0 || 
               currentEnergyData.car !== 0 || currentEnergyData.solar !== 0)) {
            // Persist to database
            insertEnergyReading(currentEnergyData).catch((error) => {
              console.error('Error persisting energy reading:', error);
            });
            lastHistoryTimestamp = timestamp;
          }
        }
      }
    } catch (error) {
      console.error('Error parsing MQTT message:', error);
    }
  });

  client.on('error', (error) => {
    console.error('MQTT error:', error);
    console.error('Error details:', {
      message: error.message,
      code: (error as any).code,
      errno: (error as any).errno,
    });
  });

  client.on('close', () => {
    console.log('MQTT connection closed');
    mqttClient = null;
  });

  client.on('offline', () => {
    console.log('MQTT client went offline');
  });

  client.on('reconnect', () => {
    console.log('Attempting to reconnect to MQTT broker...');
  });

  client.on('end', () => {
    console.log('MQTT client ended');
    mqttClient = null;
  });

  mqttClient = client;
  return client;
}

export async function GET(request: NextRequest) {
  // Initialize MQTT connection
  initializeMqtt();

  // Create a readable stream for SSE
  const stream = new ReadableStream({
    start(controller) {
      const encoder = new TextEncoder();

      // Send initial data (current state and history from database)
      const sendData = async () => {
        try {
          // Fetch recent history from database (last 100 entries)
          const history = await getEnergyReadings(100, 0);
          const data = JSON.stringify({
            current: currentEnergyData,
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
          const data = JSON.stringify({
            current: currentEnergyData,
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

