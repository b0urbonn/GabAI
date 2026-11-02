import * as Linking from 'expo-linking'
import { router, useFocusEffect } from 'expo-router'
import { useSQLiteContext } from 'expo-sqlite'
import { useCallback, useEffect, useState } from 'react'
import { ScrollView, StyleSheet, View } from 'react-native'

import { AppText } from '@/components/ui/AppText'
import { FadeIn } from '@/components/ui/FadeIn'
import { GroupedCard } from '@/components/ui/GroupedCard'
import { Icon } from '@/components/ui/Icon'
import { BackButton, Banner, Note, PageHeader, SectionHeader, TextButton } from '@/components/ui/Layout'
import { Screen } from '@/components/ui/Screen'
import { Touchable } from '@/components/ui/Touchable'
import { contactKey, DIRECTORY_SOURCE, getLocalContacts, nationalContacts, provincialContacts, toDialUri, type ContactScope, type EmergencyContact } from '@/data/contacts'
import { MUNICIPALITIES, type Municipality } from '@/data/profile'
import { getDirectoryStamp, listContactOverrides, listCustomContacts, listRemoteContacts, type ContactOverrideMap, type CustomContact, type RemoteContact } from '@/db/contacts'
import { getProfile } from '@/db/profile'
import { refreshDirectory } from '@/services/contactDirectory'
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

function ContactRow({ contact, tag, onEdit }: { contact: EmergencyContact; tag?: 'edited' | 'added'; onEdit?: () => void }) {
  const { colors } = useTheme()
  return (
    <View style={styles.row}>
      <Touchable
        onPress={() => call(contact)}
        accessibilityRole="link"
        accessibilityLabel={`Call ${contact.label}, ${contact.number}`}
        style={styles.rowBody}
      >
        <AppText weight="600">{contact.label}</AppText>
        <AppText variant="caption" tone="soft" style={styles.number}>{contact.number}{tag ? ` · ${tag}` : ''}</AppText>
      </Touchable>
      {onEdit ? (
        <Touchable onPress={onEdit} accessibilityLabel={`Edit ${contact.label}`} hitSlop={6} style={styles.editButton}>
          <Icon name="info" size={17} color={colors.muted} />
        </Touchable>
      ) : null}
      <Touchable onPress={() => call(contact)} accessibilityLabel={`Call ${contact.label}`} style={styles.callCircle}>
        <Icon name="phone" size={20} color={brand.onPrimary} />
      </Touchable>
    </View>
  )
}

