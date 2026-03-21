import { type RouteConfig, index, route } from "@react-router/dev/routes";

export default [
  /**
   * User routes
   */
  index("routes/home.tsx"),
  route("furigana/:id", "routes/furigana.$id.tsx"),

  /**
   * API routes
   */
  route("api/health", "routes/api/health.ts"),
] satisfies RouteConfig;
