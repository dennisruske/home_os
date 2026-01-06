import dotenv from 'dotenv';
import cron from 'node-cron';
import { PrismaClient } from '@repo/database';
import { createEnergyRepository } from '@repo/core';
import { MqttWorker } from './mqtt-worker';
import { EnergyAggregationJob } from './jobs/aggregation';

dotenv.config();

async function main() {
    console.log('Starting Home OS Worker...');

    // Initialize dependencies
    const prisma = new PrismaClient();
    const energyRepository = createEnergyRepository(prisma);

    // Start MQTT Worker
    const mqttWorker = new MqttWorker(energyRepository);
    try {
        mqttWorker.start();
    } catch (error) {
        console.error('Failed to start MQTT worker:', error);
        process.exit(1);
    }

    // Schedule Aggregation Job (every minute)
    console.log('Scheduling aggregation job...');
    cron.schedule('* * * * *', async () => {
        console.log('Running aggregation job...');
        const job = new EnergyAggregationJob(prisma);
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
