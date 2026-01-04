"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.MqttWorker = void 0;
const mqtt_1 = __importDefault(require("mqtt"));
const Sentry = __importStar(require("@sentry/node"));
class MqttWorker {
    constructor(repository, mqttUrl, topicCcp, topicUtc, clientFactory) {
        this.client = null;
        this.currentEnergyData = {
            timestamp: null,
            home: 0,
            grid: 0,
            car: 0,
            solar: 0,
        };
        this.lastHistoryTimestamp = null;
        this.lastMessageTimestamp = null;
        this.isShuttingDown = false;
        this.repository = repository;
        this.mqttUrl = mqttUrl || process.env.MQTT_URL || '';
        this.topicCcp = topicCcp || process.env.MQTT_TOPIC_CCP || 'go-eController/916791/ccp';
        this.topicUtc = topicUtc || process.env.MQTT_TOPIC_UTC || 'go-eController/916791/utc';
        this.clientFactory = clientFactory || mqtt_1.default.connect;
        if (!this.mqttUrl) {
            throw new Error('MQTT_URL environment variable is not set. ' +
                'Please set MQTT_URL to your MQTT broker URL (e.g., mqtt://localhost:1883 or mqtt://username:password@broker.example.com:1883)');
        }
    }
    start() {
        this.ensureConnected();
        console.log("MQTT client started");
    }
    ensureConnected() {
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
        }
        catch (error) {
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
    handleMessage(topic, message) {
        this.lastMessageTimestamp = Math.floor(Date.now() / 1000);
        Sentry.addBreadcrumb({
            category: 'mqtt',
            message: `Received MQTT message on topic: ${topic}`,
            level: 'info',
            data: { topic, messageLength: message.length },
        });
        try {
            if (topic === this.topicCcp) {
                const data = JSON.parse(message.toString());
                if (Array.isArray(data) && data.length >= 5) {
                    this.currentEnergyData.home = data[0] || 0;
                    this.currentEnergyData.grid = data[1] || 0;
                    this.currentEnergyData.car = data[2] || 0;
                    this.currentEnergyData.solar = data[4] || 0;
                    if (this.currentEnergyData.timestamp !== null &&
                        typeof this.currentEnergyData.timestamp === 'number' &&
                        !isNaN(this.currentEnergyData.timestamp) &&
                        this.currentEnergyData.timestamp !== this.lastHistoryTimestamp) {
                        console.log("Persisting energy reading:", this.currentEnergyData);
                        this.repository.insertEnergyReading(this.currentEnergyData).catch((error) => {
                            console.error('Error persisting energy reading:', error);
                            Sentry.captureException(error);
                        });
                        this.lastHistoryTimestamp = this.currentEnergyData.timestamp;
                    }
                }
            }
            else if (topic === this.topicUtc) {
                const timestampString = JSON.parse(message.toString());
                const date = new Date(timestampString + "Z");
                if (isNaN(date.getTime())) {
                    console.error('Invalid UTC timestamp format:', timestampString);
                }
                else {
                    const timestamp = Math.floor(date.getTime() / 1000);
                    this.currentEnergyData.timestamp = timestamp;
                    if (timestamp !== this.lastHistoryTimestamp &&
                        (this.currentEnergyData.home !== 0 ||
                            this.currentEnergyData.grid !== 0 ||
                            this.currentEnergyData.car !== 0 ||
                            this.currentEnergyData.solar !== 0)) {
                        this.repository.insertEnergyReading(this.currentEnergyData).catch((error) => {
                            console.error('Error persisting energy reading:', error);
                            Sentry.captureException(error);
                        });
                        this.lastHistoryTimestamp = timestamp;
                    }
                }
            }
        }
        catch (error) {
            console.error('Error parsing MQTT message:', error);
            Sentry.captureException(error);
        }
    }
    disconnect() {
        if (this.client) {
            try {
                this.client.end(true);
                console.log('MQTT client disconnected gracefully');
            }
            catch (error) {
                console.error('Error disconnecting MQTT client:', error);
            }
            this.client = null;
        }
    }
}
exports.MqttWorker = MqttWorker;
