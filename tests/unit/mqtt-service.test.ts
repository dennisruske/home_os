import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { MqttService } from '@/lib/services/mqtt-service';
import type { MqttClient } from 'mqtt';
import type { EnergyData } from '@/types/energy';
import type { EnergyRepository } from '@/lib/repositories/energy-repository';

describe('MqttService', () => {
  let mockClient: Partial<MqttClient>;
  let mockClientFactory: (url: string, options?: any) => Partial<MqttClient>;
  let eventHandlers: Record<string, ((...args: any[]) => void)[]>;
  let mockRepository: EnergyRepository;

  beforeEach(() => {
    // Reset event handlers
    eventHandlers = {};

    // Create mock repository
    mockRepository = {
      insertEnergyReading: vi.fn().mockResolvedValue(undefined),
    } as unknown as EnergyRepository;

    // Create mock client with event emitter behavior
    mockClient = {
      connected: false,
      end: vi.fn((force?: boolean, callback?: () => void) => {
        mockClient.connected = false;
        if (callback) callback();
        return mockClient as MqttClient;
      }),
      subscribe: vi.fn((topic: string, callback?: (err: Error | null) => void) => {
        if (callback) callback(null);
        return mockClient as MqttClient;
      }),
      on: vi.fn((event: string, handler: (...args: any[]) => void) => {
        if (!eventHandlers[event]) {
          eventHandlers[event] = [];
        }
        eventHandlers[event].push(handler);
        return mockClient as MqttClient;
      }),
      removeListener: vi.fn(),
      removeAllListeners: vi.fn(),
    };

    // Mock client factory
    mockClientFactory = vi.fn((url: string, options?: any) => {
      return mockClient as MqttClient;
    });

    // Clear all mocks
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('constructor', () => {
    it('should initialize with default topics from environment or defaults', () => {
      const service = new MqttService(
        'mqtt://localhost:1883',
        undefined,
        undefined,
        mockClientFactory,
        mockRepository
      );
      expect(service).toBeDefined();
    });

    it('should initialize with custom topics', () => {
      const service = new MqttService(
        'mqtt://localhost:1883',
        'custom/ccp',
        'custom/utc',
        mockClientFactory,
        mockRepository
      );
      expect(service).toBeDefined();
    });

    it('should throw error if MQTT_URL is not provided', () => {
      // Temporarily remove MQTT_URL from env
      const originalEnv = process.env.MQTT_URL;
      delete process.env.MQTT_URL;

      expect(() => {
        new MqttService(undefined, undefined, undefined, mockClientFactory, mockRepository);
      }).toThrow('MQTT_URL environment variable is not set');

      // Restore
      if (originalEnv) {
        process.env.MQTT_URL = originalEnv;
      }
    });
  });

  describe('connect', () => {
    it('should create and connect MQTT client', () => {
      const service = new MqttService(
        'mqtt://localhost:1883',
        'test/ccp',
        'test/utc',
        mockClientFactory,
        mockRepository
      );

      const client = service.connect();

      expect(mockClientFactory).toHaveBeenCalledWith('mqtt://localhost:1883', {
        clientId: 'nextjs-mqtt-client',
        clean: true,
        reconnectPeriod: 5000,
        connectTimeout: 10000,
        keepalive: 60,
      });
      expect(client).toBe(mockClient);
    });

    it('should return existing client if already connected', () => {
      const service = new MqttService(
        'mqtt://localhost:1883',
        'test/ccp',
        'test/utc',
        mockClientFactory,
        mockRepository
      );

      mockClient.connected = true;
      const client1 = service.connect();
      const client2 = service.connect();

      expect(mockClientFactory).toHaveBeenCalledTimes(1);
      expect(client1).toBe(client2);
    });

    it('should subscribe to topics on connect', () => {
      const service = new MqttService(
        'mqtt://localhost:1883',
        'test/ccp',
        'test/utc',
        mockClientFactory,
        mockRepository
      );

      service.connect();

      // Trigger connect event
      const connectHandlers = eventHandlers['connect'] || [];
      connectHandlers.forEach((handler) => handler());

      expect(mockClient.subscribe).toHaveBeenCalledWith('test/ccp');
      expect(mockClient.subscribe).toHaveBeenCalledWith('test/utc');
    });

    it('should setup event handlers', () => {
      const service = new MqttService(
        'mqtt://localhost:1883',
        'test/ccp',
        'test/utc',
        mockClientFactory,
        mockRepository
      );

      service.connect();

      expect(mockClient.on).toHaveBeenCalledWith('connect', expect.any(Function));
      expect(mockClient.on).toHaveBeenCalledWith('message', expect.any(Function));
      expect(mockClient.on).toHaveBeenCalledWith('error', expect.any(Function));
      expect(mockClient.on).toHaveBeenCalledWith('close', expect.any(Function));
      expect(mockClient.on).toHaveBeenCalledWith('offline', expect.any(Function));
      expect(mockClient.on).toHaveBeenCalledWith('reconnect', expect.any(Function));
      expect(mockClient.on).toHaveBeenCalledWith('end', expect.any(Function));
    });
  });

  describe('message handling', () => {
    it('should handle CCP topic messages and update energy data', () => {
      const service = new MqttService(
        'mqtt://localhost:1883',
        'test/ccp',
        'test/utc',
        mockClientFactory,
        mockRepository
      );

      service.connect();

      // Get message handler
      const messageHandlers = eventHandlers['message'] || [];
      expect(messageHandlers.length).toBeGreaterThan(0);
      const messageHandler = messageHandlers[0];

      // Simulate CCP message: [Home, Grid, Car, Relais, Solar]
      const ccpData = [1000, 2000, 3000, 4000, 5000];
      const message = Buffer.from(JSON.stringify(ccpData));
      messageHandler('test/ccp', message);

      const currentData = service.getCurrentData();
      expect(currentData.home).toBe(1000);
      expect(currentData.grid).toBe(2000);
      expect(currentData.car).toBe(3000);
      expect(currentData.solar).toBe(5000);
    });

    it('should handle UTC topic messages and update timestamp', () => {
      const service = new MqttService(
        'mqtt://localhost:1883',
        'test/ccp',
        'test/utc',
        mockClientFactory,
        mockRepository
      );

      service.connect();

      // Get message handler
      const messageHandlers = eventHandlers['message'] || [];
      const messageHandler = messageHandlers[0];

      // First set energy data
      const ccpData = [1000, 2000, 3000, 4000, 5000];
      messageHandler('test/ccp', Buffer.from(JSON.stringify(ccpData)));

      // Then set timestamp
      const timestampString = '2025-12-08T16:53:26.407';
      messageHandler('test/utc', Buffer.from(JSON.stringify(timestampString)));

      const currentData = service.getCurrentData();
      expect(currentData.timestamp).toBe(Math.floor(new Date(timestampString + 'Z').getTime() / 1000));
    });

    it('should persist to database when both timestamp and energy data are available', async () => {
      const service = new MqttService(
        'mqtt://localhost:1883',
        'test/ccp',
        'test/utc',
        mockClientFactory,
        mockRepository
      );

      service.connect();

      const messageHandlers = eventHandlers['message'] || [];
      const messageHandler = messageHandlers[0];

      // Set timestamp first
      const timestampString = '2025-12-08T16:53:26.407';
      messageHandler('test/utc', Buffer.from(JSON.stringify(timestampString)));

      // Then set energy data (should trigger persistence)
      const ccpData = [1000, 2000, 3000, 4000, 5000];
      messageHandler('test/ccp', Buffer.from(JSON.stringify(ccpData)));

      // Wait for async operations
      await new Promise((resolve) => setTimeout(resolve, 100));

      expect(mockRepository.insertEnergyReading).toHaveBeenCalled();
      const callArgs = (mockRepository.insertEnergyReading as any).mock.calls[0][0];
      expect(callArgs.timestamp).toBe(Math.floor(new Date(timestampString + 'Z').getTime() / 1000));
      expect(callArgs.home).toBe(1000);
      expect(callArgs.grid).toBe(2000);
      expect(callArgs.car).toBe(3000);
      expect(callArgs.solar).toBe(5000);
    });

    it('should not persist duplicate timestamps', async () => {
      const service = new MqttService(
        'mqtt://localhost:1883',
        'test/ccp',
        'test/utc',
        mockClientFactory,
        mockRepository
      );

      service.connect();

      const messageHandlers = eventHandlers['message'] || [];
      const messageHandler = messageHandlers[0];

      const timestampString = '2025-12-08T16:53:26.407';
      const ccpData = [1000, 2000, 3000, 4000, 5000];

      // First complete message
      messageHandler('test/utc', Buffer.from(JSON.stringify(timestampString)));
      messageHandler('test/ccp', Buffer.from(JSON.stringify(ccpData)));

      await new Promise((resolve) => setTimeout(resolve, 100));

      // Second message with same timestamp (should not persist)
      messageHandler('test/ccp', Buffer.from(JSON.stringify(ccpData)));

      await new Promise((resolve) => setTimeout(resolve, 100));

      // Should only be called once
      expect(mockRepository.insertEnergyReading).toHaveBeenCalledTimes(1);
    });

    it('should handle invalid message formats gracefully', () => {
      const service = new MqttService(
        'mqtt://localhost:1883',
        'test/ccp',
        'test/utc',
        mockClientFactory,
        mockRepository
      );

      service.connect();

      const messageHandlers = eventHandlers['message'] || [];
      const messageHandler = messageHandlers[0];

      // Invalid JSON
      expect(() => {
        messageHandler('test/ccp', Buffer.from('invalid json'));
      }).not.toThrow();
    });

    it('should handle invalid timestamp format gracefully', () => {
      const service = new MqttService(
        'mqtt://localhost:1883',
        'test/ccp',
        'test/utc',
        mockClientFactory,
        mockRepository
      );

      service.connect();

      const messageHandlers = eventHandlers['message'] || [];
      const messageHandler = messageHandlers[0];

      // Invalid timestamp
      expect(() => {
        messageHandler('test/utc', Buffer.from(JSON.stringify('invalid-date')));
      }).not.toThrow();
    });
  });

  describe('getCurrentData', () => {
    it('should return a copy of current energy data', () => {
      const service = new MqttService(
        'mqtt://localhost:1883',
        'test/ccp',
        'test/utc',
        mockClientFactory,
        mockRepository
      );

      const data1 = service.getCurrentData();
      const data2 = service.getCurrentData();

      // Should be different objects (copies)
      expect(data1).not.toBe(data2);
      // But should have same values
      expect(data1).toEqual(data2);
    });

    it('should return initial state with null timestamp', () => {
      const service = new MqttService(
        'mqtt://localhost:1883',
        'test/ccp',
        'test/utc',
        mockClientFactory,
        mockRepository
      );

      const data = service.getCurrentData();
      expect(data).toEqual({
        timestamp: null,
        home: 0,
        grid: 0,
        car: 0,
        solar: 0,
      });
    });
  });

  describe('disconnect', () => {
    it('should disconnect client gracefully', () => {
      const service = new MqttService(
        'mqtt://localhost:1883',
        'test/ccp',
        'test/utc',
        mockClientFactory,
        mockRepository
      );

      service.connect();
      service.disconnect();

      expect(mockClient.end).toHaveBeenCalledWith(true);
    });

    it('should handle disconnect when client is null', () => {
      const service = new MqttService(
        'mqtt://localhost:1883',
        'test/ccp',
        'test/utc',
        mockClientFactory,
        mockRepository
      );

      // Should not throw
      expect(() => service.disconnect()).not.toThrow();
    });
  });

  describe('isConnected', () => {
    it('should return false when not connected', () => {
      const service = new MqttService(
        'mqtt://localhost:1883',
        'test/ccp',
        'test/utc',
        mockClientFactory,
        mockRepository
      );

      expect(service.isConnected()).toBe(false);
    });

    it('should return true when connected', () => {
      const service = new MqttService(
        'mqtt://localhost:1883',
        'test/ccp',
        'test/utc',
        mockClientFactory,
        mockRepository
      );

      service.connect();
      mockClient.connected = true;

      expect(service.isConnected()).toBe(true);
    });
  });

  describe('cleanup', () => {
    it('should disconnect and mark as shutting down', () => {
      const service = new MqttService(
        'mqtt://localhost:1883',
        'test/ccp',
        'test/utc',
        mockClientFactory,
        mockRepository
      );

      service.connect();
      service.cleanup();

      expect(mockClient.end).toHaveBeenCalledWith(true);
    });
  });

  describe('environment variable configuration', () => {
    it('should use default topics when env vars are not set', () => {
      const originalCcp = process.env.MQTT_TOPIC_CCP;
      const originalUtc = process.env.MQTT_TOPIC_UTC;
      delete process.env.MQTT_TOPIC_CCP;
      delete process.env.MQTT_TOPIC_UTC;

      const service = new MqttService(
        'mqtt://localhost:1883',
        undefined,
        undefined,
        mockClientFactory,
        mockRepository
      );

      service.connect();
      const messageHandlers = eventHandlers['message'] || [];
      const messageHandler = messageHandlers[0];

      // Should use default topics
      const ccpData = [1000, 2000, 3000, 4000, 5000];
      messageHandler('go-eController/916791/ccp', Buffer.from(JSON.stringify(ccpData)));

      const data = service.getCurrentData();
      expect(data.home).toBe(1000);

      // Restore
      if (originalCcp) process.env.MQTT_TOPIC_CCP = originalCcp;
      if (originalUtc) process.env.MQTT_TOPIC_UTC = originalUtc;
    });
  });
});

