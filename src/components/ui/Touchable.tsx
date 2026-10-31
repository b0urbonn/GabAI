import { useState } from 'react'
import { Animated, Easing, Pressable, type GestureResponderEvent, type PressableProps, type StyleProp, type ViewStyle } from 'react-native'

import { useReduceMotion } from '@/hooks/useReduceMotion'

const AnimatedPressable = Animated.createAnimatedComponent(Pressable)

type TouchableProps = Omit<PressableProps, 'style'> & { style?: StyleProp<ViewStyle>; pressedScale?: number }

/** Springy opacity + scale press feedback; prominent actions can opt into a deeper press scale. */
export function Touchable({ style, pressedScale = 1, onPressIn, onPressOut, accessibilityRole = 'button', ...rest }: TouchableProps) {
  const reduceMotion = useReduceMotion()
  const [press] = useState(() => new Animated.Value(0))

  const animate = (toValue: 0 | 1) => {
    if (toValue) {
      Animated.timing(press, { toValue, duration: 140, easing: Easing.out(Easing.quad), useNativeDriver: true }).start()
    } else {
      Animated.spring(press, { toValue, damping: 15, stiffness: 200, mass: 0.7, useNativeDriver: true }).start()
    }
  }

  const handlePressIn = (event: GestureResponderEvent) => {
    animate(1)
    onPressIn?.(event)
  }
  const handlePressOut = (event: GestureResponderEvent) => {
    animate(0)
    onPressOut?.(event)
  }

  return (
    <AnimatedPressable
      accessibilityRole={accessibilityRole}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      style={[
        style,
        {
          opacity: press.interpolate({ inputRange: [0, 1], outputRange: [1, 0.7] }),
          transform: [{ scale: reduceMotion ? 1 : press.interpolate({ inputRange: [0, 1], outputRange: [1, pressedScale] }) }],
        },
      ]}
      {...rest}
    />
  )
}
