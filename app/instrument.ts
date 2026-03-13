import * as Sentry from "@sentry/react";

Sentry.init({
  dsn: import.meta.env["VITE_SENTRY_DSN"] as string | undefined,
  integrations: [Sentry.browserTracingIntegration(), Sentry.replayIntegration()],
  tracesSampleRate: import.meta.env.PROD ? 0.2 : 1.0,
  replaysSessionSampleRate: 0.1,
  replaysOnErrorSampleRate: 1.0,
  enabled: import.meta.env.PROD,
  tracePropagationTargets: [/^\/api\//, /^http:\/\/localhost:3000/],
});
