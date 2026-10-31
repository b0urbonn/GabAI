import * as Linking from 'expo-linking'
import { router } from 'expo-router'
import { useSQLiteContext } from 'expo-sqlite'
import { useEffect, useState } from 'react'
import { StyleSheet, View } from 'react-native'

import { AppText } from '@/components/ui/AppText'
import { FadeIn } from '@/components/ui/FadeIn'
import { Icon } from '@/components/ui/Icon'
import { BackButton, Note, PageHeader, SectionHeader, TextButton } from '@/components/ui/Layout'
import { Screen } from '@/components/ui/Screen'
import { Touchable } from '@/components/ui/Touchable'
import { getLocalContacts, nationalContacts, provincialContacts, toDialUri, type EmergencyContact } from '@/data/contacts'
import { MUNICIPALITIES, type Municipality } from '@/data/profile'
import { getProfile } from '@/db/profile'
import { getCurrentBarangay, type BarangayLookup } from '@/services/location'
import { brand, radius, space, touchTarget } from '@/theme/tokens'
import { useTheme } from '@/theme/useTheme'
import { showAlert } from '@/utils/dialogs'

type Address = { municipality: Municipality; barangay?: string }
/** `null` means "follow whatever location detection found" — see `activeFilter`. */
type Filter = Municipality | 'all' | null

async function call(contact: EmergencyContact) {
  try {
    await Linking.openURL(toDialUri(contact.number))
  } catch {
    showAlert('Unable to place call', `Dial ${contact.number} manually from your phone app.`)
  }
}

/** Explains the exact reason GPS produced no barangay, so a failed lookup is actionable. */
function lookupNote(lookup: BarangayLookup): string | null {
  switch (lookup.status) {
    case 'ok':
      return null
    case 'denied':
      return 'Location access is off, so GabAI cannot tell which barangay you are in. Allow location access, or pick a municipality above.'
    case 'services-off':
      return 'Location services are turned off. Switch on GPS and tap Retry, or pick a municipality above.'
    case 'timeout':
      return 'Could not get a GPS fix in time. Move outdoors and tap Retry, or pick a municipality above.'
    case 'off-island':
      return `You are about ${Math.round(lookup.distanceKm)} km from Marinduque. Every municipality is listed above so you can still reach the right office.`
    case 'unavailable':
      return 'Location is unavailable on this device. Pick a municipality above to see its hotlines.'
  }
}

function ContactRow({ contact }: { contact: EmergencyContact }) {
  const { colors } = useTheme()
  return (
    <Touchable
      onPress={() => call(contact)}
      accessibilityRole="link"
      accessibilityLabel={`Call ${contact.label}, ${contact.number}`}
      style={[styles.row, { backgroundColor: colors.surface, borderColor: colors.line }]}
    >
      <View style={styles.flex}>
        <AppText weight="600">{contact.label}</AppText>
        <AppText variant="caption" tone="soft" style={styles.number}>{contact.number}</AppText>
      </View>
      <View style={styles.callCircle}><Icon name="phone" size={20} color={brand.onPrimary} /></View>
    </Touchable>
  )
}

function FilterChip({ label, active, detected, onPress }: { label: string; active: boolean; detected?: boolean; onPress: () => void }) {
  const { colors } = useTheme()
  return (
    <Touchable
      onPress={onPress}
      accessibilityRole="radio"
      accessibilityState={{ selected: active }}
      accessibilityLabel={detected ? `${label}, your current location` : label}
      style={[styles.chip, { backgroundColor: active ? brand.primary : colors.surface, borderColor: active ? brand.primary : colors.line }]}
    >
      {detected ? <Icon name="pin" size={13} color={active ? brand.onPrimary : colors.teal} /> : null}
      <AppText variant="caption" weight="600" style={active ? { color: brand.onPrimary } : undefined}>{label}</AppText>
    </Touchable>
  )
}

