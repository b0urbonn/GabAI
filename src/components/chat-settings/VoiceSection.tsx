import { useEffect, useState } from 'react'
import {
  ActivityIndicator,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  useWindowDimensions,
  View,
} from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

import { AppText } from '@/components/ui/AppText'
import { GroupedCard } from '@/components/ui/GroupedCard'
import { Icon } from '@/components/ui/Icon'
import { Banner, SettingsLabel } from '@/components/ui/Layout'
import { ListRow } from '@/components/ui/ListRow'
import { Touchable } from '@/components/ui/Touchable'
import type { VoiceLanguage } from '@/db/settings'
import { useSettings } from '@/providers/SettingsProvider'
import { availableVoices, matchingVoices, speak, stopSpeaking, voiceOutputAvailable, type Voice } from '@/services/voice'
import { radius, space } from '@/theme/tokens'
import { useTheme } from '@/theme/useTheme'

const LANGUAGES: { value: VoiceLanguage; label: string; sample: string }[] = [
  { value: 'auto', label: 'Automatic', sample: 'Kumusta! Ako si Gabay, your safety companion. Nandito ako para tumulong.' },
  { value: 'fil-PH', label: 'Filipino / Taglish', sample: 'Kumusta! Ako si Gabay. Nandito ako para tumulong sa iyo.' },
  { value: 'en-US', label: 'English', sample: 'Hello! I am Gabay, your safety companion. I am here to help.' },
]

