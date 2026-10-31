import * as Linking from 'expo-linking'
import { useEffect } from 'react'
import { ActivityIndicator, Platform, RefreshControl, StyleSheet, View } from 'react-native'

import { AppText } from '@/components/ui/AppText'
import { FadeIn } from '@/components/ui/FadeIn'
import { GroupedCard } from '@/components/ui/GroupedCard'
import { Icon, type IconName } from '@/components/ui/Icon'
import { BackButton } from '@/components/ui/Layout'
import { Screen } from '@/components/ui/Screen'
import { Touchable } from '@/components/ui/Touchable'
import { usePublicUpdates } from '@/hooks/usePublicUpdates'
import { useSettings } from '@/providers/SettingsProvider'
import { officialUrl, UPDATE_SOURCES, type PublicUpdate, type UpdateSource } from '@/services/publicUpdates'
import { radius, space, touchTarget } from '@/theme/tokens'
import { useTheme } from '@/theme/useTheme'

function sourceLabel(source: UpdateSource) {
  return UPDATE_SOURCES[source].name
}

function sourceIcon(item: PublicUpdate): IconName {
  if (item.kind === 'weather') return 'storm'
  return 'quake'
}

function timeAgo(publishedAt: number): string {
  const diff = Date.now() - publishedAt
  const minutes = Math.floor(diff / 60_000)
  if (minutes < 1) return 'Just now'
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  return `${days}d ago`
}

function AlertCard({ item }: { item: PublicUpdate }) {
  const { colors } = useTheme()
  const isWeather = item.kind === 'weather'
  const badgeBg = isWeather ? colors.dangerSoft : colors.tealSoft
  const badgeColor = isWeather ? colors.danger : colors.teal

  const handlePress = () => {
    const url = officialUrl(item.url, item.source)
    if (url) Linking.openURL(url)
  }

  return (
    <Touchable onPress={handlePress} accessibilityLabel={`${item.title}. From ${sourceLabel(item.source)}`} pressedScale={1} style={[styles.alertCard, { backgroundColor: colors.surface }]}>
      <View style={[styles.alertBadge, { backgroundColor: badgeBg }]}>
        <Icon name={sourceIcon(item)} size={20} color={badgeColor} />
      </View>
      <View style={styles.alertBody}>
        <View style={styles.alertTopRow}>
          <AppText variant="caption" weight="600" numberOfLines={2} style={styles.alertTitle}>{item.title}</AppText>
          <Icon name="chevron" size={16} color={colors.muted} />
        </View>
        {item.summary ? <AppText variant="small" tone="soft" numberOfLines={3}>{item.summary}</AppText> : null}
        <View style={styles.alertMeta}>
          <AppText variant="small" tone="teal" weight="500">{sourceLabel(item.source)}</AppText>
          <AppText variant="small" tone="soft">·</AppText>
          <AppText variant="small" tone="soft">{timeAgo(item.publishedAt)}</AppText>
          {item.area ? (
            <>
              <AppText variant="small" tone="soft">·</AppText>
              <AppText variant="small" tone="soft" numberOfLines={1} style={styles.areaText}>{item.area}</AppText>
            </>
          ) : null}
        </View>
      </View>
    </Touchable>
  )
}

