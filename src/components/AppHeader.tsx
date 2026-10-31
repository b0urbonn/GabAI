import { router } from 'expo-router'
import { useSQLiteContext } from 'expo-sqlite'
import { useEffect, useState } from 'react'
import { StyleSheet, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

import { readUpdateCache } from '@/db/publicUpdates'
import { useSettings } from '@/providers/SettingsProvider'
import { currentUpdates } from '@/services/publicUpdates'
import { space, touchTarget } from '@/theme/tokens'
import { useTheme } from '@/theme/useTheme'

import { AppText } from '@/components/ui/AppText'
import { Icon } from '@/components/ui/Icon'
import { Touchable } from '@/components/ui/Touchable'

export const APP_HEADER_HEIGHT = 48

export function AppHeader() {
  const { colors } = useTheme()
  const insets = useSafeAreaInsets()
  const { settings } = useSettings()
  const db = useSQLiteContext()
  const [hasUnread, setHasUnread] = useState(false)

  useEffect(() => {
    readUpdateCache(db)
      .then((cached) => {
        const items = currentUpdates(cached.flatMap((s) => s.items))
        const newest = items.length > 0 ? Math.max(...items.map((i) => i.publishedAt)) : 0
        setHasUnread(newest > settings.lastSeenUpdates)
      })
      .catch(() => {})
  }, [db, settings.lastSeenUpdates])

  return (
    <View style={[styles.header, { paddingTop: insets.top, height: APP_HEADER_HEIGHT + insets.top, backgroundColor: colors.background, borderBottomColor: colors.line }]}>
      <AppText variant="bodyStrong" weight="600" style={styles.wordmark} accessibilityRole="header" accessibilityLabel="GabAI">
        Gab<AppText variant="bodyStrong" weight="600" tone="teal" style={styles.wordmark}>AI</AppText>
      </AppText>
      <View style={styles.actions}>
        <Touchable onPress={() => router.push('/notifications')} accessibilityLabel="Open notifications" style={styles.iconButton}>
          <Icon name="bell" size={21} color={colors.teal} />
          {hasUnread && <View style={[styles.badge, { backgroundColor: colors.danger }]} />}
        </Touchable>
        <Touchable onPress={() => router.push('/settings')} accessibilityLabel="Open settings" style={styles.iconButton}>
          <Icon name="settings" size={21} color={colors.teal} />
        </Touchable>
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: space[5], borderBottomWidth: StyleSheet.hairlineWidth },
  wordmark: { fontSize: 18, letterSpacing: -0.5 },
  actions: { flexDirection: 'row', alignItems: 'center', gap: space[1] },
  iconButton: { width: touchTarget, height: touchTarget, alignItems: 'center', justifyContent: 'center' },
  badge: { position: 'absolute', top: 8, right: 8, width: 9, height: 9, borderRadius: 5, borderWidth: 1.5, borderColor: 'transparent' },
})
