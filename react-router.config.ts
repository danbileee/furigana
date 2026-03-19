import { sentryOnBuildEnd } from "@sentry/react-router";
import type { Config } from "@react-router/dev/config";

const config: Config = {
  // Config options...
  // Server-side render by default, to enable SPA mode set this to `false`
  ssr: true,

  buildEnd: async ({
    viteConfig: viteConfig,
    reactRouterConfig: reactRouterConfig,
    buildManifest: buildManifest,
  }) => {
    await sentryOnBuildEnd({
      viteConfig: viteConfig,
      reactRouterConfig: reactRouterConfig,
      buildManifest: buildManifest,
    });
  },
};

export default config;
