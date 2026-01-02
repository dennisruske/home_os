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

}

export const onRequestError = Sentry.captureRequestError;