# Documentation

Source review dated 2026-11-02, for app version 1.2.0. These documents describe the checked-in implementation. Runtime support and external service availability require separate device and network validation.

| Document | Contents |
| --- | --- |
| [Product requirements](product-requirements.md) | Goals, user needs, requirements, priorities, acceptance criteria, open decisions |
| [Release readiness](release-readiness.md) | Safety, privacy, platform, and build sign-off checklist |
| [System overview](system-overview.md) | Purpose, routes, user journeys, connectivity |
| [Architecture](architecture.md) | Layers, startup, rendering, service boundaries |
| [AI and voice](ai-and-voice.md) | Dispatch, streaming, model lifecycle, media |
| [Data and privacy](data-and-privacy.md) | SQLite, files, secrets, backups, deletion |
| [Repository map](repository-map.md) | Source ownership, assets, native module, artifacts |
| [Development](development.md) | Installation, builds, verification, troubleshooting |
| [Review findings](review-findings.md) | Observed limitations, priorities, verification results |

## Project artifacts

- [Demo videos](demo/README.md)
- [Presentations and event material](presentations/README.md)

Update these documents when routes, migrations, model formats, platform behavior, or build configuration changes. Source paths in the topic documents are relative to the repository root.
