-- CreateTable
CREATE TABLE "energy_settings" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "consuming_price" REAL NOT NULL,
    "producing_price" REAL NOT NULL,
    "updated_at" INTEGER NOT NULL DEFAULT 0
);
