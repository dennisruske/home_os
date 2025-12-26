import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { EnergyDashboard } from '@/components/energy-dashboard';

// Mock the hooks
vi.mock('@/hooks/useEnergyData', () => ({
  useEnergyData: vi.fn(),
}));

vi.mock('@/hooks/useEnergySettings', () => ({
  useEnergySettings: vi.fn(),
}));

// Mock the energy service
vi.mock('@/lib/services/energy-service', () => ({
  getEnergyService: vi.fn(() => ({
    calculateConsumptionCost: vi.fn((kwh: number) => kwh * 0.2),
    calculateFeedInCost: vi.fn((kwh: number) => kwh * 0.1),
  })),
}));

import { useEnergyData } from '@/hooks/useEnergyData';
import { useEnergySettings } from '@/hooks/useEnergySettings';

describe('EnergyDashboard', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    // Default mock implementations
    (useEnergyData as any).mockReturnValue({
      consumption: {
        data: [{ label: '10:00', kwh: 5.5, timestamp: 1000 }],
        total: 5.5,
        loading: false,
        error: null,
      },
      feedIn: {
        data: [{ label: '10:00', kwh: 2.3, timestamp: 1000 }],
        total: 2.3,
        loading: false,
        error: null,
      },
      car: {
        data: [{ label: '10:00', kwh: 1.2, timestamp: 1000 }],
        total: 1.2,
        loading: false,
        error: null,
      },
      solar: {
        data: [{ label: '10:00', kwh: 3.4, timestamp: 1000 }],
        total: 3.4,
        loading: false,
        error: null,
      },
    });

    (useEnergySettings as any).mockReturnValue({
      settings: null,
      loading: false,
      error: null,
    });
  });

  it('should render all energy cards', async () => {
    render(<EnergyDashboard />);

    await waitFor(() => {
      expect(screen.getByText('Grid Energy Consumption')).toBeInTheDocument();
      expect(screen.getByText('Grid Energy Feed-In')).toBeInTheDocument();
      expect(screen.getByText('Car Energy Consumption')).toBeInTheDocument();
      expect(screen.getByText('Solar Energy Production')).toBeInTheDocument();
    });
  });

  it('should render chart', async () => {
    render(<EnergyDashboard />);

    await waitFor(() => {
      expect(screen.getByText('Grid Energy Consumption Overview')).toBeInTheDocument();
    });
  });

  it('should render timeframe selector', async () => {
    render(<EnergyDashboard />);

    await waitFor(() => {
      expect(screen.getByText('Current Day')).toBeInTheDocument();
      expect(screen.getByText('kWh')).toBeInTheDocument();
    });
  });

  it('should display values in kWh mode', async () => {
    render(<EnergyDashboard />);

    await waitFor(() => {
      // Should display kWh values - check for the formatted value
      expect(screen.getByText(/5\.50 kWh/)).toBeInTheDocument();
    });
  });
});

