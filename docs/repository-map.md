# Repository map

## Layout and ownership

| Path | Purpose and placement rule |
| --- | --- |
| `src/app/` | Expo Router route files and navigator layouts only |
| `src/components/ui/` | Reusable themed UI primitives |
| `src/components/chat/` | Input, message bubbles, markdown, media chips, stream indicators |
| `src/components/chat-settings/` | Local model, Gemini, and voice sections |
| `src/components/onboarding/` | Onboarding step UI and chrome |
| `src/components/` | Shared application and feature visuals |
| `src/hooks/` | React lifecycle behavior reused by screens |
| `src/providers/` | Settings context and boot-time preference hydration |
| `src/theme/` | Central visual tokens and theme resolution |
| `src/data/` | Bundled guides, contacts, profile schema, barangays/centroids, art mappings |
| `src/db/` | Migrations and table-oriented async repositories |
| `src/storage/` | Native/browser persistence and backup format |
| `src/services/` | AI, location, feeds, device information, media, and speech |
| `src/utils/` | Dialog/navigation helpers, including browser variants |
| `src/types/` | Asset declarations |
| `modules/local-ai-device/` | Maintained Android Expo module; Kotlin/C++ sources |
| `patches/` | Version-specific native dependency patch applied after install |
| `tests/` | Node tests mocking the local-model native boundary |
| `assets/` | Icons, guide/onboarding/weather artwork, mascot animation frames |
| `docs/` | System/developer documentation and supporting project artifacts |

## Root configuration

`package.json` and `package-lock.json` define the npm application. `app.json` owns app identity, plugins, permissions, native options, and Router experiments. `eas.json` defines development and internal release APK builds. `metro.config.js` configures WASM and browser isolation headers. `tsconfig.json` enables strict typing and the `@/` source alias. `eslint.config.js` configures Expo linting. `AGENTS.md` contains contributor/agent rules.

## Generated and local-only content

`android/` can exist locally but is ignored; `ios/` is also ignored. Treat generated platform projects as build output and keep lasting native changes in config/plugins or `modules/`. Do not move these directories or dependencies to make the tree look smaller.

`node_modules/`, `.expo/`, build output, signing credentials, and local environment files are excluded by `.gitignore`. The separate `video/` Remotion workspace is ignored; it is not installed by root `npm ci`. Published demo MP4s live in `docs/demo/`.

## Artifact organization

Presentation PDFs and the pitch deck are grouped under `docs/presentations/` with a manifest. Demo videos retain their existing `docs/demo/` paths because local video rendering scripts target that directory. Asset filenames are retained to preserve static imports and artwork manifests.

Use lowercase hyphenated names for new topic documents. Keep operational instructions in development documentation, implementation explanations in architecture/topic documents, and observations in review findings. The root README is the entry point, not a duplicate source tree listing.
