import { describe, it, expect, beforeEach, vi } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useEnergyCostCalculations } from '@/hooks/useEnergyCostCalculations';
import type { EnergyService } from '@/lib/services/energy-service';
import type { EnergySettings } from '@/types/energy';
import type { EnergyDataState } from '@/hooks/useEnergyData';

describe('useEnergyCostCalculations', () => {
  let mockEnergyService: EnergyService;
  let mockSettings: EnergySettings;

  beforeEach(() => {
    // Create mock energy service
    mockEnergyService = {
      calculateConsumptionCost: vi.fn((kwh: number, timestamp: number, settings: EnergySettings | null) => {
        if (!settings || kwh <= 0) return 0;
        // Simple mock: return kwh * 0.2 for consumption
        return kwh * 0.2;
      }),
      calculateFeedInCost: vi.fn((kwh: number, settings: EnergySettings | null) => {
        if (!settings || kwh <= 0) return 0;
        // Simple mock: return kwh * 0.1 for feed-in
        return kwh * 0.1;
      }),
    } as any;

    // Create mock settings
    mockSettings = {
      id: 1,
      producing_price: 0.1,
      start_date: 1000,
      end_date: null,
      updated_at: 1000,
      consuming_periods: [
        {
          id: 1,
          energy_settings_id: 1,
          start_time: 0,
          end_time: 1440,
          price: 0.2,
        },
      ],
    };
  });

  const createEnergyDataState = (
    data: Array<{ label: string; kwh: number; timestamp: number }>,
    total: number
  ): EnergyDataState => ({
    data,
    total,
    loading: false,
    error: null,
  });

  it('should return kWh values when displayMode is kwh', () => {
    const consumption = createEnergyDataState(
      [{ label: '10:00', kwh: 5.5, timestamp: 1000 }],
      5.5
    );
    const feedIn = createEnergyDataState(
      [{ label: '10:00', kwh: 2.3, timestamp: 1000 }],
      2.3
    );
    const car = createEnergyDataState(
      [{ label: '10:00', kwh: 1.2, timestamp: 1000 }],
      1.2
    );
    const solar = createEnergyDataState(
      [{ label: '10:00', kwh: 3.4, timestamp: 1000 }],
      3.4
    );

    const { result } = renderHook(() =>
      useEnergyCostCalculations(
        consumption,
        feedIn,
        car,
        solar,
        'kwh',
        null,
        mockEnergyService
      )
    );

    // Chart data should have value equal to kwh
    expect(result.current.consumptionChartData).toEqual([
      { label: '10:00', kwh: 5.5, timestamp: 1000, value: 5.5 },
    ]);
    expect(result.current.feedInChartData).toEqual([
      { label: '10:00', kwh: 2.3, timestamp: 1000, value: 2.3 },
    ]);
    expect(result.current.carChartData).toEqual([
      { label: '10:00', kwh: 1.2, timestamp: 1000, value: 1.2 },
    ]);
    expect(result.current.solarChartData).toEqual([
      { label: '10:00', kwh: 3.4, timestamp: 1000, value: 3.4 },
    ]);

    // Totals should equal original totals
    expect(result.current.consumptionTotalValue).toBe(5.5);
    expect(result.current.feedInTotalValue).toBe(2.3);
    expect(result.current.carTotalValue).toBe(1.2);
    expect(result.current.solarTotalValue).toBe(3.4);

    // Service methods should not be called in kWh mode
    expect(mockEnergyService.calculateConsumptionCost).not.toHaveBeenCalled();
    expect(mockEnergyService.calculateFeedInCost).not.toHaveBeenCalled();
  });

  it('should calculate costs correctly when displayMode is cost and settings are provided', () => {
    const consumption = createEnergyDataState(
      [{ label: '10:00', kwh: 5.0, timestamp: 1000 }],
      5.0
    );
    const feedIn = createEnergyDataState(
      [{ label: '10:00', kwh: 3.0, timestamp: 1000 }],
      3.0
    );
    const car = createEnergyDataState(
      [{ label: '10:00', kwh: 2.0, timestamp: 1000 }],
      2.0
    );
    const solar = createEnergyDataState(
      [{ label: '10:00', kwh: 4.0, timestamp: 1000 }],
      4.0
    );

    const { result } = renderHook(() =>
      useEnergyCostCalculations(
        consumption,
        feedIn,
        car,
        solar,
        'cost',
        mockSettings,
        mockEnergyService
      )
    );

    // Consumption and car should use consumption cost (kwh * 0.2)
    expect(result.current.consumptionChartData[0].value).toBe(1.0); // 5.0 * 0.2
    expect(result.current.carChartData[0].value).toBe(0.4); // 2.0 * 0.2

    // FeedIn and solar should use feed-in cost (kwh * 0.1)
    expect(result.current.feedInChartData[0].value).toBeCloseTo(0.3); // 3.0 * 0.1
    expect(result.current.solarChartData[0].value).toBe(0.4); // 4.0 * 0.1

    // Totals should be sum of chart data values
    expect(result.current.consumptionTotalValue).toBe(1.0);
    expect(result.current.feedInTotalValue).toBeCloseTo(0.3);
    expect(result.current.carTotalValue).toBe(0.4);
    expect(result.current.solarTotalValue).toBe(0.4);

    // Verify service methods were called with correct parameters
    expect(mockEnergyService.calculateConsumptionCost).toHaveBeenCalledWith(
      5.0,
      1000,
      mockSettings
    );
    expect(mockEnergyService.calculateConsumptionCost).toHaveBeenCalledWith(
      2.0,
      1000,
      mockSettings
    );
    expect(mockEnergyService.calculateFeedInCost).toHaveBeenCalledWith(
      3.0,
      mockSettings
    );
    expect(mockEnergyService.calculateFeedInCost).toHaveBeenCalledWith(
      4.0,
      mockSettings
    );
  });

  it('should use correct calculation method for each energy type', () => {
    const consumption = createEnergyDataState(
      [{ label: '10:00', kwh: 10.0, timestamp: 1000 }],
      10.0
    );
    const feedIn = createEnergyDataState(
      [{ label: '10:00', kwh: 10.0, timestamp: 1000 }],
      10.0
    );
    const car = createEnergyDataState(
      [{ label: '10:00', kwh: 10.0, timestamp: 1000 }],
      10.0
    );
    const solar = createEnergyDataState(
      [{ label: '10:00', kwh: 10.0, timestamp: 1000 }],
      10.0
    );

    renderHook(() =>
      useEnergyCostCalculations(
        consumption,
        feedIn,
        car,
        solar,
        'cost',
        mockSettings,
        mockEnergyService
      )
    );

    // Consumption and car should use calculateConsumptionCost (with timestamp)
    expect(mockEnergyService.calculateConsumptionCost).toHaveBeenCalledWith(
      10.0,
      1000,
      mockSettings
    );
    expect(mockEnergyService.calculateConsumptionCost).toHaveBeenCalledTimes(2); // consumption + car

    // FeedIn and solar should use calculateFeedInCost (without timestamp)
    expect(mockEnergyService.calculateFeedInCost).toHaveBeenCalledWith(
      10.0,
      mockSettings
    );
    expect(mockEnergyService.calculateFeedInCost).toHaveBeenCalledTimes(2); // feedIn + solar
  });

  it('should handle null/missing settings gracefully in cost mode', () => {
    const consumption = createEnergyDataState(
      [{ label: '10:00', kwh: 5.0, timestamp: 1000 }],
      5.0
    );
    const feedIn = createEnergyDataState(
      [{ label: '10:00', kwh: 3.0, timestamp: 1000 }],
      3.0
    );
    const car = createEnergyDataState(
      [{ label: '10:00', kwh: 2.0, timestamp: 1000 }],
      2.0
    );
    const solar = createEnergyDataState(
      [{ label: '10:00', kwh: 4.0, timestamp: 1000 }],
      4.0
    );

    const { result } = renderHook(() =>
      useEnergyCostCalculations(
        consumption,
        feedIn,
        car,
        solar,
        'cost',
        null,
        mockEnergyService
      )
    );

    // When settings are null, costs should be 0
    expect(result.current.consumptionChartData[0].value).toBe(0);
    expect(result.current.feedInChartData[0].value).toBe(0);
    expect(result.current.carChartData[0].value).toBe(0);
    expect(result.current.solarChartData[0].value).toBe(0);

    // Totals should be 0
    expect(result.current.consumptionTotalValue).toBe(0);
    expect(result.current.feedInTotalValue).toBe(0);
    expect(result.current.carTotalValue).toBe(0);
    expect(result.current.solarTotalValue).toBe(0);
  });

  it('should calculate totals correctly with multiple data points in cost mode', () => {
    const consumption = createEnergyDataState(
      [
        { label: '10:00', kwh: 5.0, timestamp: 1000 },
        { label: '11:00', kwh: 3.0, timestamp: 2000 },
        { label: '12:00', kwh: 2.0, timestamp: 3000 },
      ],
      10.0
    );
    const feedIn = createEnergyDataState([], 0);
    const car = createEnergyDataState([], 0);
    const solar = createEnergyDataState([], 0);

    const { result } = renderHook(() =>
      useEnergyCostCalculations(
        consumption,
        feedIn,
        car,
        solar,
        'cost',
        mockSettings,
        mockEnergyService
      )
    );

    // Each point should have cost: 5.0*0.2=1.0, 3.0*0.2=0.6, 2.0*0.2=0.4
    expect(result.current.consumptionChartData).toHaveLength(3);
    expect(result.current.consumptionChartData[0].value).toBe(1.0);
    expect(result.current.consumptionChartData[1].value).toBeCloseTo(0.6);
    expect(result.current.consumptionChartData[2].value).toBe(0.4);

    // Total should be sum: 1.0 + 0.6 + 0.4 = 2.0
    expect(result.current.consumptionTotalValue).toBe(2.0);
  });

  it('should memoize results correctly', () => {
    const consumption = createEnergyDataState(
      [{ label: '10:00', kwh: 5.0, timestamp: 1000 }],
      5.0
    );
    const feedIn = createEnergyDataState(
      [{ label: '10:00', kwh: 3.0, timestamp: 1000 }],
      3.0
    );
    const car = createEnergyDataState(
      [{ label: '10:00', kwh: 2.0, timestamp: 1000 }],
      2.0
    );
    const solar = createEnergyDataState(
      [{ label: '10:00', kwh: 4.0, timestamp: 1000 }],
      4.0
    );

    const { result, rerender } = renderHook(
      ({ consumption, feedIn, car, solar, displayMode, settings }) =>
        useEnergyCostCalculations(
          consumption,
          feedIn,
          car,
          solar,
          displayMode,
          settings,
          mockEnergyService
        ),
      {
        initialProps: {
          consumption,
          feedIn,
          car,
          solar,
          displayMode: 'kwh' as const,
          settings: null,
        },
      }
    );

    const firstResult = result.current;
    const firstConsumptionTotal = firstResult.consumptionTotalValue;

    // Rerender with same props - should return same values (memoized)
    rerender({
      consumption,
      feedIn,
      car,
      solar,
      displayMode: 'kwh',
      settings: null,
    });

    // Check that values haven't changed (memoization working)
    expect(result.current.consumptionTotalValue).toBe(firstConsumptionTotal);
    expect(result.current.feedInTotalValue).toBe(firstResult.feedInTotalValue);
    expect(result.current.carTotalValue).toBe(firstResult.carTotalValue);
    expect(result.current.solarTotalValue).toBe(firstResult.solarTotalValue);

    // Clear mocks to check if they're called again
    vi.clearAllMocks();

    // Rerender with different displayMode - should recalculate
    rerender({
      consumption,
      feedIn,
      car,
      solar,
      displayMode: 'cost',
      settings: mockSettings,
    });

    // Should have different values now
    expect(result.current.consumptionTotalValue).not.toBe(firstResult.consumptionTotalValue);
    expect(mockEnergyService.calculateConsumptionCost).toHaveBeenCalled();
  });

  it('should handle empty data arrays', () => {
    const emptyState = createEnergyDataState([], 0);

    const { result } = renderHook(() =>
      useEnergyCostCalculations(
        emptyState,
        emptyState,
        emptyState,
        emptyState,
        'cost',
        mockSettings,
        mockEnergyService
      )
    );

    expect(result.current.consumptionChartData).toEqual([]);
    expect(result.current.feedInChartData).toEqual([]);
    expect(result.current.carChartData).toEqual([]);
    expect(result.current.solarChartData).toEqual([]);

    expect(result.current.consumptionTotalValue).toBe(0);
    expect(result.current.feedInTotalValue).toBe(0);
    expect(result.current.carTotalValue).toBe(0);
    expect(result.current.solarTotalValue).toBe(0);
  });
});

