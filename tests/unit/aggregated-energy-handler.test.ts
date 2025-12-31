import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest, NextResponse } from 'next/server';
import { handleAggregatedEnergyRequest } from '@/lib/api/aggregated-energy-handler';
import { createServiceContainer } from '@/lib/services/service-container';
import type { EnergyReading, AggregatedResponse, GridAggregatedResponse } from '@/types/energy';

// Mock the service container
vi.mock('@/lib/services/service-container');
vi.mock('@/lib/energy-aggregation', () => ({
  getTimeframeBounds: vi.fn((timeframe: string) => {
    const now = new Date();
    const start = new Date(now);
    start.setHours(0, 0, 0, 0);
    return {
      start: Math.floor(start.getTime() / 1000),
      end: Math.floor(now.getTime() / 1000),
    };
  }),
}));

describe('handleAggregatedEnergyRequest', () => {
  let mockEnergyService: any;
  const mockReadings: EnergyReading[] = [
    {
      id: 1,
      timestamp: 1704067200, // 2024-01-01T00:00:00Z
      home: 1000,
      grid: 2000,
      car: 500,
      solar: 3000,
      created_at: 1704067200,
    },
  ];

  beforeEach(() => {
    vi.clearAllMocks();
    mockEnergyService = {
      getReadingsForRange: vi.fn().mockResolvedValue(mockReadings),
      aggregateEnergyData: vi.fn(),
      getAggregatedEnergyData: vi.fn(),
    };
    vi.mocked(createServiceContainer).mockReturnValue({
      energyService: mockEnergyService,
    } as any);
  });

  function createMockRequest(url: string): NextRequest {
    return new NextRequest(new URL(url, 'http://localhost:3000'));
  }

  describe('grid type', () => {
    it('should handle grid aggregation request with default timeframe', async () => {
      const mockGridResponse: GridAggregatedResponse = {
        consumption: { data: [], total: 100 },
        feedIn: { data: [], total: 50 },
      };
      mockEnergyService.getAggregatedEnergyData.mockResolvedValue(mockGridResponse);

      const request = createMockRequest('/api/energy/aggregated/grid');
      const response = await handleAggregatedEnergyRequest(request, 'grid');

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data).toEqual(mockGridResponse);
      expect(mockEnergyService.getAggregatedEnergyData).toHaveBeenCalledWith(
        expect.any(Number),
        expect.any(Number),
        'day',
        'grid'
      );
    });

    it('should handle grid aggregation request with custom timeframe', async () => {
      const mockGridResponse: GridAggregatedResponse = {
        consumption: { data: [], total: 200 },
        feedIn: { data: [], total: 100 },
      };
      mockEnergyService.getAggregatedEnergyData.mockResolvedValue(mockGridResponse);

      const request = createMockRequest('/api/energy/aggregated/grid?timeframe=week');
      const response = await handleAggregatedEnergyRequest(request, 'grid');

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data).toEqual(mockGridResponse);
      expect(mockEnergyService.getAggregatedEnergyData).toHaveBeenCalledWith(
        expect.any(Number),
        expect.any(Number),
        'week',
        'grid'
      );
    });

    it('should handle grid aggregation request with custom start and end timestamps', async () => {
      const mockGridResponse: GridAggregatedResponse = {
        consumption: { data: [], total: 150 },
        feedIn: { data: [], total: 75 },
      };
      mockEnergyService.getAggregatedEnergyData.mockResolvedValue(mockGridResponse);

      const start = 1704067200;
      const end = 1704153600;
      const request = createMockRequest(
        `/api/energy/aggregated/grid?start=${start}&end=${end}`
      );
      const response = await handleAggregatedEnergyRequest(request, 'grid');

      expect(response.status).toBe(200);
      expect(mockEnergyService.getAggregatedEnergyData).toHaveBeenCalledWith(
        start,
        end,
        'day',
        'grid'
      );
    });
  });

  describe('car type', () => {
    it('should handle car aggregation request', async () => {
      const mockCarResponse: AggregatedResponse = {
        data: [],
        total: 500,
      };
      mockEnergyService.getAggregatedEnergyData.mockResolvedValue(mockCarResponse);

      const request = createMockRequest('/api/energy/aggregated/car?timeframe=day');
      const response = await handleAggregatedEnergyRequest(request, 'car');

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data).toEqual(mockCarResponse);
      expect(mockEnergyService.getAggregatedEnergyData).toHaveBeenCalledWith(
        expect.any(Number),
        expect.any(Number),
        'day',
        'car'
      );
    });
  });

  describe('solar type', () => {
    it('should handle solar aggregation request', async () => {
      const mockSolarResponse: AggregatedResponse = {
        data: [],
        total: 3000,
      };
      mockEnergyService.getAggregatedEnergyData.mockResolvedValue(mockSolarResponse);

      const request = createMockRequest('/api/energy/aggregated/solar?timeframe=month');
      const response = await handleAggregatedEnergyRequest(request, 'solar');

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data).toEqual(mockSolarResponse);
      expect(mockEnergyService.getAggregatedEnergyData).toHaveBeenCalledWith(
        expect.any(Number),
        expect.any(Number),
        'month',
        'solar'
      );
    });
  });

  describe('error handling', () => {
    it('should return 500 error when service throws an error', async () => {
      mockEnergyService.getAggregatedEnergyData.mockRejectedValue(new Error('Database error'));

      const request = createMockRequest('/api/energy/aggregated/grid');
      const response = await handleAggregatedEnergyRequest(request, 'grid');

      expect(response.status).toBe(500);
      const data = await response.json();
      expect(data).toEqual({ error: 'Failed to aggregate grid energy data' });
    });

    it('should return 500 error when aggregation fails', async () => {
      mockEnergyService.getAggregatedEnergyData.mockRejectedValue(new Error('Aggregation error'));

      const request = createMockRequest('/api/energy/aggregated/car');
      const response = await handleAggregatedEnergyRequest(request, 'car');

      expect(response.status).toBe(500);
      const data = await response.json();
      expect(data).toEqual({ error: 'Failed to aggregate car energy data' });
    });

    it('should include type in error message', async () => {
      mockEnergyService.getAggregatedEnergyData.mockRejectedValue(new Error('Service error'));

      const request = createMockRequest('/api/energy/aggregated/solar');
      const response = await handleAggregatedEnergyRequest(request, 'solar');

      expect(response.status).toBe(500);
      const data = await response.json();
      expect(data.error).toContain('solar');
    });
  });
});

