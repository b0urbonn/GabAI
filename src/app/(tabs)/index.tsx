import { router } from 'expo-router'
import { ScrollView, StyleSheet, View } from 'react-native'

import { MarinduqueScene } from '@/components/MarinduqueScene'
import { MorionMascot } from '@/components/MorionMascot'
import { SafetyTipCard } from '@/components/SafetyTipCard'
import { WeatherCard } from '@/components/WeatherCard'
import { AppText } from '@/components/ui/AppText'
import { FadeIn } from '@/components/ui/FadeIn'
import { Icon, type IconName } from '@/components/ui/Icon'
import { IconTile } from '@/components/ui/IconTile'
import { SectionHeader } from '@/components/ui/Layout'
import { Screen } from '@/components/ui/Screen'
import { Touchable } from '@/components/ui/Touchable'
import { disasterGuides } from '@/data/guides'
import { useSettings } from '@/providers/SettingsProvider'
import { brand, radius, space, touchTarget } from '@/theme/tokens'
import { useTheme } from '@/theme/useTheme'

const openGuide = (id: string) => router.push({ pathname: '/guide/[id]', params: { id } })

const greeting = () => {
  const hour = new Date().getHours()
  if (hour < 12) return 'Magandang umaga'
  if (hour < 18) return 'Magandang hapon'
  return 'Magandang gabi'
}

const QUICK_ACTIONS: { icon: IconName; label: string; href: '/emergency' | '/chat' | '/capture' | '/guides'; emergency?: boolean }[] = [
  { icon: 'phone', label: 'Emergency', href: '/emergency', emergency: true },
  { icon: 'sparkles', label: 'Ask GabAI', href: '/chat' },
  { icon: 'camera', label: 'Capture', href: '/capture' },
  { icon: 'kit', label: 'First aid', href: '/guides' },
]

export default function HomeScreen() {
  const { settings } = useSettings()
  const { colors, scheme } = useTheme()

  return (
    <Screen>
      <FadeIn>
      <View style={[styles.hero, { backgroundColor: colors.background }]}>
        <View style={styles.scene} pointerEvents="none"><MarinduqueScene scheme={scheme} /></View>
        <View style={styles.welcomeRow}>
          <View style={styles.welcome}>
            <AppText variant="caption" tone="soft">{settings.nickname ? `${greeting()}, ${settings.nickname}` : greeting()}</AppText>
            <AppText variant="pageTitle" accessibilityRole="header">Stay ready.</AppText>
            <AppText variant="caption" tone="soft" style={styles.subcopy}>Your everyday safety companion.</AppText>
          </View>
          <Touchable
            onPress={() => router.navigate('/chat')}
            accessibilityLabel="Chat with GabAI Morion"
            accessibilityRole="button"
            pressedScale={0.94}
            style={styles.morionTouch}
          >
            <MorionMascot style={styles.morion} />
          </Touchable>
        </View>
        <WeatherCard />
      </View>
      </FadeIn>

      <FadeIn delay={90}>
      <View style={styles.actions}>
        {QUICK_ACTIONS.map((action) => (
          <Touchable
            key={action.label}
            onPress={() => router.push(action.href)}
            pressedScale={0.92}
            accessibilityLabel={action.label}
            style={styles.action}
          >
            <View style={[styles.actionIcon, { backgroundColor: action.emergency ? colors.danger : colors.surface }]}>
              <Icon name={action.icon} size={22} color={action.emergency ? brand.onPrimary : colors.teal} />
            </View>
            <AppText variant="small" tone={action.emergency ? 'danger' : 'soft'} align="center" numberOfLines={1}>{action.label}</AppText>
          </Touchable>
        ))}
      </View>
      </FadeIn>

      <FadeIn delay={170}>
      <View style={styles.section}>
        <SectionHeader title="Disaster guides" caption="Know what to do before, during & after" actionLabel="See all" onAction={() => router.navigate('/guides')} />
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.guideScroll}
          contentContainerStyle={styles.guideScrollContent}
        >
          {disasterGuides.map((guide) => (
            <Touchable
              key={guide.id}
              onPress={() => openGuide(guide.id)}
              pressedScale={0.96}
              accessibilityLabel={`Open ${guide.name} guide`}
              style={[styles.guideCard, { backgroundColor: colors.surface }]}
            >
              <IconTile icon={guide.icon} tone={guide.tone} size="lg" />
              <AppText variant="small" weight="600" style={styles.guideName}>{guide.name}</AppText>
              <AppText variant="small" tone="soft" numberOfLines={2} style={styles.guideDetail}>{guide.detail}</AppText>
            </Touchable>
          ))}
        </ScrollView>
      </View>
      </FadeIn>

      <FadeIn delay={250}>
      <View style={styles.section}>
        <SectionHeader title="Safety tip" />
        <SafetyTipCard />
      </View>
      </FadeIn>
    </Screen>
  )
}

const styles = StyleSheet.create({
  hero: { position: 'relative', marginTop: -space[6], marginHorizontal: -space[5], paddingTop: space[5], paddingHorizontal: space[5], paddingBottom: space[5] },
  scene: { position: 'absolute', right: 0, top: space[2], width: '55%', height: 120, opacity: 0.28 },
  welcomeRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: space[4], gap: space[2] },
  welcome: { flex: 1, minWidth: 0, paddingTop: space[1], gap: space[1] },
  morionTouch: { alignItems: 'center', justifyContent: 'center' },
  morion: { width: 92, height: 115 },
  subcopy: { marginTop: space[1] },
  actions: { flexDirection: 'row', justifyContent: 'space-between', gap: space[2], marginTop: space[1] },
  action: { flex: 1, alignItems: 'center', gap: space[2] },
  actionIcon: { width: touchTarget + 10, height: touchTarget + 10, borderRadius: (touchTarget + 10) / 2, alignItems: 'center', justifyContent: 'center' },
  section: { marginTop: space[6] },
  guideScroll: { marginHorizontal: -space[5] },
  guideScrollContent: { gap: space[2], paddingHorizontal: space[5] },
  guideCard: { width: 128, borderRadius: radius.group, padding: space[3], gap: space[2] },
  guideName: { marginTop: space[1] },
  guideDetail: { lineHeight: 16 },
})
