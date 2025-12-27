import { getPrismaClient } from '@/lib/db';
import { createEnergyRepository } from '@/lib/repositories/energy-repository';
import { createEnergyService } from './energy-service';
import { createEnergySettingsService } from './energy-settings-service';
import { createMqttService } from './mqtt-service';
import type { EnergyRepository } from '@/lib/repositories/energy-repository';
import type { EnergyService } from './energy-service';
import type { EnergySettingsService } from './energy-settings-service';
import type { MqttService } from './mqtt-service';
import { PrismaClient } from '@prisma/client';

/**
 * Container holding all service instances.
 * Used for dependency injection in API routes.
 */
export interface ServiceContainer {
  prisma: PrismaClient;
  repository: EnergyRepository;
  energyService: EnergyService;
  energySettingsService: EnergySettingsService;
  mqttService: MqttService;
}

/**
 * Factory function to create a service container with all dependencies.
 * This function wires up all services with their dependencies using dependency injection.
 * 
 * @returns ServiceContainer with all configured services
 */
export function createServiceContainer(): ServiceContainer {
  const prisma = getPrismaClient();
  const repository = createEnergyRepository(prisma);
  const energyService = createEnergyService(repository);
  const energySettingsService = createEnergySettingsService(repository);
  const mqttService = createMqttService(undefined, undefined, undefined, undefined, repository);
  
  return {
    prisma,
    repository,
    energyService,
    energySettingsService,
    mqttService,
  };
}

