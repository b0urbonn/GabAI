import type { ReactNode } from 'react'
import { ScrollView, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

import { space } from '@/theme/tokens'
import { useTheme } from '@/theme/useTheme'

type ScreenProps = {
  children: ReactNode
  /** Add top safe-area padding. Off for tab screens, which sit under `AppHeader`. */
  topInset?: boolean
  /** Extra bottom padding, e.g. to clear the floating emergency button. */
  bottomSpace?: number
  scroll?: boolean
  contentStyle?: StyleProp<ViewStyle>
  /** Pass a `<RefreshControl>` for pull-to-refresh. Only used when `scroll` is true. */
  refreshControl?: React.ReactElement
}

export function Screen({ children, topInset = false, bottomSpace = space[8], scroll = true, contentStyle, refreshControl }: ScreenProps) {
  const { colors } = useTheme()
  const insets = useSafeAreaInsets()
  const padding = [styles.content, { paddingTop: space[6] + (topInset ? insets.top : 0), paddingBottom: bottomSpace + (topInset ? insets.bottom : 0) }, contentStyle]
  if (!scroll) return <View style={[styles.fill, { backgroundColor: colors.background }, padding]}>{children}</View>
  return (
    <ScrollView style={[styles.fill, { backgroundColor: colors.background }]} contentContainerStyle={padding} keyboardShouldPersistTaps="handled" keyboardDismissMode="on-drag" refreshControl={refreshControl}>
      {children}
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  content: { paddingHorizontal: space[5] },
})
