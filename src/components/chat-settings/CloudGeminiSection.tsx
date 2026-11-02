import * as Linking from 'expo-linking'
import { useEffect, useMemo, useState } from 'react'
import {
  ActivityIndicator,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  useWindowDimensions,
  View,
} from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

import type { SettingsFeedback } from '@/components/chat-settings/LocalModelSection'
import { AppText } from '@/components/ui/AppText'
import { GroupedCard } from '@/components/ui/GroupedCard'
import { Icon } from '@/components/ui/Icon'
import { SettingsLabel } from '@/components/ui/Layout'
import { ListRow } from '@/components/ui/ListRow'
import { SegmentedControl } from '@/components/ui/SegmentedControl'
import { Touchable } from '@/components/ui/Touchable'
import { GEMINI_MODELS, getModelInfo } from '@/data/ai'
import { useSettings } from '@/providers/SettingsProvider'
import { GeminiError, testGeminiKey } from '@/services/gemini'
import { clearModelCache, fetchAvailableModels, modelLabel, resolveModel } from '@/services/geminiModels'
import { deleteGeminiKey, getGeminiKey, setGeminiKey } from '@/storage/secrets'
import type { ReplyLength } from '@/db/settings'
import { radius, space } from '@/theme/tokens'
import { useTheme } from '@/theme/useTheme'
import { confirmAction } from '@/utils/dialogs'

const REPLY_LENGTHS: { value: ReplyLength; label: string }[] = [
  { value: 'short', label: 'Short' },
  { value: 'detailed', label: 'Detailed' },
]

