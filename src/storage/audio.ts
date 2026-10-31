import { Directory, File, Paths } from 'expo-file-system'

const audioDirectory = () => new Directory(Paths.document, 'attachments')

export const resolveAudioUri = (fileName: string) => new File(audioDirectory(), fileName).uri

export async function persistAudio(sourceUri: string): Promise<string> {
  const directory = audioDirectory()
  directory.create({ intermediates: true, idempotent: true })
  const source = new File(sourceUri)
  const fileName = `voice-${Date.now()}${source.extension || '.aac'}`
  await source.copy(new File(directory, fileName))
  return fileName
}

export async function readAudioBase64(fileName: string): Promise<string> {
  return new File(audioDirectory(), fileName).base64()
}

export function deleteAudioFile(fileName: string) {
  const file = new File(audioDirectory(), fileName)
  if (file.exists) file.delete()
}

export function deleteAllAudioFiles() {
  const directory = audioDirectory()
  if (directory.exists) directory.delete()
}
