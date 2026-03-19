---
name: Furigana Project Tech Stack
description: Installed package versions and key configuration facts for the Furigana project, relevant for accurate implementation planning.
type: project
---

## Installed Package Versions (as of 2026-03-18)

### Production Dependencies

- react: ^19.0.0
- react-router: ^7.0.0
- @react-router/node: ^7.0.0
- axios: ^1.7.0
- lucide-react: ^0.577.0
- zod: ^4.0.0
- tailwind-merge: ^3.5.0
- @sentry/react: ^10.0.0
- @base-ui/react: ^1.2.0
- shadcn: ^4.0.5
- tw-animate-css: ^1.4.0
- class-variance-authority: ^0.7.1
- clsx: ^2.1.1

### Dev Dependencies

- vite: ^7.0.0
- tailwindcss: ^4.0.0 (CSS-first config, no tailwind.config.js)
- typescript: ^5.8.0
- @react-router/dev: ^7.0.0
- @tailwindcss/vite: ^4.0.0
- vite-tsconfig-paths: ^5.0.0
- eslint: ^10.0.3 (flat config in eslint.config.mjs)

### To Be Installed in Milestone 1 (Task 1)

- openai: ^6.31.0 (production)
- vitest: ^4.1.0 (dev)
- @vitest/coverage-v8: ^4.1.0 (dev)
- @playwright/test: ^1.58.0 (dev)

## Key Configuration Facts

- Path alias: `~/` maps to `app/` (tsconfig.json paths)
- TypeScript strict: exactOptionalPropertyTypes, noUncheckedIndexedAccess, noImplicitOverride, noPropertyAccessFromIndexSignature
- SSR: enabled (react-router.config.ts sets ssr: true)
- CSS: Tailwind v4 with @import "tailwindcss" in app/app.css (no tailwind.config.js)
- app.css uses @layer base block for global resets
- vite.config.ts: plugins = [tailwindcss(), reactRouter(), tsconfigPaths()]
- ESLint: flat config (eslint.config.mjs)
- Module system: "type": "module" in package.json (ESM)
- Engines: node >=22.0.0, pnpm >=10.0.0

## Existing File Structure

- app/routes/home.tsx — currently a starter kit demo (must be rewritten in M1)
- app/lib/axios/instance.ts — Axios client (not used for OpenAI)
- app/lib/utils.ts — cn() helper
- app/components/ui/button.tsx, card.tsx — shadcn/ui components
- app/schema/ — Zod schemas
