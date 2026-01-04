import { describe, it, expect, beforeEach, vi } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { useEnergySettings } from '@/hooks/useEnergySettings';
import type { EnergySettingsResponse } from '@/hooks/useEnergySettings';

// Mock fetch globally
global.fetch = vi.fn();

describe('useEnergySettings', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should fetch settings when displayMode is cost', async () => {
    const mockSettings: EnergySettingsResponse = {
      producing_price: 0.1,
      consuming_periods: [
        {
          id: 1,
          energy_settings_id: 1,
          start_time: 0,
          end_time: 1440,
          price: 0.2,
        },
      ],
      start_date: 1000,
      end_date: null,
    };

    (global.fetch as any).mockResolvedValueOnce({
      ok: true,
      json: async () => mockSettings,
    });

    const { result } = renderHook(() => useEnergySettings('cost'));

    expect(result.current.loading).toBe(true);

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.settings).toBeTruthy();
    expect(result.current.settings?.producing_price).toBe(0.1);
    expect(result.current.settings?.consuming_periods).toHaveLength(1);
  });

  it('should not fetch settings when displayMode is kwh', async () => {
    const { result } = renderHook(() => useEnergySettings('kwh'));

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.settings).toBeNull();
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it('should handle fetch errors', async () => {
    (global.fetch as any).mockRejectedValueOnce(new Error('Network error'));

    const { result } = renderHook(() => useEnergySettings('cost'));

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.error).toBeTruthy();
    expect(result.current.settings).toBeNull();
  });

  it('should clear settings when switching from cost to kwh', async () => {
    const mockSettings: EnergySettingsResponse = {
      producing_price: 0.1,
      consuming_periods: [],
      start_date: 1000,
      end_date: null,
    };

    (global.fetch as any).mockResolvedValue({
      ok: true,
      json: async () => mockSettings,
    });

    const { result, rerender } = renderHook(
      ({ displayMode }) => useEnergySettings(displayMode),
      {
        initialProps: { displayMode: 'cost' as const },
      }
    );

    await waitFor(() => {
      expect(result.current.settings).toBeTruthy();
    });

    rerender({ displayMode: 'kwh' });

    await waitFor(() => {
      expect(result.current.settings).toBeNull();
    });
  });
});

