import * as Haptics from 'expo-haptics'
import { useEffect, useState } from 'react'
import { Animated, Easing, Pressable, StyleSheet, View } from 'react-native'

import { getAvatarPalette } from '@/components/avatarPalettes'
import { MicahAvatar, randomAvatarSeed } from '@/components/MicahAvatar'
import { Icon } from '@/components/ui/Icon'
import { useReduceMotion } from '@/hooks/useReduceMotion'
import type { AvatarTone } from '@/db/settings'
import { useSettings } from '@/providers/SettingsProvider'
import type { ColorScheme } from '@/theme/tokens'
import { useTheme } from '@/theme/useTheme'

export type AvatarVisualSnapshot = {
  key: string
  micahSeed: string
  tone: AvatarTone
}

function AvatarFrame({
  snapshot,
  size,
  scheme,
}: {
  snapshot: AvatarVisualSnapshot
  size: number
  scheme: ColorScheme
}) {
  const palette = getAvatarPalette(snapshot.tone, scheme)

  return (
    <View
      style={[
        styles.circle,
        {
          width: size,
          height: size,
          borderRadius: size / 2,
          backgroundColor: palette.bg,
          borderColor: palette.ring,
        },
      ]}
    >
      <MicahAvatar seed={snapshot.micahSeed} size={size} />
    </View>
  )
}

/**
 * Smoothly crossfades + gently springs between avatar snapshots using a 2-slot native-driver
 * ping-pong buffer (zero 1-frame flash, zero synchronous setState in effects).
 */
export function AnimatedAvatarSurface({
  snapshot,
  size,
  scheme,
}: {
  snapshot: AvatarVisualSnapshot
  size: number
  scheme: ColorScheme
}) {
  const reduceMotion = useReduceMotion()
  const [opacities] = useState(() => [new Animated.Value(1), new Animated.Value(0)] as const)
  const [scales] = useState(() => [new Animated.Value(1), new Animated.Value(0.92)] as const)

  const [buffer, setBuffer] = useState<{
    activeSlot: 0 | 1
    slots: [AvatarVisualSnapshot, AvatarVisualSnapshot | null]
    transitionId: number
  }>({
    activeSlot: 0,
    slots: [snapshot, null],
    transitionId: 0,
  })

  const activeSnapshot = buffer.slots[buffer.activeSlot] ?? snapshot
  if (snapshot.key !== activeSnapshot.key) {
    const nextSlot: 0 | 1 = buffer.activeSlot === 0 ? 1 : 0
    const nextSlots: [AvatarVisualSnapshot, AvatarVisualSnapshot | null] =
      nextSlot === 0 ? [snapshot, buffer.slots[1]] : [buffer.slots[0], snapshot]
    setBuffer({
      activeSlot: nextSlot,
      slots: nextSlots,
      transitionId: buffer.transitionId + 1,
    })
  }

  useEffect(() => {
    if (buffer.transitionId === 0) return

    const incoming = buffer.activeSlot
    const outgoing: 0 | 1 = incoming === 0 ? 1 : 0

    opacities[0].stopAnimation()
    opacities[1].stopAnimation()
    scales[0].stopAnimation()
    scales[1].stopAnimation()

    if (reduceMotion) {
      opacities[incoming].setValue(1)
      scales[incoming].setValue(1)
      opacities[outgoing].setValue(0)
      scales[outgoing].setValue(1)
      return
    }

    opacities[incoming].setValue(0)
    scales[incoming].setValue(0.92)

    const anim = Animated.parallel([
      Animated.timing(opacities[incoming], {
        toValue: 1,
        duration: 380,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.timing(scales[incoming], {
        toValue: 1,
        duration: 380,
        easing: Easing.out(Easing.back(1.2)),
        useNativeDriver: true,
      }),
      Animated.timing(opacities[outgoing], {
        toValue: 0,
        duration: 340,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
    ])

    anim.start()
    return () => anim.stop()
  }, [buffer.activeSlot, buffer.transitionId, opacities, reduceMotion, scales])

  return (
    <View style={{ width: size, height: size, position: 'relative' }}>
      {([0, 1] as const).map((slotIndex) => {
        const slotSnapshot = buffer.slots[slotIndex]
        if (!slotSnapshot) return null
        const isCurrent = buffer.activeSlot === slotIndex
        return (
          <Animated.View
            key={slotIndex}
            pointerEvents={isCurrent ? 'auto' : 'none'}
            style={[
              StyleSheet.absoluteFill,
              {
                zIndex: isCurrent ? 2 : 1,
                opacity: opacities[slotIndex],
                transform: [{ scale: scales[slotIndex] }],
              },
            ]}
          >
            <AvatarFrame snapshot={slotSnapshot} size={size} scheme={scheme} />
          </Animated.View>
        )
      })}
    </View>
  )
}

/**
 * Interactive random avatar preview with tap-to-shuffle.
 * Displays the user's micah avatar; tapping rolls a new seed saved to settings.
 */
export function RandomAvatarPreview({ size = 104 }: { size?: number }) {
  const { colors, scheme } = useTheme()
  const { settings, updateSettings } = useSettings()
  const seed = settings.avatarSeed || 'gabai'

  const shuffle = () => {
    Haptics.selectionAsync().catch(() => {})
    void updateSettings({ avatarSeed: randomAvatarSeed() })
  }

  const buttonSize = Math.max(32, Math.round(size * 0.32))

  return (
    <View style={{ width: size, height: size }}>
      <Pressable
        onPress={shuffle}
        accessibilityRole="imagebutton"
        accessibilityLabel="Random profile avatar"
        style={({ pressed }) => [pressed && { transform: [{ scale: 0.96 }] }]}
      >
        <AnimatedAvatarSurface
          snapshot={{
            key: `micah:${seed}`,
            micahSeed: seed,
            tone: settings.avatarTone,
          }}
          size={size}
          scheme={scheme}
        />
      </Pressable>

      <Pressable
        onPress={shuffle}
        hitSlop={8}
        accessibilityRole="button"
        accessibilityLabel="Shuffle avatar"
        style={({ pressed }) => [
          styles.shuffleButton,
          {
            width: buttonSize,
            height: buttonSize,
            borderRadius: buttonSize / 2,
            backgroundColor: colors.surface,
            borderColor: colors.background,
          },
          pressed && { transform: [{ scale: 0.9 }], opacity: 0.85 },
        ]}
      >
        <Icon name="shuffle" size={Math.round(buttonSize * 0.46)} color={colors.teal} />
      </Pressable>
    </View>
  )
}

const styles = StyleSheet.create({
  circle: {
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    overflow: 'hidden',
  },
  shuffleButton: {
    position: 'absolute',
    right: -2,
    bottom: 2,
    borderWidth: 2.5,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowRadius: 3,
    shadowOffset: { width: 0, height: 1 },
    elevation: 2,
  },
})
