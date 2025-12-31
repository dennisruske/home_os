// src/instrumentation.ts
import { startCron } from "./lib/cron";

export function register() {
  // ❗ Nur lokal / nicht auf Vercel
  if (
    process.env.NODE_ENV !== "production" &&
    process.env.ENABLE_LOCAL_CRON === "true"
  ) {
    startCron();
  }
}