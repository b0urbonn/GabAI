import { useEffect, useState } from 'react'
import { AccessibilityInfo } from 'react-native'

/** Tracks the OS Reduce Motion accessibility setting so animations can degrade gracefully. */
export function useReduceMotion() {
  const [reduceMotion, setReduceMotion] = useState(false)

  useEffect(() => {
    let mounted = true
    AccessibilityInfo.isReduceMotionEnabled()
      .then((enabled) => {
        if (mounted) setReduceMotion(Boolean(enabled))
      })
      .catch(() => {})
    const subscription = AccessibilityInfo.addEventListener('reduceMotionChanged', setReduceMotion)
    return () => {
      mounted = false
      subscription.remove()
    }
  }, [])

  return reduceMotion
}
