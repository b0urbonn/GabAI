# System overview

GabAI is a device-centered safety companion for the six municipalities of Marinduque: Boac, Buenavista, Gasan, Mogpog, Santa Cruz, and Torrijos. There is no application-owned server or account service in this repository. User state lives on the device; selected features call external services directly.

## User journeys

| Route | Responsibility |
| --- | --- |
| `onboarding` | Introductory steps, required nickname, optional profile; persists completion |
| `(tabs)/index` | Home dashboard, weather, safety tips, entry points |
| `(tabs)/guides` | Browse/search bundled disaster and first-aid guides |
| `guide/[id]` | Guide detail, presented as a sheet |
| `(tabs)/capture` | Camera/library visual log and handoff to chat |
| `(tabs)/chat` | Persisted conversation, photo/voice attachments, streaming, stop/retry, speech playback |
| `(tabs)/profile` | Profile summary and avatar customization |
| `profile/[group]` | Personal, health, and emergency-contact fields |
| `emergency` | Local, provincial, national contacts; location lookup and municipality filtering |
| `notifications` | Agency updates with cached content and refresh |
| `settings` | Appearance, text scale, backup/restore, destructive data reset |
| `chat-settings` | Local/cloud mode, model download/backend, Gemini configuration, voice preferences |
| `about` | Application information |
| `+not-found` | Unknown-route handling |

The custom tab bar, app header, and emergency floating button provide shared navigation. Protected routes direct users to onboarding until the persisted `onboarded` flag is true.

## Connectivity and platform behavior

| Capability | Offline behavior | Platform differences |
| --- | --- | --- |
| Guides, directory, profile | Bundled content and saved records remain available | Shared UI |
| Chat without downloaded model | Keyword-based guide/directory answers | Available in web preview too |
| On-device chat | Works after the model is downloaded on a compatible device | Native runtime required; unavailable on web |
| Gemini | Needs network and user API key; can fall back offline | Browser requests remain subject to browser restrictions |
| Photos and voice | Saved attachments remain local | Native files versus browser data URIs |
| Weather | Last successfully cached data can be displayed | Defaults to Boac if location lookup fails |
| Agency updates | Previously cached, still-current items can remain available | Web returns fabricated preview items |
| Hotline dialing | Directory works offline; calls depend on phone service | Opens system dial URI |

## Location and public information

`src/services/location.ts` requests foreground location and matches the nearest bundled barangay centroid. It rejects matches beyond 12 km. Results distinguish success, permission denial, disabled services, timeout, off-island, and unavailable location. This is a proximity estimate, not a barangay boundary lookup. The emergency screen also reads the saved profile address and allows manual filtering.

Weather uses Open-Meteo, the nearest barangay centroid when available, and Boac otherwise. Current and forecast payloads are cached separately. Native public updates fetch PAGASA feeds and PHIVOLCS news; mounted consumers refresh every 15 minutes. This is polling, not push notification infrastructure.

Safety content and municipal hotlines are draft material. This review inventories implementation; it does not certify medical advice, phone numbers, or active emergency bulletins.
