/** Browser previews store voice recordings inline because expo-file-system is native only. */
export const resolveAudioUri = (fileName: string) => fileName

const toDataUri = (blob: Blob) => new Promise<string>((resolve, reject) => {
  const reader = new FileReader()
  reader.onload = () => resolve(reader.result as string)
  reader.onerror = () => reject(reader.error)
  reader.readAsDataURL(blob)
})

export async function persistAudio(sourceUri: string): Promise<string> {
  if (sourceUri.startsWith('data:')) return sourceUri
  const response = await fetch(sourceUri)
  return toDataUri(await response.blob())
}

export async function readAudioBase64(fileName: string): Promise<string> {
  const comma = fileName.indexOf(',')
  if (!fileName.startsWith('data:') || comma < 0) throw new Error('This recording is not stored inline.')
  return fileName.slice(comma + 1)
}

export function deleteAudioFile(_fileName: string) {}
export function deleteAllAudioFiles() {}
