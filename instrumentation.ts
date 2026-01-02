// src/instrumentation.ts
import { startCron } from "./lib/cron";
import * as Sentry from '@sentry/nextjs';

export async function register() {
  // ❗ Nur lokal / nicht auf Vercel
  if (
    process.env.NODE_ENV !== "production" &&
    process.env.ENABLE_LOCAL_CRON === "true"
  ) {
    startCron();
  }

  if (process.env.NEXT_RUNTIME === 'nodejs') {
    await import('./sentry.server.config');
  }

  if (process.env.NEXT_RUNTIME === 'edge') {
    await import('./sentry.edge.config');
  }
}

export const onRequestError = Sentry.captureRequestError;