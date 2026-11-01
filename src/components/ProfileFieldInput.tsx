import { useRef, type ComponentRef } from 'react'
import { Pressable, StyleSheet, TextInput, View } from 'react-native'

import { DateField } from '@/components/DateField'
import { SelectField } from '@/components/SelectField'
import { AppText } from '@/components/ui/AppText'
import { BLOOD_TYPES, MUNICIPALITIES, PROFILE_VALUE_MAX_LENGTH, PROVINCES, REGIONS, type ProfileField } from '@/data/profile'
import { space, typeRamp } from '@/theme/tokens'
import { useTheme } from '@/theme/useTheme'

type ProfileFieldInputProps = {
  field: ProfileField
  value: string
  onChange: (value: string) => void
  options?: readonly string[]
  error?: string
}

const WORD_CAPITALIZED_KEYS = new Set(['name', 'contactName', 'relationship'])

const SELECT_OPTIONS: Record<string, readonly string[]> = {
  region: REGIONS,
  province: PROVINCES,
  municipality: MUNICIPALITIES,
  bloodType: BLOOD_TYPES,
}

/** iOS Inset Grouped editing cell: chromeless select sheet, date input, or text field. */
export function ProfileFieldInput({ field, value, onChange, options, error }: ProfileFieldInputProps) {
  const { colors, scale } = useTheme()
  const inputRef = useRef<ComponentRef<typeof TextInput>>(null)
  const labelTone = error ? 'danger' : 'soft'
  const isSelect = field.input === 'barangay' || (field.input != null && field.input in SELECT_OPTIONS)

  return (
    <View style={styles.row}>
      {isSelect ? (
        <AppText variant="small" weight="500" tone={labelTone}>{field.label}</AppText>
      ) : (
        <Pressable onPress={() => inputRef.current?.focus()} accessible={false}>
          <AppText variant="small" weight="500" tone={labelTone}>{field.label}</AppText>
        </Pressable>
      )}
      {field.input != null && field.input in SELECT_OPTIONS ? (
        <SelectField
          label={field.label}
          value={value}
          placeholder={field.placeholder ?? 'Choose'}
          options={SELECT_OPTIONS[field.input]}
          onChange={onChange}
          error={!!error}
          variant="plain"
          allowClear
        />
      ) : field.input === 'barangay' ? (
        <SelectField
          label={field.label}
          value={value}
          placeholder={field.placeholder ?? 'Choose'}
          options={options ?? []}
          onChange={onChange}
          disabled={!options?.length}
          disabledHint="Choose a city or municipality first"
          error={!!error}
          variant="plain"
          allowClear
        />
      ) : field.input === 'date' ? (
        <DateField label={field.label} value={value} onChange={onChange} error={!!error} variant="plain" inputRef={inputRef} />
      ) : (
        <TextInput
          ref={inputRef}
          value={value}
          onChangeText={onChange}
          placeholder={field.placeholder ?? 'Optional'}
          placeholderTextColor={colors.inkSoft}
          keyboardType={field.input === 'phone' ? 'phone-pad' : field.keyboardType}
          autoCapitalize={field.input === 'phone' ? 'none' : WORD_CAPITALIZED_KEYS.has(field.key) ? 'words' : 'sentences'}
          autoComplete="off"
          maxLength={PROFILE_VALUE_MAX_LENGTH}
          accessibilityLabel={field.label}
          style={[styles.input, { color: colors.ink, fontSize: typeRamp.body.fontSize * scale }]}
        />
      )}
      {error ? <AppText variant="small" tone="danger" accessibilityLiveRegion="polite" style={styles.error}>{error}</AppText> : null}
    </View>
  )
}

const styles = StyleSheet.create({
  row: { gap: 2, minHeight: 58, paddingHorizontal: space[4], paddingVertical: 10 },
  input: { minHeight: 32, paddingVertical: 2 },
  error: { marginTop: 2 },
})
