# Development and operations

## Install and run

Use npm; the repository has `package-lock.json`. Root dependency installation applies the checked-in LiteRT patch through `postinstall`.

```sh
npm ci
npx expo start --dev-client
```

Use a development build containing the current native dependencies. Expo Go is insufficient for the local AI runtime/custom native module. Browser preview:

```sh
npm run web
```

The app's declared versions are Expo `~58.0.21`, React Native `0.88.1`, React `19.3.0`, TypeScript `~6.0.3`, and LiteRT LM `0.8.1`. Check the lockfile for exact resolved versions. Use `npx expo install <package>` for SDK-compatible additions.

Read the matching [SDK 58 reference](https://docs.expo.dev/versions/v58.0.0/) and [Expo documentation index](https://docs.expo.dev/llms.txt) before changing framework APIs. The repository instructions require version-specific documentation rather than remembered APIs.

## Native builds

```sh
npx eas-cli@latest build --platform android --profile development
npx eas-cli@latest build --platform android --profile release
```

`development` is an internal development-client APK; `release` is also an internal APK distribution profile. Neither profile configures store submission. The config identifies Android package `com.dale_123.gabai`, version 1.2.0, versionCode 5, and deep-link scheme `gabai`.

`npm run android` / `npm run ios` invoke local Expo native runs when the relevant toolchain is installed. Native dependency, module, plugin, permission, or JNI keep-rule changes need a rebuilt binary. Preserve generated-directory conventions and do not hand-edit generated projects for lasting changes.

EAS submit/update workflows are not configured as release automation in this repository. Do not infer deployed OTA support from the existence of an EAS project ID.

## Verification

```sh
npm run typecheck
npm run lint
npx expo-doctor
node --test tests/localModel.test.cjs
```

Optional bundling check:

```sh
CI=1 npx expo export --platform android --platform ios --output-dir /tmp/gabai-export
```

The Node suite tests memory guards, incomplete models, engine serialization, media cleanup, and failure recovery with mocked native boundaries. Passing it does not prove physical-device inference, microphone access, GPU/NPU execution, or production JNI packaging. TypeScript includes `src`, generated route types, and Expo declarations; it does not typecheck Kotlin/C++ or the separate video workspace.

## Troubleshooting

| Symptom | Check |
| --- | --- |
| Local AI unavailable in build | Install/rebuild a development binary with Nitro/LiteRT and the local Expo module |
| Model cannot load | Artifact size, free storage, actual available RAM, supported ABI/API, compatible backend |
| Voice recording works but local analysis fails | Android local decoder accepts 30 seconds although recorder allows 120; iOS local audio analysis is unsupported |
| Browser waits for database | Close another tab or use the database handoff action; use a secure browser context |
| Gemini falls back offline | Key, accessible models, network, quota, and displayed mapped error |
| No fresh updates | Network/source availability; web intentionally uses preview items |
| Preference reverts after restart | Persistence failed after optimistic provider update |

## Demo workspace

The ignored `video/` directory is a separate Remotion project when present locally. Existing project notes describe `npm run render`, `npm run promo`, screen capture, and generated narration/music inside that workspace. Its dependencies and rendering environment are not part of the root application's verification. Final videos are indexed in [demo/README.md](demo/README.md).
