# GabAI product requirements

**Status:** Product baseline and release requirements  
**Product:** GabAI  
**Version reviewed:** 1.2.0  
**Audience:** Product, engineering, design, disaster-risk, health, and local government reviewers

This document describes the product evidenced by the current app and defines requirements for a safe, usable release. It is not a claim that every launch requirement has been met. See [release readiness](release-readiness.md) for open gates and [review findings](review-findings.md) for repository observations.

## 1. Product summary

GabAI is a mobile safety companion for residents and visitors in Marinduque, Philippines. It provides practical, locally relevant emergency guidance, access to emergency contacts, a personal emergency profile, and an assistant that can work without an internet connection using bundled content or an optional on-device model.

The product must make its limits clear. It does not replace emergency responders, medical professionals, or official bulletins. AI-generated content must not be presented as verified official advice. Users must be able to reach the hotline directory without configuring an AI service.

## 2. Problem and opportunity

During severe weather, earthquakes, floods, landslides, or other emergencies, people may have limited connectivity, limited time, or difficulty finding practical local steps and relevant contacts. A mobile app can keep essential reference content and a personal emergency profile accessible on the device, while offering connected and local AI assistance when available.

The product opportunity is to make preparedness information and contact discovery easier to access in the Marinduque context, including when connectivity is poor. The current repository does not provide research evidence quantifying the problem or proving outcomes; local discovery and validation remain necessary.

## 3. Users and context

### Primary users

- Residents of Marinduque who want to prepare for hazards and find local responders.
- People who need quick access to essential health, address, or emergency-contact details.
- Users with intermittent or no internet access during an emergency.

### Secondary users

- Visitors who need provincial or national hotlines and general preparedness information.
- Local disaster-risk, health, and government reviewers responsible for verifying the content and contact directory.

### Use conditions

- Users may be stressed, in a hurry, using one hand, or working with limited battery and connectivity.
- Some users may use larger text settings or assistive technologies.
- Location access may be denied, inaccurate, disabled, or unavailable.
- On-device AI may not fit the device's memory or native build capabilities.
- The app targets iOS and Android; web is a preview and development surface.

## 4. Product goals

1. Keep core guides, contacts, and saved profile information available offline.
2. Help users identify relevant municipal, provincial, or national emergency contacts with a manual fallback when GPS fails.
3. Provide useful assistant responses through available AI and deterministic offline content, while explaining which source answered and when AI is unavailable.
4. Let users capture and revisit safety-related photos and attach relevant media to a chat when supported.
5. Keep personal information on the device by default, make external data flows understandable, and provide backup and clear-data controls.
6. Make the experience legible, accessible, and usable on mobile devices under stressful conditions.

## 5. Non-goals

- Replacing emergency services, professional medical care, or official public warnings.
- Guaranteeing internet access, delivery of notifications, emergency dispatch, or contact availability.
- Providing a cloud account, cross-device synchronization, or a server-side user profile.
- Guaranteeing that an AI answer is correct, that a phone supports local inference, or that local inference can use an NPU.
- Providing a complete backup of all app state: the current backup covers profile and selected preferences only.
- Treating preview-generated browser updates as real-time official updates.

## 6. Functional requirements

Priority levels: **P0** required for a safe public release; **P1** important core behavior; **P2** useful enhancement. “Current” describes source behavior, not approval or release verification.

