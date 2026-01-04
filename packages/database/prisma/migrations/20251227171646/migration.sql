-- CreateTable
CREATE TABLE "energy_buckets" (
    "bucket_start" INTEGER NOT NULL,
    "bucket_end" INTEGER NOT NULL,
    "home_kwh" DOUBLE PRECISION NOT NULL,
    "grid_kwh" DOUBLE PRECISION NOT NULL,
    "car_kwh" DOUBLE PRECISION NOT NULL,
    "solar_kwh" DOUBLE PRECISION NOT NULL,
    "readings_count" INTEGER NOT NULL,
    "first_timestamp" INTEGER NOT NULL,
    "last_timestamp" INTEGER NOT NULL,
    "first_home" DOUBLE PRECISION NOT NULL,
    "first_grid" DOUBLE PRECISION NOT NULL,
    "first_car" DOUBLE PRECISION NOT NULL,
    "first_solar" DOUBLE PRECISION NOT NULL,
    "last_home" DOUBLE PRECISION NOT NULL,
    "last_grid" DOUBLE PRECISION NOT NULL,
    "last_car" DOUBLE PRECISION NOT NULL,
    "last_solar" DOUBLE PRECISION NOT NULL,

    CONSTRAINT "energy_buckets_pkey" PRIMARY KEY ("bucket_start")
);

-- CreateTable
CREATE TABLE "energy_bucket_aggregation_jobs" (
    "id" SERIAL NOT NULL,
    "last_processed_timestamp" INTEGER NOT NULL,
    "last_run_at" INTEGER NOT NULL,
    "status" TEXT NOT NULL,

    CONSTRAINT "energy_bucket_aggregation_jobs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "energy_buckets_bucket_start_idx" ON "energy_buckets"("bucket_start");