/** Row shown inside the "My contacts" card when the user has not saved any number yet. */
function AddContactRow({ onPress }: { onPress: () => void }) {
  const { colors } = useTheme()
  return (
    <Touchable onPress={onPress} accessibilityLabel="Add a contact" style={styles.addRow}>
      <View style={[styles.addBadge, { backgroundColor: colors.tealSoft }]}>
        <Icon name="plus" size={18} color={colors.teal} />
      </View>
      <AppText tone="teal" weight="600">Add a contact</AppText>
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
  const { colors } = useTheme()
  const [lookup, setLookup] = useState<BarangayLookup | null>(null)
  const [saved, setSaved] = useState<Address | null>(null)
  const [filter, setFilter] = useState<Filter>(null)
  const [attempt, setAttempt] = useState(0)
  const [custom, setCustom] = useState<CustomContact[]>([])
  const [overrides, setOverrides] = useState<ContactOverrideMap>({})
  const [remote, setRemote] = useState<RemoteContact[]>([])
  const [stamp, setStamp] = useState(0)
  const [refreshing, setRefreshing] = useState(false)
  const [dirNotice, setDirNotice] = useState<{ text: string; tone: 'info' | 'error' } | null>(null)

  // Contacts, corrections, and fetched directory reload every time the editor pops back here.
  useFocusEffect(
    useCallback(() => {
      Promise.all([listCustomContacts(db), listContactOverrides(db), listRemoteContacts(db), getDirectoryStamp(db)])
        .then(([contacts, map, remoteContacts, directoryStamp]) => {
          setCustom(contacts)
          setOverrides(map)
          setRemote(remoteContacts)
          setStamp(directoryStamp)
        })
        .catch(() => {})
    }, [db]),
  )

  const refresh = async () => {
    setRefreshing(true)
    setDirNotice(null)
    const result = await refreshDirectory(db)
    if (result.status === 'updated') {
      setRemote(await listRemoteContacts(db))
      setStamp(await getDirectoryStamp(db))
      setDirNotice({ tone: 'info', text: `Updated — ${result.count} numbers from ${DIRECTORY_SOURCE.label}.` })
    } else if (result.status === 'unreachable') {
      setDirNotice({ tone: 'error', text: `Couldn't reach ${DIRECTORY_SOURCE.label} — using numbers saved on this device.` })
    } else {
      setDirNotice({ tone: 'error', text: 'The directory update looked wrong — using saved numbers.' })
    }
    setRefreshing(false)
  }

  // Precedence per hotline: the user's own correction, then the fetched directory, then bundled.
  const remoteNumber = new Map(remote.map((entry) => [contactKey(entry.scope, entry.label), entry.number]))

  /** A bundled row plus its corrected number, when the user or the directory has replaced it. */
  const resolved = (scope: ContactScope, contact: EmergencyContact) => {
    const key = contactKey(scope, contact.label)
    const corrected = overrides[key]
    return { key, number: corrected ?? remoteNumber.get(key) ?? contact.number, overridden: corrected != null }
  }

  /** Directory rows with no bundled counterpart — appended after the bundled list for a scope. */
  const remoteExtras = (scope: ContactScope, bundledLabels: Set<string>) =>
    remote.filter((entry) => entry.scope === scope && !bundledLabels.has(entry.label))

  const customRow = (contact: CustomContact) => (
    <ContactRow
      key={contact.id}
      contact={contact}
      tag="added"
      onEdit={() => router.push({ pathname: '/contact-editor', params: { mode: 'custom', id: String(contact.id) } })}
    />
  )

  const builtinRow = (scope: ContactScope, contact: EmergencyContact) => {
    const row = resolved(scope, contact)
    return (
      <ContactRow
        key={contact.label}
        contact={{ label: contact.label, number: row.number }}
        tag={row.overridden ? 'edited' : undefined}
        onEdit={() => router.push({ pathname: '/contact-editor', params: { mode: 'builtin', key: row.key } })}
      />
    )
  }

  const mine = custom.filter((contact) => contact.scope === 'mine')
  const scopedTo = (scope: ContactScope) => custom.filter((contact) => contact.scope === scope)

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

  const openAdd = () => router.push({ pathname: '/contact-editor', params: { mode: 'add' } })

  const remoteRow = (entry: RemoteContact) => <ContactRow key={`remote:${entry.scope}:${entry.label}`} contact={entry} />

  return (
    <Screen topInset contentStyle={styles.content}>
      <BackButton />
      <PageHeader
        title="Emergency contacts"
        subtitle="Choose a service to call. Cellular service is required."
        action={
          <Touchable onPress={openAdd} accessibilityLabel="Add emergency contact" style={[styles.plusButton, { backgroundColor: colors.tealSoft }]}>
            <Icon name="plus" size={20} color={colors.teal} />
          </Touchable>
        }
      />
      <FadeIn delay={60}>
      <View style={styles.list}>
        <SectionHeader title="My contacts" caption="Numbers you added — family, neighbors, your barangay hall." />
        <GroupedCard>
          {mine.length === 0 ? <AddContactRow onPress={openAdd} /> : mine.map(customRow)}
        </GroupedCard>

        <SectionHeader
          title="Local hotlines"
          caption={caption}
          actionLabel={lookup && !gps ? 'Retry' : undefined}
          onAction={lookup && !gps ? retry : undefined}
        />

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.filters}
          accessibilityRole="radiogroup"
          accessibilityLabel="Filter hotlines by municipality"
        >
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
        </ScrollView>

        {shown.map((municipality) => {
          const local = getLocalContacts(municipality, municipality === here?.municipality ? here.barangay : undefined)
          return (
            <View key={municipality} style={styles.group}>
              {activeFilter === 'all' ? <AppText variant="eyebrow" tone="soft" style={styles.groupTitle}>{municipality}</AppText> : null}
              <GroupedCard>
                {local.map((contact) => builtinRow(municipality, contact))}
                {remoteExtras(municipality, new Set(local.map((contact) => contact.label))).map(remoteRow)}
                {scopedTo(municipality).map(customRow)}
              </GroupedCard>
            </View>
          )
        })}

        {note ? <Note icon="pin">{note}</Note> : null}
        {lookup && !gps && !saved ? (
          <TextButton
            label="Save your barangay in Profile"
            onPress={() => router.push({ pathname: '/profile/[group]', params: { group: 'personal' } })}
          />
        ) : null}

        <SectionHeader title="Provincial" />
        <GroupedCard>
          {provincialContacts.map((contact) => builtinRow('Provincial', contact))}
          {remoteExtras('Provincial', new Set(provincialContacts.map((contact) => contact.label))).map(remoteRow)}
          {scopedTo('Provincial').map(customRow)}
        </GroupedCard>
        <SectionHeader title="National" />
        <GroupedCard>
          {nationalContacts.map((contact) => builtinRow('National', contact))}
          {remoteExtras('National', new Set(nationalContacts.map((contact) => contact.label))).map(remoteRow)}
          {scopedTo('National').map(customRow)}
        </GroupedCard>

        <View style={styles.directory}>
          <View style={styles.directoryInfo}>
            <AppText variant="small" weight="600">Hotline directory</AppText>
            <AppText variant="small" tone="soft" style={styles.directorySource}>
              Source: {DIRECTORY_SOURCE.label} · {stamp ? `updated ${formatStamp(stamp)}` : 'bundled with the app'}
            </AppText>
          </View>
          <Touchable onPress={() => void refresh()} disabled={refreshing} accessibilityLabel="Refresh hotline directory" style={styles.refreshButton}>
            <Icon name="restore" size={15} color={colors.teal} />
            <AppText variant="caption" tone="teal" weight="600">{refreshing ? 'Checking…' : 'Refresh'}</AppText>
          </Touchable>
        </View>
        {dirNotice ? <Banner text={dirNotice.text} tone={dirNotice.tone} /> : null}
      </View>
      </FadeIn>
    </Screen>
  )
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'] as const
const formatStamp = (stamp: number) => {
  const date = new Date(stamp)
  return `${MONTHS[date.getMonth()]} ${date.getDate()}, ${date.getFullYear()}`
}

const styles = StyleSheet.create({
  content: { width: '100%', maxWidth: 640, alignSelf: 'center' },
  list: { gap: space[3] },
  plusButton: { width: 40, height: 40, borderRadius: radius.pill, alignItems: 'center', justifyContent: 'center' },
  filters: { flexDirection: 'row', gap: space[2], paddingRight: space[5] },
  chip: { flexDirection: 'row', alignItems: 'center', gap: 5, borderWidth: 1, borderRadius: radius.pill, paddingHorizontal: space[3], paddingVertical: 6, minHeight: 36 },
  group: { gap: space[2] },
  groupTitle: { marginHorizontal: space[1] },
  row: { flexDirection: 'row', alignItems: 'center', paddingLeft: space[4], paddingRight: space[2], paddingVertical: space[2], gap: space[1] },
  rowBody: { flex: 1, minWidth: 0, paddingVertical: space[2] },
  number: { marginTop: 3 },
  editButton: { width: 36, height: 36, borderRadius: radius.sm, alignItems: 'center', justifyContent: 'center' },
  callCircle: { width: touchTarget, height: touchTarget, borderRadius: radius.md, alignItems: 'center', justifyContent: 'center', backgroundColor: brand.emergency },
  addRow: { flexDirection: 'row', alignItems: 'center', gap: space[3], paddingHorizontal: space[4], paddingVertical: space[3], minHeight: 64 },
  addBadge: { width: space[8], height: space[8], borderRadius: radius.sm, alignItems: 'center', justifyContent: 'center' },
  directory: { flexDirection: 'row', alignItems: 'center', gap: space[3], marginTop: space[3], paddingHorizontal: space[1] },
  directoryInfo: { flex: 1, minWidth: 0 },
  directorySource: { marginTop: 2 },
  refreshButton: { flexDirection: 'row', alignItems: 'center', gap: space[1], paddingVertical: space[2], paddingHorizontal: space[2] },
})