export default function EmergencyScreen() {
  const db = useSQLiteContext()
  const [lookup, setLookup] = useState<BarangayLookup | null>(null)
  const [saved, setSaved] = useState<Address | null>(null)
  const [filter, setFilter] = useState<Filter>(null)
  const [attempt, setAttempt] = useState(0)

  useEffect(() => {
    let active = true
    void getProfile(db).then((profile) => {
      const municipality = MUNICIPALITIES.find((m) => m === profile.municipality)
      if (active && municipality) setSaved({ municipality, barangay: profile.barangay || undefined })
    }).catch(() => {})
    return () => { active = false }
  }, [db])

  useEffect(() => {
    let active = true
    void getCurrentBarangay().then((result) => {
      if (active) setLookup(result)
    })
    return () => { active = false }
  }, [attempt])

  const retry = () => {
    setLookup(null)
    setFilter(null)
    setAttempt((n) => n + 1)
  }

  const gps = lookup?.status === 'ok' ? lookup.barangay : null
  const here: Address | null = gps ?? (lookup && !gps ? saved : null)
  // An untouched filter follows detection, so the default needs no effect to sync it.
  const activeFilter: Municipality | 'all' = filter ?? here?.municipality ?? 'all'
  const shown = activeFilter === 'all' ? MUNICIPALITIES : [activeFilter]
  const note = lookup && !gps ? lookupNote(lookup) : null

  const caption = !lookup
    ? 'Finding your location…'
    : gps
      ? `Based on your current location: Brgy. ${gps.barangay}, ${gps.municipality}`
      : here
        ? `Based on your saved address: ${here.barangay ? `Brgy. ${here.barangay}, ` : ''}${here.municipality}`
        : 'Showing every municipality. Pick one to narrow the list.'

  return (
    <Screen topInset>
      <BackButton />
      <PageHeader title="Emergency contacts" subtitle="Choose a service to call. Cellular service is required." />
      <FadeIn delay={60}>
      <View style={styles.list}>
        <SectionHeader
          title="Local hotlines"
          caption={caption}
          actionLabel={lookup && !gps ? 'Retry' : undefined}
          onAction={lookup && !gps ? retry : undefined}
        />

        <View style={styles.filters} accessibilityRole="radiogroup" accessibilityLabel="Filter hotlines by municipality">
          <FilterChip label="All" active={activeFilter === 'all'} onPress={() => setFilter('all')} />
          {MUNICIPALITIES.map((municipality) => (
            <FilterChip
              key={municipality}
              label={municipality}
              active={activeFilter === municipality}
              detected={municipality === here?.municipality}
              onPress={() => setFilter(municipality)}
            />
          ))}
        </View>

        {shown.map((municipality) => (
          <View key={municipality} style={styles.group}>
            {activeFilter === 'all' ? <AppText variant="eyebrow" tone="soft" style={styles.groupTitle}>{municipality}</AppText> : null}
            {getLocalContacts(municipality, municipality === here?.municipality ? here.barangay : undefined).map((contact) => (
              <ContactRow key={contact.label} contact={contact} />
            ))}
          </View>
        ))}

        {note ? <Note icon="pin">{note}</Note> : null}
        {lookup && !gps && !saved ? (
          <TextButton
            label="Save your barangay in Profile"
            onPress={() => router.push({ pathname: '/profile/[group]', params: { group: 'personal' } })}
          />
        ) : null}

        <SectionHeader title="Provincial" />
        {provincialContacts.map((contact) => <ContactRow key={contact.label} contact={contact} />)}
        <SectionHeader title="National" />
        {nationalContacts.map((contact) => <ContactRow key={contact.label} contact={contact} />)}
      </View>
      </FadeIn>
    </Screen>
  )
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  list: { gap: space[3] },
  filters: { flexDirection: 'row', flexWrap: 'wrap', gap: space[2] },
  chip: { flexDirection: 'row', alignItems: 'center', gap: 5, borderWidth: 1, borderRadius: radius.pill, paddingHorizontal: space[3], paddingVertical: 6, minHeight: 36 },
  group: { gap: space[3] },
  groupTitle: { marginHorizontal: space[1] },
  row: { flexDirection: 'row', alignItems: 'center', padding: space[3], paddingLeft: space[4], borderRadius: radius.group, borderWidth: 1 },
  number: { marginTop: 3 },
  callCircle: { width: touchTarget, height: touchTarget, borderRadius: radius.md, alignItems: 'center', justifyContent: 'center', backgroundColor: brand.emergency },
})