export function VoiceSection() {
  const { settings, updateSettings } = useSettings()
  const { colors } = useTheme()
  const insets = useSafeAreaInsets()
  const { height: windowHeight } = useWindowDimensions()
  const [voices, setVoices] = useState<Voice[]>([])
  const [loading, setLoading] = useState(true)
  const [refresh, setRefresh] = useState(0)
  const [previewing, setPreviewing] = useState(false)
  const [error, setError] = useState('')
  const [langPickerOpen, setLangPickerOpen] = useState(false)
  const [voicePickerOpen, setVoicePickerOpen] = useState(false)

  const supported = voiceOutputAvailable()
  const language = LANGUAGES.find((item) => item.value === settings.voiceLanguage) ?? LANGUAGES[0]
  const choices = matchingVoices(voices, settings.voiceLanguage).map((voice, index) => ({
    voice,
    label: `${voice.name === voice.identifier ? 'Voice' : voice.name} ${index + 1}${voice.quality === 'Enhanced' ? ' (Enhanced)' : ''}`,
  }))
  const selected = choices.find((item) => item.voice.identifier === settings.voiceIdentifier)

  useEffect(() => {
    let cancelled = false
    availableVoices().then((items) => {
      if (!cancelled) setVoices(items)
    }).catch(() => {
      if (!cancelled) setError('Unable to load voices.')
    }).finally(() => {
      if (!cancelled) setLoading(false)
    })
    return () => { cancelled = true }
  }, [refresh])

  useEffect(() => () => stopSpeaking(), [])

  const stopPreview = () => {
    stopSpeaking()
    setPreviewing(false)
    setError('')
  }

  const togglePreview = () => {
    if (previewing) {
      stopPreview()
      return
    }
    setError('')
    setPreviewing(true)
    speak(
      language.sample,
      settings.voiceLanguage,
      () => setPreviewing(false),
      (msg) => {
        setPreviewing(false)
        setError(msg ?? 'Voice playback failed.')
      },
      settings.voiceIdentifier,
    )
  }

  const handleRefresh = () => {
    stopPreview()
    setLoading(true)
    setRefresh((v) => v + 1)
  }

  return (
    <View style={styles.section}>
      <SettingsLabel>SPEECH</SettingsLabel>
      <GroupedCard>
        <ListRow
          title="Read Replies Aloud"
          subtitle="Speak incoming assistant replies"
          leading="speaker"
          trailing={
            <Switch
              value={settings.voiceReplies}
              onValueChange={(val) => void updateSettings({ voiceReplies: val })}
              trackColor={{ true: colors.teal }}
            />
          }
        />

        {settings.voiceReplies && (
          <>
            <ListRow
              title="Voice Language"
              subtitle={language.label}
              leading="book"
              trailing={<Icon name="chevron" size={16} color={colors.muted} />}
              onPress={() => setLangPickerOpen(true)}
            />

            <ListRow
              title="Speaking Voice"
              subtitle={selected?.label ?? 'Automatic'}
              leading="profile"
              trailing={<Icon name="chevron" size={16} color={colors.muted} />}
              onPress={() => setVoicePickerOpen(true)}
            />

            <Touchable onPress={togglePreview} disabled={!supported || loading} style={styles.actionRow}>
              <Icon name={previewing ? 'stop' : 'speaker'} size={17} color={colors.teal} />
              <AppText tone="teal" weight="600">{previewing ? 'Stop Speaking' : 'Preview Voice'}</AppText>
            </Touchable>

            <Touchable onPress={handleRefresh} disabled={loading} style={styles.actionRow}>
              {loading ? (
                <ActivityIndicator size="small" color={colors.inkSoft} />
              ) : (
                <Icon name="restore" size={17} color={colors.inkSoft} />
              )}
              <AppText tone="soft" weight="500">Refresh System Voices</AppText>
            </Touchable>
          </>
        )}
      </GroupedCard>
      <AppText variant="small" tone="soft" style={styles.footnote}>
        Uses your device&apos;s text-to-speech engine. Download additional voices in system settings.
      </AppText>

      {!supported && <Banner text="Speech output is unavailable on this platform." tone="info" />}
      {!!error && <Banner text={error} tone="error" />}

      {/* Language Picker Sheet */}
      <Modal visible={langPickerOpen} transparent animationType="slide" onRequestClose={() => setLangPickerOpen(false)}>
        <View style={styles.sheetBackdrop}>
          <Pressable style={StyleSheet.absoluteFill} onPress={() => setLangPickerOpen(false)} />
          <View style={[styles.sheetModal, { backgroundColor: colors.surface, paddingBottom: insets.bottom + space[3] }]}>
            <View style={[styles.sheetGrabber, { backgroundColor: colors.line }]} />
            <View style={styles.sheetHeader}>
              <AppText variant="sheetTitle">Voice Language</AppText>
              <Touchable onPress={() => setLangPickerOpen(false)} hitSlop={8}>
                <AppText variant="caption" tone="teal" weight="600">Done</AppText>
              </Touchable>
            </View>
            <ScrollView style={styles.pickerList}>
              {LANGUAGES.map((item) => {
                const isSelected = settings.voiceLanguage === item.value
                return (
                  <Touchable
                    key={item.value}
                    onPress={() => {
                      stopPreview()
                      void updateSettings({ voiceLanguage: item.value, voiceIdentifier: '' })
                      setLangPickerOpen(false)
                    }}
                    style={styles.pickerRow}
                  >
                    <AppText weight={isSelected ? '600' : '400'} tone={isSelected ? 'teal' : 'default'}>
                      {item.label}
                    </AppText>
                    {isSelected && <Icon name="check" size={18} color={colors.teal} />}
                  </Touchable>
                )
              })}
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Voice Picker Sheet */}
      <Modal visible={voicePickerOpen} transparent animationType="slide" onRequestClose={() => setVoicePickerOpen(false)}>
        <View style={styles.sheetBackdrop}>
          <Pressable style={StyleSheet.absoluteFill} onPress={() => setVoicePickerOpen(false)} />
          <View style={[styles.sheetModal, { backgroundColor: colors.surface, paddingBottom: insets.bottom + space[3] }]}>
            <View style={[styles.sheetGrabber, { backgroundColor: colors.line }]} />
            <View style={styles.sheetHeader}>
              <AppText variant="sheetTitle">Speaking Voice</AppText>
              <Touchable onPress={() => setVoicePickerOpen(false)} hitSlop={8}>
                <AppText variant="caption" tone="teal" weight="600">Done</AppText>
              </Touchable>
            </View>
            <ScrollView style={[styles.pickerList, { maxHeight: windowHeight * 0.5 }]}>
              <Touchable
                onPress={() => {
                  stopPreview()
                  void updateSettings({ voiceIdentifier: '' })
                  setVoicePickerOpen(false)
                }}
                style={styles.pickerRow}
              >
                <AppText weight={!settings.voiceIdentifier ? '600' : '400'} tone={!settings.voiceIdentifier ? 'teal' : 'default'}>
                  Automatic (Recommended)
                </AppText>
                {!settings.voiceIdentifier && <Icon name="check" size={18} color={colors.teal} />}
              </Touchable>
              {choices.map((item) => {
                const isSelected = settings.voiceIdentifier === item.voice.identifier
                return (
                  <Touchable
                    key={item.voice.identifier}
                    onPress={() => {
                      stopPreview()
                      void updateSettings({ voiceIdentifier: item.voice.identifier })
                      setVoicePickerOpen(false)
                    }}
                    style={styles.pickerRow}
                  >
                    <View style={styles.pickerBody}>
                      <AppText weight={isSelected ? '600' : '400'} tone={isSelected ? 'teal' : 'default'}>
                        {item.label}
                      </AppText>
                      <AppText variant="small" tone="soft">{item.voice.language}</AppText>
                    </View>
                    {isSelected && <Icon name="check" size={18} color={colors.teal} />}
                  </Touchable>
                )
              })}
            </ScrollView>
          </View>
        </View>
      </Modal>
    </View>
  )
}

const styles = StyleSheet.create({
  section: { marginTop: space[6] },
  footnote: { marginTop: space[2], marginHorizontal: space[4] },
  actionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: space[2],
    minHeight: 48,
  },
  sheetBackdrop: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0, 0, 0, 0.4)',
  },
  sheetModal: {
    borderTopLeftRadius: radius.group,
    borderTopRightRadius: radius.group,
    paddingHorizontal: space[4],
    paddingTop: space[2],
  },
  sheetGrabber: {
    width: 36,
    height: 5,
    borderRadius: 2.5,
    alignSelf: 'center',
    marginBottom: space[2],
  },
  sheetHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: space[2],
    marginBottom: space[1],
  },
  pickerList: {
    flexGrow: 0,
  },
  pickerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: space[3],
    minHeight: 48,
  },
  pickerBody: {
    flex: 1,
    marginRight: space[2],
  },
})
