import { useSQLiteContext } from 'expo-sqlite'
import { useEffect, useState } from 'react'
import { Modal, Pressable, StyleSheet, View } from 'react-native'
import Svg, { Circle } from 'react-native-svg'

import { AppText } from '@/components/ui/AppText'
import { Button } from '@/components/ui/Button'
import { Icon } from '@/components/ui/Icon'
import { Touchable } from '@/components/ui/Touchable'
import { TOKEN_LIMITS } from '@/data/ai'
import type { AiMode } from '@/db/settings'
import { getTokenUsage, resetTokenUsage, type SourceUsage, type UsageSource } from '@/db/tokenUsage'
import { useSettings } from '@/providers/SettingsProvider'
import { radius, space, touchTarget } from '@/theme/tokens'
import { useTheme } from '@/theme/useTheme'
import { confirmAction } from '@/utils/dialogs'

const RING_SIZE = 112
const RING_STROKE = 11
const RING_RADIUS = (RING_SIZE - RING_STROKE) / 2
const RING_LENGTH = 2 * Math.PI * RING_RADIUS

const SOURCES: Record<AiMode, { source: UsageSource; label: string; detail: string }> = {
  local: { source: 'local', label: 'Local AI', detail: 'Gemma 4 E2B' },
  cloud: { source: 'gemini', label: 'Cloud AI', detail: 'Google Gemini' },
}

const EMPTY: Record<UsageSource, SourceUsage> = {
  gemini: { source: 'gemini', requests: 0, promptTokens: 0, completionTokens: 0 },
  local: { source: 'local', requests: 0, promptTokens: 0, completionTokens: 0 },
  custom: { source: 'custom', requests: 0, promptTokens: 0, completionTokens: 0 },
}

const compact = (value: number) =>
  value >= 1_000_000 ? `${+(value / 1_000_000).toFixed(1)}M` : value >= 1_000 ? `${+(value / 1_000).toFixed(1)}k` : String(value)

function UsageRing({ percent, color, track }: { percent: number; color: string; track: string }) {
  const center = RING_SIZE / 2
  return (
    <View style={styles.ring}>
      <Svg width={RING_SIZE} height={RING_SIZE}>
        <Circle cx={center} cy={center} r={RING_RADIUS} stroke={track} strokeWidth={RING_STROKE} fill="none" />
        {percent > 0 && (
          <Circle
            cx={center}
            cy={center}
            r={RING_RADIUS}
            stroke={color}
            strokeWidth={RING_STROKE}
            fill="none"
            strokeLinecap="round"
            strokeDasharray={`${RING_LENGTH} ${RING_LENGTH}`}
            strokeDashoffset={RING_LENGTH * (1 - percent)}
            transform={`rotate(-90 ${center} ${center})`}
          />
        )}
      </Svg>
      <View style={styles.ringLabel}>
        <AppText variant="sectionTitle" style={{ color }}>{`${Math.round(percent * 100)}%`}</AppText>
      </View>
    </View>
  )
}

export function TokenUsageModal({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const db = useSQLiteContext()
  const { settings } = useSettings()
  const { colors } = useTheme()
  const [usage, setUsage] = useState(EMPTY)
  const { source, label, detail } = SOURCES[settings.aiMode]
  const used = usage[source].promptTokens + usage[source].completionTokens
  const limit = TOKEN_LIMITS[source]
  const full = used >= limit
  const color = full ? colors.danger : source === 'local' ? colors.teal : colors.weatherAccent

  useEffect(() => {
    if (!visible) return
    getTokenUsage(db)
      .then((rows) => setUsage(rows.reduce((next, row) => ({ ...next, [row.source]: row }), EMPTY)))
      .catch(() => setUsage(EMPTY))
  }, [db, visible])

  const reset = async () => {
    const confirmed = await confirmAction({
      title: `Reset ${label} usage?`,
      message: 'The counter goes back to zero. Your chat history is not affected.',
      confirmLabel: 'Reset',
      destructive: true,
    })
    if (!confirmed) return
    await resetTokenUsage(db, source)
    setUsage((current) => ({ ...current, [source]: EMPTY[source] }))
  }

  if (!visible) return null

  return (
    <Modal visible transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.center}>
        <Pressable style={[StyleSheet.absoluteFill, { backgroundColor: colors.overlay }]} onPress={onClose} accessibilityLabel="Close token usage" />
        <View style={[styles.card, { backgroundColor: colors.surface }]} accessibilityViewIsModal>
          <View style={styles.header}>
            <AppText variant="sheetTitle" accessibilityRole="header" style={styles.flex}>Token usage</AppText>
            <Touchable onPress={onClose} accessibilityLabel="Close" style={styles.close}>
              <Icon name="close" size={20} color={colors.inkSoft} />
            </Touchable>
          </View>

          <View style={styles.column}>
            <UsageRing percent={Math.min(1, used / limit)} color={color} track={colors.line} />
            <AppText weight="600" align="center" style={styles.label}>{label}</AppText>
            <AppText variant="small" tone="soft" align="center">{detail}</AppText>
            <AppText variant="caption" tone={full ? 'danger' : 'default'} align="center" style={styles.count}>
              {`${compact(used)} / ${compact(limit)}`}
            </AppText>
            {full && (
              <View style={styles.resetRow}>
                <Button label="Reset" variant="destructive" onPress={reset} />
              </View>
            )}
          </View>

          <AppText variant="small" tone="soft" align="center" style={styles.note}>
            Tokens are small pieces of text, about 4 characters each. Answers from the built-in guides use no tokens.
          </AppText>
        </View>
      </View>
    </Modal>
  )
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: space[5] },
  card: { width: '100%', maxWidth: 320, borderRadius: radius.lg, padding: space[5] },
  header: { flexDirection: 'row', alignItems: 'center', marginBottom: space[4] },
  close: { width: touchTarget, height: touchTarget, alignItems: 'center', justifyContent: 'center', marginRight: -space[3] },
  column: { alignItems: 'center' },
  ring: { width: RING_SIZE, height: RING_SIZE, marginBottom: space[3] },
  ringLabel: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0, alignItems: 'center', justifyContent: 'center' },
  label: { marginBottom: 2 },
  count: { marginTop: space[2] },
  resetRow: { flexDirection: 'row', alignSelf: 'stretch', marginTop: space[3] },
  note: { marginTop: space[5] },
})
