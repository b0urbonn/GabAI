import * as Haptics from 'expo-haptics'
import { router, useFocusEffect } from 'expo-router'
import { useSQLiteContext } from 'expo-sqlite'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Alert, FlatList, Image, KeyboardAvoidingView, Platform, ScrollView, StyleSheet, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

import { ChatInput } from '@/components/chat/ChatInput'
import { ContextRing } from '@/components/chat/ContextRing'
import { MessageBubble } from '@/components/chat/MessageBubble'
import { AppText } from '@/components/ui/AppText'
import { Icon } from '@/components/ui/Icon'
import { Touchable } from '@/components/ui/Touchable'
import { MUNICIPALITIES, type ProfileInfo } from '@/data/profile'
import { addMessage, clearMessages, listMessages, updateMessage, type ChatMessage } from '@/db/chat'
import { getProfile } from '@/db/profile'
import { recordTokenUsage } from '@/db/tokenUsage'
import { useSettings } from '@/providers/SettingsProvider'
import { generateReply, type AssistantContext } from '@/services/assistant'
import { attachmentFromStored, captureAttachment, takeStagedAttachment, AttachmentError, type Attachment, type AttachmentSource } from '@/services/attachment'
import { audioAttachmentFromStored } from '@/services/audioAttachment'
import { releaseLocalConversation, useLocalModel } from '@/services/localModel'
import { MAX_RECORDING_MS, useVoiceRecorder, type VoiceAttachment } from '@/services/voiceRecorder'
import { speak, stopSpeaking, voiceOutputAvailable } from '@/services/voice'
import { deleteAudioFile } from '@/storage/audio'
import { deletePhotoFile } from '@/storage/photos'
import { getGeminiKey } from '@/storage/secrets'
import { radius, space, touchTarget } from '@/theme/tokens'
import { useTheme } from '@/theme/useTheme'
import { confirmAction } from '@/utils/dialogs'

const morionImage = require('../../../assets/Untitled design.webp')

const SUGGESTIONS = [
  { icon: 'shield' as const, label: 'What to do in an emergency', prompt: 'I am in an emergency situation right now and I do not know what to do next. Guide me step by step.' },
  { icon: 'storm' as const, label: 'Typhoon and strong winds', prompt: 'A strong typhoon is hitting right now. How do I stay safe and what is next?' },
  { icon: 'flood' as const, label: 'Rising floodwater', prompt: 'Floodwater is entering or rising fast. What should I do right now and what is next?' },
  { icon: 'quake' as const, label: 'Earthquake safety steps', prompt: 'An earthquake just hit. What should I do right now and what comes next?' },
  { icon: 'bleeding' as const, label: 'First aid for injuries', prompt: 'Someone is injured and bleeding. What should I do right now to help them?' },
  { icon: 'phone' as const, label: 'Find emergency hotlines', prompt: 'Who do I call in an emergency in my municipality?' },
]

const QUICK_ACTIONS = [
  { label: 'What to do now', prompt: 'What should I do right now? I am in an emergency.' },
  { label: "What's next?", prompt: 'What is the next step I should take?' },
  { label: 'What to avoid', prompt: 'What critical hazards should I avoid right now?' },
  { label: 'Who to call', prompt: 'Who should I call for emergency rescue right now?' },
  { label: 'Is it safe?', prompt: 'Is it safe to go outside or return home now?' },
]

async function loadAssistantContext(db: ReturnType<typeof useSQLiteContext>): Promise<AssistantContext | undefined> {
  const profile = await getProfile(db).catch((): ProfileInfo => ({}))
  const municipality = MUNICIPALITIES.find((item) => item === profile.municipality)
  return municipality || profile.contactPhone
    ? {
        municipality,
        barangay: municipality ? profile.barangay || undefined : undefined,
        emergencyContact: profile.contactPhone
          ? { name: profile.contactName || 'Emergency contact', phone: profile.contactPhone, relationship: profile.relationship || undefined }
          : undefined,
      }
    : undefined
}

const dotColor = (mode: string, state: string, ready: boolean) => {
  if (mode === 'local') return ready ? 'ready' : state === 'loading' || state === 'downloading' ? 'busy' : 'setup'
  return ready ? 'ready' : 'setup'
}

