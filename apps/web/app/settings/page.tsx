'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import type { EnergySettings, ConsumingPricePeriod } from '@/types/energy';

export default function SettingsPage() {
  const [producingPrice, setProducingPrice] = useState<string>('');
  const [consumingPeriods, setConsumingPeriods] = useState<ConsumingPricePeriod[]>([]);
  const [effectiveDate, setEffectiveDate] = useState<string>('');
  const [currentSettings, setCurrentSettings] = useState<EnergySettings | null>(null);
  const [priceHistory, setPriceHistory] = useState<EnergySettings[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      setError(null);
      try {
        // Fetch current settings
        const settingsResponse = await fetch('/api/energy/settings');
        if (!settingsResponse.ok) {
          throw new Error('Failed to fetch current settings');
        }
        const settingsData = await settingsResponse.json();
        setCurrentSettings(settingsData);
        setProducingPrice(settingsData.producing_price?.toString() || '');
        // Initialize consuming periods, or create a default one if none exist
        if (settingsData.consuming_periods && settingsData.consuming_periods.length > 0) {
          setConsumingPeriods(settingsData.consuming_periods);
        } else {
          // Create a default period covering the full day
          setConsumingPeriods([{
            id: 0,
            energy_settings_id: 0,
            start_time: 0,
            end_time: 1439,
            price: 0,
          }]);
        }

        // Fetch price history
        const historyResponse = await fetch('/api/energy/settings/history');
        if (!historyResponse.ok) {
          throw new Error('Failed to fetch price history');
        }
        const historyData = await historyResponse.json();
        setPriceHistory(historyData.settings || []);
      } catch (err) {
        console.error('Error fetching settings:', err);
        setError(err instanceof Error ? err.message : 'Failed to load settings');
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  const addConsumingPeriod = () => {
    setConsumingPeriods([
      ...consumingPeriods,
      {
        id: Date.now(), // Temporary ID for new periods
        energy_settings_id: 0,
        start_time: 0,
        end_time: 1439,
        price: 0,
      },
    ]);
  };

  const removeConsumingPeriod = (index: number) => {
    setConsumingPeriods(consumingPeriods.filter((_, i) => i !== index));
  };

  const updateConsumingPeriod = (
    index: number,
    field: 'start_time' | 'end_time' | 'price',
    value: string
  ) => {
    const updated = [...consumingPeriods];
    if (field === 'price') {
      updated[index] = { ...updated[index], [field]: parseFloat(value) || 0 };
    } else {
      // Convert time string (HH:MM) to minutes
      const [hours, minutes] = value.split(':').map(Number);
      const totalMinutes = (hours || 0) * 60 + (minutes || 0);
      updated[index] = { ...updated[index], [field]: totalMinutes };
    }
    setConsumingPeriods(updated);
  };

  const formatTimeFromMinutes = (minutes: number): string => {
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return `${String(hours).padStart(2, '0')}:${String(mins).padStart(2, '0')}`;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    setSuccess(false);

    try {
      const producing = parseFloat(producingPrice);

      if (isNaN(producing)) {
        throw new Error('Please enter a valid number for producing price');
      }

      if (producing < 0) {
        throw new Error('Producing price must be non-negative');
      }

      if (consumingPeriods.length === 0) {
        throw new Error('At least one consuming price period is required');
      }

      // Validate periods
      for (const period of consumingPeriods) {
        if (period.price < 0) {
          throw new Error('All prices must be non-negative');
        }
        if (period.start_time < 0 || period.start_time > 1439 ||
            period.end_time < 0 || period.end_time > 1439) {
          throw new Error('Time values must be between 00:00 and 23:59');
        }
      }

      // Convert effective date to Unix timestamp if provided
      let startDate: number | undefined;
      if (effectiveDate) {
        const date = new Date(effectiveDate);
        if (isNaN(date.getTime())) {
          throw new Error('Invalid date format');
        }
        startDate = Math.floor(date.getTime() / 1000);
      }

      // Prepare consuming periods (remove temporary IDs)
      const periodsToSave = consumingPeriods.map(({ id, energy_settings_id, ...rest }) => rest);

      const response = await fetch('/api/energy/settings', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          producing_price: producing,
          consuming_periods: periodsToSave,
          start_date: startDate,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || errorData.details || 'Failed to save settings');
      }

      setSuccess(true);
      setTimeout(() => setSuccess(false), 3000);
      
      // Reload data
      const settingsResponse = await fetch('/api/energy/settings');
      if (settingsResponse.ok) {
        const settingsData = await settingsResponse.json();
        setCurrentSettings(settingsData);
      }

      const historyResponse = await fetch('/api/energy/settings/history');
      if (historyResponse.ok) {
        const historyData = await historyResponse.json();
        setPriceHistory(historyData.settings || []);
      }

      // Clear form
      setEffectiveDate('');
    } catch (err) {
      console.error('Error saving settings:', err);
      setError(err instanceof Error ? err.message : 'Failed to save settings');
    } finally {
      setSaving(false);
    }
  };

  const formatPrice = (value: string | number): string => {
    if (value === '' || value === null || value === undefined) return '';
    const num = typeof value === 'string' ? parseFloat(value) : value;
    if (isNaN(num)) return '';
    return `€${num.toFixed(4)}`;
  };

  const formatDate = (timestamp: number): string => {
    const date = new Date(timestamp * 1000);
    return date.toLocaleString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  return (
    <div className="min-h-screen bg-background">
      <main className="container mx-auto p-6 max-w-4xl space-y-6">
        {/* Current Settings Card */}
        <Card>
          <CardHeader>
            <CardTitle>Energy Price Settings</CardTitle>
            <CardDescription>
              Configure the price per kilowatt hour. Producing price is a single value, while consuming price can have different rates for different times of day (e.g., day/night tariffs).
            </CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <p className="text-muted-foreground">Loading settings...</p>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-6">
                {/* Producing Price */}
                <div className="space-y-2">
                  <Label htmlFor="producing-price">
                    Producing Price (€/kWh)
                  </Label>
                  <Input
                    id="producing-price"
                    type="number"
                    step="0.0001"
                    min="0"
                    value={producingPrice}
                    onChange={(e) => setProducingPrice(e.target.value)}
                    placeholder="0.0000"
                    required
                  />
                  {producingPrice && !isNaN(parseFloat(producingPrice)) && (
                    <p className="text-sm text-muted-foreground">
                      {formatPrice(producingPrice)} per kWh
                    </p>
                  )}
                </div>

                {/* Consuming Price Periods */}
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <Label>Consuming Price Periods (€/kWh)</Label>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={addConsumingPeriod}
                    >
                      Add Period
                    </Button>
                  </div>
                  
                  {consumingPeriods.length === 0 ? (
                    <p className="text-sm text-muted-foreground">
                      No consuming price periods defined. Click "Add Period" to add one.
                    </p>
                  ) : (
                    <div className="space-y-3">
                      {consumingPeriods.map((period, index) => (
                        <div key={index} className="flex gap-2 items-end p-3 border rounded-md">
                          <div className="flex-1 space-y-2">
                            <Label className="text-xs">Start Time</Label>
                            <Input
                              type="time"
                              value={formatTimeFromMinutes(period.start_time)}
                              onChange={(e) => updateConsumingPeriod(index, 'start_time', e.target.value)}
                              required
                            />
                          </div>
                          <div className="flex-1 space-y-2">
                            <Label className="text-xs">End Time</Label>
                            <Input
                              type="time"
                              value={formatTimeFromMinutes(period.end_time)}
                              onChange={(e) => updateConsumingPeriod(index, 'end_time', e.target.value)}
                              required
                            />
                          </div>
                          <div className="flex-1 space-y-2">
                            <Label className="text-xs">Price (€/kWh)</Label>
                            <Input
                              type="number"
                              step="0.0001"
                              min="0"
                              value={period.price}
                              onChange={(e) => updateConsumingPeriod(index, 'price', e.target.value)}
                              placeholder="0.0000"
                              required
                            />
                          </div>
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => removeConsumingPeriod(index)}
                            disabled={consumingPeriods.length === 1}
                          >
                            Remove
                          </Button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Effective Date */}
                <div className="space-y-2">
                  <Label htmlFor="effective-date">
                    Effective Start Date (Optional)
                  </Label>
                  <Input
                    id="effective-date"
                    type="datetime-local"
                    value={effectiveDate}
                    onChange={(e) => setEffectiveDate(e.target.value)}
                  />
                  <p className="text-sm text-muted-foreground">
                    Leave empty to apply immediately. Set a future date to schedule when these prices become effective.
                  </p>
                </div>

                {/* Current Active Settings Display */}
                {currentSettings && (
                  <div className="p-4 bg-muted rounded-md">
                    <p className="text-sm font-medium mb-2">Current Active Prices:</p>
                    <div className="space-y-1 text-sm">
                      <p>
                        Producing: {formatPrice(currentSettings.producing_price)} per kWh
                      </p>
                      <p>Consuming:</p>
                      <ul className="list-disc list-inside ml-2 space-y-1">
                        {currentSettings.consuming_periods?.map((period, idx) => (
                          <li key={idx}>
                            {formatTimeFromMinutes(period.start_time)} - {formatTimeFromMinutes(period.end_time)}: {formatPrice(period.price)} per kWh
                          </li>
                        ))}
                      </ul>
                      <p className="text-muted-foreground">
                        Effective from: {formatDate(currentSettings.start_date)}
                        {currentSettings.end_date && ` until ${formatDate(currentSettings.end_date)}`}
                      </p>
                    </div>
                  </div>
                )}

                {error && (
                  <div className="p-3 bg-destructive/10 text-destructive rounded-md text-sm">
                    {error}
                  </div>
                )}

                {success && (
                  <div className="p-3 bg-green-500/10 text-green-600 dark:text-green-400 rounded-md text-sm">
                    Settings saved successfully!
                  </div>
                )}

                <Button type="submit" disabled={saving} className="w-full">
                  {saving ? 'Saving...' : 'Save Settings'}
                </Button>
              </form>
            )}
          </CardContent>
        </Card>

        {/* Price History Card */}
        <Card>
          <CardHeader>
            <CardTitle>Price History</CardTitle>
            <CardDescription>
              View all price changes over time, including past, current, and future-dated prices.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <p className="text-muted-foreground">Loading history...</p>
            ) : priceHistory.length === 0 ? (
              <p className="text-muted-foreground">No price history available.</p>
            ) : (
              <div className="space-y-4">
                {priceHistory.map((setting) => {
                  const now = Math.floor(Date.now() / 1000);
                  const isActive = setting.start_date <= now && (!setting.end_date || setting.end_date > now);
                  const isFuture = setting.start_date > now;
                  
                  return (
                    <div key={setting.id} className="p-4 border rounded-md">
                      <div className="flex items-center justify-between mb-2">
                        <div>
                          <p className="font-medium">
                            {formatDate(setting.start_date)}
                            {setting.end_date && ` - ${formatDate(setting.end_date)}`}
                          </p>
                        </div>
                        <span
                          className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                            isActive
                              ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'
                              : isFuture
                              ? 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200'
                              : 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200'
                          }`}
                        >
                          {isActive ? 'Active' : isFuture ? 'Future' : 'Past'}
                        </span>
                      </div>
                      <div className="space-y-2 text-sm">
                        <p>
                          <span className="font-medium">Producing:</span> {formatPrice(setting.producing_price)} per kWh
                        </p>
                        <div>
                          <span className="font-medium">Consuming:</span>
                          <ul className="list-disc list-inside ml-4 mt-1 space-y-1">
                            {setting.consuming_periods?.map((period, idx) => (
                              <li key={idx}>
                                {formatTimeFromMinutes(period.start_time)} - {formatTimeFromMinutes(period.end_time)}: {formatPrice(period.price)} per kWh
                              </li>
                            ))}
                          </ul>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
