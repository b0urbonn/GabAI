import * as Haptics from 'expo-haptics'
import type { BottomTabBarProps } from 'expo-router/js-tabs'
import { useEffect, useState } from 'react'
import { Animated, Easing, StyleSheet, View } from 'react-native'

import { Icon, type IconName } from '@/components/ui/Icon'
import { Touchable } from '@/components/ui/Touchable'
import { useKeyboardVisible } from '@/hooks/useKeyboardVisible'
import { useReduceMotion } from '@/hooks/useReduceMotion'
import { brand, radius, space, touchTarget } from '@/theme/tokens'
import { useTheme } from '@/theme/useTheme'

export const TAB_BAR_HEIGHT = 90
const PILL_HEIGHT = 74

const tabs: Record<string, { label: string; icon: IconName; prominent?: boolean }> = {
  index: { label: 'Home', icon: 'home' },
  guides: { label: 'Guides', icon: 'book' },
  capture: { label: 'Capture', icon: 'camera', prominent: true },
  chat: { label: 'GabAI', icon: 'chat' },
  profile: { label: 'Profile', icon: 'profile' },
}

type TabItemProps = {
  label: string
  icon: IconName
  focused: boolean
  prominent?: boolean
  onPress: () => void
  onLongPress: () => void
}

/** One dock item: icon over an animated soft-teal indicator, or the raised center badge. */
function TabItem({ label, icon, focused, prominent, onPress, onLongPress }: TabItemProps) {
  const { colors } = useTheme()
  const reduceMotion = useReduceMotion()
  const [focus] = useState(() => new Animated.Value(focused ? 1 : 0))

  useEffect(() => {
    if (reduceMotion) {
      focus.setValue(focused ? 1 : 0)
      return
    }
    const anim = Animated.timing(focus, {
      toValue: focused ? 1 : 0,
      duration: 260,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    })
    anim.start()
    return () => anim.stop()
  }, [focus, focused, reduceMotion])

  const color = focused && !prominent ? brand.onPrimary : focused ? colors.teal : colors.inkSoft
  const pop = reduceMotion ? 1 : focus.interpolate({ inputRange: [0, 1], outputRange: [1, 1.1] })

  return (
    <Touchable
      onPress={onPress}
      onLongPress={onLongPress}
      accessibilityRole="tab"
      accessibilityState={{ selected: focused }}
      accessibilityLabel={label}
      pressedScale={prominent ? 0.94 : 0.96}
      style={styles.item}
    >
      {prominent ? (
        <Animated.View
          style={[
            styles.prominentBadge,
            {
              backgroundColor: colors.teal,
              borderColor: colors.background,
              transform: [{ scale: pop }],
            },
          ]}
        >
          <Icon name={icon} size={30} color={brand.onPrimary} />
        </Animated.View>
      ) : (
        <>
          <Animated.View
            style={[
              styles.indicator,
              {
                backgroundColor: colors.teal,
                opacity: focus,
                transform: [{ scale: reduceMotion ? 1 : focus.interpolate({ inputRange: [0, 1], outputRange: [0.6, 1] }) }],
              },
            ]}
          />
          <Animated.View style={[styles.iconSlot, { transform: [{ scale: pop }] }]}>
            <Icon name={icon} size={28} color={color} />
          </Animated.View>
        </>
      )}
    </Touchable>
  )
}

/** Floating oblong dock following Apple Human Interface Guidelines. */
export function TabBar({ state, descriptors, emitter, navigateToTab, insets }: BottomTabBarProps) {
  const { colors } = useTheme()
  const keyboardVisible = useKeyboardVisible()
  const focusedRoute = state.routes[state.index]
  if (focusedRoute.name === 'chat') return null
  if (keyboardVisible && descriptors[focusedRoute.key].options.tabBarHideOnKeyboard) return null
  return (
    <View
      accessibilityRole="tabbar"
      style={[
        styles.dock,
        {
          marginBottom: Math.max(insets.bottom, space[2]),
          backgroundColor: colors.surface,
          borderColor: colors.line,
        },
      ]}
    >
      {state.routes.map((route, index) => {
        const tab = tabs[route.name]
        if (!tab) return null
        const focused = state.index === index
        const onPress = () => {
          const event = emitter.emit({ type: 'tabPress', target: route.key, canPreventDefault: true })
          if (!focused && !event.defaultPrevented) {
            Haptics.selectionAsync().catch(() => {})
            navigateToTab(route.key)
          }
        }
        return (
          <TabItem
            key={route.key}
            label={tab.label}
            icon={tab.icon}
            focused={focused}
            prominent={tab.prominent}
            onPress={onPress}
            onLongPress={() => emitter.emit({ type: 'tabLongPress', target: route.key })}
          />
        )
      })}
    </View>
  )
}

const styles = StyleSheet.create({
  dock: {
    flexDirection: 'row',
    height: PILL_HEIGHT,
    marginTop: space[2],
    marginHorizontal: space[2],
    paddingHorizontal: space[1],
    borderRadius: PILL_HEIGHT / 2,
    borderWidth: StyleSheet.hairlineWidth,
    shadowColor: '#000',
    shadowOpacity: 0.14,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 8,
  },
  item: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 0,
    minHeight: touchTarget,
  },
  indicator: {
    ...StyleSheet.absoluteFill,
    marginHorizontal: 2,
    marginVertical: 9,
    borderRadius: radius.pill,
  },
  prominentBadge: {
    width: 68,
    height: 68,
    borderRadius: 34,
    marginTop: -34,
    borderWidth: 4,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.18,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 6,
  },
  iconSlot: {
    width: touchTarget,
    maxWidth: '100%',
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
})
