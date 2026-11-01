import * as Haptics from 'expo-haptics'
import * as ImagePicker from 'expo-image-picker'
import { router, useFocusEffect } from 'expo-router'
import { useSQLiteContext } from 'expo-sqlite'
import { useCallback, useState } from 'react'
import { Image, StyleSheet, View } from 'react-native'

import { AppText } from '@/components/ui/AppText'
import { Button } from '@/components/ui/Button'
import { FadeIn } from '@/components/ui/FadeIn'
import { Icon } from '@/components/ui/Icon'
import { Banner, Note, PageHeader, SectionHeader } from '@/components/ui/Layout'
import { Screen } from '@/components/ui/Screen'
import { Touchable } from '@/components/ui/Touchable'
import { deletePhotoRow, insertPhoto, listPhotos, type Photo } from '@/db/photos'
import { attachmentFromStored, stageAttachment, AttachmentError, type Attachment } from '@/services/attachment'
import { deletePhotoFile, persistPhoto } from '@/storage/photos'
import { radius, space } from '@/theme/tokens'
import { useTheme } from '@/theme/useTheme'
import { confirmAction } from '@/utils/dialogs'

const pickerOptions: ImagePicker.ImagePickerOptions = { mediaTypes: ['images'], quality: 0.8, exif: false }

export default function CaptureScreen() {
  const db = useSQLiteContext()
  const { colors } = useTheme()
  const [pending, setPending] = useState<ImagePicker.ImagePickerAsset | null>(null)
  const [photos, setPhotos] = useState<Photo[]>([])
  const [busy, setBusy] = useState<'analyze' | 'save' | null>(null)
  const [error, setError] = useState('')

  useFocusEffect(useCallback(() => {
    listPhotos(db).then(setPhotos).catch(() => setError('Unable to load saved photos.'))
  }, [db]))

  const pick = async (source: 'camera' | 'library') => {
    setError('')
    try {
      if (source === 'camera') {
        const permission = await ImagePicker.requestCameraPermissionsAsync()
        if (!permission.granted) {
          setError('Camera permission is required to capture photos. Enable it in device settings.')
          return
        }
      }
      const result = source === 'camera'
        ? await ImagePicker.launchCameraAsync(pickerOptions)
        : await ImagePicker.launchImageLibraryAsync(pickerOptions)
      if (!result.canceled) {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {})
        setPending(result.assets[0])
      }
    } catch {
      setError(source === 'camera' ? 'Unable to open camera.' : 'Unable to open photo library.')
    }
  }

  const analyze = async (attachment: Attachment) => {
    stageAttachment(attachment)
    router.push('/chat')
  }

  const analyzePending = async () => {
    if (!pending) return
    setBusy('analyze')
    try {
      const fileName = await persistPhoto(pending.uri)
      await analyze(await attachmentFromStored(fileName, pending.mimeType, pending.uri))
    } catch (err) {
      setError(err instanceof AttachmentError ? err.message : 'Unable to prepare photo.')
    } finally {
      setBusy(null)
    }
  }

  const analyzeSaved = async (photo: Photo) => {
    try {
      await analyze(await attachmentFromStored(photo.fileName, undefined, photo.uri))
    } catch (err) {
      setError(err instanceof AttachmentError ? err.message : 'Unable to read photo.')
    }
  }

  const save = async () => {
    if (!pending) return
    setBusy('save')
    try {
      const fileName = await persistPhoto(pending.uri)
      const photo = await insertPhoto(db, { fileName, width: pending.width, height: pending.height })
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {})
      setPhotos((current) => [photo, ...current])
      setPending(null)
    } catch {
      setError('Unable to save photo.')
    } finally {
      setBusy(null)
    }
  }

  const confirmDelete = async (photo: Photo) => {
    const confirmed = await confirmAction({
      title: 'Delete photo?',
      message: 'This permanently removes the photo from this device.',
      confirmLabel: 'Delete',
      destructive: true,
    })
    if (!confirmed) return
    try {
      await deletePhotoRow(db, photo.id)
      deletePhotoFile(photo.fileName)
      Haptics.selectionAsync().catch(() => {})
      setPhotos((current) => current.filter((item) => item.id !== photo.id))
    } catch {
      setError('Unable to delete photo.')
    }
  }

  return (
    <Screen>
      <PageHeader title="Visual Assessment" subtitle="Capture a situation or damage for instant safety guidance." />

      {pending ? (
        <FadeIn>
        <View style={[styles.viewfinder, { backgroundColor: '#151518' }]}>
          <View style={styles.previewContainer}>
            <Image
              source={{ uri: pending.uri }}
              style={styles.preview}
              resizeMode="cover"
              accessibilityLabel="Captured photo preview"
            />
            <Touchable
              onPress={() => {
                Haptics.selectionAsync().catch(() => {})
                setPending(null)
              }}
              hitSlop={8}
              accessibilityLabel="Discard photo"
              style={styles.closeOverlay}
            >
              <Icon name="close" size={16} color="#ffffff" />
            </Touchable>
            <View style={styles.previewBadge}>
              <Icon name="check" size={14} color={colors.teal} />
              <AppText variant="caption" weight="600" style={{ color: '#ffffff' }}>
                Photo Ready
              </AppText>
            </View>
          </View>
        </View>
        </FadeIn>
      ) : null}

      {error ? <Banner text={error} tone="error" /> : null}

      <FadeIn delay={100}>
      {/* Apple Camera Controls */}
      {pending ? (
        <View style={styles.pendingActions}>
          <View style={styles.actionRowFull}>
            <Button
              label="Ask GabAI"
              icon="sparkles"
              onPress={analyzePending}
              loading={busy === 'analyze'}
              disabled={busy !== null}
            />
          </View>
          <View style={styles.actionRowSplit}>
            <Button
              label="Retake"
              icon="camera"
              variant="secondary"
              onPress={() => pick('camera')}
              disabled={busy !== null}
            />
            <Button
              label="Save photo"
              icon="download"
              variant="secondary"
              onPress={save}
              loading={busy === 'save'}
              disabled={busy !== null}
            />
          </View>
        </View>
      ) : (
        <View style={styles.captureActions}>
          <Button
            label="Take a photo"
            icon="camera"
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {})
              void pick('camera')
            }}
          />
          <Button
            label="Choose from library"
            icon="image"
            variant="secondary"
            onPress={() => {
              Haptics.selectionAsync().catch(() => {})
              void pick('library')
            }}
          />
        </View>
      )}
      </FadeIn>

      {/* Saved Photos Gallery */}
      <FadeIn delay={180}>
      <View style={styles.section}>
        <SectionHeader
          title="Recent Captures"
          caption={photos.length ? `${photos.length} ${photos.length === 1 ? 'photo' : 'photos'} saved on device` : 'Photos you save appear here'}
        />
        {photos.length ? (
          <View style={styles.grid}>
            {photos.map((photo) => {
              const taken = new Date(photo.createdAt).toLocaleString()
              return (
                <View key={photo.id} style={styles.thumbWrap}>
                  <Touchable
                    onPress={() => analyzeSaved(photo)}
                    accessibilityLabel={`Ask GabAI about photo saved ${taken}`}
                    style={styles.thumbTouch}
                  >
                    <Image
                      source={{ uri: photo.uri }}
                      style={[styles.thumb, { backgroundColor: colors.surface }]}
                    />
                  </Touchable>
                  <Touchable
                    onPress={() => confirmDelete(photo)}
                    hitSlop={8}
                    accessibilityLabel={`Delete photo saved ${taken}`}
                    style={[styles.thumbAction, { backgroundColor: 'rgba(0,0,0,0.6)' }]}
                  >
                    <Icon name="trash" size={13} color="#ffffff" />
                  </Touchable>
                </View>
              )
            })}
          </View>
        ) : (
          <View style={[styles.emptyCard, { backgroundColor: colors.surface, borderColor: colors.line }]}>
            <Icon name="image" size={22} color={colors.inkSoft} />
            <AppText variant="caption" tone="soft" align="center">
              No captures yet — photos you save will appear here.
            </AppText>
          </View>
        )}
      </View>
      </FadeIn>

      <Note icon="shield">
        Photos remain on this device and are only analyzed when you ask the chatbot.
      </Note>
    </Screen>
  )
}

