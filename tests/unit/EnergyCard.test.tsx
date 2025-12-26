import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { EnergyCard } from '@/components/energy-dashboard/EnergyCard';

describe('EnergyCard', () => {
  it('should render card with title and description', () => {
    render(
      <EnergyCard
        title="Test Card"
        description="Test description"
        value={100}
        displayMode="kwh"
        timeframe="day"
        loading={false}
        error={null}
        color="hsl(var(--chart-1))"
      />
    );

    expect(screen.getByText('Test Card')).toBeInTheDocument();
    expect(screen.getByText('Test description')).toBeInTheDocument();
  });

  it('should display value in kWh mode', () => {
    render(
      <EnergyCard
        title="Test Card"
        description="Test description"
        value={100.5}
        displayMode="kwh"
        timeframe="day"
        loading={false}
        error={null}
        color="hsl(var(--chart-1))"
      />
    );

    expect(screen.getByText(/100\.50 kWh/)).toBeInTheDocument();
  });

  it('should display value in cost mode', () => {
    render(
      <EnergyCard
        title="Test Card"
        description="Test description"
        value={50.25}
        displayMode="cost"
        timeframe="day"
        loading={false}
        error={null}
        color="hsl(var(--chart-1))"
      />
    );

    expect(screen.getByText(/€50\.25/)).toBeInTheDocument();
  });

  it('should show loading state', () => {
    render(
      <EnergyCard
        title="Test Card"
        description="Test description"
        value={100}
        displayMode="kwh"
        timeframe="day"
        loading={true}
        error={null}
        color="hsl(var(--chart-1))"
      />
    );

    expect(screen.getByText('Loading...')).toBeInTheDocument();
  });

  it('should show error state', () => {
    render(
      <EnergyCard
        title="Test Card"
        description="Test description"
        value={100}
        displayMode="kwh"
        timeframe="day"
        loading={false}
        error="Error message"
        color="hsl(var(--chart-1))"
      />
    );

    expect(screen.getByText('Error message')).toBeInTheDocument();
  });

  it('should show loading when settings are loading in cost mode', () => {
    render(
      <EnergyCard
        title="Test Card"
        description="Test description"
        value={100}
        displayMode="cost"
        timeframe="day"
        loading={false}
        error={null}
        color="hsl(var(--chart-1))"
        settingsLoading={true}
      />
    );

    expect(screen.getByText('Loading...')).toBeInTheDocument();
  });
});

