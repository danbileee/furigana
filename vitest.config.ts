import { defineConfig, mergeConfig } from "vitest/config";
import { defineConfig as defineViteConfig } from "vite";
import viteConfig from "./vite.config";

const resolvedViteConfig =
  typeof viteConfig === "function"
    ? viteConfig({ command: "serve", mode: "test", isSsrBuild: false })
    : defineViteConfig(viteConfig);

export default mergeConfig(
  resolvedViteConfig,
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
