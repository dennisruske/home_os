-- CreateTable
CREATE TABLE "energy_readings" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "timestamp" INTEGER NOT NULL,
    "home" REAL NOT NULL,
    "grid" REAL NOT NULL,
    "car" REAL NOT NULL,
    "solar" REAL NOT NULL,
    "created_at" INTEGER NOT NULL DEFAULT 0
);

-- CreateIndex
CREATE INDEX "energy_readings_timestamp_idx" ON "energy_readings"("timestamp");

-- CreateIndex
CREATE INDEX "energy_readings_created_at_idx" ON "energy_readings"("created_at");
