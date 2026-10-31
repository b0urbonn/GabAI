import { router, usePathname } from 'expo-router'
import { useEffect, useMemo, useState } from 'react'
import { Animated, PanResponder, StyleSheet, useWindowDimensions } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

import { Icon } from '@/components/ui/Icon'
import { Touchable } from '@/components/ui/Touchable'
import { useKeyboardVisible } from '@/hooks/useKeyboardVisible'
import { brand, space } from '@/theme/tokens'

import { TAB_BAR_HEIGHT } from './TabBar'

export const FAB_SIZE = 56
/** Bottom padding tab screens should reserve so content is not hidden behind the FAB. */
export const FAB_CLEARANCE = FAB_SIZE + space[6] * 2
const CHAT_COMPOSER_CLEARANCE = 72

const clamp = (value: number, min: number, max: number) => Math.min(Math.max(value, min), max)

/** Drag to place the emergency shortcut; tap to open the hotline directory. */
export function EmergencyFab() {
  const pathname = usePathname()
  const insets = useSafeAreaInsets()
  const keyboardVisible = useKeyboardVisible()
  const { width, height } = useWindowDimensions()
  const [placement, setPlacement] = useState({ x: 1, y: 1 })
  const bounds = useMemo(() => ({
    left: insets.left + space[2],
    right: Math.max(insets.left + space[2], width - insets.right - FAB_SIZE - space[2]),
    top: insets.top + space[2],
    bottom: Math.max(insets.top + space[2], height - insets.bottom - FAB_SIZE - space[4] - (pathname === '/chat' ? CHAT_COMPOSER_CLEARANCE : TAB_BAR_HEIGHT)),
  }), [height, width, insets, pathname])
  const point = useMemo(() => ({
    x: bounds.left + placement.x * (bounds.right - bounds.left),
    y: bounds.top + placement.y * (bounds.bottom - bounds.top),
  }), [bounds, placement])
  const [position] = useState(() => new Animated.ValueXY(point))
  const [lift] = useState(() => new Animated.Value(1))

  useEffect(() => { position.setValue(point) }, [point, position])

  const panResponder = useMemo(() => {
    const springLift = (toValue: number) => Animated.spring(lift, { toValue, useNativeDriver: true, speed: 30, bounciness: 6 }).start()
    const move = (dx: number, dy: number) => ({
      x: clamp(point.x + dx, bounds.left, bounds.right),
      y: clamp(point.y + dy, bounds.top, bounds.bottom),
    })
    const finish = (dx: number, dy: number) => {
      springLift(1)
      const next = move(dx, dy)
      position.setValue(next)
      setPlacement({
        x: (next.x - bounds.left) / (bounds.right - bounds.left || 1),
        y: (next.y - bounds.top) / (bounds.bottom - bounds.top || 1),
      })
    }
    return PanResponder.create({
      onMoveShouldSetPanResponderCapture: (_, gesture) => Math.hypot(gesture.dx, gesture.dy) > 6,
      onPanResponderGrant: () => springLift(1.08),
      onPanResponderMove: (_, gesture) => position.setValue(move(gesture.dx, gesture.dy)),
      onPanResponderRelease: (_, gesture) => finish(gesture.dx, gesture.dy),
      onPanResponderTerminate: (_, gesture) => finish(gesture.dx, gesture.dy),
    })
  }, [bounds, lift, point, position])

  const isHome = pathname === '/' || pathname === '/index' || pathname === '' || pathname === '/(tabs)' || pathname === '/(tabs)/index'
  if (isHome || pathname === '/capture' || keyboardVisible) return null
  return (
    <Animated.View {...panResponder.panHandlers} style={[styles.position, { transform: [...position.getTranslateTransform(), { scale: lift }] }]}>
      <Touchable
        onPress={() => router.push('/emergency')}
        accessibilityLabel="Emergency contacts"
        accessibilityHint="Tap to open emergency hotlines. Drag to move this button."
        pressedScale={0.94}
        style={styles.fab}
      >
        <Icon name="phone" size={24} color={brand.onPrimary} />
      </Touchable>
    </Animated.View>
  )
}

const styles = StyleSheet.create({
  position: { position: 'absolute', left: 0, top: 0, zIndex: 10 },
  fab: {
    width: FAB_SIZE,
    height: FAB_SIZE,
    borderRadius: FAB_SIZE / 2,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: brand.emergency,
    shadowColor: '#000',
    shadowOpacity: 0.12,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 3 },
    elevation: 4,
  },
})
