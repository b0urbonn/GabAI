# Release readiness checklist

Use this checklist for each public release. Assign a named owner and attach evidence for each item. A checked item means it was verified for the candidate build, content revision, and supported platforms.

## Safety content and contacts

- [ ] Medical reviewer approved health and first-aid guidance; record reviewer, credentials/role, revision, and date.
- [ ] Local DRRM reviewer approved hazard procedures, evacuation wording, and escalation guidance.
- [ ] Every emergency number was called or confirmed with the responsible agency; store provenance, verifier, municipality, and verification date.
- [ ] A named owner and schedule exist for rechecking directory entries and bundled guide content.
- [ ] Emergency/crisis assistant responses and offline fallback were reviewed against the approved content.
- [ ] All app text distinguishes educational guidance from official instructions and tells users to follow authorities.

## Data, privacy, and security

- [ ] Privacy notice covers SQLite profile/chat, photos/audio, location, Gemini requests, weather coordinates, public feeds, backups, and browser storage differences.
- [ ] Cloud mode clearly discloses that the question, attachment, and any included profile context go to Gemini.
- [ ] Backup export/restore scope is described accurately; exported sensitive files are handled safely.
- [ ] Clear-data copy matches actual deletion, including weather/public-update cache and secrets; verify onboarding restarts.
- [ ] No API keys, bearer tokens, personal records, or sensitive prompt contents are written to logs or backups.
- [ ] Imported backups and media paths are bounded and validated on each platform.
- [ ] Platform store privacy labels, permission purpose strings, and data disclosures match actual behavior.

## Platform and device validation

- [ ] Android release build installs and launches from a clean install and upgrade path.
- [ ] iOS release build installs and launches from a clean install and upgrade path.
- [ ] Onboarding, navigation, guide lookup, calls, manual municipality selection, and profile work without network.
- [ ] Location success, denial, disabled services, timeout, unavailable, and off-island paths are exercised.
- [ ] Local model download, resume, cancel, corrupt/incomplete-file handling, memory refusal, inference, and removal are exercised on supported hardware.
- [ ] At least one low-memory device confirms model setup does not break core screens.
- [ ] Photo and audio permissions, persistence, playback/analysis, limits, temporary-file cleanup, and clear-data are exercised.
- [ ] Missing/outdated native-module states explain how to recover.
- [ ] TalkBack/VoiceOver, larger text, contrast, screen rotation/resizing where supported, and safe areas are checked.

## Network and information freshness

- [ ] Gemini unavailable, quota-limited, invalid-key, cancellation, and streaming-interruption paths are checked.
- [ ] Weather online, stale-cache, no-location, and service-error states are checked and timestamped.
- [ ] Native PAGASA and PHIVOLCS parsing is tested with current and malformed feed samples.
- [ ] Partial feed outage preserves usable cached content and identifies its age/source.
- [ ] Browser preview either disables update content or labels sample data persistently and unmistakably; it never implies samples are live alerts.
- [ ] External links are restricted to the intended official domains.

## Build and operations

- [ ] `npm run typecheck`, `npm run lint`, existing unit tests, and `npx expo-doctor` results reviewed.
- [ ] Android and iOS bundles/builds complete with the exact native modules and ProGuard/JNI keep rules.
- [ ] Dependency compatibility and lockfile are reviewed; development build is regenerated after native changes.
- [ ] App version/build numbers and release notes are correct.
- [ ] Support contact, incident escalation path, and content correction process are available to users and maintainers.
- [ ] Release owner confirms all P0 requirements in [product requirements](product-requirements.md) have evidence and signs off.

## Known open items from repository review

At the documentation review date, bundled safety content and hotlines were drafts; browser agency updates were synthetic preview data; clear-data left weather and public-update caches; local audio analysis on Android accepted 30 seconds while recording allowed 120 seconds; and native behavior had not been validated on physical devices. Reassess each item against the release candidate rather than carrying these statements forward without checking.
