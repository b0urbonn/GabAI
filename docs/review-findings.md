# Repository review findings

Review date: 2026-11-02. Scope: application source, route/component structure, persistence and service boundaries, local Android module, dependency patch, configuration, existing tests, and artifact inventory. Binary presentation/video content, generated native projects, dependency internals, production infrastructure, and physical-device execution were not exhaustively audited. Findings below are static observations unless verification explicitly says otherwise.

## Findings and suggested priorities

| Priority | Observation | Implication / next action |
| --- | --- | --- |
| High | `publicUpdates.web.ts` fabricates plausible weather/earthquake news with fresh relative timestamps | Browser previews must clearly identify sample content; do not present it as current official safety information |
| High | Bundled guide/hotline content is explicitly draft | Obtain medical/DRRM and MDRRMO review before public release; retain provenance and verification dates |
| Medium | `clearAllData()` leaves weather/public-update caches | Reset wording and retained location-bearing weather data differ; decide retention policy and cover it with a targeted check |
| Medium | Backup restores profile and a narrow preference subset only | Users need an explicit scope description; it is not full disaster recovery for chat/media |
| Medium | Browser secrets use localStorage; profile/chat/backup have no application encryption | Document the browser trust boundary and exported personal-data handling |
| Medium | Recorder allows 120 seconds; local Android decoder rejects over 30 seconds | Surface the active local limit before recording or sending |
| Medium | Settings update memory before SQL succeeds | A failed write can leave session appearance/config inconsistent with the next launch |
| Medium | Model completeness uses a byte-size comparison | A same-size corrupted artifact is not detected before native parsing; consider digest validation |
| Medium | Local service tests mock native runtime | Add physical-device release smoke coverage for memory pressure, JNI rules, media, and supported accelerators |
| Low | Legacy backend settings, secret helpers, `custom` usage source remain without active dispatch | Preserve compatibility intentionally or remove through a separate migration-aware cleanup |
| Low | Public updates and weather logic include substantial parsing/state behavior outside the current test suite | Target parser/cache expiry and partial-source failures when extending tests |

Partial feed refresh currently replaces the visible item list with successful sources only; cached items from a failed source are not merged into that success result. This can reduce the displayed feed during a partial outage (`src/hooks/usePublicUpdates.ts`).

## Documentation discrepancies corrected

The former `docs/README.md` described llama.rn, three modes including a custom backend, speech recognition, system appearance, and synchronous settings hydration. Current source instead uses LiteRT LM, local/cloud dispatch, recorded audio attachments, light/dark appearance, and asynchronous settings hydration before rendering. Root `AGENTS.md` implementation notes were refreshed to point to these topic documents while retaining its contributor rules.

## Verification

Results from the documentation/organization change are recorded below. No application behavior was intentionally changed. Device, cloud, hotline, and safety-content validation are separate release work.

| Check | Result |
| --- | --- |
| `npm run typecheck` | Passed |
| `npm run lint` | Passed |
| `node --test tests/localModel.test.cjs` | 14 passed, 0 failed |
| `npx expo-doctor` | 19/20 checks passed; SDK patch compatibility check failed |

Expo Doctor expected newer patches for expo (58.0.22), expo-audio (58.0.11), expo-build-properties (58.0.12), expo-dev-client (58.0.18), expo-router (58.0.29), and expo-sqlite (58.0.15). Installed patches are one lower for each. Dependencies were left unchanged during the documentation/organization task. Review and upgrade them together in a separately verified dependency change.
