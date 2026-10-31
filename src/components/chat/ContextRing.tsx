import { useState, type ReactNode } from 'react'
import { Modal, Pressable, StyleSheet, View } from 'react-native'
import Svg, { Circle } from 'react-native-svg'

import { AppText } from '@/components/ui/AppText'
import { Button } from '@/components/ui/Button'
import { Touchable } from '@/components/ui/Touchable'
import { radius, space } from '@/theme/tokens'
import { useTheme } from '@/theme/useTheme'

const compact = (value: number) => value >= 1000 ? `${(value / 1000).toFixed(1)}k` : String(value)

function Ring({ size, stroke, fraction, color, track, children }: {
  size: number
  stroke: number
  fraction: number
  color: string
  track: string
  children?: ReactNode
}) {
  const ringRadius = (size - stroke) / 2
  const circumference = 2 * Math.PI * ringRadius

  return (
    <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
      <Svg width={size} height={size} style={StyleSheet.absoluteFill}>
        <Circle cx={size / 2} cy={size / 2} r={ringRadius} stroke={track} strokeWidth={stroke} fill="none" />
        {fraction >= 0.005 ? (
          <Circle
            cx={size / 2}
            cy={size / 2}
            r={ringRadius}
            stroke={color}
            strokeWidth={stroke}
            fill="none"
            strokeLinecap="round"
            strokeDasharray={`${circumference} ${circumference}`}
            strokeDashoffset={circumference * (1 - fraction)}
            transform={`rotate(-90 ${size / 2} ${size / 2})`}
          />
        ) : null}
      </Svg>
      {children}
    </View>
  )
}

/** Circular context-window meter, with a tap-through explanation. */
export function ContextRing({ usedTokens, maxTokens, estimated = true }: {
  usedTokens: number
  maxTokens?: number
  estimated?: boolean
}) {
  const { colors } = useTheme()
  const [open, setOpen] = useState(false)
  const fraction = maxTokens ? Math.min(usedTokens / maxTokens, 1) : 0
  const warning = fraction >= 0.5
  const danger = fraction >= 0.8
  const stroke = danger ? colors.danger : warning ? colors.weatherAccent : colors.teal
  const percent = maxTokens ? `${Math.round(fraction * 100)}%` : '?'

  return (
    <>
      <Touchable
        onPress={() => setOpen(true)}
        accessibilityLabel={`AI memory ${percent} used`}
        style={[styles.button, { backgroundColor: colors.tealSoft }]}
      >
        <Ring size={34} stroke={4} fraction={fraction} color={stroke} track={colors.line}>
          <AppText variant="eyebrow" style={styles.percent}>{percent}</AppText>
        </Ring>
      </Touchable>

      <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)}>
        <View style={styles.center}>
          <Pressable style={[StyleSheet.absoluteFill, { backgroundColor: colors.overlay }]} onPress={() => setOpen(false)} />
          <View style={[styles.card, { backgroundColor: colors.surface }]} accessibilityViewIsModal>
            <AppText variant="sheetTitle" align="center">AI memory (context window)</AppText>
            <Ring size={136} stroke={12} fraction={fraction} color={stroke} track={colors.line}>
              <AppText variant="pageTitle" align="center" tone={danger ? 'danger' : warning ? 'teal' : 'default'} style={styles.big}>{percent}</AppText>
              <AppText variant="small" tone="soft">used</AppText>
            </Ring>
            <AppText align="center">
              {estimated ? 'About ' : ''}{compact(usedTokens)}{maxTokens ? ` of ${compact(maxTokens)}` : ''} tokens used
            </AppText>
            {maxTokens ? (
              <AppText variant="small" tone="soft" align="center">Room left: {compact(Math.max(maxTokens - usedTokens, 0))} tokens</AppText>
            ) : (
              <AppText variant="small" tone="soft" align="center">The context size appears after the first AI reply.</AppText>
            )}
            {danger ? <AppText variant="small" tone="danger" align="center">Memory is nearly full. Older messages may be dropped.</AppText> : null}
            {!danger && warning ? <AppText variant="small" tone="soft" align="center">Memory is filling up.</AppText> : null}
            <AppText variant="small" tone="soft" align="center" style={styles.note}>
              {estimated ? 'Estimated at about four characters per token until the AI reports its usage.' : 'Reported by the local model after its last reply.'}
            </AppText>
            <Button label="Done" variant="secondary" onPress={() => setOpen(false)} style={styles.done} />
          </View>
        </View>
      </Modal>
    </>
  )
}

const styles = StyleSheet.create({
  button: { width: 44, height: 44, borderRadius: radius.md, alignItems: 'center', justifyContent: 'center' },
  percent: { position: 'absolute', fontSize: 9 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: space[5] },
  card: { width: '100%', maxWidth: 340, borderRadius: radius.lg, padding: space[5], gap: space[2], alignItems: 'center' },
  big: { marginTop: space[1] },
  note: { marginTop: space[1] },
  done: { alignSelf: 'stretch', marginTop: space[2] },
})
