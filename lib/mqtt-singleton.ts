// lib/mqtt/mqtt-singleton.ts

import type { MqttService } from '@/lib/services/mqtt-service';

declare global {
  // eslint-disable-next-line no-var
  var mqttServiceGlobal: MqttService | undefined;
}

export function getGlobalMqttService(): MqttService {

 // 🚫 Laufzeit-Guard statt Top-Level-Throw
 if (typeof window !== 'undefined') {
    throw new Error('getGlobalMqttService darf nicht im Browser aufgerufen werden');
  }

  if (!globalThis.mqttServiceGlobal) {
    // Lazy imports → keine circular deps, keine HMR-Probleme
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

  return globalThis.mqttServiceGlobal;
}