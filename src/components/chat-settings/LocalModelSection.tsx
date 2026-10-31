import { useState } from 'react'
import { ActivityIndicator, Platform, StyleSheet, View } from 'react-native'

import { AppText } from '@/components/ui/AppText'
import { GroupedCard } from '@/components/ui/GroupedCard'
import { Icon } from '@/components/ui/Icon'
import { SettingsLabel } from '@/components/ui/Layout'
import { ListRow } from '@/components/ui/ListRow'
import { Touchable } from '@/components/ui/Touchable'
import type { LocalBackend, ReplyLength } from '@/db/settings'
import { useSettings } from '@/providers/SettingsProvider'
import {
  getDeviceSpecs,
  localAiCapability,
  OFFLINE_AI_MIN_FREE_GB,
  OFFLINE_AI_RECOMMENDED_RAM_GB,
} from '@/services/deviceSpecs'
import { LOCAL_MODEL, useLocalModel } from '@/services/localModel'
import { radius, space } from '@/theme/tokens'
import { useTheme } from '@/theme/useTheme'
import { confirmAction } from '@/utils/dialogs'

export type SettingsFeedback = { text: string; error?: boolean } | null

const REPLY_LENGTHS: { value: ReplyLength; label: string }[] = [
  { value: 'short', label: 'Short' },
  { value: 'detailed', label: 'Detailed' },
]

const BACKENDS: { value: LocalBackend; label: string }[] = [
  { value: 'auto', label: 'Auto' },
  { value: 'npu', label: 'NPU' },
  { value: 'gpu', label: 'GPU' },
  { value: 'cpu', label: 'CPU' },
]

const gb = (value: number) => `${(value / 1_000_000_000).toFixed(1)} GB`
const duration = (seconds: number | null) => {
  if (!seconds) return ''
  if (seconds < 60) return ` · ~${seconds}s left`
  return ` · ~${Math.ceil(seconds / 60)}m left`
}

