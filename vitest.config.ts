import { defineConfig, mergeConfig } from "vitest/config";
import viteConfig from "./vite.config";

export default mergeConfig(
  viteConfig,
  defineConfig({
    test: {
      globals: true,
      environment: "node",
      include: ["app/**/*.test.ts"],
      exclude: ["e2e/**/*"],
      coverage: {
        provider: "v8",
        reporter: ["text", "json", "html"],
        include: ["app/lib/**/*.ts"],
        exclude: ["**/*.test.ts", "**/*.d.ts"],
      },
    },
  }),
);
