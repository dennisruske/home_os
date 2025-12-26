import { describe, it, expect, beforeEach, vi } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { useEnergyData } from '@/hooks/useEnergyData';
import type { AggregatedResponse, GridAggregatedResponse } from '@/hooks/useEnergyData';

// Mock fetch globally
global.fetch = vi.fn();

describe('useEnergyData', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should fetch all energy data in parallel', async () => {
    const mockGridData: GridAggregatedResponse = {
      consumption: {
        data: [{ label: '10:00', kwh: 5.5, timestamp: 1000 }],
        total: 5.5,
      },
      feedIn: {
        data: [{ label: '10:00', kwh: 2.3, timestamp: 1000 }],
        total: 2.3,
      },
    };

    const mockCarData: AggregatedResponse = {
      data: [{ label: '10:00', kwh: 1.2, timestamp: 1000 }],
      total: 1.2,
    };

    const mockSolarData: AggregatedResponse = {
      data: [{ label: '10:00', kwh: 3.4, timestamp: 1000 }],
      total: 3.4,
    };

    (global.fetch as any)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => mockGridData,
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => mockCarData,
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => mockSolarData,
      });

    const { result } = renderHook(() => useEnergyData('day'));

    await waitFor(() => {
      expect(result.current.consumption.loading).toBe(false);
      expect(result.current.feedIn.loading).toBe(false);
      expect(result.current.car.loading).toBe(false);
      expect(result.current.solar.loading).toBe(false);
    });

    expect(result.current.consumption.data).toEqual(mockGridData.consumption.data);
    expect(result.current.consumption.total).toBe(5.5);
    expect(result.current.feedIn.data).toEqual(mockGridData.feedIn.data);
    expect(result.current.feedIn.total).toBe(2.3);
    expect(result.current.car.data).toEqual(mockCarData.data);
    expect(result.current.car.total).toBe(1.2);
    expect(result.current.solar.data).toEqual(mockSolarData.data);
    expect(result.current.solar.total).toBe(3.4);
  });

  it('should handle errors gracefully', async () => {
    // Mock all 3 fetch calls to reject (grid, car, solar)
    (global.fetch as any)
      .mockRejectedValueOnce(new Error('Network error'))
      .mockRejectedValueOnce(new Error('Network error'))
      .mockRejectedValueOnce(new Error('Network error'));

    const { result } = renderHook(() => useEnergyData('day'));

    await waitFor(() => {
      expect(result.current.consumption.loading).toBe(false);
      expect(result.current.feedIn.loading).toBe(false);
      expect(result.current.car.loading).toBe(false);
      expect(result.current.solar.loading).toBe(false);
    });

    expect(result.current.consumption.error).toBeTruthy();
    expect(result.current.feedIn.error).toBeTruthy();
    expect(result.current.car.error).toBeTruthy();
    expect(result.current.solar.error).toBeTruthy();
  });

  it('should refetch when timeframe changes', async () => {
    const mockData: GridAggregatedResponse = {
      consumption: { data: [], total: 0 },
      feedIn: { data: [], total: 0 },
    };

    (global.fetch as any).mockResolvedValue({
      ok: true,
      json: async () => mockData,
    });

    const { result, rerender } = renderHook(
      ({ timeframe }) => useEnergyData(timeframe),
      {
        initialProps: { timeframe: 'day' as const },
      }
    );

    await waitFor(() => {
      expect(result.current.consumption.loading).toBe(false);
    });

    rerender({ timeframe: 'week' });

    await waitFor(() => {
      expect(result.current.consumption.loading).toBe(false);
    });

    // Should have been called multiple times (once for each timeframe)
    expect(global.fetch).toHaveBeenCalledTimes(6); // 3 calls for 'day', 3 calls for 'week'
  });
});

