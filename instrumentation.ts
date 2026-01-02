// src/instrumentation.ts
import * as Sentry from '@sentry/nextjs';
import { startCron } from "./lib/cron";

export function register() {
  // Initialize Sentry
  Sentry.init({
    dsn: process.env.SENTRY_DSN,
    environment: process.env.NODE_ENV || 'development',
    tracesSampleRate: 1.0,
    integrations: [
      new Sentry.Integrations.Http({ tracing: true }),
      new Sentry.Integrations.Console(),
      new Sentry.Integrations.OnUncaughtException(),
      new Sentry.Integrations.OnUnhandledRejection(),
    ],
  });

  // ❗ Nur lokal / nicht auf Vercel
  if (
    process.env.NODE_ENV !== "production" &&
    process.env.ENABLE_LOCAL_CRON === "true"
  ) {
    startCron();
  }
}