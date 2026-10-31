import { Platform } from 'react-native'
import type { Voice } from 'expo-speech'

import type { VoiceLanguage } from '@/db/settings'
import { speech as Speech } from '@/services/speech'

export type { Voice } from 'expo-speech'

const normalizeLanguage = (language: string) => language.toLowerCase().replaceAll('_', '-')
const isFilipino = (language: string) => /^(fil|tl)(-|$)/.test(normalizeLanguage(language))

/** Taglish uses Filipino pronunciation so Tagalog words keep their natural sounds. */
export function playbackLanguage(text: string, language: VoiceLanguage): 'fil-PH' | 'en-US' {
  if (language !== 'auto') return language
  return /\b(ako|ikaw|siya|tayo|kami|kayo|sila|ang|mga|ng|iyong|inyong|aking|ating|natin|naman|po|opo|hindi|huwag|wag|kung|kapag|kailangan|maaari|puwede|pwede|salamat|kumusta|magandang|umaga|gabi|tulong|pumunta|tumawag|ligtas|mayroon|meron|walang|para sa)\b/i.test(text)
    ? 'fil-PH' : 'en-US'
}

export function matchingVoices(voices: Voice[], language: VoiceLanguage): Voice[] {
  return voices.filter((voice) => language === 'auto'
    ? isFilipino(voice.language) || /^en(-|$)/.test(normalizeLanguage(voice.language))
    : language === 'fil-PH' ? isFilipino(voice.language) : /^en(-|$)/.test(normalizeLanguage(voice.language)))
    .sort((a, b) => {
      const score = (voice: Voice) => (voice.quality === 'Enhanced' ? 10 : 0)
        + (normalizeLanguage(voice.language) === normalizeLanguage(language) ? 2 : 0)
        + (normalizeLanguage(voice.language) === 'en-ph' ? 1 : 0)
      return score(b) - score(a) || a.name.localeCompare(b.name) || a.identifier.localeCompare(b.identifier)
    })
}

/** Re-query so voices installed in phone settings are picked up without restarting. */
export async function availableVoices(): Promise<Voice[]> {
  if (!Speech) return []
  return Speech.getAvailableVoicesAsync()
}

let request = 0
let activeEnd: (() => void) | undefined
let stopping = Promise.resolve()

function stopEngine() {
  stopping = stopping.then(() => Speech?.stop()).then(() => {}, () => {})
  return stopping
}

/** Speaks using an installed voice, preferring enhanced voices in the reply's language. */
export function speak(text: string, lang: VoiceLanguage, onEnd?: () => void, onError?: (message?: string) => void, voiceIdentifier = '') {
  const id = ++request
  activeEnd?.()
  let finished = false
  const finish = () => {
    if (finished) return
    finished = true
    if (id === request) activeEnd = undefined
    onEnd?.()
  }
  activeEnd = finish
  const fail = (message?: string) => {
    if (id !== request || finished) return
    finish()
    onError?.(message)
  }

  void (async () => {
    try {
      const engine = Speech
      if (!engine) { fail(); return }
      await stopEngine()
      const voices = await availableVoices()
      if (id !== request) return
      const language = playbackLanguage(text, lang)
      const candidates = matchingVoices(voices, language)
      const voice = candidates.find((item) => item.identifier === voiceIdentifier) ?? candidates[0]
      if (voices.length && !voice) {
        fail(`Install ${language === 'fil-PH' ? 'a Filipino / Tagalog' : 'an English'} voice in your device's text-to-speech settings, then try again.`)
        return
      }
      // Avoid reading Markdown syntax aloud.
      const spoken = text.replace(/```[\s\S]*?```/g, '')
        .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
        .replace(/^\s{0,3}(?:#{1,6}\s+|[-*+]\s+)/gm, '')
        .replace(/[*_`]/g, '').trim()
      if (!spoken) { finish(); return }
      // Android engines cap input length. Read long replies in order without truncation.
      const limit = Math.max(1, Math.min(engine.maxSpeechInputLength || 3000, 3000))
      let remaining = spoken
      const next = () => {
        if (id !== request || finished) return
        if (!remaining) { finish(); return }
        let end = Math.min(remaining.length, limit)
        if (end < remaining.length) {
          const boundary = remaining.lastIndexOf(' ', end)
          if (boundary > end / 2) end = boundary
        }
        const chunk = remaining.slice(0, end)
        remaining = remaining.slice(end).trimStart()
        try {
          engine.speak(chunk, {
            language: voice?.language ?? language,
            voice: voice?.identifier,
            rate: 0.95,
            pitch: 1,
            onDone: next,
            onStopped: finish,
            onError: () => fail(),
          })
        } catch { fail() }
      }
      next()
    } catch { fail() }
  })()
}

export function voiceOutputAvailable(): boolean {
  return Speech !== null && (Platform.OS !== 'web' || (typeof window !== 'undefined' && 'speechSynthesis' in window))
}

export function stopSpeaking() {
  ++request
  activeEnd?.()
  activeEnd = undefined
  void stopEngine()
}
