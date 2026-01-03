-- ============================================================
-- Materialized Views for energy aggregation
-- Source: energy_buckets (1-minute buckets, UTC)
-- Atomic migration: all-or-nothing
-- ============================================================

BEGIN;

-- ============================================================
-- CLEANUP (safe for re-runs)
-- ============================================================

DROP MATERIALIZED VIEW IF EXISTS energy_hourly_buckets CASCADE;
DROP MATERIALIZED VIEW IF EXISTS energy_daily_buckets CASCADE;

-- ============================================================
-- HOURLY BUCKETS
-- ============================================================

CREATE MATERIALIZED VIEW energy_hourly_buckets AS
WITH normalized AS (
  SELECT
    (bucket_start / 3600) * 3600 AS hour_start,

    home_kwh,
    grid_kwh,
    car_kwh,
    solar_kwh,
    readings_count,

    first_timestamp,
    last_timestamp,

    first_home,
    first_grid,
    first_car,
    first_solar,

    last_home,
    last_grid,
    last_car,
    last_solar
  FROM energy_buckets
)
SELECT
  hour_start AS bucket_start,
  hour_start + 3600 AS bucket_end,

  -- Energy sums
  SUM(home_kwh)  AS home_kwh,
  SUM(grid_kwh)  AS grid_kwh,
  SUM(car_kwh)   AS car_kwh,
  SUM(solar_kwh) AS solar_kwh,

  -- Metadata
  SUM(readings_count)  AS readings_count,
  MIN(first_timestamp) AS first_timestamp,
  MAX(last_timestamp)  AS last_timestamp,

  -- First / last meter values
  MIN(first_home)   AS first_home,
  MIN(first_grid)   AS first_grid,
  MIN(first_car)    AS first_car,
  MIN(first_solar)  AS first_solar,

  MAX(last_home)    AS last_home,
  MAX(last_grid)    AS last_grid,
  MAX(last_car)     AS last_car,
  MAX(last_solar)   AS last_solar
FROM normalized
GROUP BY hour_start;

CREATE UNIQUE INDEX energy_hourly_buckets_bucket_start_uidx
  ON energy_hourly_buckets(bucket_start);

CREATE INDEX energy_hourly_buckets_bucket_start_idx
  ON energy_hourly_buckets(bucket_start);

-- ============================================================
-- DAILY BUCKETS (UTC MIDNIGHT)
-- ============================================================

CREATE MATERIALIZED VIEW energy_daily_buckets AS
WITH normalized AS (
  SELECT
    EXTRACT(
      EPOCH FROM
      DATE_TRUNC(
        'day',
        TO_TIMESTAMP(bucket_start) AT TIME ZONE 'UTC'
      )
    )::bigint AS day_start,

    home_kwh,
    grid_kwh,
    car_kwh,
    solar_kwh,
    readings_count,

    first_timestamp,
    last_timestamp,

    first_home,
    first_grid,
    first_car,
    first_solar,

    last_home,
    last_grid,
    last_car,
    last_solar
  FROM energy_buckets
)
SELECT
  day_start AS bucket_start,
  day_start + 86400 AS bucket_end,

  -- Energy sums
  SUM(home_kwh)  AS home_kwh,
  SUM(grid_kwh)  AS grid_kwh,
  SUM(car_kwh)   AS car_kwh,
  SUM(solar_kwh) AS solar_kwh,

  -- Metadata
  SUM(readings_count)  AS readings_count,
  MIN(first_timestamp) AS first_timestamp,
  MAX(last_timestamp)  AS last_timestamp,

  -- First / last meter values
  MIN(first_home)   AS first_home,
  MIN(first_grid)   AS first_grid,
  MIN(first_car)    AS first_car,
  MIN(first_solar)  AS first_solar,

  MAX(last_home)    AS last_home,
  MAX(last_grid)    AS last_grid,
  MAX(last_car)     AS last_car,
  MAX(last_solar)   AS last_solar
FROM normalized
GROUP BY day_start;

CREATE UNIQUE INDEX energy_daily_buckets_bucket_start_uidx
  ON energy_daily_buckets(bucket_start);

CREATE INDEX energy_daily_buckets_bucket_start_idx
  ON energy_daily_buckets(bucket_start);

-- ============================================================
-- INITIAL REFRESH
-- ============================================================

REFRESH MATERIALIZED VIEW energy_hourly_buckets;
REFRESH MATERIALIZED VIEW energy_daily_buckets;

COMMIT;