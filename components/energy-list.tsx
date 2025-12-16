'use client';

import { useEffect, useRef, useState, useDeferredValue, startTransition } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import type { EnergyData, EnergyHistoryEntry } from '@/types/energy';

interface EnergyResponse {
  current: EnergyData;
  history: EnergyHistoryEntry[];
}

export function EnergyList() {
  const [history, setHistory] = useState<EnergyHistoryEntry[]>([]);
  const [error, setError] = useState<string | null>(null);
  const parentRef = useRef<HTMLDivElement>(null);

  // Defer history updates to prevent synchronous flushes during render
  const deferredHistory = useDeferredValue(history);

  // Virtualizer for the table rows - use deferred history to prevent flushSync errors
  const virtualizer = useVirtualizer({
    count: deferredHistory.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 40,
    overscan: 10,
  });

  useEffect(() => {
    const eventSource = new EventSource('/api/energy');

    eventSource.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data) as EnergyResponse;
        // Wrap state updates in startTransition to mark them as non-urgent
        // This prevents synchronous flushes that cause flushSync errors
        startTransition(() => {
          setHistory(data.history);
          setError(null);
        });
      } catch (err) {
        console.error('Error parsing SSE data:', err);
        startTransition(() => {
          setError('Failed to parse energy data');
        });
      }
    };

    eventSource.onerror = (err) => {
      console.error('SSE error:', err);
      startTransition(() => {
        setError('Connection error. Make sure the MQTT broker is running.');
      });
      eventSource.close();
    };

    return () => {
      eventSource.close();
    };
  }, []);

  const formatTimestamp = (timestamp: number): string => {
    // Validate timestamp is a valid number
    if (timestamp === null || timestamp === undefined || isNaN(timestamp)) {
      return 'Invalid timestamp';
    }
    
    const date = new Date(timestamp * 1000);
    // Check if date is valid
    if (isNaN(date.getTime())) {
      return 'Invalid date';
    }
    
    return date.toLocaleString();
  };

  const formatWatts = (watts: number): string => {
    if (watts >= 1000) {
      return `${(watts / 1000).toFixed(2)} kW`;
    }
    return `${watts.toFixed(0)} W`;
  };

  return (
    <div className="container mx-auto p-6 max-w-6xl">
      <Card>
        <CardHeader>
          <CardTitle>Energy Consumption History</CardTitle>
          <CardDescription>
            Real-time energy data from Go-E Controller ({deferredHistory.length} entries)
          </CardDescription>
        </CardHeader>
        <CardContent>
          {error && (
            <div className="mb-4 p-3 bg-destructive/10 text-destructive rounded-md">
              {error}
            </div>
          )}
          <div className="rounded-md border">
            <div className="overflow-x-auto border-b bg-muted/50">
              <div className="flex w-full">
                <div className="w-[200px] h-10 px-2 flex items-center font-medium text-foreground border-r">
                  Timestamp
                </div>
                <div className="flex-1 h-10 px-2 flex items-center justify-end font-medium text-foreground border-r">
                  Home
                </div>
                <div className="flex-1 h-10 px-2 flex items-center justify-end font-medium text-foreground border-r">
                  Grid
                </div>
                <div className="flex-1 h-10 px-2 flex items-center justify-end font-medium text-foreground border-r">
                  Car
                </div>
                <div className="flex-1 h-10 px-2 flex items-center justify-end font-medium text-foreground">
                  Solar
                </div>
              </div>
            </div>
            <div
              ref={parentRef}
              className="h-[600px] overflow-auto"
            >
              <div
                style={{
                  height: `${virtualizer.getTotalSize()}px`,
                  position: 'relative',
                }}
              >
                {virtualizer.getVirtualItems().map((virtualRow) => {
                  const entry = deferredHistory[virtualRow.index];
                  // Safety check: skip rendering if entry is undefined during transition
                  if (!entry) {
                    return null;
                  }
                  return (
                    <div
                      key={virtualRow.key}
                      data-index={virtualRow.index}
                      ref={virtualizer.measureElement}
                      className="border-b hover:bg-muted/50 transition-colors"
                      style={{
                        position: 'absolute',
                        top: 0,
                        left: 0,
                        width: '100%',
                        height: `${virtualRow.size}px`,
                        transform: `translateY(${virtualRow.start}px)`,
                      }}
                    >
                      <div className="flex w-full h-full">
                        <div className="w-[200px] px-2 flex items-center border-r">
                          {formatTimestamp(entry.timestamp)}
                        </div>
                        <div className="flex-1 px-2 flex items-center justify-end border-r">
                          {formatWatts(entry.home)}
                        </div>
                        <div className="flex-1 px-2 flex items-center justify-end border-r">
                          {formatWatts(entry.grid)}
                        </div>
                        <div className="flex-1 px-2 flex items-center justify-end border-r">
                          {formatWatts(entry.car)}
                        </div>
                        <div className="flex-1 px-2 flex items-center justify-end">
                          {formatWatts(entry.solar)}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

