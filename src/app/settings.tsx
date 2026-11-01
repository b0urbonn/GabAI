import { router } from 'expo-router'
import { useSQLiteContext } from 'expo-sqlite'
import { useState } from 'react'
import { StyleSheet, View } from 'react-native'

import { AppText } from '@/components/ui/AppText'
import { FadeIn } from '@/components/ui/FadeIn'
import { GroupedCard } from '@/components/ui/GroupedCard'
import { Icon, type IconName } from '@/components/ui/Icon'
import { BackButton, Banner, PageHeader, SettingsLabel } from '@/components/ui/Layout'
import { ListRow } from '@/components/ui/ListRow'
import { Screen } from '@/components/ui/Screen'
import { Touchable } from '@/components/ui/Touchable'
import { getProfile, saveProfile } from '@/db/profile'
import type { Appearance } from '@/db/settings'
import { useSettings } from '@/providers/SettingsProvider'
import { clearAllData } from '@/services/appData'
import { pickBackup, shareBackup } from '@/storage/backup'
import { BackupError } from '@/storage/backupFormat'
import { radius, space, textSizes, touchTarget, type TextSize } from '@/theme/tokens'
import { useTheme } from '@/theme/useTheme'
import { confirmAction } from '@/utils/dialogs'

const appearanceOptions: { value: Appearance; label: string; icon: IconName }[] = [
  { value: 'light', label: 'Light', icon: 'sun' },
  { value: 'dark', label: 'Dark', icon: 'moon' },
]

type Feedback = { text: string; error?: boolean } | null

const errorText = (error: unknown, fallback: string) => (error instanceof BackupError ? error.message : fallback)

export default function SettingsScreen() {
  const db = useSQLiteContext()
  const { settings, updateSettings, resetSettings } = useSettings()
  const { colors } = useTheme()
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
      message: 'This deletes your profile, chat history, saved photos, preferences, and Gemini API key from this device. Safety guides, the downloaded AI model, and exported backup files are not affected.',
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
    <Screen topInset>
      <BackButton />
      <PageHeader title="Settings" subtitle="Make GabAI work better for you." />

      <FadeIn>
      <View style={[styles.section, styles.firstSection]}>
        <SettingsLabel>Appearance</SettingsLabel>
        <View style={[styles.card, { backgroundColor: colors.surface }]}>
          <View style={styles.appearanceRow} accessibilityRole="radiogroup" accessibilityLabel="Color appearance">
            {appearanceOptions.map((option) => {
              const selected = settings.appearance === option.value
              return (
                <Touchable
                  key={option.value}
                  onPress={() => updateSettings({ appearance: option.value })}
                  accessibilityRole="radio"
                  accessibilityState={{ selected }}
                  accessibilityLabel={`${option.label} appearance`}
                  style={[styles.appearanceOption, { borderColor: selected ? colors.teal : colors.line, backgroundColor: selected ? colors.tealSoft : 'transparent' }]}
                >
                  <View style={styles.optionLabel}>
                    <Icon name={option.icon} size={16} color={colors.ink} />
                    <AppText variant="caption">{option.label}</AppText>
                  </View>
                  <View style={[styles.check, { borderColor: selected ? colors.teal : colors.line, backgroundColor: selected ? colors.teal : 'transparent' }]}>
                    {selected && <Icon name="check" size={13} color={colors.background} />}
                  </View>
                </Touchable>
              )
            })}
          </View>

          <View style={[styles.textSize, { borderTopColor: colors.line }]}>
            <View style={styles.rowBetween}>
              <AppText>Text size</AppText>
              <AppText variant="caption" tone="soft">{textSizes[settings.textSize].label}</AppText>
            </View>
            <View style={[styles.segmented, { backgroundColor: colors.background }]} accessibilityRole="radiogroup" accessibilityLabel="Text size">
              {(Object.keys(textSizes) as TextSize[]).map((size) => {
                const selected = settings.textSize === size
                return (
                  <Touchable
                    key={size}
                    onPress={() => updateSettings({ textSize: size })}
                    pressedScale={1}
                    accessibilityRole="radio"
                    accessibilityState={{ selected }}
                    style={[styles.segment, selected && [styles.segmentSelected, { backgroundColor: colors.surface }]]}
                  >
                    <AppText variant="small" tone={selected ? 'teal' : 'default'} weight={selected ? '600' : '400'}>{textSizes[size].label}</AppText>
                  </Touchable>
                )
              })}
            </View>
            <AppText tone="soft" align="center" style={styles.preview}>Clear guidance, whenever you need it.</AppText>
          </View>
        </View>
      </View>
      </FadeIn>

      <FadeIn delay={90}>
      <View style={styles.section}>
        <SettingsLabel>GabAI</SettingsLabel>
        <GroupedCard>
          <ListRow title="Chatbot settings" subtitle="Local or cloud AI" leading="chat" onPress={() => router.push('/chat-settings')} />
          <ListRow title="About GabAI" subtitle="The team behind the app" leading="sparkles" onPress={() => router.push('/about')} />
        </GroupedCard>
      </View>
      </FadeIn>

      <FadeIn delay={170}>
      <View style={styles.section}>
        <SettingsLabel>Backup & restore</SettingsLabel>
        <GroupedCard>
          <ListRow title="Back up data" subtitle="Export a JSON file" leading="download" onPress={exportBackup} />
          <ListRow title="Restore data" subtitle="Import a GabAI backup" leading="restore" onPress={restoreBackup} />
        </GroupedCard>
      </View>
      </FadeIn>

      <FadeIn delay={240}>
      <View style={styles.section}>
        <SettingsLabel>Manage data</SettingsLabel>
        <GroupedCard>
          <ListRow title="Clear data" subtitle="Delete everything stored on this device" leading="trash" destructive onPress={clearData} />
        </GroupedCard>
      </View>
      </FadeIn>

      {feedback && <Banner text={feedback.text} tone={feedback.error ? 'error' : 'info'} />}
    </Screen>
  )
}

const styles = StyleSheet.create({
  section: { marginTop: space[6] },
  firstSection: { marginTop: 0 },
  card: { borderRadius: radius.group, padding: space[4] },
  appearanceRow: { flexDirection: 'row', gap: space[2] },
  appearanceOption: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', minHeight: touchTarget, paddingHorizontal: space[3], borderWidth: 1, borderRadius: radius.group },
  optionLabel: { flexDirection: 'row', alignItems: 'center', gap: space[1] },
  check: { width: 20, height: 20, borderRadius: 10, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  textSize: { marginTop: space[5], paddingTop: space[4], borderTopWidth: StyleSheet.hairlineWidth },
  rowBetween: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', flexWrap: 'wrap', gap: space[2] },
  segmented: { flexDirection: 'row', gap: space[1], padding: space[1], borderRadius: radius.md, marginTop: space[3] },
  segment: { flex: 1, minHeight: touchTarget, borderRadius: radius.sm, alignItems: 'center', justifyContent: 'center' },
  segmentSelected: { shadowColor: '#000', shadowOpacity: 0.1, shadowRadius: 3, shadowOffset: { width: 0, height: 1 }, elevation: 1 },
  preview: { marginTop: space[4] },
})
