'use client';

export type Timeframe = 'day' | 'yesterday' | 'week' | 'month';
export type DisplayMode = 'kwh' | 'cost';

export function getTimeframeLabel(tf: Timeframe): string {
  switch (tf) {
    case 'day':
      return 'Current Day';
    case 'yesterday':
      return 'Yesterday';
    case 'week':
      return 'Last 7 Days';
    case 'month':
      return 'Current Month';
  }
}

interface TimeframeSelectorProps {
  timeframe: Timeframe;
  displayMode: DisplayMode;
  onTimeframeChange: (timeframe: Timeframe) => void;
  onDisplayModeChange: (displayMode: DisplayMode) => void;
}

export function TimeframeSelector({
  timeframe,
  displayMode,
  onTimeframeChange,
  onDisplayModeChange,
}: TimeframeSelectorProps) {
  return (
    <div className="mb-6 flex justify-between items-center">
      <div className="flex gap-2">
        {(['kwh', 'cost'] as DisplayMode[]).map((mode) => (
          <button
            key={mode}
            onClick={() => onDisplayModeChange(mode)}
            className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
              displayMode === mode
                ? 'bg-primary text-primary-foreground'
                : 'bg-muted text-muted-foreground hover:bg-muted/80'
            }`}
          >
            {mode === 'kwh' ? 'kWh' : '€'}
          </button>
        ))}
      </div>
      <div className="flex gap-2">
        {(['day', 'yesterday', 'week', 'month'] as Timeframe[]).map((tf) => (
          <button
            key={tf}
            onClick={() => onTimeframeChange(tf)}
            className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
              timeframe === tf
                ? 'bg-primary text-primary-foreground'
                : 'bg-muted text-muted-foreground hover:bg-muted/80'
            }`}
          >
            {getTimeframeLabel(tf)}
          </button>
        ))}
      </div>
    </div>
  );
}

