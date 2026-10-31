import * as ImagePicker from 'expo-image-picker'

import { persistPhoto, readPhotoBase64, resolvePhotoUri } from '@/storage/photos'

/**
 * A photo staged for a chat message. `fileName` is the persisted reference (file name on
 * native, data URI on web) and `base64` is the payload sent to the vision model.
 */
export type Attachment = { fileName: string; mimeType: string; uri: string; base64: string }

export class AttachmentError extends Error {}

/**
 * Inline request bodies are capped at 20MB total. Base64 inflates bytes by ~33%, so this
 * leaves generous headroom for the prompt and history.
 */
const MAX_BASE64_CHARS = 6_000_000

/** Gemini accepts PNG, JPEG, WEBP, HEIC and HEIF. */
const SUPPORTED_MIME = ['image/png', 'image/jpeg', 'image/jpg', 'image/webp', 'image/heic', 'image/heif']

const PICKER_OPTIONS: ImagePicker.ImagePickerOptions = { mediaTypes: ['images'], quality: 0.6, exif: false, base64: true }

export type AttachmentSource = 'camera' | 'library'

/**
 * Opens the camera or photo library and stages the result.
 * Resolves `null` when the user cancels. Throws `AttachmentError` with a message
 * that is safe to show the user.
 */
export async function captureAttachment(source: AttachmentSource): Promise<Attachment | null> {
  if (source === 'camera') {
    const permission = await ImagePicker.requestCameraPermissionsAsync()
    if (!permission.granted) {
      throw new AttachmentError('Camera access is blocked. Allow camera permission in your device settings, or choose a photo instead.')
    }
  }

  let result: ImagePicker.ImagePickerResult
  try {
    result = source === 'camera'
      ? await ImagePicker.launchCameraAsync(PICKER_OPTIONS)
      : await ImagePicker.launchImageLibraryAsync(PICKER_OPTIONS)
  } catch {
    throw new AttachmentError(source === 'camera' ? 'Unable to open the camera. Try again, or choose a photo instead.' : 'Unable to open your photos.')
  }
  if (result.canceled) return null

  const asset = result.assets[0]
  const mimeType = SUPPORTED_MIME.includes(asset.mimeType ?? '') ? (asset.mimeType as string) : 'image/jpeg'
  const fileName = await persistPhoto(asset.uri)
  // Web's picker can omit base64; fall back to reading the persisted copy.
  const base64 = asset.base64 ?? await readPhotoBase64(fileName)
  if (base64.length > MAX_BASE64_CHARS) throw new AttachmentError('That photo is too large to send. Try taking it again at a lower resolution.')
  return { fileName, mimeType, uri: resolvePhotoUri(fileName), base64 }
}

const MIME_BY_EXTENSION: Record<string, string> = {
  png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg',
  webp: 'image/webp', heic: 'image/heic', heif: 'image/heif',
}

/** Stored photos carry no mime column, so the extension is the source of truth. */
const mimeFor = (mimeType: string | undefined, fileName: string) => {
  if (mimeType && SUPPORTED_MIME.includes(mimeType)) return mimeType
  const ext = fileName.split('.').pop()?.toLowerCase() ?? ''
  return MIME_BY_EXTENSION[ext] ?? 'image/jpeg'
}

/** Rebuilds an attachment from a photo already stored on the device. */
export async function attachmentFromStored(fileName: string, mimeType: string | undefined, uri: string): Promise<Attachment> {
  try {
    const base64 = await readPhotoBase64(fileName)
    if (base64.length > MAX_BASE64_CHARS) throw new AttachmentError('That photo is too large to send.')
    return { fileName, mimeType: mimeFor(mimeType, fileName), uri, base64 }
  } catch (error) {
    if (error instanceof AttachmentError) throw error
    throw new AttachmentError('Unable to read that photo.')
  }
}

/**
 * One-slot handoff so the Capture tab can send a photo to the chat screen without
 * putting megabytes of base64 through route params.
 */
let staged: Attachment | null = null

export const stageAttachment = (attachment: Attachment) => {
  staged = attachment
}

export const takeStagedAttachment = (): Attachment | null => {
  const current = staged
  staged = null
  return current
}
