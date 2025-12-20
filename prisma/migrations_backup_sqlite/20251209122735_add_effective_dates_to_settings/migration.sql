/*
  Warnings:

  - Added the required column `start_date` to the `energy_settings` table without a default value. This is not possible if the table is not empty.

*/
-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_energy_settings" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "consuming_price" REAL NOT NULL,
    "producing_price" REAL NOT NULL,
    "start_date" INTEGER NOT NULL,
    "end_date" INTEGER,
    "updated_at" INTEGER NOT NULL DEFAULT 0
);
-- Migrate existing data: set start_date from updated_at (or current timestamp if updated_at is 0)
INSERT INTO "new_energy_settings" ("consuming_price", "id", "producing_price", "updated_at", "start_date", "end_date") 
SELECT 
    "consuming_price", 
    "id", 
    "producing_price", 
    "updated_at",
    CASE 
        WHEN "updated_at" > 0 THEN "updated_at"
        ELSE CAST(strftime('%s', 'now') AS INTEGER)
    END AS "start_date",
    NULL AS "end_date"
FROM "energy_settings";
DROP TABLE "energy_settings";
ALTER TABLE "new_energy_settings" RENAME TO "energy_settings";
CREATE INDEX "energy_settings_start_date_idx" ON "energy_settings"("start_date");
CREATE INDEX "energy_settings_end_date_idx" ON "energy_settings"("end_date");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
