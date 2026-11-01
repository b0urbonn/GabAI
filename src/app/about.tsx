import Constants from 'expo-constants'
import { StyleSheet, View } from 'react-native'

import { AppText } from '@/components/ui/AppText'
import { FadeIn } from '@/components/ui/FadeIn'
import { GroupedCard } from '@/components/ui/GroupedCard'
import { BackButton, PageHeader, SettingsLabel } from '@/components/ui/Layout'
import { ListRow } from '@/components/ui/ListRow'
import { Screen } from '@/components/ui/Screen'
import { space } from '@/theme/tokens'

const TEAM_CREDITS: readonly { name: string; role: string }[] = [
  { name: 'Ruby Charlene Perilla', role: 'Project Manager & Team Lead' },
  { name: 'Terrence Briones', role: 'Lead Developer & AI Engineer' },
  { name: 'Lyka Tolosa', role: 'UI/UX Designer & Frontend Developer' },
]

const appVersion = Constants.expoConfig?.version ?? '1.0.0'

export default function AboutScreen() {
  return (
    <Screen topInset>
      <BackButton />
      <PageHeader title="About GabAI" subtitle="Your offline companion for disaster preparedness, first aid guidance, and emergency assistance." />

      <FadeIn>
        <View style={styles.firstSection}>
          <SettingsLabel>Built by the Team Pixel6</SettingsLabel>
          <GroupedCard>
            {TEAM_CREDITS.map((member) => (
              <ListRow key={member.name} title={member.name} subtitle={member.role} leading="profile" />
            ))}
          </GroupedCard>
        </View>
      </FadeIn>

      <FadeIn delay={90}>
        <View style={styles.section}>
          <SettingsLabel>Credits</SettingsLabel>
          <GroupedCard>
            <ListRow title="Dale Ogbac" subtitle="Mentor" leading="heart" />
            <ListRow
              title="Marinduque Innovation Fest 2026"
              subtitle="Top 5 Finalist · 10/29/2026 - 10/31/2026"
              leading="sparkles"
            />
          </GroupedCard>
        </View>
      </FadeIn>

      <AppText variant="small" tone="soft" align="center" style={styles.version}>
        GabAI {appVersion}
      </AppText>
    </Screen>
  )
}

const styles = StyleSheet.create({
  firstSection: { marginTop: 0 },
  section: { marginTop: space[6] },
  version: { marginTop: space[8] },
})
