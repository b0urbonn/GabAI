import { useTheme } from '@/theme/useTheme'
import { Image, Platform, StyleSheet, TextInput, View } from 'react-native'

import { AppText } from '@/components/ui/AppText'
import { Icon } from '@/components/ui/Icon'
import { Touchable } from '@/components/ui/Touchable'
import { brand, radius, space, touchTarget, typeRamp } from '@/theme/tokens'
import { AudioChip } from './AudioChip'

type PendingAudio = { uri: string; durationMs: number }

export function ChatInput({
  value,
  onChange,
  onSend,
  onStop,
  disabled = false,
  generating = false,
  imageUri,
  onPickImage,
  onRemoveImage,
  audio,
  onRemoveAudio,
  recording = false,
  recordingMs = 0,
  onStartRecording,
  onStopRecording,
  onCancelRecording,
}: {
  value: string
  onChange: (value: string) => void
  onSend: () => void
  onStop: () => void
  disabled?: boolean
  generating?: boolean
  imageUri?: string | null
  onPickImage?: () => void
  onRemoveImage?: () => void
  audio?: PendingAudio | null
  onRemoveAudio?: () => void
  recording?: boolean
  recordingMs?: number
  onStartRecording?: () => void
  onStopRecording?: () => void
  onCancelRecording?: () => void
}) {
  const { colors, scale } = useTheme()
  const canSend = !disabled && !generating && !recording && Boolean(value.trim() || imageUri || audio)
  const inputLineHeight = typeRamp.body.lineHeight * scale
  const inputMaxHeight = inputLineHeight * 4 + space[2] * 2

  return (
    <View style={[styles.container, { backgroundColor: colors.background, borderTopColor: colors.line }]}>
      {(imageUri || audio) ? (
        <View style={[styles.tray, { backgroundColor: colors.surface, borderColor: colors.line }]}>
          <View style={styles.trayHeader}>
            <Icon name="paperclip" size={14} color={colors.teal} />
            <AppText variant="small" tone="soft" weight="600">Attachments</AppText>
          </View>
          {imageUri ? (
            <View style={styles.trayItem}>
              <Image source={{ uri: imageUri }} style={styles.thumbnail} />
              <View style={styles.flex}>
                <AppText weight="600">Photo</AppText>
                <AppText variant="small" tone="soft">Attached</AppText>
              </View>
              <Touchable onPress={onRemoveImage} accessibilityLabel="Remove photo" style={styles.remove}>
                <Icon name="close" size={18} color={colors.inkSoft} />
              </Touchable>
            </View>
          ) : null}
          {audio ? <View style={styles.audioTray}><AudioChip uri={audio.uri} durationMs={audio.durationMs} onRemove={onRemoveAudio} compact /></View> : null}
        </View>
      ) : null}

      <View style={styles.row}>
        {!recording && onPickImage ? (
          <Touchable onPress={onPickImage} disabled={disabled || generating} accessibilityLabel="Attach a photo" style={styles.tool}>
            <Icon name="paperclip" size={20} color={disabled || generating ? colors.inkSoft : colors.ink} />
          </Touchable>
        ) : null}
        <View style={[styles.pill, { backgroundColor: colors.surface, borderColor: recording ? colors.danger : colors.line }]}>
          {recording ? (
            <View style={styles.recordingRow}>
              <View style={[styles.recordDot, { backgroundColor: colors.danger }]} />
              <AppText weight="600" tone="danger">{`${Math.floor(recordingMs / 60_000)}:${String(Math.floor(recordingMs / 1000) % 60).padStart(2, '0')}`}</AppText>
              <View style={styles.flex} />
              <Touchable onPress={onCancelRecording} accessibilityLabel="Discard recording" style={[styles.tool, { backgroundColor: colors.danger }]}>
                <Icon name="trash" size={18} color={brand.onPrimary} />
              </Touchable>
            </View>
          ) : (
            <TextInput
              {...(Platform.OS === 'web' ? ({ rows: 1 } as object) : {})}
              value={value}
              onChangeText={onChange}
              placeholder={disabled ? 'Set up an AI provider in Chat settings' : imageUri || audio ? 'Add a message…' : 'Message GabAI…'}
              placeholderTextColor={colors.inkSoft}
              accessibilityLabel="Message GabAI"
              maxLength={500}
              multiline
              editable={!disabled && !generating}
              textAlignVertical="top"
              onKeyPress={Platform.OS === 'web' ? (event) => {
                const native = event.nativeEvent as unknown as { key: string; shiftKey?: boolean; preventDefault?: () => void }
                if (native.key === 'Enter' && !native.shiftKey) {
                  native.preventDefault?.()
                  if (canSend) onSend()
                }
              } : undefined}
              style={[styles.input, { color: colors.ink, fontSize: typeRamp.body.fontSize * scale, lineHeight: inputLineHeight, maxHeight: inputMaxHeight }, Platform.OS === 'web' && ({ outlineStyle: 'none' } as object)]}
            />
          )}
        </View>
        {!recording && onStartRecording ? (
          <Touchable onPress={onStartRecording} disabled={disabled || generating} accessibilityLabel="Record a voice message" style={styles.tool}>
            <Icon name="mic" size={20} color={disabled || generating ? colors.inkSoft : colors.ink} />
          </Touchable>
        ) : null}
        {recording ? (
          <Touchable onPress={onStopRecording} accessibilityLabel="Use this recording" hitSlop={4} style={[styles.action, { backgroundColor: colors.teal }]}>
            <Icon name="check" size={20} color={brand.onPrimary} />
          </Touchable>
        ) : generating ? (
          <Touchable onPress={onStop} accessibilityLabel="Stop generating" hitSlop={4} style={[styles.action, { backgroundColor: colors.danger }]}>
            <Icon name="stop" size={18} color={brand.onPrimary} />
          </Touchable>
        ) : (
          <Touchable onPress={onSend} disabled={!canSend} accessibilityLabel="Send message" hitSlop={4} style={[styles.action, { backgroundColor: canSend ? brand.primary : colors.line }]}>
            <Icon name="arrowUp" size={20} color={canSend ? brand.onPrimary : colors.inkSoft} />
          </Touchable>
        )}
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  container: { borderTopWidth: StyleSheet.hairlineWidth, paddingTop: space[2], paddingBottom: space[2], paddingHorizontal: space[3], gap: space[2] },
  flex: { flex: 1 },
  tray: { borderWidth: 1, borderRadius: radius.group, padding: space[3], gap: space[2] },
  trayHeader: { flexDirection: 'row', alignItems: 'center', gap: space[1] },
  trayItem: { flexDirection: 'row', alignItems: 'center', gap: space[2] },
  thumbnail: { width: 56, height: 56, borderRadius: radius.md },
  audioTray: { alignSelf: 'flex-start' },
  row: { flexDirection: 'row', alignItems: 'flex-end', gap: space[1] },
  tool: { width: touchTarget, height: touchTarget, alignItems: 'center', justifyContent: 'center', borderRadius: radius.pill },
  pill: { flex: 1, minHeight: 40, borderWidth: 1, borderRadius: radius.pill, paddingHorizontal: space[3], justifyContent: 'center' },
  input: { paddingVertical: space[2], paddingHorizontal: 0 },
  action: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center', borderRadius: radius.pill, marginBottom: 2 },
  remove: { width: touchTarget - 8, height: touchTarget - 8, alignItems: 'center', justifyContent: 'center' },
  recordingRow: { minHeight: 46, flexDirection: 'row', alignItems: 'center', gap: space[2] },
  recordDot: { width: 9, height: 9, borderRadius: 5 },
})
