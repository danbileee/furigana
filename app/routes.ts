import { type RouteConfig, index, route } from "@react-router/dev/routes";

export default [
  index("routes/home.tsx"),
  route("health", "routes/health.ts"),
  route("/sentry-example-page", "routes/sentry-example-page.tsx"),
  route("/api/sentry-example-api", "routes/api.sentry-example-api.ts"),
] satisfies RouteConfig;
