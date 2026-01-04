export interface EnergyData {
    timestamp: number | null;
    home: number;
    grid: number;
    car: number;
    solar: number;
}

export interface EnergyHistoryEntry {
    timestamp: number;
    home: number;
    grid: number;
    car: number;
    solar: number;
}

export interface EnergyReading {
    id: number;
    timestamp: number;
    home: number;
    grid: number;
    car: number;
    solar: number;
    created_at: number;
}

export interface EnergyMessage {
    type: 'ccp' | 'utc';
    data: number[] | number;
}

export interface ConsumingPricePeriod {
    id: number;
    energy_settings_id: number;
    start_time: number; // Minutes since midnight (0-1439)
    end_time: number; // Minutes since midnight (0-1439)
    price: number;
}

export interface EnergySettings {
    id: number;
    producing_price: number;
    start_date: number;
    end_date: number | null;
    updated_at: number;
    consuming_periods?: ConsumingPricePeriod[];
}

export interface EnergySettingsHistory {
    settings: EnergySettings[];
    current: EnergySettings | null;
}

export interface AggregatedDataPoint {
    label: string;
    kwh: number;
    timestamp: number;
}

export interface AggregatedResponse {
    data: AggregatedDataPoint[];
    total: number;
}

export interface GridAggregatedResponse {
    consumption: AggregatedResponse;
    feedIn: AggregatedResponse;
}

export interface EnergyBucket {
    bucket_start: number;
    bucket_end: number;
    home_kwh: number;
    grid_kwh: number;
    car_kwh: number;
    solar_kwh: number;
    readings_count: number;
    first_timestamp: number;
    last_timestamp: number;
    first_home: number;
    first_grid: number;
    first_car: number;
    first_solar: number;
    last_home: number;
    last_grid: number;
    last_car: number;
    last_solar: number;
}
