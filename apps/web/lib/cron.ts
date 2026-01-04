// src/lib/cron.ts
import cron from "node-cron";

let started = false;

export function startCron() {
  if (started) return; // verhindert mehrfaches Starten
  started = true;

  cron.schedule("* * * * *", async () => {
    try {
      await fetch("http://localhost:3000/api/jobs/aggregate-energy");
      console.log("✅ Cron: aggregate-energy getriggert");
    } catch (err) {
      console.error("❌ Cron Fehler", err);
    }
  });
}