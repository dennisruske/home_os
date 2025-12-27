import mqtt, { type MqttClient, type IClientOptions } from 'mqtt';
import type { EnergyData } from '@/types/energy';
import type { EnergyRepository } from '@/lib/repositories/energy-repository';

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
  private repository: EnergyRepository | null = null;

  constructor(
    mqttUrl?: string,
    topicCcp?: string,
    topicUtc?: string,
    clientFactory?: MqttClientFactory,
    repository?: EnergyRepository
  ) {
    this.mqttUrl = mqttUrl || process.env.MQTT_URL || '';
    this.topicCcp = topicCcp || process.env.MQTT_TOPIC_CCP || 'go-eController/916791/ccp';
    this.topicUtc = topicUtc || process.env.MQTT_TOPIC_UTC || 'go-eController/916791/utc';
    this.clientFactory = clientFactory || mqtt.connect;
    this.repository = repository || null;

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

  /**
   * Ensures MQTT connection is established. Called automatically when needed.
   * This method is idempotent - it will only connect if not already connected.
   */
  private ensureConnected(): void {
    // Check if client exists and is connected
    if (this.client && this.client.connected) {
      return;
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

    // Validate and normalize the MQTT URL
    // The mqtt library internally uses decodeURIComponent which can fail if the URL
    // contains unencoded special characters. We need to ensure proper encoding.
    let normalizedUrl = this.mqttUrl;
    try {
      // Try to parse the URL to validate it
      const url = new URL(this.mqttUrl);
      
      // Always reconstruct the URL with properly encoded credentials
      // This ensures that any special characters are properly encoded
      const protocol = url.protocol;
      const hostname = url.hostname;
      const port = url.port;
      const pathname = url.pathname;
      const search = url.search;
      
      // Encode username and password if they exist
      // Note: new URL() automatically decodes them, so we just need to re-encode
      const encodedUsername = url.username ? encodeURIComponent(url.username) : '';
      const encodedPassword = url.password ? encodeURIComponent(url.password) : '';
      
      // Reconstruct URL with properly encoded credentials
      if (encodedUsername && encodedPassword) {
        normalizedUrl = `${protocol}//${encodedUsername}:${encodedPassword}@${hostname}${port ? `:${port}` : ''}${pathname}${search}`;
      } else if (encodedUsername) {
        normalizedUrl = `${protocol}//${encodedUsername}@${hostname}${port ? `:${port}` : ''}${pathname}${search}`;
      } else {
        normalizedUrl = `${protocol}//${hostname}${port ? `:${port}` : ''}${pathname}${search}`;
      }
    } catch (urlError) {
      // If URL parsing fails, the URL is malformed
      console.error('Error parsing MQTT URL:', urlError);
      console.error('MQTT URL format should be: mqtt://[username:password@]hostname[:port][/path]');
      console.error('Current MQTT_URL value (sanitized):', this.mqttUrl.replace(/\/\/([^:]+):([^@]+)@/, '//***:***@'));
      throw new Error(
        `Invalid MQTT URL format. Please check your MQTT_URL environment variable. ` +
        `Expected format: mqtt://[username:password@]hostname[:port][/path]. ` +
        `Special characters in username/password must be URL-encoded.`
      );
    }

    // Log connection attempt without exposing credentials
    const logUrl = normalizedUrl.replace(/\/\/([^:]+):([^@]+)@/, '//***:***@');
    console.log(`Connecting to MQTT broker at ${logUrl}...`);

    let client: MqttClient;
    try {
      client = this.clientFactory(normalizedUrl, {
        reconnectPeriod: 5000, // Reconnect every 5 seconds
        connectTimeout: 10000, // 10 second connection timeout
        keepalive: 60,
      });
    } catch (error) {
      console.error('Error creating MQTT client:', error);
      if (error instanceof URIError) {
        console.error('URI Error: The MQTT URL contains invalid characters.');
        console.error('Please ensure your MQTT_URL is properly formatted.');
        console.error('Example formats:');
        console.error('  - mqtt://localhost:1883');
        console.error('  - mqtt://username:password@broker.example.com:1883');
        console.error('  - mqtts://username:password@broker.example.com:8883');
        console.error('Note: Special characters in username/password must be URL-encoded.');
      }
      throw error;
    }

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
  }

  /**
   * Explicitly connect to MQTT broker. 
   * Note: Connection is now automatic on first use, but this method is kept for explicit control.
   * @deprecated Connection happens automatically - this method is kept for backward compatibility
   */
  connect(): MqttClient {
    this.ensureConnected();
    return this.client!;
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
            this.repository &&
            this.currentEnergyData.timestamp !== null &&
            typeof this.currentEnergyData.timestamp === 'number' &&
            !isNaN(this.currentEnergyData.timestamp) &&
            this.currentEnergyData.timestamp !== this.lastHistoryTimestamp
          ) {
            // Persist to database
            this.repository.insertEnergyReading(this.currentEnergyData).catch((error) => {
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
            this.repository &&
            timestamp !== this.lastHistoryTimestamp &&
            (this.currentEnergyData.home !== 0 ||
              this.currentEnergyData.grid !== 0 ||
              this.currentEnergyData.car !== 0 ||
              this.currentEnergyData.solar !== 0)
          ) {
            // Persist to database
            this.repository.insertEnergyReading(this.currentEnergyData).catch((error) => {
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
    // Auto-connect on first access to ensure we're receiving data
    this.ensureConnected();
    return { ...this.currentEnergyData };
  }

  cleanup(): void {
    this.disconnect();
    this.isShuttingDown = true;
  }
}

/**
 * Factory function to create an MqttService instance.
 * @param mqttUrl - Optional MQTT broker URL (defaults to MQTT_URL env var)
 * @param topicCcp - Optional CCP topic (defaults to MQTT_TOPIC_CCP env var)
 * @param topicUtc - Optional UTC topic (defaults to MQTT_TOPIC_UTC env var)
 * @param clientFactory - Optional MQTT client factory function
 * @param repository - Optional EnergyRepository for persisting readings
 * @returns MqttService instance
 */
export function createMqttService(
  mqttUrl?: string,
  topicCcp?: string,
  topicUtc?: string,
  clientFactory?: MqttClientFactory,
  repository?: EnergyRepository
): MqttService {
  return new MqttService(mqttUrl, topicCcp, topicUtc, clientFactory, repository);
}

// Singleton instance for backward compatibility (deprecated - use createMqttService instead)
let mqttServiceInstance: MqttService | null = null;

/**
 * Gets the singleton instance of MqttService.
 * @deprecated Use createMqttService() instead for dependency injection
 */
export function getMqttService(): MqttService {
  if (!mqttServiceInstance) {
    // Import here to avoid circular dependencies
    const { getPrismaClient } = require('@/lib/db');
    const { createEnergyRepository } = require('@/lib/repositories/energy-repository');
    const prisma = getPrismaClient();
    const repository = createEnergyRepository(prisma);
    mqttServiceInstance = new MqttService(undefined, undefined, undefined, undefined, repository);
  }
  return mqttServiceInstance;
}

