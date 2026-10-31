import type { ReactNode } from 'react'
import { StyleSheet, Text, View } from 'react-native'

import { AppText } from '@/components/ui/AppText'
import { radius, space } from '@/theme/tokens'
import { useTheme } from '@/theme/useTheme'

function inlineRuns(line: string): ReactNode[] {
  const pattern = /(`[^`]+`)|(\*\*[^*]+\*\*)|(\*[^*\n]+\*)|(_[^_\n]+_)/g
  const result: ReactNode[] = []
  let offset = 0
  let index = 0
  let match: RegExpExecArray | null
  while ((match = pattern.exec(line))) {
    if (match.index > offset) result.push(line.slice(offset, match.index))
    const value = match[0]
    const key = `${match.index}-${index++}`
    if (value.startsWith('`')) result.push(<Text key={key} style={{ fontFamily: 'monospace' }}>{value.slice(1, -1)}</Text>)
    else if (value.startsWith('**')) result.push(<Text key={key} style={{ fontWeight: '700' }}>{value.slice(2, -2)}</Text>)
    else result.push(<Text key={key} style={{ fontStyle: 'italic' }}>{value.slice(1, -1)}</Text>)
    offset = match.index + value.length
  }
  if (offset < line.length) result.push(line.slice(offset))
  return result
}

export function MarkdownText({ text }: { text: string }) {
  const { colors } = useTheme()
  const nodes: ReactNode[] = []
  let paragraph: string[] = []
  const flush = () => {
    if (!paragraph.length) return
    nodes.push(
      <AppText key={`p-${nodes.length}`}>
        {paragraph.map((line, index) => <Text key={index}>{index > 0 ? '\n' : ''}{inlineRuns(line)}</Text>)}
      </AppText>,
    )
    paragraph = []
  }

  text.split('```').forEach((chunk, chunkIndex) => {
    if (chunkIndex % 2 === 1) {
      flush()
      const newline = chunk.indexOf('\n')
      const content = newline < 0 ? chunk : chunk.slice(newline + 1)
      nodes.push(<View key={`code-${chunkIndex}`} style={[styles.code, { backgroundColor: colors.background }]}><AppText variant="small" style={styles.codeText}>{content}</AppText></View>)
      return
    }
    for (const line of chunk.split('\n')) {
      const heading = line.match(/^#{1,3}\s+(.*)/)
      const bullet = line.match(/^\s*[-*]\s+(.*)/)
      const numbered = line.match(/^\s*(\d+)\.\s+(.*)/)
      if (heading) {
        flush()
        nodes.push(<AppText key={`h-${nodes.length}`} variant="bodyStrong">{inlineRuns(heading[1])}</AppText>)
      } else if (bullet) {
        flush()
        nodes.push(<AppText key={`b-${nodes.length}`} style={styles.indent}>• {inlineRuns(bullet[1])}</AppText>)
      } else if (numbered) {
        flush()
        nodes.push(<AppText key={`n-${nodes.length}`} style={styles.indent}>{numbered[1]}. {inlineRuns(numbered[2])}</AppText>)
      } else if (!line.trim()) flush()
      else paragraph.push(line)
    }
  })
  flush()
  return <View style={styles.container}>{nodes}</View>
}

const styles = StyleSheet.create({
  container: { gap: space[2] },
  indent: { paddingLeft: space[2] },
  code: { borderRadius: radius.sm, padding: space[2] },
  codeText: { fontFamily: 'monospace' },
})
