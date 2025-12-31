// lib/mqtt/mqtt-singleton.ts

import type { MqttService } from '@/lib/services/mqtt-service';

declare global {
  // eslint-disable-next-line no-var
  var mqttServiceGlobal: MqttService | undefined;
}

export function getGlobalMqttService(): MqttService {
    if (typeof window !== 'undefined') {
      throw new Error('getGlobalMqttService darf nicht im Browser aufgerufen werden');
    }
  
    if (!globalThis.mqttServiceGlobal) {
      const { createMqttService } = require('@/lib/services/mqtt-service');
      const { getPrismaClient } = require('@/lib/db');
      const { createEnergyRepository } = require('@/lib/repositories/energy-repository');
  
      const prisma = getPrismaClient();
      const repository = createEnergyRepository(prisma);
  
      globalThis.mqttServiceGlobal = createMqttService(
        undefined,
        undefined,
        undefined,
        undefined,
        repository
      );
    }
  
    // 👇 entscheidend für TypeScript
    if (!globalThis.mqttServiceGlobal) {
      throw new Error('MQTT Service nicht initialisiert');
    }
  
    return globalThis.mqttServiceGlobal;


}