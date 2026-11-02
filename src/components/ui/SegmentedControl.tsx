import { StyleSheet, View } from 'react-native'

import { radius, space } from '@/theme/tokens'
import { useTheme } from '@/theme/useTheme'

import { AppText } from './AppText'
import { Icon, type IconName } from './Icon'
import { Touchable } from './Touchable'

export type SegmentedOption<T extends string> = {
  value: T
  label: string
  icon?: IconName
}

type SegmentedControlProps<T extends string> = {
  options: readonly SegmentedOption<T>[]
  value: T
  onChange: (value: T) => void
  /** Accessibility label for the radio group. */
  label: string
}

/** iOS-style segmented control: muted track, the selected segment lifts with a surface fill. */
export function SegmentedControl<T extends string>({ options, value, onChange, label }: SegmentedControlProps<T>) {
  const { colors } = useTheme()
  return (
    <View style={[styles.track, { backgroundColor: colors.line }]} accessibilityRole="radiogroup" accessibilityLabel={label}>
      {options.map((option) => {
        const selected = option.value === value
        return (
          <Touchable
            key={option.value}
            onPress={() => onChange(option.value)}
            pressedScale={0.98}
            accessibilityRole="radio"
            accessibilityState={{ selected }}
            accessibilityLabel={option.label}
            style={[styles.tab, selected && [styles.tabActive, { backgroundColor: colors.surface }]]}
          >
            {option.icon ? <Icon name={option.icon} size={16} color={selected ? colors.teal : colors.inkSoft} /> : null}
            <AppText variant="caption" tone={selected ? 'default' : 'soft'} weight={selected ? '600' : '500'} numberOfLines={1}>
              {option.label}
            </AppText>
          </Touchable>
        )
      })}
    </View>
  )
}

const styles = StyleSheet.create({
  track: { flexDirection: 'row', borderRadius: radius.md, padding: 3, gap: 3 },
  tab: { flex: 1, height: 36, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: space[2], borderRadius: radius.sm },
  tabActive: { shadowColor: '#000', shadowOpacity: 0.1, shadowRadius: 3, shadowOffset: { width: 0, height: 1 }, elevation: 1 },
})