| ID | Priority | Requirement | Acceptance criteria | Current status |
| --- | --- | --- | --- | --- |
| ONB-1 | P1 | First launch collects a nickname and explains the app's purpose. | An incomplete profile routes to onboarding; a valid nickname completes onboarding; clearing data reopens it. | Implemented |
| GUIDE-1 | P0 | Users can browse and search bundled safety guides offline. | Guides load without network; relevant local terms find the intended guide; content review and versioning are complete before release. | Implemented; content review open |
| GUIDE-2 | P0 | Guidance communicates its source and limitations. | Safety-sensitive copy avoids diagnosis/guarantees, advises following local authorities, and has a named content reviewer and review date. | Content review open |
| CONTACT-1 | P0 | Users can access national, provincial, and municipality-specific contacts without AI or network access. | Directory renders from bundled data; each entry has source and last-verified date; each number is confirmed by responsible agency before release. | Implemented; verification open |
| CONTACT-2 | P0 | GPS assists contact selection without blocking manual selection. | Permission denial, services-off, timeout, off-island, and unavailable states are explained; retry and municipality selection remain available. | Implemented; device validation open |
| CONTACT-3 | P1 | Users can call a listed number. | Tapping a contact invokes the platform dialer; failure leaves the number readable for manual dialing. | Implemented; device validation open |
| PROF-1 | P1 | Users can save emergency-relevant personal, health, location, and contact details locally. | Fields validate allowed values and length; reopening the profile reads persisted values; data is not sent unless needed for a user-requested assistant interaction. | Implemented; privacy review open |
| CHAT-1 | P1 | The assistant answers text requests using the configured available source. | Local mode uses the downloaded model when available, otherwise bundled retrieval; cloud mode uses Gemini when configured and falls back before output begins; the UI explains fallback. | Implemented; answer-quality review open |
| CHAT-2 | P0 | The assistant does not silently replace partially streamed responses. | Once text is visible, a later error is shown on the message and can be retried; interruption recovery marks unfinished replies. | Implemented |
| CHAT-3 | P0 | Assistant responses are framed as guidance, with appropriate emergency escalation. | Crisis/emergency prompts prioritize calling verified local or national services; content reviewers sign off on safety prompts and refusal/fallback wording. | Partially implemented; review open |
| CHAT-4 | P1 | Users can attach an image or recorded voice message where supported. | Unsupported platform/build states are explained; media access is permission-gated; attachments persist and can be removed with chat data; local duration limits are disclosed. | Implemented; limit clarity open |
| CHAT-5 | P1 | Users can stop generation, retry failed messages, and optionally hear replies. | Stop aborts active work; retry uses appropriate prior completed history; speech can be stopped; missing native modules produce a clear explanation. | Implemented; device validation open |
| LOCAL-1 | P1 | Users can download, pause/resume, remove, and load the local model. | Progress and status are visible; incomplete/wrong-size files are not loaded; low-memory/unsupported devices receive actionable errors; model lifecycle remains serialized. | Implemented; hardware coverage open |
| CLOUD-1 | P1 | Users can configure and remove their Gemini key. | Key is not included in backups; cloud requests only occur when cloud mode is selected; key deletion works through clear-data. | Implemented; privacy disclosure review open |
| DATA-1 | P0 | Users understand what is stored, backed up, sent externally, and deleted. | Privacy information matches actual native and web behavior; backup scope is stated; reset outcomes are accurate and tested. | Partially implemented; reset cache gap open |
| DATA-2 | P1 | Users can export and restore a supported backup. | Valid backups restore allowed profile/settings; invalid or oversized files fail safely; restore warns it replaces current profile/preferences. | Implemented; scope is limited |
| DATA-3 | P0 | Users can clear personal data and credentials. | Reset removes all in-scope profile, conversation, media, preferences, credentials, and location-bearing cached data, then returns to onboarding. | Partially implemented; weather/update cache currently remains |
| WEATHER-1 | P2 | Home can show current weather and a forecast using local coordinates when available. | Location source/fallback and update time are clear; stale cached values are distinguishable from fresh data; outage does not block core offline features. | Implemented; UX validation open |
| UPDATE-1 | P1 | Users can view recent updates attributed to official sources. | Each item links to an allowed official domain and displays source/time; stale/expired items are removed; failures preserve usable cached items; preview content is unmistakably labeled. | Native implemented; web uses sample content and needs clear labeling |
| UI-1 | P1 | Core tasks remain usable across supported screen sizes and text settings. | Touch targets, text scaling, contrast, safe areas, and screen-reader labels are checked on representative iOS/Android devices. | Partial; accessibility/device review open |

## 7. Safety and trust requirements