export function CloudGeminiSection({
  onFeedback,
}: {
  onFeedback: (feedback: SettingsFeedback) => void
}) {
  const { settings, updateSettings } = useSettings()
  const { colors } = useTheme()
  const insets = useSafeAreaInsets()
  const [apiKey, setApiKey] = useState('')
  const [editingKey, setEditingKey] = useState(false)
  const [savedKey, setSavedKey] = useState('')
  const [modelPickerOpen, setModelPickerOpen] = useState(false)
  const [busy, setBusy] = useState(false)
  const [available, setAvailable] = useState<string[] | null>(null)
  const { height: windowHeight } = useWindowDimensions()

  const selectedModelLabel = settings.geminiModel === 'auto'
    ? 'Automatic'
    : modelLabel(settings.geminiModel)

  const pickerModels = useMemo(() => {
    if (available === null) {
      return GEMINI_MODELS.map((option) => ({ id: option.id, label: option.label, detail: option.detail, unavailable: false }))
    }
    return available.map((id) => {
      const info = getModelInfo(id)
      return { id, label: info?.label ?? modelLabel(id), detail: info?.detail ?? 'Available on your key', unavailable: false }
    })
  }, [available])

  useEffect(() => {
    getGeminiKey().then((key) => setSavedKey(key ?? '')).catch(() => setSavedKey(''))
  }, [])

  useEffect(() => {
    if (!savedKey) return
    let cancelled = false
    fetchAvailableModels(savedKey).then((models) => {
      if (!cancelled) setAvailable(models)
    })
    return () => { cancelled = true }
  }, [savedKey])

  const saveKey = async () => {
    onFeedback(null)
    const trimmed = apiKey.trim()
    if (!trimmed) {
      onFeedback({ text: 'Paste your API key first.', error: true })
      return
    }
    setBusy(true)
    try {
      await setGeminiKey(trimmed)
      clearModelCache()
      setSavedKey(trimmed)
      setAvailable(null)
      setApiKey('')
      setEditingKey(false)
      onFeedback({ text: 'API key saved.' })
    } catch {
      onFeedback({ text: 'Unable to save API key.', error: true })
    } finally {
      setBusy(false)
    }
  }

  const removeKey = async () => {
    onFeedback(null)
    const confirmed = await confirmAction({
      title: 'Remove API key?',
      message: 'Cloud AI will be unavailable until a key is added.',
      confirmLabel: 'Remove',
      destructive: true,
    })
    if (!confirmed) return
    setBusy(true)
    try {
      await deleteGeminiKey()
      setSavedKey('')
      setAvailable(null)
    } catch {
      onFeedback({ text: 'Unable to remove API key.', error: true })
    } finally {
      setBusy(false)
    }
  }

  const testConnection = async () => {
    onFeedback(null)
    if (!savedKey) return
    setBusy(true)
    try {
      const resolved = await resolveModel(savedKey, settings.geminiModel)
      await testGeminiKey(savedKey, resolved.model)
      onFeedback({ text: `Connected to Gemini (${resolved.model}).` })
    } catch (error) {
      onFeedback({ text: error instanceof GeminiError ? error.message : 'Unable to reach Gemini.', error: true })
    } finally {
      setBusy(false)
    }
  }

  return (
    <View style={styles.section}>
      <SettingsLabel>API CREDENTIALS</SettingsLabel>
      <GroupedCard>
        {savedKey && !editingKey ? (
          <>
            <ListRow
              title="Gemini API Key"
              subtitle={`•••• ${savedKey.slice(-4)} · Stored on device`}
              leading="cloud"
              trailing={
                <View style={[styles.pillBadge, { backgroundColor: colors.tealSoft }]}>
                  <View style={[styles.statusDot, { backgroundColor: colors.teal }]} />
                  <AppText variant="caption" tone="teal" weight="600">Saved</AppText>
                </View>
              }
            />
            <Touchable onPress={testConnection} disabled={busy} style={styles.actionRow}>
              {busy ? (
                <ActivityIndicator size="small" color={colors.teal} />
              ) : (
                <Icon name="sparkles" size={17} color={colors.teal} />
              )}
              <AppText tone="teal" weight="600">Test Connection</AppText>
            </Touchable>
            <View style={styles.actionSplit}>
              <Touchable onPress={() => setEditingKey(true)} disabled={busy} style={styles.actionCell}>
                <AppText tone="teal" weight="500">Change Key</AppText>
              </Touchable>
              <View style={[styles.actionDivider, { backgroundColor: colors.line }]} />
              <Touchable onPress={removeKey} disabled={busy} style={styles.actionCell}>
                <AppText tone="danger" weight="500">Remove</AppText>
              </Touchable>
            </View>
          </>
        ) : (
          <>
            <View style={styles.inputRow}>
              <Icon name="cloud" size={18} color={colors.inkSoft} />
              <TextInput
                value={apiKey}
                onChangeText={setApiKey}
                placeholder="Paste Gemini API key"
                placeholderTextColor={colors.inkSoft}
                secureTextEntry
                autoCapitalize="none"
                autoCorrect={false}
                style={[styles.input, { color: colors.ink }]}
                accessibilityLabel="Gemini API key"
              />
              {apiKey.length > 0 && (
                <Touchable onPress={() => setApiKey('')} hitSlop={8}>
                  <Icon name="close" size={16} color={colors.inkSoft} />
                </Touchable>
              )}
            </View>
            <View style={styles.actionSplit}>
              <Touchable onPress={saveKey} disabled={!apiKey.trim() || busy} style={styles.actionCell}>
                {busy ? (
                  <ActivityIndicator size="small" color={colors.teal} />
                ) : (
                  <AppText tone={!apiKey.trim() ? 'soft' : 'teal'} weight="600">Save Key</AppText>
                )}
              </Touchable>
              {savedKey ? (
                <>
                  <View style={[styles.actionDivider, { backgroundColor: colors.line }]} />
                  <Touchable onPress={() => { setEditingKey(false); setApiKey('') }} disabled={busy} style={styles.actionCell}>
                    <AppText tone="soft" weight="500">Cancel</AppText>
                  </Touchable>
                </>
              ) : null}
            </View>
          </>
        )}
      </GroupedCard>

      <View style={styles.footerLinkRow}>
        <Touchable onPress={() => Linking.openURL('https://aistudio.google.com/apikey')} hitSlop={8} style={styles.linkButton}>
          <AppText variant="small" tone="teal" weight="500">Get an API key from Google AI Studio</AppText>
          <Icon name="chevron" size={14} color={colors.teal} />
        </Touchable>
      </View>

      <View style={styles.subSection}>
        <SettingsLabel>MODEL</SettingsLabel>
        <GroupedCard>
          <ListRow
            title="Gemini Model"
            subtitle={selectedModelLabel}
            leading="sparkles"
            trailing={<Icon name="chevron" size={16} color={colors.muted} />}
            onPress={() => setModelPickerOpen(true)}
          />
        </GroupedCard>
        <AppText variant="small" tone="soft" style={styles.footnote}>
          Automatic selects the fastest available model and handles rate limits.
        </AppText>
      </View>

      <View style={styles.subSection}>
        <SettingsLabel>PREFERENCES</SettingsLabel>
        <GroupedCard>
          <View style={styles.preferenceBlock}>
            <View style={styles.preferenceHeader}>
              <AppText weight="500">Reply length</AppText>
              <AppText variant="caption" tone="soft">
                {settings.localReplyLength === 'short' ? 'Short (~120 words)' : 'Detailed (up to 10 steps)'}
              </AppText>
            </View>
            <SegmentedControl
              label="Reply length"
              options={REPLY_LENGTHS}
              value={settings.localReplyLength}
              onChange={(localReplyLength) => void updateSettings({ localReplyLength })}
            />
          </View>
        </GroupedCard>
      </View>

      <Modal visible={modelPickerOpen} transparent animationType="slide" onRequestClose={() => setModelPickerOpen(false)}>
        <View style={styles.sheetBackdrop}>
          <Pressable style={StyleSheet.absoluteFill} onPress={() => setModelPickerOpen(false)} />
          <View style={[styles.sheetModal, { backgroundColor: colors.surface, paddingBottom: insets.bottom + space[3] }]}>
            <View style={[styles.sheetGrabber, { backgroundColor: colors.line }]} />
            <View style={styles.sheetHeader}>
              <AppText variant="sheetTitle">Select Model</AppText>
              <Touchable onPress={() => setModelPickerOpen(false)} hitSlop={8}>
                <AppText variant="caption" tone="teal" weight="600">Done</AppText>
              </Touchable>
            </View>
            <ScrollView style={[styles.modelList, { maxHeight: windowHeight * 0.5 }]} keyboardShouldPersistTaps="handled">
              <Touchable
                onPress={() => { void updateSettings({ geminiModel: 'auto' }); setModelPickerOpen(false) }}
                accessibilityRole="radio"
                accessibilityState={{ selected: settings.geminiModel === 'auto' }}
                style={styles.modelRow}
              >
                <View style={styles.modelBody}>
                  <AppText weight={settings.geminiModel === 'auto' ? '600' : '500'}>Automatic</AppText>
                  <AppText variant="small" tone="soft">Recommended · Dynamically routes requests</AppText>
                </View>
                {settings.geminiModel === 'auto' && <Icon name="check" size={18} color={colors.teal} />}
              </Touchable>

              {pickerModels.map((option) => {
                const selected = settings.geminiModel === option.id
                return (
                  <Touchable
                    key={option.id}
                    onPress={() => { void updateSettings({ geminiModel: option.id }); setModelPickerOpen(false) }}
                    accessibilityRole="radio"
                    accessibilityState={{ selected, disabled: option.unavailable }}
                    disabled={option.unavailable}
                    style={[styles.modelRow, option.unavailable && styles.modelUnavailable]}
                  >
                    <View style={styles.modelBody}>
                      <AppText weight={selected ? '600' : '500'} tone={option.unavailable ? 'soft' : 'default'}>{option.label}</AppText>
                      <AppText variant="small" tone="soft">{option.detail}</AppText>
                    </View>
                    {selected && <Icon name="check" size={18} color={colors.teal} />}
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
  subSection: { marginTop: space[6] },
  footnote: { marginTop: space[2], marginHorizontal: space[4] },
  pillBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: radius.pill,
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  actionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: space[2],
    minHeight: 48,
  },
  actionSplit: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 48,
  },
  actionCell: {
    flex: 1,
    height: 48,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionDivider: {
    width: StyleSheet.hairlineWidth,
    height: 24,
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space[3],
    paddingHorizontal: space[4],
    minHeight: 52,
  },
  input: {
    flex: 1,
    fontSize: 16,
    paddingVertical: 10,
  },
  footerLinkRow: {
    marginTop: space[2],
    marginHorizontal: space[4],
  },
  linkButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    minHeight: 32,
  },
  preferenceBlock: {
    paddingHorizontal: space[4],
    paddingVertical: space[3],
    gap: space[2],
  },
  preferenceHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
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
  modelList: {
    flexGrow: 0,
  },
  modelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: space[3],
    minHeight: 52,
  },
  modelBody: {
    flex: 1,
    marginRight: space[2],
  },
  modelUnavailable: {
    opacity: 0.4,
  },
})
