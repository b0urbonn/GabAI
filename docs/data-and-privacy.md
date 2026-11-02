# Data and privacy

## Persistence inventory

Database: `gabai.db`, managed by `src/db/migrations.ts`. Eleven append-only migrations currently exist. All repository access uses async SQLite APIs. Append migrations instead of rewriting shipped schema history.

| Table | Stored data | Repository |
| --- | --- | --- |
| `settings` | String key/value preferences, onboarding, AI and avatar selections | `src/db/settings.ts` |
| `profile` | Personal, health, address, emergency-contact key/value records | `src/db/profile.ts` |
| `chat_messages` | Role/body/time, photo/audio references, MIME/duration, pending/done/error state and error | `src/db/chat.ts` |
| `photos` | Unique file reference, dimensions, capture time | `src/db/photos.ts` |
| `token_usage` | Per-source requests and prompt/completion counters | `src/db/tokenUsage.ts` |
| `public_update_cache` | Source-keyed JSON snapshots | `src/db/publicUpdates.ts` |
| `weather_cache` | Current/forecast JSON including location and timestamps | `src/db/weatherCache.ts` |
| `emergency_contacts` | User-added "My contacts" labels and numbers | `src/db/contacts.ts` |
| `emergency_contact_overrides` | User-corrected numbers for bundled hotlines | `src/db/contacts.ts` |
| `emergency_remote_contacts` | Hotlines fetched from the remote directory manifest | `src/db/contacts.ts` |

The source constraint still permits `custom` usage even though active dispatch only uses local/Gemini. Profile fields and validators are defined in `src/data/profile.ts` and `profileValidation.ts`; values are length bounded. The app has no multi-user account model.

## Files and credentials

Native photo/audio helpers store files in app-private document directories and persist file names, rebuilding URIs on read. Models live in a separate `models` directory. Browser helpers use data URIs; file-deletion helpers are no-ops there because attachment content lives in persisted records.

Native Gemini keys and the legacy backend token use SecureStore. Browser counterparts use localStorage, which does not provide native secure credential storage. SQLite profile/chat data and exported JSON are not application-encrypted by the code reviewed here.

## Backup contract

Backup version 1 exports profile plus appearance, text size, nickname, and supported avatar tone/preset preferences. It excludes chat history, photos, audio, avatar photo/seed, downloaded models, usage counters, caches, AI configuration, voice settings, secrets, `onboarded`, and user-added emergency contacts/overrides.

Import checks app/version, supported profile keys/value lengths, settings types, and a 64 KiB size limit in the picker path. Legacy system appearance maps to light. Native export writes a JSON file and invokes sharing; browser export downloads JSON. Restore replaces profile and applies the allowed preference subset after confirmation. It is a profile/preferences backup, not a complete application snapshot.

## Reset semantics

`clearAllData()` deletes profile, chat, photo rows, settings, token counters, custom emergency contacts, hotline number overrides, and the fetched directory copy; removes photo/audio files; and deletes both credential keys. The settings screen resets provider state so onboarding is shown again. Bundled content, downloaded model files, and exported backups remain.

The current reset does **not** delete weather or public-update cache rows. Weather cache includes location labels/coordinates. SQL deletion, filesystem cleanup, and credential deletion are separate operations rather than a single atomic transaction; failures can leave a partial reset.

## Network data boundaries

| Destination | Data leaving the device |
| --- | --- |
| Google Gemini | API key in request header; selected history, prompt context, current photo/audio when attached |
| Hugging Face | Model download requests |
| Open-Meteo | Chosen location coordinates in forecast requests |
| PAGASA / PHIVOLCS | Feed/bulletin requests on native |
| GitHub raw (`raw.githubusercontent.com`) | Directory manifest fetch — user-initiated Refresh only; no user data is sent, and the response is validated before replacing saved numbers |
| System dialer | Selected phone number via dial URI |

Local inference and deterministic retrieval do not require cloud inference. Selecting cloud mode can send saved address/contact context through prompts. Exported backups contain personal/health/contact information and depend on the user's chosen sharing destination.
