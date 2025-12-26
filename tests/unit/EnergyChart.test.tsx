import { describe, it, expect } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { EnergyChart } from '@/components/energy-dashboard/EnergyChart';

const mockData = [
  { label: '10:00', kwh: 5.5, timestamp: 1000, value: 5.5 },
  { label: '11:00', kwh: 6.2, timestamp: 1100, value: 6.2 },
];

describe('EnergyChart', () => {
  it('should render chart with title and description', async () => {
    render(
      <EnergyChart
        data={mockData}
        displayMode="kwh"
        timeframe="day"
        loading={false}
        error={null}
        title="Test Chart"
        description="Test description"
      />
    );

    await waitFor(() => {
      expect(screen.getByText('Test Chart')).toBeInTheDocument();
      expect(screen.getByText('Test description')).toBeInTheDocument();
    });
  });

  it('should show loading state', () => {
    render(
      <EnergyChart
        data={[]}
        displayMode="kwh"
        timeframe="day"
        loading={true}
        error={null}
        title="Test Chart"
        description="Test description"
      />
    );

    expect(screen.getByText('Loading data...')).toBeInTheDocument();
  });

  it('should show error state', () => {
    render(
      <EnergyChart
        data={[]}
        displayMode="kwh"
        timeframe="day"
        loading={false}
        error="Error message"
        title="Test Chart"
        description="Test description"
      />
    );

    expect(screen.getByText('Error message')).toBeInTheDocument();
  });

  it('should show no data message when data is empty', () => {
    render(
      <EnergyChart
        data={[]}
        displayMode="kwh"
        timeframe="day"
        loading={false}
        error={null}
        title="Test Chart"
        description="Test description"
      />
    );

    expect(screen.getByText('No data available for the selected timeframe')).toBeInTheDocument();
  });

  it('should render chart container when data is available', async () => {
    const { container } = render(
      <EnergyChart
        data={mockData}
        displayMode="kwh"
        timeframe="day"
        loading={false}
        error={null}
        title="Test Chart"
        description="Test description"
      />
    );

    // Chart container should be rendered (check for data-chart attribute)
    await waitFor(() => {
      const chartContainer = container.querySelector('[data-chart]');
      expect(chartContainer).toBeInTheDocument();
    });
  });
});

