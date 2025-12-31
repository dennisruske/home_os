import { getPrismaClient } from '@/lib/db';
import { createEnergyRepository } from '@/lib/repositories/energy-repository';
import { createEnergyBucketRepository } from '@/lib/repositories/energy-bucket-repository';
import { createEnergyService } from './energy-service';
import { createEnergySettingsService } from './energy-settings-service';
import { createMqttService } from './mqtt-service';
import { createEnergyAggregationJob } from './energy-aggregation-job';
import { getRedisClient } from '@/lib/cache/cache-client';
import { createRedisCache } from '@/lib/cache/redis-cache';
import type { EnergyRepository } from '@/lib/repositories/energy-repository';
import type { EnergyBucketRepository } from '@/lib/repositories/energy-bucket-repository';
import type { EnergyService } from './energy-service';
import type { EnergySettingsService } from './energy-settings-service';
import type { EnergyAggregationJob } from './energy-aggregation-job';
import type { Cache } from '@/lib/cache/cache-interface';
import { PrismaClient } from '@prisma/client';
import { getGlobalMqttService } from '@/lib/mqtt-singleton';


/**
 * Container holding all service instances.
 * Used for dependency injection in API routes.
 */
export interface ServiceContainer {
  prisma: PrismaClient;
  repository: EnergyRepository;
  bucketRepository: EnergyBucketRepository;
  cache: Cache | null;
  energyService: EnergyService;
  energySettingsService: EnergySettingsService;
  mqttService: MqttService;
  aggregationJob: EnergyAggregationJob;
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
  const bucketRepository = createEnergyBucketRepository(prisma);
  
  // Cache is optional - create only if REDIS_URL is configured
  let cache: Cache | null = null;
  try {
    const redisClient = getRedisClient();
    cache = createRedisCache(redisClient);
  } catch (error) {
    console.warn('Redis cache not available, continuing without cache:', error);
  }

  const energyService = createEnergyService(repository, bucketRepository, cache || undefined);
  const energySettingsService = createEnergySettingsService(repository);
  const mqttService = getGlobalMqttService();//createMqttService(undefined, undefined, undefined, undefined, repository);
  const aggregationJob = createEnergyAggregationJob(prisma, cache || undefined);
  
  return {
    prisma,
    repository,
    bucketRepository,
    cache,
    energyService,
    energySettingsService,
    mqttService,
    aggregationJob,
  };
}

