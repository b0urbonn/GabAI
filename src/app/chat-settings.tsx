import { useState } from 'react'
import { StyleSheet, View } from 'react-native'

import { CloudGeminiSection } from '@/components/chat-settings/CloudGeminiSection'
import { LocalModelSection, type SettingsFeedback } from '@/components/chat-settings/LocalModelSection'
import { VoiceSection } from '@/components/chat-settings/VoiceSection'
import { AppText } from '@/components/ui/AppText'
import { GroupedCard } from '@/components/ui/GroupedCard'
import { Icon, type IconName } from '@/components/ui/Icon'
import { BackButton, Banner, PageHeader, SettingsLabel } from '@/components/ui/Layout'
import { ListRow } from '@/components/ui/ListRow'
import { Screen } from '@/components/ui/Screen'
import { SegmentedControl } from '@/components/ui/SegmentedControl'
import type { AiMode } from '@/db/settings'
import { useSettings } from '@/providers/SettingsProvider'
import { space } from '@/theme/tokens'
import { useTheme } from '@/theme/useTheme'

const AI_MODES: { value: AiMode; label: string; icon: IconName; footnote: string }[] = [
  {
    value: 'local',
    label: 'On-Device',
    icon: 'phone',
    footnote: 'Gemma 4 E2B runs on this device. Fully private and works offline.',
  },
  {
    value: 'cloud',
    label: 'Cloud AI',
    icon: 'cloud',
    footnote: 'Google Gemini handles requests online. Requires an active connection.',
  },
]

export default function ChatSettingsScreen() {
  const { settings, updateSettings } = useSettings()
  const { colors } = useTheme()
  const [feedback, setFeedback] = useState<SettingsFeedback>(null)

  const selectedMode = AI_MODES.find((option) => option.value === settings.aiMode) ?? AI_MODES[0]

  return (
    <Screen topInset contentStyle={styles.content}>
      <BackButton label="Settings" />
      <PageHeader title="AI Settings" subtitle="Configure on-device and cloud intelligence." />

      <View style={styles.section}>
        <SettingsLabel>AI PROVIDER</SettingsLabel>
        <SegmentedControl
          label="AI provider"
          options={AI_MODES}
          value={selectedMode.value}
          onChange={(aiMode) => {
            setFeedback(null)
            void updateSettings({ aiMode })
          }}
        />
        <AppText variant="small" tone="soft" style={styles.footnote}>
          {selectedMode.footnote}
        </AppText>
      </View>

      {feedback && <Banner text={feedback.text} tone={feedback.error ? 'error' : 'info'} />}
      {selectedMode.value === 'local' && <LocalModelSection onFeedback={setFeedback} />}
      {settings.aiMode === 'cloud' && <CloudGeminiSection onFeedback={setFeedback} />}

      <VoiceSection />

      <View style={styles.section}>
        <SettingsLabel>SUPPORTED LANGUAGES</SettingsLabel>
        <GroupedCard>
          <ListRow
            title="English, Filipino & Taglish"
            subtitle="Automatic language detection"
            leading="book"
            trailing={<Icon name="check" size={18} color={colors.teal} />}
          />
        </GroupedCard>
        <AppText variant="small" tone="soft" style={styles.footnote}>
          GabAI understands and responds in all three automatically.
        </AppText>
      </View>
    </Screen>
  )
}

const styles = StyleSheet.create({
  content: { width: '100%', maxWidth: 640, alignSelf: 'center' },
  section: { marginTop: space[6] },
  footnote: { marginTop: space[2], marginHorizontal: space[4] },
})
