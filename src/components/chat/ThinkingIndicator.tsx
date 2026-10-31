import { useEffect, useState } from 'react'
import { Animated, Easing, StyleSheet, View } from 'react-native'

import { AppText } from '@/components/ui/AppText'
import { space } from '@/theme/tokens'
import { useTheme } from '@/theme/useTheme'

const PHRASES = ['GabAI is thinking…', 'Checking the emergency guides…', 'Putting it together…']
const DOT_COUNT = 3

export function ThinkingIndicator() {
  const { colors } = useTheme()
  const [dots] = useState(() => Array.from({ length: DOT_COUNT }, () => new Animated.Value(0)))
  const [phraseOpacity] = useState(() => new Animated.Value(1))
  const [phraseIndex, setPhraseIndex] = useState(0)

  useEffect(() => {
    const loops = dots.map((dot, index) => {
      const loop = Animated.loop(
        Animated.sequence([
          Animated.delay(index * 140),
          Animated.timing(dot, { toValue: 1, duration: 320, easing: Easing.out(Easing.quad), useNativeDriver: true }),
          Animated.timing(dot, { toValue: 0, duration: 320, easing: Easing.in(Easing.quad), useNativeDriver: true }),
          Animated.delay((DOT_COUNT - 1 - index) * 140 + 240),
        ]),
      )
      loop.start()
      return loop
    })
    return () => loops.forEach((loop) => loop.stop())
  }, [dots])

  useEffect(() => {
    const timer = setInterval(() => setPhraseIndex((index) => (index + 1) % PHRASES.length), 2800)
    return () => clearInterval(timer)
  }, [])

  useEffect(() => {
    phraseOpacity.setValue(0)
    Animated.timing(phraseOpacity, { toValue: 1, duration: 300, useNativeDriver: true }).start()
  }, [phraseIndex, phraseOpacity])

  return (
    <View style={styles.row} accessibilityRole="progressbar" accessibilityLabel="GabAI is thinking">
      <View style={styles.dots} accessibilityElementsHidden>
        {dots.map((dot, index) => (
          <Animated.View
            key={index}
            style={[
              styles.dot,
              {
                backgroundColor: colors.teal,
                opacity: dot.interpolate({ inputRange: [0, 1], outputRange: [0.3, 1] }),
                transform: [{ translateY: dot.interpolate({ inputRange: [0, 1], outputRange: [0, -4] }) }],
              },
            ]}
          />
        ))}
      </View>
      <Animated.View style={{ opacity: phraseOpacity }}>
        <AppText variant="small" tone="soft">{PHRASES[phraseIndex]}</AppText>
      </Animated.View>
    </View>
  )
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: space[2], marginTop: space[1] },
  dots: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingVertical: 4 },
  dot: { width: 7, height: 7, borderRadius: 4 },
})
