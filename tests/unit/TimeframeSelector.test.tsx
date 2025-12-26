import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { TimeframeSelector } from '@/components/energy-dashboard/TimeframeSelector';

describe('TimeframeSelector', () => {
  it('should render all timeframe buttons', () => {
    const mockOnTimeframeChange = vi.fn();
    const mockOnDisplayModeChange = vi.fn();

    render(
      <TimeframeSelector
        timeframe="day"
        displayMode="kwh"
        onTimeframeChange={mockOnTimeframeChange}
        onDisplayModeChange={mockOnDisplayModeChange}
      />
    );

    expect(screen.getByText('Current Day')).toBeInTheDocument();
    expect(screen.getByText('Yesterday')).toBeInTheDocument();
    expect(screen.getByText('Last 7 Days')).toBeInTheDocument();
    expect(screen.getByText('Current Month')).toBeInTheDocument();
  });

  it('should render display mode buttons', () => {
    const mockOnTimeframeChange = vi.fn();
    const mockOnDisplayModeChange = vi.fn();

    render(
      <TimeframeSelector
        timeframe="day"
        displayMode="kwh"
        onTimeframeChange={mockOnTimeframeChange}
        onDisplayModeChange={mockOnDisplayModeChange}
      />
    );

    expect(screen.getByText('kWh')).toBeInTheDocument();
    expect(screen.getByText('€')).toBeInTheDocument();
  });

  it('should call onTimeframeChange when timeframe button is clicked', () => {
    const mockOnTimeframeChange = vi.fn();
    const mockOnDisplayModeChange = vi.fn();

    render(
      <TimeframeSelector
        timeframe="day"
        displayMode="kwh"
        onTimeframeChange={mockOnTimeframeChange}
        onDisplayModeChange={mockOnDisplayModeChange}
      />
    );

    const weekButton = screen.getByText('Last 7 Days');
    fireEvent.click(weekButton);

    expect(mockOnTimeframeChange).toHaveBeenCalledWith('week');
  });

  it('should call onDisplayModeChange when display mode button is clicked', () => {
    const mockOnTimeframeChange = vi.fn();
    const mockOnDisplayModeChange = vi.fn();

    render(
      <TimeframeSelector
        timeframe="day"
        displayMode="kwh"
        onTimeframeChange={mockOnTimeframeChange}
        onDisplayModeChange={mockOnDisplayModeChange}
      />
    );

    const costButton = screen.getByText('€');
    fireEvent.click(costButton);

    expect(mockOnDisplayModeChange).toHaveBeenCalledWith('cost');
  });

  it('should highlight active timeframe', () => {
    const mockOnTimeframeChange = vi.fn();
    const mockOnDisplayModeChange = vi.fn();

    render(
      <TimeframeSelector
        timeframe="week"
        displayMode="kwh"
        onTimeframeChange={mockOnTimeframeChange}
        onDisplayModeChange={mockOnDisplayModeChange}
      />
    );

    const weekButton = screen.getByText('Last 7 Days');
    expect(weekButton).toHaveClass('bg-primary');
  });

  it('should highlight active display mode', () => {
    const mockOnTimeframeChange = vi.fn();
    const mockOnDisplayModeChange = vi.fn();

    render(
      <TimeframeSelector
        timeframe="day"
        displayMode="cost"
        onTimeframeChange={mockOnTimeframeChange}
        onDisplayModeChange={mockOnDisplayModeChange}
      />
    );

    const costButton = screen.getByText('€');
    expect(costButton).toHaveClass('bg-primary');
  });
});

