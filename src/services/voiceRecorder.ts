import type { RecordingOptions } from 'expo-audio'
import { useCallback } from 'react'
import { Platform } from 'react-native'

import { persistAudio, readAudioBase64, resolveAudioUri } from '@/storage/audio'
import { audioRuntime, AUDIO_BUILD_MESSAGE } from './audioRuntime'

export const MAX_RECORDING_MS = 120_000

const RecordingPresets = audioRuntime?.RecordingPresets
const RECORDING_OPTIONS: RecordingOptions | null = RecordingPresets ? {
  ...RecordingPresets.HIGH_QUALITY,
  ...(Platform.OS === 'android'
    ? {
        extension: '.aac',
        android: {
          ...RecordingPresets.HIGH_QUALITY.android,
          extension: '.aac',
          outputFormat: 'aac_adts' as const,
          audioEncoder: 'aac' as const,
        },
      }
    : {}),
} : null

export type VoiceAttachment = {
  fileName: string
  mimeType: string
  durationMs: number
  uri: string
  base64: string
}

function useAvailableVoiceRecorder() {
  const { useAudioRecorder, useAudioRecorderState, requestRecordingPermissionsAsync, setAudioModeAsync } = audioRuntime!
  const recorder = useAudioRecorder(RECORDING_OPTIONS!)
  const state = useAudioRecorderState(recorder)

  const start = useCallback(async () => {
    const permission = await requestRecordingPermissionsAsync()
    if (!permission.granted) throw new Error('Microphone access is needed for voice messages.')
    await setAudioModeAsync({ allowsRecording: true, playsInSilentMode: true })
    await recorder.prepareToRecordAsync()
    recorder.record()
  }, [recorder, requestRecordingPermissionsAsync, setAudioModeAsync])

  const stop = useCallback(async (): Promise<VoiceAttachment | null> => {
    try {
      if (recorder.isRecording) await recorder.stop()
    } catch {
      // The web implementation can throw when the recording was already stopped.
    }
    if (!recorder.uri) return null
    const durationMs = recorder.getStatus().durationMillis
    const fileName = await persistAudio(recorder.uri)
    const mimeType = fileName.startsWith('data:')
      ? fileName.slice(5, fileName.indexOf(';'))
      : fileName.toLowerCase().endsWith('.m4a') ? 'audio/mp4' : 'audio/aac'
    const uri = resolveAudioUri(fileName)
    const base64 = await readAudioBase64(fileName)
    if (base64.length > 10_000_000) {
      throw new Error('That recording is too large to send. Try a shorter voice message.')
    }
    return { fileName, mimeType, durationMs, uri, base64 }
  }, [recorder])

  const cancel = useCallback(async () => {
    try {
      if (recorder.isRecording) await recorder.stop()
    } catch {}
  }, [recorder])

  return {
    recording: state.isRecording,
    durationMs: state.durationMillis,
    start,
    stop,
    cancel,
  }
}

function useUnavailableVoiceRecorder() {
  return {
    recording: false,
    durationMs: 0,
    start: async () => { throw new Error(AUDIO_BUILD_MESSAGE) },
    stop: async (): Promise<VoiceAttachment | null> => null,
    cancel: async () => {},
  }
}

// Availability is fixed for the lifetime of the installed binary, so hook order is stable.
export const useVoiceRecorder = audioRuntime ? useAvailableVoiceRecorder : useUnavailableVoiceRecorder
