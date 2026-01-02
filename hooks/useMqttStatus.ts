'use client';

import { useEffect, useState } from 'react';

export interface MqttStatus {
  isOnline: boolean;
  lastMessageTimestamp: number | null;
  loading: boolean;
  error: string | null;
}

/**
 * Custom hook to fetch MQTT status and determine if it's online.
 * Polls the status API every 10 seconds and considers it online if
 * a message was received within the last 60 seconds.
 */
export function useMqttStatus(): MqttStatus {
  const [status, setStatus] = useState<MqttStatus>({
    isOnline: false,
    lastMessageTimestamp: null,
    loading: true,
    error: null,
  });

  useEffect(() => {
    const fetchStatus = async () => {
      try {
        const response = await fetch('/api/mqtt/status');
        if (!response.ok) {
          throw new Error('Failed to fetch MQTT status');
        }
        const data = await response.json();

        const now = Math.floor(Date.now() / 1000);
        const isOnline = data.lastMessageTimestamp &&
          (now - data.lastMessageTimestamp) <= 60;

        setStatus({
          isOnline,
          lastMessageTimestamp: data.lastMessageTimestamp,
          loading: false,
          error: null,
        });
      } catch (error) {
        console.error('Error fetching MQTT status:', error);
        setStatus(prev => ({
          ...prev,
          loading: false,
          error: error instanceof Error ? error.message : 'Unknown error',
          isOnline: false, // Default to offline on error
        }));
      }
    };

    // Fetch immediately
    fetchStatus();

    // Poll every 10 seconds (skip in test environment)
    const interval = typeof window !== 'undefined' && process.env.NODE_ENV !== 'test'
      ? setInterval(fetchStatus, 10000)
      : null;

    return () => {
      if (interval) clearInterval(interval);
    };
  }, []);

  return status;
}