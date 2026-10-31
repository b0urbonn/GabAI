import { StyleSheet, View } from 'react-native'

import { AppText } from '@/components/ui/AppText'
import { Icon } from '@/components/ui/Icon'
import { Touchable } from '@/components/ui/Touchable'
import { space } from '@/theme/tokens'
import { useTheme } from '@/theme/useTheme'
import { audioRuntime, AUDIO_BUILD_MESSAGE } from '@/services/audioRuntime'

const duration = (ms: number) => `${Math.floor(ms / 60_000)}:${String(Math.floor(ms / 1000) % 60).padStart(2, '0')}`

type AudioChipProps = { uri: string; durationMs: number; onRemove?: () => void; compact?: boolean }

export function AudioChip(props: AudioChipProps) {
  if (!audioRuntime) return <AppText variant="small" tone="soft">{AUDIO_BUILD_MESSAGE}</AppText>
  return <AvailableAudioChip {...props} />
}

function AvailableAudioChip({ uri, durationMs, onRemove, compact = false }: AudioChipProps) {
  const { useAudioPlayer, useAudioPlayerStatus } = audioRuntime!
  const { colors } = useTheme()
  const player = useAudioPlayer(uri)
  const status = useAudioPlayerStatus(player)

  const toggle = () => {
    if (status.playing) player.pause()
    else {
      if (status.didJustFinish) void player.seekTo(0)
      player.play()
    }
  }

  return (
    <View style={[styles.row, compact && styles.compact, { backgroundColor: colors.tealSoft }]}>
      <Touchable onPress={toggle} accessibilityLabel={status.playing ? 'Pause voice message' : 'Play voice message'} style={styles.play}>
        <Icon name={status.playing ? 'stop' : 'mic'} size={18} color={colors.teal} />
      </Touchable>
      <View style={styles.wave} accessibilityElementsHidden>
        {Array.from({ length: 20 }, (_, index) => (
          <View key={index} style={[styles.bar, { height: 5 + ((index * 7) % 13), backgroundColor: colors.teal }]} />
        ))}
      </View>
      <AppText variant="small" tone="teal" weight="600">{durationMs > 0 ? duration(durationMs) : status.currentTime ? duration(status.currentTime * 1000) : 'Voice'}</AppText>
      {onRemove ? (
        <Touchable onPress={onRemove} accessibilityLabel="Remove voice message" style={styles.remove}>
          <Icon name="close" size={17} color={colors.inkSoft} />
        </Touchable>
      ) : null}
    </View>
  )
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: space[2], borderRadius: 12, paddingHorizontal: space[2], paddingVertical: space[1], minWidth: 180 },
  compact: { minWidth: 160, paddingHorizontal: space[1] },
  play: { width: 34, height: 34, alignItems: 'center', justifyContent: 'center' },
  wave: { flex: 1, height: 24, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 2, overflow: 'hidden' },
  bar: { width: 2, borderRadius: 2, opacity: 0.65 },
  remove: { width: 32, height: 34, alignItems: 'center', justifyContent: 'center' },
})
