// src/instrumentation.ts
import * as Sentry from '@sentry/nextjs';
import { startCron } from "./lib/cron";
console.log("test")

export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    await import("./sentry.server.config");
  }
  if (process.env.NEXT_RUNTIME === "edge") {
    await import("./sentry.edge.config");
  }

  // ❗ Nur lokal / nicht auf Vercel
  if (
    process.env.NODE_ENV !== "production" &&
    process.env.ENABLE_LOCAL_CRON === "true"
  ) {
    startCron();
  }
}

export const onRequestError = Sentry.captureRequestError;