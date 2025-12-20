/*
  Warnings:

  - You are about to drop the column `consuming_price` on the `energy_settings` table. All the data in the column will be lost.

*/
-- CreateTable
CREATE TABLE "consuming_price_periods" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "energy_settings_id" INTEGER NOT NULL,
    "start_time" INTEGER NOT NULL,
    "end_time" INTEGER NOT NULL,
    "price" REAL NOT NULL,
    CONSTRAINT "consuming_price_periods_energy_settings_id_fkey" FOREIGN KEY ("energy_settings_id") REFERENCES "energy_settings" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_energy_settings" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "producing_price" REAL NOT NULL,
    "start_date" INTEGER NOT NULL,
    "end_date" INTEGER,
    "updated_at" INTEGER NOT NULL DEFAULT 0
);
-- Migrate data and preserve consuming_price by creating default periods
INSERT INTO "new_energy_settings" ("end_date", "id", "producing_price", "start_date", "updated_at") 
SELECT "end_date", "id", "producing_price", "start_date", "updated_at" FROM "energy_settings";
-- Create default consuming price periods (full day 0-1439 minutes) for existing records
INSERT INTO "consuming_price_periods" ("energy_settings_id", "start_time", "end_time", "price")
SELECT "id", 0, 1439, "consuming_price" FROM "energy_settings";
DROP TABLE "energy_settings";
ALTER TABLE "new_energy_settings" RENAME TO "energy_settings";
CREATE INDEX "energy_settings_start_date_idx" ON "energy_settings"("start_date");
CREATE INDEX "energy_settings_end_date_idx" ON "energy_settings"("end_date");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE INDEX "consuming_price_periods_energy_settings_id_idx" ON "consuming_price_periods"("energy_settings_id");
