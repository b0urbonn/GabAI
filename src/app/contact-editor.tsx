import { useLocalSearchParams } from 'expo-router'
import { useSQLiteContext } from 'expo-sqlite'
import { useEffect, useState } from 'react'
import { StyleSheet, TextInput, View } from 'react-native'

import { SelectField } from '@/components/SelectField'
import { AppText } from '@/components/ui/AppText'
import { Button } from '@/components/ui/Button'
import { GroupedCard } from '@/components/ui/GroupedCard'
import { BackButton, Banner, Note, PageHeader, TextButton } from '@/components/ui/Layout'
import { Screen } from '@/components/ui/Screen'
import {
  CONTACT_GROUPS,
  findBundledContact,
  groupFromScope,
  isEmergencyNumber,
  scopeFromGroup,
  type ContactGroup,
  type ContactScope,
} from '@/data/contacts'
import {
  addCustomContact,
  clearContactOverride,
  deleteCustomContact,
  getCustomContact,
  listContactOverrides,
  setContactOverride,
  updateCustomContact,
} from '@/db/contacts'
import { space, typeRamp } from '@/theme/tokens'
import { useTheme } from '@/theme/useTheme'
import { confirmAction } from '@/utils/dialogs'
import { goBack } from '@/utils/navigation'

type Mode = 'add' | 'custom' | 'builtin'

type Target =
  | { mode: 'custom'; id: number; group: ContactGroup; label: string; number: string }
  | { mode: 'builtin'; key: string; scope: ContactScope; label: string; number: string; defaultNumber: string; overridden: boolean }

const titles: Record<Mode, string> = { add: 'Add contact', custom: 'Edit contact', builtin: 'Correct number' }
const subtitles: Record<Mode, string> = {
  add: 'Save a number you may need to reach fast.',
  custom: 'Update the details or file it under another group.',
  builtin: 'Fix a listed number. The correction stays on this device.',
}

