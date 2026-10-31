import { useEffect, useState, type ReactNode } from 'react'
import { Animated, Easing, type StyleProp, type ViewStyle } from 'react-native'

import { useReduceMotion } from '@/hooks/useReduceMotion'

type FadeInProps = {
  children: ReactNode
  /** Milliseconds before the entrance starts; use rising values to stagger sections. */
  delay?: number
  /** Initial downward offset in px the content rises from. */
  distance?: number
  duration?: number
  style?: StyleProp<ViewStyle>
}

/** Gentle fade-and-rise entrance on mount. Honors the OS Reduce Motion setting. */
export function FadeIn({ children, delay = 0, distance = 14, duration = 380, style }: FadeInProps) {
  const reduceMotion = useReduceMotion()
  const [progress] = useState(() => new Animated.Value(0))

  useEffect(() => {
    if (reduceMotion) {
      progress.setValue(1)
      return
    }
    const anim = Animated.timing(progress, {
      toValue: 1,
      delay,
      duration,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    })
    anim.start()
    return () => anim.stop()
  }, [delay, duration, progress, reduceMotion])

  return (
    <Animated.View
      style={[
        style,
        {
          opacity: progress,
          transform: [{ translateY: progress.interpolate({ inputRange: [0, 1], outputRange: [distance, 0] }) }],
        },
      ]}
    >
      {children}
    </Animated.View>
  )
}
