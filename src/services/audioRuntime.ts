import { requireOptionalNativeModule } from 'expo'
import { Platform } from 'react-native'

// Older development clients must still be able to open Chat before being rebuilt.
export const audioRuntime: typeof import('expo-audio') | null =
  Platform.OS === 'web' || requireOptionalNativeModule('ExpoAudio')
    // eslint-disable-next-line @typescript-eslint/no-require-imports -- Static imports crash older development clients before Chat can render.
    ? require('expo-audio')
    : null

export const AUDIO_BUILD_MESSAGE = 'Voice messages need the updated GabAI app. Install the latest development build to enable audio.'