export default function ContactEditorScreen() {
  const params = useLocalSearchParams<{ mode?: string; id?: string; key?: string }>()
  const mode: Mode = params.mode === 'custom' || params.mode === 'builtin' ? params.mode : 'add'
  const db = useSQLiteContext()
  const { colors, scale } = useTheme()

  const [target, setTarget] = useState<Target | 'loading' | 'missing' | null>(mode === 'add' ? null : 'loading')
  const [group, setGroup] = useState<ContactGroup>('My contacts')
  const [label, setLabel] = useState('')
  const [number, setNumber] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (mode === 'add') return
    let active = true
    const load = async (): Promise<Target> => {
      if (mode === 'custom') {
        const id = Number(params.id)
        const contact = Number.isInteger(id) ? await getCustomContact(db, id) : null
        if (!contact) throw new Error('missing')
        return { mode: 'custom', id: contact.id, group: groupFromScope(contact.scope), label: contact.label, number: contact.number }
      }
      const key = params.key ?? ''
      const found = findBundledContact(key)
      if (!found) throw new Error('missing')
      const corrected = (await listContactOverrides(db))[key]
      return {
        mode: 'builtin',
        key,
        scope: found.scope,
        label: found.contact.label,
        number: corrected ?? found.contact.number,
        defaultNumber: found.contact.number,
        overridden: corrected != null,
      }
    }
    void load()
      .then((result) => {
        if (!active) return
        setTarget(result)
        setLabel(result.label)
        setNumber(result.number)
        if (result.mode === 'custom') setGroup(result.group)
      })
      .catch(() => { if (active) setTarget('missing') })
    return () => { active = false }
  }, [db, mode, params.id, params.key])

  const run = async (action: () => Promise<unknown>) => {
    setBusy(true)
    try {
      await action()
      goBack('/emergency')
    } catch {
      setError('Unable to save. Please try again.')
    } finally {
      setBusy(false)
    }
  }

  const save = () => {
    const trimmedLabel = label.trim()
    const trimmedNumber = number.trim()
    if (mode !== 'builtin' && trimmedLabel.length < 2) {
      setError('Give this contact a name (at least 2 letters).')
      return
    }
    if (!isEmergencyNumber(trimmedNumber)) {
      setError('Enter a valid phone number, e.g. 911 or 0917 123 4567.')
      return
    }
    setError('')
    if (mode === 'add') {
      void run(() => addCustomContact(db, { label: trimmedLabel, number: trimmedNumber, scope: scopeFromGroup(group) }))
    } else if (typeof target === 'object' && target?.mode === 'custom') {
      void run(() => updateCustomContact(db, target.id, { label: trimmedLabel, number: trimmedNumber, scope: scopeFromGroup(group) }))
    } else if (typeof target === 'object' && target?.mode === 'builtin') {
      // Saving the listed number unchanged removes the correction instead of storing a no-op.
      void run(() => (trimmedNumber === target.defaultNumber ? clearContactOverride(db, target.key) : setContactOverride(db, target.key, trimmedNumber)))
    }
  }

  const remove = async () => {
    if (typeof target !== 'object' || target?.mode !== 'custom') return
    const confirmed = await confirmAction({
      title: 'Delete this contact?',
      message: `${label.trim() || 'This contact'} will be removed from your list.`,
      confirmLabel: 'Delete',
      destructive: true,
    })
    if (confirmed) await run(() => deleteCustomContact(db, target.id))
  }

  const loaded = typeof target === 'object' && target !== null
  const readOnly = mode === 'builtin'
  const inputStyle = [styles.input, { color: colors.ink, fontSize: typeRamp.body.fontSize * scale }]

  return (
    <Screen topInset contentStyle={styles.content}>
      <BackButton label="Emergency contacts" />
      <PageHeader title={titles[mode]} subtitle={subtitles[mode]} />

      {target === 'missing' ? (
        <Banner text="This contact could not be found." tone="error" />
      ) : target === 'loading' ? null : (
        <>
          <GroupedCard>
            <View style={styles.field}>
              <AppText variant="small" weight="500" tone="soft">Group</AppText>
              {readOnly ? (
                <AppText style={styles.value}>{loaded && target.mode === 'builtin' ? groupFromScope(target.scope) : ''}</AppText>
              ) : (
                <SelectField
                  label="Group"
                  value={group}
                  placeholder="Choose a group"
                  options={CONTACT_GROUPS}
                  onChange={(value) => setGroup(value as ContactGroup)}
                  variant="plain"
                />
              )}
            </View>
            <View style={styles.field}>
              <AppText variant="small" weight="500" tone="soft">Name</AppText>
              {readOnly ? (
                <AppText style={styles.value}>{label}</AppText>
              ) : (
                <TextInput
                  value={label}
                  onChangeText={setLabel}
                  placeholder="e.g. Barangay hall, Auntie Nena"
                  placeholderTextColor={colors.inkSoft}
                  autoCapitalize="words"
                  autoComplete="off"
                  maxLength={60}
                  accessibilityLabel="Contact name"
                  style={inputStyle}
                />
              )}
            </View>
            <View style={styles.field}>
              <AppText variant="small" weight="500" tone="soft">Phone number</AppText>
              <TextInput
                value={number}
                onChangeText={setNumber}
                placeholder="e.g. 0917 123 4567"
                placeholderTextColor={colors.inkSoft}
                keyboardType="phone-pad"
                autoComplete="off"
                maxLength={24}
                accessibilityLabel="Phone number"
                style={inputStyle}
              />
            </View>
          </GroupedCard>

          {loaded && target.mode === 'builtin' ? (
            <AppText variant="small" tone="soft" style={styles.footnote}>Listed number: {target.defaultNumber}</AppText>
          ) : null}
          {error ? <Banner text={error} tone="error" /> : null}

          <View style={styles.actions}>
            {loaded && target.mode === 'custom' ? <Button label="Delete" variant="destructive" onPress={() => void remove()} disabled={busy} /> : null}
            <Button label={mode === 'add' ? 'Add contact' : 'Save'} onPress={save} loading={busy} />
          </View>
          {loaded && target.mode === 'builtin' && target.overridden ? (
            <View style={styles.center}>
              <TextButton label="Use listed number" onPress={() => void run(() => clearContactOverride(db, target.key))} />
            </View>
          ) : null}
          <Note icon="shield">Saved only on this device. Double-check the number before an emergency.</Note>
        </>
      )}
    </Screen>
  )
}

const styles = StyleSheet.create({
  content: { width: '100%', maxWidth: 640, alignSelf: 'center' },
  field: { gap: 2, paddingHorizontal: space[4], paddingVertical: 10 },
  value: { minHeight: 32, paddingVertical: 6 },
  input: { minHeight: 32, paddingVertical: 2 },
  footnote: { marginTop: space[2], marginHorizontal: space[4] },
  actions: { flexDirection: 'row', gap: space[3], marginTop: space[6] },
  center: { alignItems: 'center', marginTop: space[4] },
})
