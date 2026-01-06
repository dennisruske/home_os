"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const dotenv_1 = __importDefault(require("dotenv"));
const node_cron_1 = __importDefault(require("node-cron"));
const database_1 = require("@repo/database");
const core_1 = require("@repo/core");
const mqtt_worker_1 = require("./mqtt-worker");
const aggregation_1 = require("./jobs/aggregation");
dotenv_1.default.config();
async function main() {
    console.log('Starting Home OS Worker...');
    // Initialize dependencies
    const prisma = new database_1.PrismaClient();
    const energyRepository = (0, core_1.createEnergyRepository)(prisma);
    // Start MQTT Worker
    const mqttWorker = new mqtt_worker_1.MqttWorker(energyRepository);
    try {
        mqttWorker.start();
    }
    catch (error) {
        console.error('Failed to start MQTT worker:', error);
        process.exit(1);
    }
    // Schedule Aggregation Job (every minute)
    console.log('Scheduling aggregation job...');
    node_cron_1.default.schedule('* * * * *', async () => {
        console.log('Running aggregation job...');
        const job = new aggregation_1.EnergyAggregationJob(prisma);
        await job.run();
    });
    // Graceful shutdown
    const shutdown = () => {
        console.log('Shutting down worker...');
        mqttWorker.disconnect();
        prisma.$disconnect();
        process.exit(0);
    };
    process.on('SIGTERM', shutdown);
    process.on('SIGINT', shutdown);
}
main().catch((error) => {
    console.error('Worker failed:', error);
    process.exit(1);
});