export default function ChatScreen() {
  const db = useSQLiteContext()
  const { settings, updateSettings } = useSettings()
  const { colors } = useTheme()
  const insets = useSafeAreaInsets()
  const generation = useRef<AbortController | null>(null)
  const recorder = useVoiceRecorder()
  const { start: startRecorder, stop: stopRecorder, cancel: cancelRecorder } = recorder
  const recorderRef = useRef(recorder)
  const recordingTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const localModel = useLocalModel()
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [draft, setDraft] = useState('')
  const [attachment, setAttachment] = useState<Attachment | null>(null)
  const [audio, setAudio] = useState<VoiceAttachment | null>(null)
  const [thinking, setThinking] = useState(false)
  const [notice, setNotice] = useState('')
  const [speakingId, setSpeakingId] = useState<number | null>(null)
  const [reportedContext, setReportedContext] = useState<{ mode: string; usedTokens: number; maxTokens: number } | null>(null)
  const [lastModel, setLastModel] = useState('')
  const [keyReady, setKeyReady] = useState(false)
  const speakerAvailable = useMemo(() => voiceOutputAvailable(), [])

  useEffect(() => {
    recorderRef.current = recorder
  }, [recorder])

  useEffect(() => {
    listMessages(db).then(async (loaded) => {
      const recovered = await Promise.all(loaded.map(async (message) => {
        if (message.status !== 'pending') return message
        const error = 'Generation was interrupted. Tap Try again to get a reply.'
        await updateMessage(db, message.id, { status: 'error', error })
        return { ...message, status: 'error' as const, error }
      }))
      setMessages(recovered)
    }).catch(() => setMessages([]))
  }, [db])

  useFocusEffect(useCallback(() => {
    if (settings.aiMode !== 'cloud') return undefined
    let cancelled = false
    void getGeminiKey().then((key) => { if (!cancelled) setKeyReady(Boolean(key)) }).catch(() => { if (!cancelled) setKeyReady(false) })
    return () => { cancelled = true }
  }, [settings.aiMode]))

  useFocusEffect(useCallback(() => {
    const staged = takeStagedAttachment()
    if (staged) setAttachment(staged)
    return () => {
      stopSpeaking()
      setSpeakingId(null)
      if (recordingTimer.current) clearTimeout(recordingTimer.current)
      if (recorderRef.current.recording) void recorderRef.current.cancel()
    }
  }, [setAttachment]))

  const finishRecording = useCallback(async () => {
    if (recordingTimer.current) clearTimeout(recordingTimer.current)
    recordingTimer.current = null
    try {
      const result = await stopRecorder()
      if (result) {
        setAudio(result)
        void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {})
      }
    } catch (error) {
      setNotice(error instanceof Error ? error.message : 'Unable to save this recording.')
    }
  }, [stopRecorder, setAudio])

  const startRecording = useCallback(async () => {
    setNotice('')
    try {
      await startRecorder()
      void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {})
      recordingTimer.current = setTimeout(() => { void finishRecording() }, MAX_RECORDING_MS)
    } catch (error) {
      setNotice(error instanceof Error ? error.message : 'Unable to start voice recording.')
    }
  }, [startRecorder, finishRecording])

  const cancelRecording = useCallback(() => {
    if (recordingTimer.current) clearTimeout(recordingTimer.current)
    recordingTimer.current = null
    void cancelRecorder()
  }, [cancelRecorder])

  const attach = async (source: AttachmentSource) => {
    setNotice('')
    try {
      const picked = await captureAttachment(source)
      if (picked) setAttachment(picked)
    } catch (error) {
      setNotice(error instanceof AttachmentError ? error.message : 'Unable to use that photo.')
    }
  }

  const pickAttachment = () => {
    if (Platform.OS === 'web') {
      void attach('library')
      return
    }
    Alert.alert('Attach a photo', undefined, [
      { text: 'Take a photo', onPress: () => void attach('camera') },
      { text: 'Choose from library', onPress: () => void attach('library') },
      { text: 'Cancel', style: 'cancel' },
    ])
  }

  const speechFailed = (message?: string) => setNotice(message ?? 'Voice playback is unavailable. Enable a text-to-speech engine in your phone settings, then try again.')

  const toggleSpeak = (item: ChatMessage) => {
    if (speakingId === item.id) {
      setSpeakingId(null)
      stopSpeaking()
      return
    }
    setSpeakingId(item.id)
    speak(item.body, settings.voiceLanguage, () => setSpeakingId((current) => current === item.id ? null : current), speechFailed, settings.voiceIdentifier)
  }

  const runGeneration = async (
    assistant: ChatMessage,
    question: string,
    history: ChatMessage[],
    controller: AbortController,
    photo?: Attachment,
    voice?: VoiceAttachment,
    context?: AssistantContext,
  ) => {
    generation.current = controller
    let body = ''
    let streamTimer: ReturnType<typeof setTimeout> | undefined
    let lastPersistAt = 0
    let persistQueue = Promise.resolve()
    const persist = (force = false) => {
      const now = Date.now()
      if (!force && now - lastPersistAt < 500) return persistQueue
      lastPersistAt = now
      persistQueue = persistQueue.then(() => updateMessage(db, assistant.id, { body })).catch(() => {})
      return persistQueue
    }
    const flush = () => {
      streamTimer = undefined
      setMessages((current) => current.map((item) => item.id === assistant.id ? { ...item, body } : item))
      void persist()
    }
    try {
      if (controller.signal.aborted) throw new Error('Generation stopped before it started.')
      const reply = await generateReply(
        question,
        history.filter((item) => item.status === 'done'),
        settings,
        {
          image: photo && { mimeType: photo.mimeType, data: photo.base64 },
          imageUri: photo?.uri,
          audio: voice && { mimeType: voice.mimeType, data: voice.base64 },
          audioUri: voice?.uri,
        },
        context,
        {
          signal: controller.signal,
          conversationId: 'main',
          onContext: (usage) => setReportedContext({ mode: settings.aiMode, ...usage }),
          onReset: () => {
            body = ''
            if (streamTimer) clearTimeout(streamTimer)
            streamTimer = undefined
            setMessages((current) => current.map((item) => item.id === assistant.id ? { ...item, body: '' } : item))
            void updateMessage(db, assistant.id, { body: '' })
          },
          onToken: (token) => {
            body += token
            if (!streamTimer) streamTimer = setTimeout(flush, 50)
          },
        },
      )
      if (streamTimer) clearTimeout(streamTimer)
      streamTimer = undefined
      if (reply.text && reply.text.length !== body.length && !controller.signal.aborted) body = reply.text
      await persist(true)
      await persistQueue
      await updateMessage(db, assistant.id, { body, status: 'done', error: null })
      setMessages((current) => current.map((item) => item.id === assistant.id ? { ...item, body, status: 'done', error: undefined } : item))
      setNotice(reply.notice ?? '')
      if (reply.model) setLastModel(reply.model)
      if (reply.context) setReportedContext({ mode: settings.aiMode, ...reply.context })
      if (settings.aiMode === 'cloud' && reply.model && settings.geminiModel !== 'auto' && reply.model !== settings.geminiModel) {
        void updateSettings({ geminiModel: reply.model })
      }
      if (reply.usage) await recordTokenUsage(db, reply.usage.source, reply.usage).catch(() => {})
      if (!controller.signal.aborted && settings.voiceReplies && speakerAvailable && body) {
        setSpeakingId(assistant.id)
        speak(body, settings.voiceLanguage, () => setSpeakingId((current) => current === assistant.id ? null : current), speechFailed, settings.voiceIdentifier)
      }
    } catch (error) {
      if (streamTimer) clearTimeout(streamTimer)
      await persist(true)
      await persistQueue
      const message = error instanceof Error ? error.message : 'Generation failed. Please try again.'
      await updateMessage(db, assistant.id, { body, status: 'error', error: message }).catch(() => {})
      setMessages((current) => current.map((item) => item.id === assistant.id ? { ...item, body, status: 'error', error: message } : item))
    } finally {
      generation.current = null
      setThinking(false)
    }
  }

  const send = async (explicitText?: string) => {
    const text = (explicitText !== undefined ? explicitText : draft).trim()
    const photo = attachment ?? undefined
    const voice = audio ?? undefined
    if ((!text && !photo && !voice) || thinking) return
    const controller = new AbortController()
    generation.current = controller
    if (explicitText === undefined) setDraft('')
    setAttachment(null)
    setAudio(null)
    setNotice('')
    setThinking(true)
    let savedUserMessage: ChatMessage | undefined
    let assistantMessage: ChatMessage | undefined
    try {
      const body = text
      savedUserMessage = await addMessage(db, 'user', body, photo && { fileName: photo.fileName, mimeType: photo.mimeType }, 'done', voice && { fileName: voice.fileName, mimeType: voice.mimeType, durationMs: voice.durationMs })
      assistantMessage = await addMessage(db, 'assistant', '', undefined, 'pending')
      setMessages((current) => [...current, savedUserMessage!, assistantMessage!])
      const context = await loadAssistantContext(db)
      await runGeneration(assistantMessage, text, messages, controller, photo, voice, context)
    } catch (error) {
      if (assistantMessage) {
        const message = error instanceof Error ? error.message : 'Something went wrong sending that. Please try again.'
        await updateMessage(db, assistantMessage.id, { status: 'error', error: message }).catch(() => {})
        setMessages((current) => current.map((item) => item.id === assistantMessage!.id ? { ...item, status: 'error', error: message } : item))
      } else {
        if (!savedUserMessage && explicitText === undefined) setDraft(text)
        setNotice(error instanceof Error ? error.message : 'Something went wrong sending that. Please try again.')
      }
    } finally {
      if (generation.current === controller) generation.current = null
      setThinking(false)
    }
  }

  const retry = async (item: ChatMessage) => {
    if (thinking || item.status !== 'error') return
    const failedIndex = messages.findIndex((message) => message.id === item.id)
    let userIndex = -1
    for (let index = failedIndex - 1; index >= 0; index--) {
      if (messages[index].role === 'user') { userIndex = index; break }
    }
    if (failedIndex < 0 || userIndex < 0) return
    const userMessage = messages[userIndex]
    const controller = new AbortController()
    generation.current = controller
    setThinking(true)
    setNotice('')
    let photo: Attachment | undefined
    let voice: VoiceAttachment | undefined
    try {
      if (userMessage.photo) photo = await attachmentFromStored(userMessage.photo.fileName, userMessage.photo.mimeType, userMessage.photo.uri)
      if (userMessage.audio) voice = await audioAttachmentFromStored(userMessage.audio)
      if (controller.signal.aborted) return
      const context = await loadAssistantContext(db)
      const prior = messages.slice(0, userIndex).filter((message) => message.status === 'done')
      await updateMessage(db, item.id, { body: '', status: 'pending', error: null })
      setMessages((current) => current.map((message) => message.id === item.id ? { ...message, body: '', status: 'pending', error: undefined } : message))
      const question = (photo || voice) && (userMessage.body === 'Shared a photo for analysis.' || userMessage.body === 'Shared a voice message.') ? '' : userMessage.body
      await releaseLocalConversation('main')
      await runGeneration(item, question, prior, controller, photo, voice, context)
    } catch (error) {
      setNotice(error instanceof Error ? error.message : 'Unable to retry this reply.')
    } finally {
      if (generation.current === controller) generation.current = null
      setThinking(false)
    }
  }

  const stopGeneration = () => generation.current?.abort()

  const deleteChat = async () => {
    if (thinking || messages.length === 0) return
    const confirmed = await confirmAction({ title: 'Delete this chat?', message: 'All messages and attachments in this conversation will be removed. This cannot be undone.', confirmLabel: 'Delete', destructive: true })
    if (!confirmed) return
    for (const message of messages) {
      if (message.photo) deletePhotoFile(message.photo.fileName)
      if (message.audio) deleteAudioFile(message.audio.fileName)
    }
    await clearMessages(db)
    await releaseLocalConversation('main')
    setMessages([])
    setReportedContext(null)
    setNotice('')
  }

  const contextEstimate = Math.ceil((settings.nickname.length + messages.reduce((total, message) => total + message.body.length, 0) + draft.length) / 4)
  const context = reportedContext?.mode === settings.aiMode
    ? { usedTokens: reportedContext.usedTokens, maxTokens: reportedContext.maxTokens, estimated: false }
    : { usedTokens: contextEstimate, maxTokens: settings.aiMode === 'local' ? 4096 : undefined, estimated: true }

  const isReady = settings.aiMode === 'local'
    ? localModel.engineAvailable && (localModel.status === 'downloaded' || localModel.status === 'ready')
    : keyReady
  const status = dotColor(settings.aiMode, localModel.status, isReady)
  const statusText = settings.aiMode === 'local'
    ? !localModel.engineAvailable ? 'Local AI unavailable in this build' : localModel.status === 'ready' ? `Local AI · ${localModel.backend?.toUpperCase() ?? 'Ready'}` : localModel.status === 'downloaded' ? 'Local AI · ready to load' : localModel.status === 'downloading' ? `Downloading Gemma · ${Math.round(localModel.progress * 100)}%` : localModel.status === 'loading' ? 'Loading local model…' : localModel.status === 'unsupported' ? 'Local AI unavailable in this build' : 'Local AI · model setup needed'
    : isReady ? `Gemini · ${lastModel || 'Cloud'}` : 'Gemini · setup needed'
  const statusColor = status === 'ready' ? colors.teal : status === 'busy' ? colors.weatherAccent : colors.danger
  const setupMessage = settings.aiMode === 'local'
    ? !localModel.engineAvailable ? Platform.OS === 'web' ? 'Local AI is unavailable in this web preview. Switch to Cloud AI or ask from the built-in guides.' : 'Install the updated GabAI development build to enable Local AI. You can still use Cloud AI or the built-in guides.' : localModel.status === 'missing' ? 'Download Gemma 4 E2B in Chat settings to use the full offline model.' : null
    : keyReady ? null : 'Add a Gemini API key in Chat settings to use cloud replies. GabAI can still answer from its built-in guides.'

  return (
    <KeyboardAvoidingView style={[styles.fill, { paddingBottom: insets.bottom }]} behavior={Platform.OS === 'web' ? undefined : 'padding'}>
      <View style={[styles.topBar, { paddingTop: insets.top, borderBottomColor: colors.line }]}>
        <Touchable onPress={() => router.navigate('/')} accessibilityLabel="Back to Home" style={styles.topAction}>
          <Icon name="arrowLeft" size={21} color={colors.ink} />
        </Touchable>
        <View style={[styles.headerAvatarContainer, { backgroundColor: colors.tealSoft }]}>
          <Image source={morionImage} style={styles.headerAvatar} resizeMode="cover" />
        </View>
        <View style={styles.headerText}>
          <AppText variant="bodyStrong">AI Chat</AppText>
          <View style={styles.statusRow}>
            <View style={[styles.statusDot, { backgroundColor: statusColor }]} />
            <AppText variant="small" tone="soft" numberOfLines={1}>{statusText}</AppText>
          </View>
        </View>
        <ContextRing usedTokens={context.usedTokens} maxTokens={context.maxTokens} estimated={context.estimated} />
        <Touchable onPress={() => void deleteChat()} disabled={thinking || messages.length === 0} accessibilityLabel="Clear chat" style={styles.topAction}><Icon name="trash" size={19} color={messages.length ? colors.danger : colors.inkSoft} /></Touchable>
        <Touchable onPress={() => router.push('/chat-settings')} accessibilityLabel="Chat settings" style={styles.topAction}><Icon name="settings" size={19} color={colors.ink} /></Touchable>
      </View>

      {setupMessage ? (
        <Touchable onPress={() => router.push('/chat-settings')} style={[styles.setupBanner, { backgroundColor: colors.tealSoft }]} accessibilityLabel="Open AI settings">
          <AppText variant="small" tone="teal" style={styles.setupText}>{setupMessage}</AppText>
          <Icon name="chevron" size={18} color={colors.teal} />
        </Touchable>
      ) : null}
      {notice ? <AppText variant="small" tone="soft" align="center" style={styles.notice}>{notice}</AppText> : null}
      {messages.length === 0 ? (
        <ScrollView
          style={styles.fill}
          contentContainerStyle={styles.empty}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode={Platform.OS === 'ios' ? 'interactive' : 'on-drag'}
          showsVerticalScrollIndicator={false}
        >
          <View style={[styles.emptyMascotWrapper, { backgroundColor: colors.tealSoft }]}>
            <Image source={morionImage} style={styles.emptyMascot} resizeMode="contain" />
          </View>
          <AppText variant="pageTitle" align="center" style={styles.emptyTitle}>Hi {settings.nickname || 'there'}, how can I help?</AppText>
          <AppText variant="caption" tone="soft" align="center">Ask about first aid, disasters, or Marinduque emergency contacts.</AppText>
          <View style={styles.suggestions}>
            {SUGGESTIONS.map((suggestion) => (
              <Touchable key={suggestion.label} onPress={() => setDraft(suggestion.prompt)} style={[styles.suggestion, { backgroundColor: colors.tealSoft, borderColor: colors.tealSoft }]}>
                <Icon name={suggestion.icon} size={18} color={colors.teal} />
                <AppText variant="small" style={styles.suggestionText}>{suggestion.label}</AppText>
              </Touchable>
            ))}
          </View>
        </ScrollView>
      ) : (
        <FlatList
          style={styles.fill}
          data={[...messages].reverse()}
          inverted
          keyExtractor={(item) => String(item.id)}
          contentContainerStyle={styles.list}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode={Platform.OS === 'ios' ? 'interactive' : 'on-drag'}
          renderItem={({ item }) => (
            <MessageBubble
              item={item}
              onRetry={item.role === 'assistant' && item.status === 'error' ? () => void retry(item) : undefined}
              onSpeak={item.role === 'assistant' && item.status === 'done' && speakerAvailable ? () => toggleSpeak(item) : undefined}
              speaking={speakingId === item.id}
            />
          )}
        />
      )}
      <View style={[styles.quickActionsBar, { backgroundColor: colors.background, borderTopColor: colors.line }]}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.quickActionsContent}>
          {QUICK_ACTIONS.map((action) => (
            <Touchable
              key={action.label}
              onPress={() => void send(action.prompt)}
              disabled={thinking}
              style={[styles.quickActionChip, { backgroundColor: colors.surface, borderColor: colors.line }]}
              accessibilityRole="button"
              accessibilityLabel={action.prompt}
            >
              <AppText variant="small" weight="600">{action.label}</AppText>
            </Touchable>
          ))}
        </ScrollView>
      </View>
      <ChatInput
        value={draft}
        onChange={setDraft}
        onSend={() => void send()}
        onStop={stopGeneration}
        disabled={false}
        generating={thinking}
        imageUri={attachment?.uri}
        onPickImage={pickAttachment}
        onRemoveImage={() => {
          if (attachment) deletePhotoFile(attachment.fileName)
          setAttachment(null)
        }}
        audio={audio}
        onRemoveAudio={() => {
          if (audio) deleteAudioFile(audio.fileName)
          setAudio(null)
        }}
        recording={recorder.recording}
        recordingMs={recorder.durationMs}
        onStartRecording={() => void startRecording()}
        onStopRecording={() => void finishRecording()}
        onCancelRecording={cancelRecording}
      />
    </KeyboardAvoidingView>
  )
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  topBar: { minHeight: 62, flexDirection: 'row', alignItems: 'center', gap: space[1], paddingHorizontal: space[2], paddingBottom: space[1], borderBottomWidth: StyleSheet.hairlineWidth },
  headerText: { flex: 1, minWidth: 0 },
  headerAvatarContainer: { width: 34, height: 34, borderRadius: 17, overflow: 'hidden', alignItems: 'center', justifyContent: 'center', marginHorizontal: space[1] },
  headerAvatar: { width: 34, height: 34 },
  statusRow: { flexDirection: 'row', alignItems: 'center', gap: space[1] },
  statusDot: { width: 7, height: 7, borderRadius: 4 },
  topAction: { width: touchTarget, height: touchTarget, alignItems: 'center', justifyContent: 'center', borderRadius: radius.md },
  list: { flexGrow: 1, paddingHorizontal: space[4], paddingVertical: space[3] },
  empty: { flexGrow: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: space[4], paddingVertical: space[4] },
  emptyMascotWrapper: { width: 110, height: 110, borderRadius: 55, alignItems: 'center', justifyContent: 'center', marginBottom: space[4], overflow: 'hidden' },
  emptyMascot: { width: 95, height: 105 },
  emptyTitle: { marginBottom: space[1] },
  suggestions: { width: '100%', maxWidth: 480, flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: space[2], marginTop: space[5] },
  suggestion: { minHeight: touchTarget, flexDirection: 'row', alignItems: 'center', gap: space[2], borderWidth: 1, borderRadius: radius.pill, paddingHorizontal: space[3], paddingVertical: space[2] },
  suggestionText: { flexShrink: 1 },
  notice: { paddingHorizontal: space[4], paddingTop: space[2] },
  setupBanner: { flexDirection: 'row', alignItems: 'center', gap: space[2], marginHorizontal: space[4], marginTop: space[2], padding: space[3], borderRadius: radius.md },
  setupText: { flex: 1 },
  quickActionsBar: { paddingVertical: space[1], borderTopWidth: StyleSheet.hairlineWidth },
  quickActionsContent: { gap: space[2], paddingHorizontal: space[3], alignItems: 'center' },
  quickActionChip: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: space[3], paddingVertical: 6, borderRadius: radius.pill, borderWidth: 1 },
})