- Verified emergency numbers and safety instructions require named local authority owners, provenance, verification dates, and a refresh process.
- The app must distinguish static educational guidance, cached information, live fetched updates, and generated AI answers.
- No synthetic or stale update may appear as a current official warning.
- If location cannot be determined, the app must expose manual municipality selection and must not imply that an approximate centroid proves the user's barangay.
- AI must not claim a responder has been contacted, a call has been placed, or a user's location has been shared unless the app actually performed that action.
- The app must not imply guaranteed medical or disaster outcomes. Urgent cases should direct users to verified human emergency channels.
- Privacy descriptions must distinguish native SecureStore from browser localStorage and explain data sent to Gemini, Open-Meteo, and public feeds.
- Users must be told before personal profile context is included in a cloud AI request.

## 8. Non-functional requirements

### Availability and performance

- Bundled guides, contact directory, profile, and saved chat history must open without network access.
- Core navigation must remain responsive while network requests or model downloads are in progress.
- Local model loading must check memory and model completeness before native inference; failures must not crash the primary guide/contact flows.
- Cached weather and official updates must show their timestamps and recover gracefully from network failures.

### Privacy and security

- Keep personal records and captured media in app-private storage on native platforms.
- Never include secrets in an exported backup or application logs.
- Bound and validate imported backup data and native media paths.
- Clearly explain that browser localStorage and browser-held data do not have the same protection as native SecureStore.
- Clear-data behavior and copy must agree, including caches that contain coordinates.

### Accessibility and usability

- Provide adjustable text sizes, theme choices, accessible labels and states, clear focus/navigation behavior, and adequate touch targets.
- Preserve readable error messages and manual alternatives when location, camera, microphone, network, model, or dialer access is unavailable.
- Keep the emergency directory reachable without completing AI setup.

### Compatibility

- Primary support is iOS and Android builds that include the required native modules.
- Web is a preview; disclose which functions are sample-only or unavailable.
- Validate each native release build on representative physical devices, including a low-memory device and at least one device with the intended local model path.

## 9. Success measures

Instrumenting product analytics is not currently part of the repository. Establish privacy-preserving measures with stakeholder approval before collecting any user data. Candidate measures:

- Task success rate for finding a correct municipality hotline without assistance.
- Time to reach a guide or contact from a cold app start.
- Completion rate for onboarding and emergency profile setup.
- Offline task completion for guide lookup and hotline browsing.
- Rate of confusing or unsafe assistant answers reported in moderated review.
- Percentage of hotline entries with a current agency verification record.
- Crash-free sessions and model-load success by device class, collected only with appropriate consent and minimization.

Do not use model engagement or raw conversation collection as a success measure by default; prioritize safe task completion and verified information.

## 10. Dependencies and assumptions

- Medical and disaster guidance reviewers are available before public release.
- Municipal and provincial agencies can verify hotlines and provide a change contact/process.
- Users have an iOS/Android phone; advanced local inference is optional and device-dependent.
- Gemini is bring-your-own-key and internet-dependent. Provider availability, pricing, quotas, and retention policies can change and must be rechecked before launch.
- Open-Meteo and public agency feeds are third-party dependencies; their uptime and terms are outside the app's control.
- App content is currently bundled and requires an app update to correct static guides or numbers.

## 11. Release gates

Public release requires all P0 acceptance criteria to pass and the [release readiness checklist](release-readiness.md) to be signed by the relevant owners. In particular, review and verify safety content and hotlines, correct web preview labeling, align reset behavior with privacy copy, exercise native builds on devices, and confirm no app-store privacy or permission disclosures are missing.

## 12. Open product decisions

1. Which local authority owns approval and periodic re-verification of each guide and hotline?
2. Should location-bearing weather cache be retained after clear-data, and if so, how is that retention disclosed?
3. Should voice recording be capped at 30 seconds to match local analysis, or should longer recordings clearly require cloud mode?
4. Which browser-preview features should use labeled sample data versus be disabled?
5. What minimum device matrix and supported OS versions define official release support?
6. Is complete backup of chat and media desirable, or should the limited profile/preferences backup remain the deliberate privacy choice?
