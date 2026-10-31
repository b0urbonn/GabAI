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
import { brand, radius, space } from '@/theme/tokens'
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

      <FadeIn>
      {/* Apple-style Camera Viewfinder */}
      <View style={[styles.viewfinder, { backgroundColor: '#151518' }]}>
        {pending ? (
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
        ) : (
          <Touchable
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {})
              void pick('camera')
            }}
            pressedScale={0.99}
            accessibilityRole="button"
            accessibilityLabel="Tap to open camera"
            style={styles.viewfinderTouchable}
          >
            <View style={styles.placeholder}>
              <View style={styles.placeholderIcon}>
                <Icon name="camera" size={32} color="#ffffff" />
              </View>
              <AppText variant="bodyStrong" style={styles.viewfinderTitle}>
                Tap to Open Camera
              </AppText>
              <AppText variant="caption" style={styles.viewfinderSubtitle}>
                Frame hazard, injury, or damage
              </AppText>
            </View>

            {/* iOS Framing Reticle Brackets */}
            <View style={styles.reticleTopLeft} />
            <View style={styles.reticleTopRight} />
            <View style={styles.reticleBottomLeft} />
            <View style={styles.reticleBottomRight} />
          </Touchable>
        )}
      </View>
      </FadeIn>

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
        <View style={styles.cameraDock}>
          {/* Photo Library Button */}
          <View style={styles.dockItem}>
            <Touchable
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {})
                void pick('library')
              }}
              pressedScale={0.92}
              accessibilityLabel="Choose from photo library"
              style={[
                styles.dockSideButton,
                { backgroundColor: colors.surface, borderColor: colors.line },
              ]}
            >
              <Icon name="image" size={22} color={colors.ink} />
            </Touchable>
            <AppText variant="small" tone="soft" style={styles.dockLabel}>
              Photos
            </AppText>
          </View>

          {/* Central Apple Shutter Button */}
          <View style={styles.dockItem}>
            <Touchable
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {})
                void pick('camera')
              }}
              pressedScale={0.90}
              accessibilityLabel="Take a photo"
              accessibilityRole="button"
              style={[styles.shutterOuter, { borderColor: colors.line }]}
            >
              <View style={[styles.shutterInner, { backgroundColor: colors.teal }]}>
                <Icon name="camera" size={26} color={brand.onPrimary} />
              </View>
            </Touchable>
            <AppText variant="caption" weight="600" style={styles.dockLabel}>
              Take Photo
            </AppText>
          </View>

          {/* Recent Thumbnail or Balanced Slot */}
          <View style={styles.dockItem}>
            {photos.length > 0 ? (
              <Touchable
                onPress={() => {
                  Haptics.selectionAsync().catch(() => {})
                  void analyzeSaved(photos[0])
                }}
                pressedScale={0.92}
                accessibilityLabel="Analyze latest photo"
                style={[
                  styles.dockSideButton,
                  { backgroundColor: colors.surface, borderColor: colors.line, overflow: 'hidden' },
                ]}
              >
                <Image source={{ uri: photos[0].uri }} style={StyleSheet.absoluteFill} />
                <View style={[styles.recentBadge, { backgroundColor: colors.teal }]}>
                  <AppText variant="tab" weight="700" style={{ color: brand.onPrimary, fontSize: 9 }}>
                    {photos.length}
                  </AppText>
                </View>
              </Touchable>
            ) : (
              <View style={styles.dockSidePlaceholder} />
            )}
            <AppText variant="small" tone="soft" style={styles.dockLabel}>
              {photos.length > 0 ? 'Recent' : ''}
            </AppText>
          </View>
        </View>
      )}
      </FadeIn>

      {/* Saved Photos Gallery */}
      {photos.length > 0 && (
        <FadeIn delay={180}>
        <View style={styles.section}>
          <SectionHeader
            title="Recent Captures"
            caption={`${photos.length} ${photos.length === 1 ? 'photo' : 'photos'} saved on device`}
          />
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
        </View>
        </FadeIn>
      )}

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
  viewfinderTouchable: {
    ...StyleSheet.absoluteFill,
    alignItems: 'center',
    justifyContent: 'center',
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
  placeholder: {
    alignItems: 'center',
    padding: space[6],
    gap: space[2],
  },
  placeholderIcon: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: space[2],
  },
  viewfinderTitle: {
    color: '#ffffff',
  },
  viewfinderSubtitle: {
    color: 'rgba(255, 255, 255, 0.6)',
  },
  /* Reticle corner brackets */
  reticleTopLeft: {
    position: 'absolute',
    top: 16,
    left: 16,
    width: 24,
    height: 24,
    borderTopWidth: 2.5,
    borderLeftWidth: 2.5,
    borderTopLeftRadius: 6,
    borderColor: 'rgba(255, 255, 255, 0.5)',
  },
  reticleTopRight: {
    position: 'absolute',
    top: 16,
    right: 16,
    width: 24,
    height: 24,
    borderTopWidth: 2.5,
    borderRightWidth: 2.5,
    borderTopRightRadius: 6,
    borderColor: 'rgba(255, 255, 255, 0.5)',
  },
  reticleBottomLeft: {
    position: 'absolute',
    bottom: 16,
    left: 16,
    width: 24,
    height: 24,
    borderBottomWidth: 2.5,
    borderLeftWidth: 2.5,
    borderBottomLeftRadius: 6,
    borderColor: 'rgba(255, 255, 255, 0.5)',
  },
  reticleBottomRight: {
    position: 'absolute',
    bottom: 16,
    right: 16,
    width: 24,
    height: 24,
    borderBottomWidth: 2.5,
    borderRightWidth: 2.5,
    borderBottomRightRadius: 6,
    borderColor: 'rgba(255, 255, 255, 0.5)',
  },
  /* Apple Camera Control Dock */
  cameraDock: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    marginTop: space[6],
    paddingHorizontal: space[4],
  },
  dockItem: {
    alignItems: 'center',
    gap: space[2],
    minWidth: 74,
  },
  dockLabel: {
    textAlign: 'center',
  },
  shutterOuter: {
    width: 74,
    height: 74,
    borderRadius: 37,
    borderWidth: 4,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.12,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 3 },
    elevation: 3,
  },
  shutterInner: {
    width: 58,
    height: 58,
    borderRadius: 29,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dockSideButton: {
    width: 50,
    height: 50,
    borderRadius: 25,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.06,
    shadowRadius: 3,
    shadowOffset: { width: 0, height: 1 },
    elevation: 1,
  },
  dockSidePlaceholder: {
    width: 50,
    height: 50,
  },
  recentBadge: {
    position: 'absolute',
    top: 2,
    right: 2,
    minWidth: 16,
    height: 16,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
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