export function LocalModelSection({ onFeedback }: { onFeedback: (feedback: SettingsFeedback) => void }) {
  const { settings, updateSettings } = useSettings()
  const { colors } = useTheme()
  const model = useLocalModel()
  const [busy, setBusy] = useState(false)
  const [deviceOpen, setDeviceOpen] = useState(false)
  const [specs] = useState(getDeviceSpecs)
  const capability = localAiCapability(specs)

  const run = async (action: () => Promise<void>, success?: string) => {
    onFeedback(null)
    setBusy(true)
    try {
      await action()
      if (success) onFeedback({ text: success })
    } catch (error) {
      onFeedback({ text: error instanceof Error ? error.message : 'Unable to update local model.', error: true })
    } finally {
      setBusy(false)
    }
  }

  const download = async () => {
    const confirmed = await confirmAction({
      title: 'Download Gemma 4 E2B?',
      message: `The model is ${gb(LOCAL_MODEL.bytes)}. Connect to Wi-Fi and keep GabAI open during download.`,
      confirmLabel: 'Download',
    })
    if (!confirmed) return
    await run(model.download)
  }

  const resume = () => run(model.resume)

  const deleteModel = async () => {
    const confirmed = await confirmAction({
      title: 'Delete local model?',
      message: 'GabAI will answer from built-in safety guides until downloaded again.',
      confirmLabel: 'Delete',
      destructive: true,
    })
    if (confirmed) await run(model.remove)
  }

  const load = () => run(() => model.load(settings.localBackend), 'Local AI is ready.')
  const status = model.status === 'unsupported'
    ? model.progress >= 1 ? 'downloaded' : model.progress > 0 ? 'paused' : 'missing'
    : model.status

  return (
    <View style={styles.section}>
      <SettingsLabel>OFFLINE MODEL</SettingsLabel>
      <GroupedCard>
        <ListRow
          title={LOCAL_MODEL.name}
          subtitle={status === 'ready' ? `Active in memory (${model.backend?.toUpperCase() ?? 'Auto'})` : `${gb(LOCAL_MODEL.bytes)} · On-device`}
          leading="phone"
          trailing={
            status === 'ready' ? (
              <View style={[styles.pillBadge, { backgroundColor: colors.tealSoft }]}>
                <View style={[styles.statusDot, { backgroundColor: colors.teal }]} />
                <AppText variant="caption" tone="teal" weight="600">Ready</AppText>
              </View>
            ) : status === 'downloaded' ? (
              <View style={[styles.pillBadge, { backgroundColor: colors.line }]}>
                <AppText variant="caption" tone="soft" weight="500">Downloaded</AppText>
              </View>
            ) : status === 'downloading' ? (
              <View style={[styles.pillBadge, { backgroundColor: colors.tealSoft }]}>
                <AppText variant="caption" tone="teal" weight="600">{Math.round(model.progress * 100)}%</AppText>
              </View>
            ) : status === 'paused' ? (
              <View style={[styles.pillBadge, { backgroundColor: colors.line }]}>
                <AppText variant="caption" tone="soft" weight="500">Paused</AppText>
              </View>
            ) : status === 'loading' ? (
              <ActivityIndicator size="small" color={colors.teal} />
            ) : (
              <AppText variant="caption" tone="soft">Not installed</AppText>
            )
          }
        />

        {(model.status === 'downloading' || model.status === 'paused') && (
          <View style={styles.progressRow}>
            <View style={[styles.progressBar, { backgroundColor: colors.line }]} accessibilityRole="progressbar" accessibilityValue={{ min: 0, max: 100, now: Math.round(model.progress * 100) }}>
              <View style={[styles.progressFill, { backgroundColor: colors.teal, width: `${Math.max(2, Math.round(model.progress * 100))}%` }]} />
            </View>
            <AppText variant="small" tone="soft">
              {status === 'paused' ? 'Paused' : `${Math.round(model.progress * 100)}%`}
              {model.downloadedBytes ? ` (${gb(model.downloadedBytes)} of ${gb(model.totalBytes)})` : ''}
              {duration(model.etaSeconds)}
            </AppText>
          </View>
        )}

        {status === 'missing' && (
          <Touchable
            onPress={() => void download()}
            disabled={Platform.OS === 'web' || busy}
            style={styles.actionRow}
          >
            <Icon name="download" size={17} color={Platform.OS === 'web' ? colors.inkSoft : colors.teal} />
            <AppText tone={Platform.OS === 'web' ? 'soft' : 'teal'} weight="600">
              {Platform.OS === 'web' ? 'Open mobile app to download' : `Download Model (${gb(LOCAL_MODEL.bytes)})`}
            </AppText>
          </Touchable>
        )}

        {model.status === 'downloading' && (
          <View style={styles.actionSplit}>
            <Touchable onPress={() => void run(model.pause)} style={styles.actionCell}>
              <AppText tone="teal" weight="600">Pause</AppText>
            </Touchable>
            <View style={[styles.actionDivider, { backgroundColor: colors.line }]} />
            <Touchable onPress={() => void run(model.cancel)} style={styles.actionCell}>
              <AppText tone="danger" weight="600">Cancel</AppText>
            </Touchable>
          </View>
        )}

        {status === 'paused' && (
          <View style={styles.actionSplit}>
            <Touchable onPress={() => void resume()} style={styles.actionCell}>
              <AppText tone="teal" weight="600">Resume</AppText>
            </Touchable>
            <View style={[styles.actionDivider, { backgroundColor: colors.line }]} />
            <Touchable onPress={() => void run(model.cancel)} style={styles.actionCell}>
              <AppText tone="danger" weight="600">Cancel</AppText>
            </Touchable>
          </View>
        )}

        {status === 'downloaded' && (
          <Touchable
            onPress={() => void load()}
            disabled={!model.engineAvailable || busy}
            style={styles.actionRow}
          >
            {busy ? (
              <ActivityIndicator size="small" color={colors.teal} />
            ) : (
              <Icon name="sparkles" size={17} color={model.engineAvailable ? colors.teal : colors.inkSoft} />
            )}
            <AppText tone={model.engineAvailable ? 'teal' : 'soft'} weight="600">
              {model.engineAvailable ? 'Load into Memory' : 'Development build required'}
            </AppText>
          </Touchable>
        )}

        {model.status === 'ready' && (
          <Touchable onPress={() => void run(model.unload)} disabled={busy} style={styles.actionRow}>
            {busy ? <ActivityIndicator size="small" color={colors.inkSoft} /> : <Icon name="stop" size={17} color={colors.inkSoft} />}
            <AppText tone="soft" weight="500">Unload from Memory</AppText>
          </Touchable>
        )}

        {(status === 'downloaded' || status === 'ready') && (
          <Touchable onPress={() => void deleteModel()} disabled={busy} style={styles.actionRow}>
            <Icon name="trash" size={17} color={colors.danger} />
            <AppText tone="danger" weight="500">Delete Model</AppText>
          </Touchable>
        )}
      </GroupedCard>
      <AppText variant="small" tone="soft" style={styles.footnote}>
        Offline replies stay entirely on your device.
      </AppText>

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
            <View
              style={[styles.segmentedTrack, { backgroundColor: colors.line }]}
              accessibilityRole="radiogroup"
              accessibilityLabel="Reply length"
            >
              {REPLY_LENGTHS.map((opt) => {
                const selected = settings.localReplyLength === opt.value
                return (
                  <Touchable
                    key={opt.value}
                    onPress={() => void updateSettings({ localReplyLength: opt.value })}
                    pressedScale={0.98}
                    accessibilityRole="radio"
                    accessibilityState={{ selected }}
                    style={[
                      styles.segmentTab,
                      selected && [styles.segmentTabActive, { backgroundColor: colors.surface }],
                    ]}
                  >
                    <AppText
                      variant="small"
                      tone={selected ? 'default' : 'soft'}
                      weight={selected ? '600' : '500'}
                    >
                      {opt.label}
                    </AppText>
                  </Touchable>
                )
              })}
            </View>
          </View>

          <View style={styles.preferenceBlock}>
            <View style={styles.preferenceHeader}>
              <AppText weight="500">Compute backend</AppText>
              <AppText variant="caption" tone="soft">{settings.localBackend.toUpperCase()}</AppText>
            </View>
            <View
              style={[styles.segmentedTrack, { backgroundColor: colors.line }]}
              accessibilityRole="radiogroup"
              accessibilityLabel="Compute backend"
            >
              {BACKENDS.map((opt) => {
                const selected = settings.localBackend === opt.value
                return (
                  <Touchable
                    key={opt.value}
                    onPress={() => void updateSettings({ localBackend: opt.value })}
                    pressedScale={0.98}
                    accessibilityRole="radio"
                    accessibilityState={{ selected }}
                    style={[
                      styles.segmentTab,
                      selected && [styles.segmentTabActive, { backgroundColor: colors.surface }],
                    ]}
                  >
                    <AppText
                      variant="small"
                      tone={selected ? 'default' : 'soft'}
                      weight={selected ? '600' : '500'}
                    >
                      {opt.label}
                    </AppText>
                  </Touchable>
                )
              })}
            </View>
          </View>
        </GroupedCard>
      </View>

      <View style={styles.subSection}>
        <SettingsLabel>DEVICE COMPATIBILITY</SettingsLabel>
        <GroupedCard>
          <ListRow
            title={specs.device ?? 'This Device'}
            subtitle={`${specs.memoryGb !== null ? `${specs.memoryGb} GB RAM` : 'RAM unknown'} · ${specs.freeGb !== null ? `${specs.freeGb} GB free` : 'Storage unknown'}`}
            leading="system"
            trailing={
              <View style={styles.trailingCluster}>
                <View style={[styles.pillBadge, { backgroundColor: capability.level === 'insufficient' ? colors.dangerSoft : colors.tealSoft }]}>
                  <AppText variant="caption" tone={capability.level === 'insufficient' ? 'danger' : 'teal'} weight="600">
                    {capability.level === 'ready' ? 'Optimal' : capability.level === 'insufficient' ? 'Low RAM' : 'Compatible'}
                  </AppText>
                </View>
                <Icon name={deviceOpen ? 'chevronDown' : 'chevron'} size={16} color={colors.muted} />
              </View>
            }
            onPress={() => setDeviceOpen(!deviceOpen)}
          />
          {deviceOpen && (
            <>
              <ListRow title="Operating System" subtitle={specs.os} leading="shield" />
              {specs.cpu ? <ListRow title="Processor" subtitle={specs.cpu} leading="chart" /> : null}
              <ListRow
                title="Memory requirement"
                subtitle={`${specs.memoryGb !== null ? `${specs.memoryGb} GB RAM` : 'Unknown'} (${OFFLINE_AI_RECOMMENDED_RAM_GB} GB+ recommended)`}
                leading="sparkles"
              />
              <ListRow
                title="Storage requirement"
                subtitle={`${specs.freeGb !== null ? `${specs.freeGb} GB free` : 'Unknown'} (${OFFLINE_AI_MIN_FREE_GB} GB required)`}
                leading="download"
              />
            </>
          )}
        </GroupedCard>
      </View>
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
  progressRow: {
    paddingHorizontal: space[4],
    paddingVertical: space[3],
    gap: space[2],
  },
  progressBar: {
    height: 4,
    borderRadius: 2,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: 2,
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
  segmentedTrack: {
    flexDirection: 'row',
    borderRadius: radius.sm,
    padding: 3,
    gap: 3,
  },
  segmentTab: {
    flex: 1,
    height: 34,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.sm - 2,
  },
  segmentTabActive: {
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowRadius: 2,
    shadowOffset: { width: 0, height: 1 },
    elevation: 1,
  },
  trailingCluster: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space[2],
  },
})
