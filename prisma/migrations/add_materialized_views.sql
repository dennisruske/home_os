-- Materialized views for optimized hourly and daily aggregations
-- Run this after the buckets table migration is applied

-- Drop existing views if they exist (for idempotency)
DROP MATERIALIZED VIEW IF EXISTS energy_hourly_buckets CASCADE;
DROP MATERIALIZED VIEW IF EXISTS energy_daily_buckets CASCADE;

-- Hourly buckets materialized view
-- Aggregates 1-minute buckets into hourly buckets (sums kWh values)
CREATE MATERIALIZED VIEW energy_hourly_buckets AS
SELECT 
  -- Round bucket_start to hour boundary
  (bucket_start / 3600) * 3600 AS bucket_start,
  (bucket_start / 3600) * 3600 + 3600 AS bucket_end,
  SUM(home_kwh) AS home_kwh,
  SUM(grid_kwh) AS grid_kwh,
  SUM(car_kwh) AS car_kwh,
  SUM(solar_kwh) AS solar_kwh,
  SUM(readings_count) AS readings_count,
  MIN(first_timestamp) AS first_timestamp,
  MAX(last_timestamp) AS last_timestamp,
  MIN(first_home) AS first_home,
  MIN(first_grid) AS first_grid,
  MIN(first_car) AS first_car,
  MIN(first_solar) AS first_solar,
  MAX(last_home) AS last_home,
  MAX(last_grid) AS last_grid,
  MAX(last_car) AS last_car,
  MAX(last_solar) AS last_solar
FROM energy_buckets
GROUP BY (bucket_start / 3600) * 3600;

-- Create index on hourly buckets for fast range queries
CREATE INDEX energy_hourly_buckets_bucket_start_idx 
ON energy_hourly_buckets(bucket_start);

-- Daily buckets materialized view
-- Aggregates 1-minute buckets into daily buckets (sums kWh values)
CREATE MATERIALIZED VIEW energy_daily_buckets AS
SELECT 
  -- Round bucket_start to day boundary (midnight UTC)
  -- Convert Unix timestamp to date, truncate to day, convert back to Unix timestamp
  (EXTRACT(EPOCH FROM DATE_TRUNC('day', TO_TIMESTAMP(bucket_start)))::bigint) AS bucket_start,
  (EXTRACT(EPOCH FROM DATE_TRUNC('day', TO_TIMESTAMP(bucket_start)) + INTERVAL '1 day')::bigint) AS bucket_end,
  SUM(home_kwh) AS home_kwh,
  SUM(grid_kwh) AS grid_kwh,
  SUM(car_kwh) AS car_kwh,
  SUM(solar_kwh) AS solar_kwh,
  SUM(readings_count) AS readings_count,
  MIN(first_timestamp) AS first_timestamp,
  MAX(last_timestamp) AS last_timestamp,
  MIN(first_home) AS first_home,
  MIN(first_grid) AS first_grid,
  MIN(first_car) AS first_car,
  MIN(first_solar) AS first_solar,
  MAX(last_home) AS last_home,
  MAX(last_grid) AS last_grid,
  MAX(last_car) AS last_car,
  MAX(last_solar) AS last_solar
FROM energy_buckets
GROUP BY (EXTRACT(EPOCH FROM DATE_TRUNC('day', TO_TIMESTAMP(bucket_start)))::bigint);

-- Create index on daily buckets for fast range queries
CREATE INDEX energy_daily_buckets_bucket_start_idx 
ON energy_daily_buckets(bucket_start);

-- Note: These materialized views should be refreshed periodically by the aggregation job
-- Use: REFRESH MATERIALIZED VIEW CONCURRENTLY energy_hourly_buckets;
-- Use: REFRESH MATERIALIZED VIEW CONCURRENTLY energy_daily_buckets;

