import type { ChatAudio } from '@/db/chat'
import { readAudioBase64 } from '@/storage/audio'
import type { VoiceAttachment } from '@/services/voiceRecorder'

export class AudioAttachmentError extends Error {}

const MAX_BASE64_CHARS = 10_000_000

export async function audioAttachmentFromStored(audio: ChatAudio): Promise<VoiceAttachment> {
  try {
    const base64 = await readAudioBase64(audio.fileName)
    if (base64.length > MAX_BASE64_CHARS) throw new AudioAttachmentError('That recording is too large to send.')
    return { ...audio, base64 }
  } catch (error) {
    if (error instanceof AudioAttachmentError) throw error
    throw new AudioAttachmentError('Unable to read that voice message.')
  }
}
