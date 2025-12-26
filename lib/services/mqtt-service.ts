import mqtt, { type MqttClient, type IClientOptions } from 'mqtt';
import type { EnergyData } from '@/types/energy';
import { insertEnergyReading } from '@/lib/db';

type MqttClientFactory = (url: string, options?: IClientOptions) => MqttClient;

export class MqttService {
  private client: MqttClient | null = null;
  private currentEnergyData: EnergyData = {
    timestamp: null,
    home: 0,
    grid: 0,
    car: 0,
    solar: 0,
  };
  private lastHistoryTimestamp: number | null = null;
  private topicCcp: string;
  private topicUtc: string;
  private mqttUrl: string;
  private clientFactory: MqttClientFactory;
  private isShuttingDown: boolean = false;

  constructor(
    mqttUrl?: string,
    topicCcp?: string,
    topicUtc?: string,
    clientFactory?: MqttClientFactory
  ) {
    this.mqttUrl = mqttUrl || process.env.MQTT_URL || '';
    this.topicCcp = topicCcp || process.env.MQTT_TOPIC_CCP || 'go-eController/916791/ccp';
    this.topicUtc = topicUtc || process.env.MQTT_TOPIC_UTC || 'go-eController/916791/utc';
    this.clientFactory = clientFactory || mqtt.connect;

    if (!this.mqttUrl) {
      throw new Error(
        'MQTT_URL environment variable is not set. ' +
        'Please set MQTT_URL to your MQTT broker URL (e.g., mqtt://localhost:1883 or mqtt://username:password@broker.example.com:1883)'
      );
    }

    // Setup graceful shutdown handlers
    this.setupShutdownHandlers();
  }

  private setupShutdownHandlers(): void {
    // Only setup handlers once per process
    if (typeof process !== 'undefined') {
      const shutdown = () => {
        if (!this.isShuttingDown) {
          this.isShuttingDown = true;
          console.log('Received shutdown signal, disconnecting MQTT client...');
          this.disconnect();
        }
      };

      process.once('SIGTERM', shutdown);
      process.once('SIGINT', shutdown);
    }
  }

  connect(): MqttClient {
    // Check if client exists and is connected
    if (this.client && this.client.connected) {
      return this.client;
    }

    // If client exists but is disconnected, clean it up
    if (this.client) {
      try {
        this.client.end(true);
      } catch (error) {
        console.error('Error ending existing MQTT client:', error);
      }
      this.client = null;
    }

    // Log connection attempt without exposing credentials
    const logUrl = this.mqttUrl.replace(/\/\/([^:]+):([^@]+)@/, '//***:***@');
    console.log(`Connecting to MQTT broker at ${logUrl}...`);

    const client = this.clientFactory(this.mqttUrl, {
      reconnectPeriod: 5000, // Reconnect every 5 seconds
      connectTimeout: 10000, // 10 second connection timeout
      keepalive: 60,
    });

    client.on('connect', () => {
      console.log('Connected to MQTT broker');
      try {
        client.subscribe(this.topicCcp, (err) => {
          if (err) {
            console.error(`Error subscribing to ccp topic (${this.topicCcp}):`, err);
          } else {
            console.log(`Subscribed to ${this.topicCcp}`);
          }
        });
        client.subscribe(this.topicUtc, (err) => {
          if (err) {
            console.error(`Error subscribing to utc topic (${this.topicUtc}):`, err);
          } else {
            console.log(`Subscribed to ${this.topicUtc}`);
          }
        });
      } catch (error) {
        console.error('Error during subscription:', error);
      }
    });

    client.on('message', (topic, message) => {
      this.handleMessage(topic, message);
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
      if (!this.isShuttingDown) {
        this.client = null;
      }
    });

    client.on('offline', () => {
      console.log('MQTT client went offline');
    });

    client.on('reconnect', () => {
      console.log('Attempting to reconnect to MQTT broker...');
    });

    client.on('end', () => {
      console.log('MQTT client ended');
      if (!this.isShuttingDown) {
        this.client = null;
      }
    });

    this.client = client;
    return client;
  }

  private handleMessage(topic: string, message: Buffer): void {
    try {
      if (topic === this.topicCcp) {
        // Parse energy data array: [Home, Grid, Car, Relais, Solar, ...]
        const data = JSON.parse(message.toString()) as number[];
        if (Array.isArray(data) && data.length >= 5) {
          this.currentEnergyData.home = data[0] || 0;
          this.currentEnergyData.grid = data[1] || 0;
          this.currentEnergyData.car = data[2] || 0;
          this.currentEnergyData.solar = data[4] || 0; // Index 4 is Solar

          // Persist to database if we have a valid timestamp
          if (
            this.currentEnergyData.timestamp !== null &&
            typeof this.currentEnergyData.timestamp === 'number' &&
            !isNaN(this.currentEnergyData.timestamp) &&
            this.currentEnergyData.timestamp !== this.lastHistoryTimestamp
          ) {
            // Persist to database
            insertEnergyReading(this.currentEnergyData).catch((error) => {
              console.error('Error persisting energy reading:', error);
            });
            this.lastHistoryTimestamp = this.currentEnergyData.timestamp;
          }
        }
      } else if (topic === this.topicUtc) {
        // Parse timestamp - UTC topic sends ISO 8601 string like "2025-12-08T16:53:26.407"
        const timestampString = JSON.parse(message.toString()) as string;

        // Convert ISO 8601 string to Unix timestamp in seconds
        const date = new Date(timestampString);
        if (isNaN(date.getTime())) {
          console.error('Invalid UTC timestamp format:', timestampString);
        } else {
          const timestamp = Math.floor(date.getTime() / 1000); // Convert to Unix seconds
          this.currentEnergyData.timestamp = timestamp;

          // Persist to database if we have complete energy data
          if (
            timestamp !== this.lastHistoryTimestamp &&
            (this.currentEnergyData.home !== 0 ||
              this.currentEnergyData.grid !== 0 ||
              this.currentEnergyData.car !== 0 ||
              this.currentEnergyData.solar !== 0)
          ) {
            // Persist to database
            insertEnergyReading(this.currentEnergyData).catch((error) => {
              console.error('Error persisting energy reading:', error);
            });
            this.lastHistoryTimestamp = timestamp;
          }
        }
      }
    } catch (error) {
      console.error('Error parsing MQTT message:', error);
    }
  }

  disconnect(): void {
    if (this.client) {
      try {
        this.client.end(true);
        console.log('MQTT client disconnected gracefully');
      } catch (error) {
        console.error('Error disconnecting MQTT client:', error);
      }
      this.client = null;
    }
  }

  isConnected(): boolean {
    return this.client !== null && this.client.connected;
  }

  getCurrentData(): EnergyData {
    return { ...this.currentEnergyData };
  }

  cleanup(): void {
    this.disconnect();
    this.isShuttingDown = true;
  }
}

// Singleton instance for use in API routes
let mqttServiceInstance: MqttService | null = null;

export function getMqttService(): MqttService {
  if (!mqttServiceInstance) {
    mqttServiceInstance = new MqttService();
  }
  return mqttServiceInstance;
}