const styles = StyleSheet.create({
  viewfinder: {
    width: '100%',
    aspectRatio: 4 / 5,
    maxHeight: 330,
    borderRadius: radius.group,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  previewContainer: {
    ...StyleSheet.absoluteFill,
  },
  preview: {
    ...StyleSheet.absoluteFill,
  },
  closeOverlay: {
    position: 'absolute',
    top: space[3],
    right: space[3],
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(0, 0, 0, 0.65)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  previewBadge: {
    position: 'absolute',
    bottom: space[3],
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(0, 0, 0, 0.75)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: radius.pill,
  },
  captureActions: {
    marginTop: space[6],
    gap: space[3],
  },
  /* Pending review actions */
  pendingActions: {
    marginTop: space[4],
    gap: space[3],
  },
  actionRowFull: {
    flexDirection: 'row',
  },
  actionRowSplit: {
    flexDirection: 'row',
    gap: space[3],
  },
  /* Gallery */
  section: {
    marginTop: space[6],
  },
  emptyCard: {
    minHeight: 110,
    alignItems: 'center',
    justifyContent: 'center',
    gap: space[2],
    padding: space[5],
    borderWidth: 1,
    borderRadius: radius.group,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginHorizontal: -space[1],
  },
  thumbWrap: {
    width: '33.333%',
    padding: space[1],
  },
  thumbTouch: {
    width: '100%',
  },
  thumb: {
    width: '100%',
    aspectRatio: 1,
    borderRadius: radius.md,
  },
  thumbAction: {
    position: 'absolute',
    top: space[2],
    right: space[2],
    width: 26,
    height: 26,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
  },
})
