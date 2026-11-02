import { router } from 'expo-router'
import { useSQLiteContext } from 'expo-sqlite'
import { useState } from 'react'
import { StyleSheet, View } from 'react-native'

import { AppText } from '@/components/ui/AppText'
import { FadeIn } from '@/components/ui/FadeIn'
import { GroupedCard } from '@/components/ui/GroupedCard'
import { BackButton, Banner, PageHeader, SettingsLabel } from '@/components/ui/Layout'
import { ListRow } from '@/components/ui/ListRow'
import { Screen } from '@/components/ui/Screen'
import { SegmentedControl, type SegmentedOption } from '@/components/ui/SegmentedControl'
import { getProfile, saveProfile } from '@/db/profile'
import type { Appearance } from '@/db/settings'
import { useSettings } from '@/providers/SettingsProvider'
import { clearAllData } from '@/services/appData'
import { pickBackup, shareBackup } from '@/storage/backup'
import { BackupError } from '@/storage/backupFormat'
import { space, textSizes, type TextSize } from '@/theme/tokens'
import { confirmAction } from '@/utils/dialogs'

const appearanceOptions: SegmentedOption<Appearance>[] = [
  { value: 'light', label: 'Light', icon: 'sun' },
  { value: 'dark', label: 'Dark', icon: 'moon' },
]

const textSizeOptions: SegmentedOption<TextSize>[] = (Object.keys(textSizes) as TextSize[]).map((size) => ({
  value: size,
  label: textSizes[size].label,
}))

type Feedback = { text: string; error?: boolean } | null

const errorText = (error: unknown, fallback: string) => (error instanceof BackupError ? error.message : fallback)

export default function SettingsScreen() {
  const db = useSQLiteContext()
  const { settings, updateSettings, resetSettings } = useSettings()
  const [feedback, setFeedback] = useState<Feedback>(null)

  const exportBackup = async () => {
    setFeedback(null)
    const confirmed = await confirmAction({
      title: 'Export a backup?',
      message: 'The file includes personal and health details you entered. It is not encrypted. Only save it somewhere private.',
      confirmLabel: 'Export',
    })
    if (!confirmed) return
    try {
      await shareBackup(await getProfile(db), settings)
      setFeedback({ text: 'Backup created. Keep the file somewhere private.' })
    } catch (error) {
      setFeedback({ text: errorText(error, 'Unable to create a backup. Please try again.'), error: true })
    }
  }

  const restoreBackup = async () => {
    setFeedback(null)
    try {
      const backup = await pickBackup()
      if (!backup) return
      const confirmed = await confirmAction({
        title: 'Restore this backup?',
        message: 'Your current profile and preferences will be replaced by this backup. This cannot be undone.',
        confirmLabel: 'Restore',
      })
      if (!confirmed) return
      await saveProfile(db, backup.profile)
      await updateSettings(backup.settings)
      setFeedback({ text: 'Backup restored. Profile and preferences updated.' })
    } catch (error) {
      setFeedback({ text: errorText(error, 'Unable to restore this backup. Please try again.'), error: true })
    }
  }

  const clearData = async () => {
    setFeedback(null)
    const confirmed = await confirmAction({
      title: 'Clear app data?',
      message: 'This deletes your profile, chat history, saved photos, custom emergency contacts, preferences, and Gemini API key from this device. Safety guides, the downloaded AI model, and exported backup files are not affected.',
      confirmLabel: 'Clear data',
      destructive: true,
    })
    if (!confirmed) return
    try {
      await clearAllData(db)
      resetSettings()
      setFeedback({ text: 'App data cleared. Default settings restored.' })
    } catch {
      setFeedback({ text: 'Unable to clear app data. Please try again.', error: true })
    }
  }

  return (
    <Screen topInset contentStyle={styles.content}>
      <BackButton />
      <PageHeader title="Settings" subtitle="Make GabAI work better for you." />

      {feedback && <Banner text={feedback.text} tone={feedback.error ? 'error' : 'info'} />}

      <FadeIn>
        <View style={styles.section}>
          <SettingsLabel>APPEARANCE</SettingsLabel>
          <GroupedCard>
            <View style={styles.preferenceBlock}>
              <AppText weight="500">Theme</AppText>
              <SegmentedControl
                label="Theme"
                options={appearanceOptions}
                value={settings.appearance}
                onChange={(appearance) => void updateSettings({ appearance })}
              />
            </View>
            <View style={styles.preferenceBlock}>
              <AppText weight="500">Text size</AppText>
              <SegmentedControl
                label="Text size"
                options={textSizeOptions}
                value={settings.textSize}
                onChange={(textSize) => void updateSettings({ textSize })}
              />
              <AppText tone="soft" align="center" style={styles.preview}>Clear guidance, whenever you need it.</AppText>
            </View>
          </GroupedCard>
        </View>
      </FadeIn>

      <FadeIn delay={90}>
        <View style={styles.section}>
          <SettingsLabel>GENERAL</SettingsLabel>
          <GroupedCard>
            <ListRow title="Chatbot settings" subtitle="Local or cloud AI" leading="chat" onPress={() => router.push('/chat-settings')} />
            <ListRow title="About GabAI" subtitle="The team behind the app" leading="sparkles" onPress={() => router.push('/about')} />
          </GroupedCard>
        </View>
      </FadeIn>

      <FadeIn delay={170}>
        <View style={styles.section}>
          <SettingsLabel>DATA</SettingsLabel>
          <GroupedCard>
            <ListRow title="Back up data" subtitle="Export a JSON file" leading="download" onPress={exportBackup} />
            <ListRow title="Restore data" subtitle="Import a GabAI backup" leading="restore" onPress={restoreBackup} />
            <ListRow title="Clear data" subtitle="Delete everything stored on this device" leading="trash" destructive onPress={clearData} />
          </GroupedCard>
          <AppText variant="small" tone="soft" style={styles.footnote}>Backup files are not encrypted. Keep them somewhere private.</AppText>
        </View>
      </FadeIn>
    </Screen>
  )
}

const styles = StyleSheet.create({
  content: { width: '100%', maxWidth: 640, alignSelf: 'center' },
  section: { marginTop: space[6] },
  preferenceBlock: { paddingHorizontal: space[4], paddingVertical: space[3], gap: space[2] },
  preview: { marginTop: space[2] },
  footnote: { marginTop: space[2], marginHorizontal: space[4] },
})
