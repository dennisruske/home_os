-- CreateTable
CREATE TABLE "energy_readings" (
    "id" SERIAL NOT NULL,
    "timestamp" INTEGER NOT NULL,
    "home" DOUBLE PRECISION NOT NULL,
    "grid" DOUBLE PRECISION NOT NULL,
    "car" DOUBLE PRECISION NOT NULL,
    "solar" DOUBLE PRECISION NOT NULL,
    "created_at" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "energy_readings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "energy_settings" (
    "id" SERIAL NOT NULL,
    "producing_price" DOUBLE PRECISION NOT NULL,
    "start_date" INTEGER NOT NULL,
    "end_date" INTEGER,
    "updated_at" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "energy_settings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "consuming_price_periods" (
    "id" SERIAL NOT NULL,
    "energy_settings_id" INTEGER NOT NULL,
    "start_time" INTEGER NOT NULL,
    "end_time" INTEGER NOT NULL,
    "price" DOUBLE PRECISION NOT NULL,

    CONSTRAINT "consuming_price_periods_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "energy_readings_timestamp_idx" ON "energy_readings"("timestamp");

-- CreateIndex
CREATE INDEX "energy_readings_created_at_idx" ON "energy_readings"("created_at");

-- CreateIndex
CREATE INDEX "energy_settings_start_date_idx" ON "energy_settings"("start_date");

-- CreateIndex
CREATE INDEX "energy_settings_end_date_idx" ON "energy_settings"("end_date");

-- CreateIndex
CREATE INDEX "consuming_price_periods_energy_settings_id_idx" ON "consuming_price_periods"("energy_settings_id");

-- AddForeignKey
ALTER TABLE "consuming_price_periods" ADD CONSTRAINT "consuming_price_periods_energy_settings_id_fkey" FOREIGN KEY ("energy_settings_id") REFERENCES "energy_settings"("id") ON DELETE CASCADE ON UPDATE CASCADE;