export default function NotificationsScreen() {
  const { colors } = useTheme()
  const { items, loading, error, refresh } = usePublicUpdates()
  const { updateSettings } = useSettings()

  // Mark as seen when the screen opens
  useEffect(() => {
    if (items.length > 0) {
      const newest = Math.max(...items.map((i) => i.publishedAt))
      updateSettings({ lastSeenUpdates: newest })
    }
  }, [items, updateSettings])

  const weatherAlerts = items.filter((i) => i.kind === 'weather')
  const newsItems = items.filter((i) => i.kind === 'news')
  const isEmpty = items.length === 0 && !loading

  return (
    <Screen topInset refreshControl={<RefreshControl refreshing={loading && items.length > 0} onRefresh={refresh} tintColor={colors.teal} colors={[colors.teal]} />}>
      <BackButton label="Home" />
      <AppText variant="pageTitle" accessibilityRole="header" style={styles.pageTitle}>Notifications</AppText>
      <AppText variant="caption" tone="soft" style={styles.subtitle}>
        Real-time alerts from official Philippine agencies. No account needed.
      </AppText>

      {Platform.OS === 'web' && (
        <View style={[styles.previewBanner, { backgroundColor: colors.tealSoft }]}>
          <AppText variant="small" style={{ color: colors.tealDark }}>
            Web preview mode: displaying official sample bulletins. Live XML polling operates on iOS and Android devices.
          </AppText>
        </View>
      )}

      {loading && items.length === 0 ? (
        <View style={styles.center}>
          <ActivityIndicator color={colors.teal} />
          <AppText variant="caption" tone="soft" style={styles.loadingText}>Checking official sources…</AppText>
        </View>
      ) : error && isEmpty ? (
        <View style={styles.center}>
          <Icon name="wifiOff" size={40} color={colors.muted} />
          <AppText variant="body" weight="600" style={styles.emptyTitle}>No connection</AppText>
          <AppText variant="caption" tone="soft" style={styles.emptyText}>{error}</AppText>
          <Touchable onPress={refresh} style={[styles.retryButton, { backgroundColor: colors.tealSoft }]}>
            <AppText variant="caption" weight="600" tone="teal">Try again</AppText>
          </Touchable>
        </View>
      ) : isEmpty ? (
        <View style={styles.center}>
          <Icon name="shield" size={40} color={colors.teal} />
          <AppText variant="body" weight="600" style={styles.emptyTitle}>All clear</AppText>
          <AppText variant="caption" tone="soft" style={styles.emptyText}>
            No active weather alerts or agency news for Marinduque right now.
          </AppText>
        </View>
      ) : (
        <>
          {weatherAlerts.length > 0 && (
            <FadeIn delay={80}>
            <View style={styles.section}>
              <AppText variant="eyebrow" tone="soft" style={styles.sectionLabel}>WEATHER ALERTS</AppText>
              <GroupedCard>
                {weatherAlerts.map((item) => (
                  <AlertCard key={item.id} item={item} />
                ))}
              </GroupedCard>
              <AppText variant="small" tone="soft" style={styles.sourceNote}>
                Source: {UPDATE_SOURCES.pagasa.name}
              </AppText>
            </View>
            </FadeIn>
          )}

          {newsItems.length > 0 && (
            <FadeIn delay={160}>
            <View style={styles.section}>
              <AppText variant="eyebrow" tone="soft" style={styles.sectionLabel}>AGENCY NEWS</AppText>
              <GroupedCard>
                {newsItems.map((item) => (
                  <AlertCard key={item.id} item={item} />
                ))}
              </GroupedCard>
              <AppText variant="small" tone="soft" style={styles.sourceNote}>
                Source: {UPDATE_SOURCES.phivolcs.name}
              </AppText>
            </View>
            </FadeIn>
          )}
        </>
      )}
    </Screen>
  )
}

const styles = StyleSheet.create({
  pageTitle: { marginTop: space[1] },
  subtitle: { marginTop: space[2], marginBottom: space[5] },
  previewBanner: { padding: space[3], borderRadius: radius.md, marginBottom: space[5] },
  section: { marginBottom: space[6] },
  sectionLabel: { marginBottom: space[2], marginLeft: space[1] },
  sourceNote: { marginTop: space[2], marginLeft: space[1] },
  alertCard: { flexDirection: 'row', alignItems: 'flex-start', gap: space[3], paddingHorizontal: space[4], paddingVertical: space[3], minHeight: touchTarget },
  alertBadge: { width: space[8], height: space[8], borderRadius: radius.sm, alignItems: 'center', justifyContent: 'center', marginTop: 2 },
  alertBody: { flex: 1, minWidth: 0, gap: 4 },
  alertTopRow: { flexDirection: 'row', alignItems: 'flex-start', gap: space[2] },
  alertTitle: { flex: 1 },
  alertMeta: { flexDirection: 'row', alignItems: 'center', gap: 4, flexWrap: 'wrap', marginTop: 2 },
  areaText: { flex: 1 },
  center: { alignItems: 'center', justifyContent: 'center', paddingVertical: 80, gap: space[3] },
  retryButton: { marginTop: space[2], paddingHorizontal: space[4], paddingVertical: space[2], borderRadius: radius.pill },
  loadingText: { marginTop: space[2] },
  emptyTitle: { marginTop: space[1] },
  emptyText: { textAlign: 'center', paddingHorizontal: space[6] },
})
