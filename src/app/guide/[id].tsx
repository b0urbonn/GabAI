import { router, useLocalSearchParams } from 'expo-router'
import { useState } from 'react'
import { ScrollView, StyleSheet, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

import { GuideIllustration } from '@/components/GuideIllustration'
import { AppText } from '@/components/ui/AppText'
import { Button } from '@/components/ui/Button'
import { FadeIn } from '@/components/ui/FadeIn'
import { Icon } from '@/components/ui/Icon'
import { IconTile } from '@/components/ui/IconTile'
import { Touchable } from '@/components/ui/Touchable'
import { getGuide, guideKindLabel } from '@/data/guides'
import { getGuideArtwork } from '@/data/guideArtwork'
import { radius, space, touchTarget } from '@/theme/tokens'
import { useTheme } from '@/theme/useTheme'
import { goBack } from '@/utils/navigation'

export default function GuideSheet() {
  const { id } = useLocalSearchParams<{ id: string }>()
  const guide = getGuide(id)
  const { colors } = useTheme()
  const insets = useSafeAreaInsets()
  const [phaseIndex, setPhaseIndex] = useState(0)

  if (!guide) {
    return (
      <View style={[styles.missing, { backgroundColor: colors.surface }]}>
        <AppText variant="sheetTitle">Guide not found</AppText>
        <Touchable onPress={() => goBack('/guides')} style={styles.missingAction}><AppText tone="teal">Close</AppText></Touchable>
      </View>
    )
  }

  const phase = guide.phases[phaseIndex]
  const isAid = guide.kind === 'aid'
  const artwork = getGuideArtwork(guide.id, phase.label)
  return (
    <ScrollView style={{ backgroundColor: colors.surface }} contentContainerStyle={[styles.content, { paddingBottom: space[8] + insets.bottom }]}>
      <View style={styles.header}>
        <IconTile icon={guide.icon} tone={guide.tone} />
        <View style={styles.flex}>
          <AppText variant="eyebrow" tone="soft">{guideKindLabel[guide.kind]}</AppText>
          <AppText variant="sheetTitle" accessibilityRole="header">{guide.name}</AppText>
        </View>
        <Touchable onPress={() => goBack('/guides')} accessibilityLabel="Close" style={[styles.close, { borderColor: colors.line, backgroundColor: colors.background }]}>
          <Icon name="close" size={18} color={colors.ink} />
        </Touchable>
      </View>

      <FadeIn delay={80}>
      <View style={[styles.illustration, { backgroundColor: colors.background }]}>
        <GuideIllustration guide={guide} phase={phase.label} />
      </View>
      <AppText variant="small" tone="soft" style={styles.illustrationCaption}>{artwork?.caption ?? guide.detail}</AppText>
      </FadeIn>

      {!isAid ? (
        <>
          <View style={[styles.tabs, { backgroundColor: colors.background }]} accessibilityRole="tablist">
            {guide.phases.map((item, index) => {
              const active = index === phaseIndex
              return (
                <Touchable
                  key={item.label}
                  onPress={() => setPhaseIndex(index)}
                  pressedScale={1}
                  accessibilityRole="tab"
                  accessibilityState={{ selected: active }}
                  style={[styles.tab, active && [styles.tabActive, { backgroundColor: colors.surface }]]}
                >
                  <AppText variant="small" weight="700" tone={active ? 'teal' : 'soft'} align="center">{item.label}</AppText>
                </Touchable>
              )
            })}
          </View>
          <View style={[styles.disasterSection, { backgroundColor: colors.background }]}>
            <AppText variant="bodyStrong" style={styles.sectionHeading}>{phase.label}</AppText>
            <GuideSteps steps={phase.steps} />
          </View>
        </>
      ) : (
        <View style={styles.aidSections}>
          {guide.phases.map((item, sectionIndex) => (
            <View key={item.label} style={[styles.aidSection, { backgroundColor: sectionIndex === 1 ? colors.dangerSoft : colors.background }]}>
              <AppText variant="bodyStrong" tone={sectionIndex === 1 ? 'danger' : 'default'} style={styles.aidSectionTitle}>{item.label}</AppText>
              <GuideSteps steps={item.steps} />
            </View>
          ))}
        </View>
      )}

      <View style={[styles.offlineBadge, { backgroundColor: colors.tealSoft }]}>
        <Icon name="shield" size={18} color={colors.teal} />
        <AppText variant="small" weight="700" tone="teal">General guidance · Available offline</AppText>
      </View>
      {isAid ? <Button label="Emergency contacts" variant="destructive" icon="phone" onPress={() => router.push('/emergency')} style={styles.emergencyButton} /> : null}
      <AppText variant="small" tone="soft" style={styles.disclaimer}>Draft guidance. Follow local authorities and emergency responders. First aid information is not a substitute for professional medical care.</AppText>
    </ScrollView>
  )
}

function GuideSteps({ steps }: { steps: string[] }) {
  const { colors } = useTheme()
  return (
    <View style={styles.steps}>
      {steps.map((step, index) => (
        <View key={step} style={[styles.step, { backgroundColor: colors.surface }]}>
          <View style={[styles.stepNumber, { backgroundColor: colors.tealSoft }]}>
            <AppText variant="small" weight="800" tone="teal">{index + 1}</AppText>
          </View>
          <AppText style={styles.flex}>{step}</AppText>
        </View>
      ))}
    </View>
  )
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  content: { paddingHorizontal: space[5], paddingTop: space[6] },
  header: { flexDirection: 'row', alignItems: 'center', gap: space[3] },
  close: { width: touchTarget, height: touchTarget, borderRadius: radius.md, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  illustration: { marginTop: space[4], borderRadius: radius.group, overflow: 'hidden' },
  illustrationCaption: { marginTop: space[2], marginHorizontal: space[1] },
  tabs: { flexDirection: 'row', gap: 2, marginTop: space[4], marginBottom: space[4], padding: 2, borderRadius: radius.md },
  tab: { flex: 1, paddingVertical: space[2], minHeight: touchTarget - 4, justifyContent: 'center', borderRadius: radius.sm },
  tabActive: { shadowColor: '#000', shadowOpacity: 0.08, shadowRadius: 3, shadowOffset: { width: 0, height: 1 }, elevation: 1 },
  disasterSection: { marginTop: space[1], padding: space[3], borderRadius: radius.group },
  sectionHeading: { marginBottom: space[2] },
  steps: { gap: space[2] },
  step: { flexDirection: 'row', alignItems: 'flex-start', gap: space[3], padding: space[3], borderRadius: radius.md },
  stepNumber: { width: 28, height: 28, borderRadius: 9, alignItems: 'center', justifyContent: 'center' },
  aidSections: { gap: space[4], marginTop: space[5] },
  aidSection: { padding: space[4], borderRadius: radius.group },
  aidSectionTitle: { marginBottom: space[3] },
  offlineBadge: { marginTop: space[5], padding: space[3], borderRadius: radius.md, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: space[2] },
  emergencyButton: { marginTop: space[4] },
  disclaimer: { marginTop: space[4], textAlign: 'center', lineHeight: 18 },
  missing: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: space[3], padding: space[6] },
  missingAction: { minHeight: touchTarget, justifyContent: 'center', borderRadius: radius.md },
})
