import { Image, StyleSheet, View } from 'react-native'

import type { ChatMessage } from '@/db/chat'
import { AppText } from '@/components/ui/AppText'
import { Icon } from '@/components/ui/Icon'
import { Touchable } from '@/components/ui/Touchable'
import { brand, radius, space, touchTarget } from '@/theme/tokens'
import { useTheme } from '@/theme/useTheme'
import { AudioChip } from './AudioChip'
import { MarkdownText } from './MarkdownText'
import { ThinkingIndicator } from './ThinkingIndicator'

const morionImage = require('../../../assets/Untitled design.webp')

export function MessageBubble({ item, onRetry, onSpeak, speaking = false }: {
  item: ChatMessage
  onRetry?: () => void
  onSpeak?: () => void
  speaking?: boolean
}) {
  const { colors } = useTheme()
  const mine = item.role === 'user'

  return (
    <View style={[styles.row, mine ? styles.rowMine : styles.rowAssistant]}>
      {!mine ? (
        <View style={[styles.avatar, { backgroundColor: colors.tealSoft }]}>
          <Image source={morionImage} style={styles.avatarImage} resizeMode="cover" />
        </View>
      ) : null}
      <View style={[styles.column, mine && styles.mineColumn]}>
        <View style={[styles.bubble, mine ? styles.mineBubble : styles.assistantBubble, { backgroundColor: mine ? brand.primary : colors.surface, borderColor: item.status === 'error' ? colors.danger : colors.line, borderWidth: item.status === 'error' ? 1 : 0 }]}>
          {item.photo ? <Image source={{ uri: item.photo.uri }} style={[styles.image, (item.audio || item.body) && styles.mediaGap]} resizeMode="cover" accessibilityLabel="Attached photo" /> : null}
          {item.audio ? <View style={item.body ? styles.mediaGap : undefined}><AudioChip uri={item.audio.uri} durationMs={item.audio.durationMs} compact /></View> : null}
          {item.body ? mine ? <AppText style={{ color: brand.onPrimary }}>{item.body}</AppText> : <MarkdownText text={item.body} /> : null}
          {!mine && item.status === 'pending' && !item.body ? <ThinkingIndicator /> : null}
          {!mine && item.status === 'error' ? (
            <View style={styles.errorBlock}>
              <View style={styles.errorLine}><Icon name="wifiOff" size={15} color={colors.danger} /><AppText variant="small" tone="danger" style={styles.flex}>{item.error || 'The reply failed.'}</AppText></View>
              {onRetry ? <Touchable onPress={onRetry} accessibilityLabel="Retry failed reply" style={[styles.retry, { backgroundColor: colors.teal }]}><Icon name="restore" size={16} color={brand.onPrimary} /><AppText variant="small" tone="inverse" weight="600">Try again</AppText></Touchable> : null}
            </View>
          ) : null}
          {!mine && item.status === 'done' && onSpeak ? (
            <Touchable onPress={onSpeak} accessibilityLabel={speaking ? 'Stop reading reply' : 'Read reply aloud'} style={styles.speak}>
              <Icon name="speaker" size={16} color={speaking ? colors.teal : colors.inkSoft} />
              <AppText variant="eyebrow" tone="soft">{speaking ? 'Stop' : 'Listen'}</AppText>
            </Touchable>
          ) : null}
        </View>
        {item.status !== 'pending' ? <AppText variant="eyebrow" tone="soft" style={styles.time}>{new Date(item.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</AppText> : null}
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'flex-end', gap: space[2], marginVertical: space[1] },
  rowMine: { justifyContent: 'flex-end' },
  rowAssistant: { justifyContent: 'flex-start' },
  avatar: { width: 28, height: 28, borderRadius: 14, overflow: 'hidden', alignItems: 'center', justifyContent: 'center', marginRight: space[1] },
  avatarImage: { width: 28, height: 28 },
  column: { maxWidth: '82%' },
  mineColumn: { alignItems: 'flex-end' },
  bubble: { borderRadius: radius.group, paddingHorizontal: space[3], paddingVertical: space[3] },
  mineBubble: { borderBottomRightRadius: 5 },
  assistantBubble: { borderTopLeftRadius: 5 },
  image: { width: 200, height: 200, borderRadius: radius.md },
  mediaGap: { marginBottom: space[2] },
  errorBlock: { marginTop: space[2], gap: space[2] },
  errorLine: { flexDirection: 'row', alignItems: 'flex-start', gap: space[1] },
  flex: { flex: 1 },
  retry: { alignSelf: 'flex-start', minHeight: touchTarget - 4, borderRadius: radius.sm, paddingHorizontal: space[3], flexDirection: 'row', alignItems: 'center', gap: space[1] },
  speak: { alignSelf: 'flex-start', minHeight: touchTarget - 8, flexDirection: 'row', alignItems: 'center', gap: space[1], marginTop: space[1] },
  time: { marginTop: 3, marginHorizontal: space[1] },
})
