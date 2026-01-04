import mqtt, { type MqttClient, type IClientOptions } from 'mqtt';
import * as Sentry from '@sentry/node';
import type { EnergyData, EnergyHistoryEntry } from '@repo/core';
import type { EnergyRepository } from '@repo/core';

type MqttClientFactory = (url: string, options?: IClientOptions) => MqttClient;

export class MqttWorker {
    private client: MqttClient | null = null;
    private currentEnergyData: EnergyData = {
        timestamp: null,
        home: 0,
        grid: 0,
        car: 0,
        solar: 0,
    };
    private lastHistoryTimestamp: number | null = null;
    private lastMessageTimestamp: number | null = null;
    private topicCcp: string;
    private topicUtc: string;
    private mqttUrl: string;
    private clientFactory: MqttClientFactory;
    private isShuttingDown: boolean = false;
    private repository: EnergyRepository;

    constructor(
        repository: EnergyRepository,
        mqttUrl?: string,
        topicCcp?: string,
        topicUtc?: string,
        clientFactory?: MqttClientFactory
    ) {
        this.repository = repository;
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
    }

    public start(): void {
        this.ensureConnected();
        console.log("MQTT client started");
    }

    private ensureConnected(): void {
        if (this.client) {
            return;
        }

        let normalizedUrl = this.mqttUrl;
        // URL parsing logic from original implementation...
        try {
            const credentialMatch = this.mqttUrl.match(/^([^:]+):\/\/([^:]+):([^@]+)@(.+)$/);
            if (credentialMatch) {
                const [, protocol, username, password, rest] = credentialMatch;
                normalizedUrl = `${protocol}://${encodeURIComponent(username)}:${encodeURIComponent(password)}@${rest}`;
            }
        } catch (error) {
            console.error('Invalid MQTT URL:', error);
            throw error;
        }

        const logUrl = normalizedUrl.replace(/\/\/([^:]+):([^@]+)@/, '//***:***@');
        console.log(`Creating MQTT client → ${logUrl}`);

        const client = this.clientFactory(normalizedUrl, {
            clientId: 'home-os-mqtt-worker',
            clean: true,
            reconnectPeriod: 5000,
            connectTimeout: 10000,
            keepalive: 60,
        });

        client.on('connect', () => {
            console.log('MQTT connected');
            client.subscribe(this.topicCcp);
            client.subscribe(this.topicUtc);
        });

        client.on('message', (topic, message) => {
            this.handleMessage(topic, message);
        });

        client.on('error', (error) => {
            console.error('MQTT error:', error);
        });

        client.on('close', () => {
            console.log('MQTT connection closed');
        });

        client.on('offline', () => {
            console.log('MQTT client offline');
        });

        this.client = client;
    }

    private handleMessage(topic: string, message: Buffer): void {
        this.lastMessageTimestamp = Math.floor(Date.now() / 1000);

        Sentry.addBreadcrumb({
            category: 'mqtt',
            message: `Received MQTT message on topic: ${topic}`,
            level: 'info',
            data: { topic, messageLength: message.length },
        });

        try {
            if (topic === this.topicCcp) {
                const data = JSON.parse(message.toString()) as number[];
                if (Array.isArray(data) && data.length >= 5) {
                    this.currentEnergyData.home = data[0] || 0;
                    this.currentEnergyData.grid = data[1] || 0;
                    this.currentEnergyData.car = data[2] || 0;
                    this.currentEnergyData.solar = data[4] || 0;

                    if (
                        this.currentEnergyData.timestamp !== null &&
                        typeof this.currentEnergyData.timestamp === 'number' &&
                        !isNaN(this.currentEnergyData.timestamp) &&
                        this.currentEnergyData.timestamp !== this.lastHistoryTimestamp
                    ) {
                        console.log("Persisting energy reading:", this.currentEnergyData);
                        this.repository.insertEnergyReading(this.currentEnergyData).catch((error: unknown) => {
                            console.error('Error persisting energy reading:', error);
                            Sentry.captureException(error);
                        });
                        this.lastHistoryTimestamp = this.currentEnergyData.timestamp;
                    }
                }
            } else if (topic === this.topicUtc) {
                const timestampString = JSON.parse(message.toString()) as string;
                const date = new Date(timestampString + "Z");

                if (isNaN(date.getTime())) {
                    console.error('Invalid UTC timestamp format:', timestampString);
                } else {
                    const timestamp = Math.floor(date.getTime() / 1000);
                    this.currentEnergyData.timestamp = timestamp;

                    if (
                        timestamp !== this.lastHistoryTimestamp &&
                        (this.currentEnergyData.home !== 0 ||
                            this.currentEnergyData.grid !== 0 ||
                            this.currentEnergyData.car !== 0 ||
                            this.currentEnergyData.solar !== 0)
                    ) {
                        this.repository.insertEnergyReading(this.currentEnergyData).catch((error: unknown) => {
                            console.error('Error persisting energy reading:', error);
                            Sentry.captureException(error);
                        });
                        this.lastHistoryTimestamp = timestamp;
                    }
                }
            }
        } catch (error) {
            console.error('Error parsing MQTT message:', error);
            Sentry.captureException(error);
        }
    }

    public disconnect(): void {
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
}
