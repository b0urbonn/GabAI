import { BARANGAYS } from './barangays'
import { MUNICIPALITIES, type Municipality } from './profile'

export type EmergencyContact = { label: string; number: string }

export const nationalContacts: EmergencyContact[] = [
  { label: 'National emergency (911)', number: '911' },
  { label: 'Philippine Red Cross', number: '143' },
]

export const provincialContacts: EmergencyContact[] = [
  { label: 'Marinduque PDRRMO', number: '(042) 332 1913' },
  { label: 'Coast Guard Station Marinduque', number: '0930 430 3182' },
  { label: 'Marinduque Provincial Government', number: '(042) 704 0144' },
]

/**
 * Municipal hotlines, compiled from public LGU / MDRRMO / BFP posts (Oct 2026); the
 * municipal hall landlines come from the DILG MIMAROPA LGU directory.
 * Draft: verify every number with each MDRRMO before release.
 */
export const municipalContacts: Record<Municipality, EmergencyContact[]> = {
  Boac: [
    { label: 'Boac MDRRMO 24/7 OpCen', number: '0960 585 8800' },
    { label: 'Boac Municipal Hall', number: '(042) 311 1378' },
  ],
  Buenavista: [
    { label: 'Buenavista MDRRMO', number: '0947 761 3187' },
    { label: 'Buenavista Fire Station', number: '(042) 704 0095' },
    { label: 'Buenavista Municipal Hall', number: '(042) 704 0062' },
  ],
  Gasan: [
    { label: 'Gasan Municipal Hall', number: '(042) 342 1074' },
    { label: 'Gasan Fire Station', number: '(042) 332 0477' },
    { label: 'Coast Guard Sub-Station Gasan', number: '0910 473 9932' },
  ],
  Mogpog: [
    { label: 'Mogpog MDRRMO', number: '0917 813 7880' },
    { label: 'Mogpog Municipal Hall', number: '(042) 332 1249' },
  ],
  'Santa Cruz': [
    { label: 'Santa Cruz MDRRMO', number: '0920 455 4034' },
    { label: 'Santa Cruz BFP', number: '0946 027 1055' },
    { label: 'Santa Cruz PNP', number: '0998 598 5806' },
  ],
  Torrijos: [
    { label: 'Torrijos Fire Station', number: '0999 102 8059' },
    { label: 'Torrijos Fire Station landline', number: '(042) 754 2817' },
  ],
}

/**
 * Barangay hall / BDRRMC hotlines keyed by municipality, then barangay name as listed in `BARANGAYS`.
 *
 * Intentionally empty: no public directory of Marinduque barangay hotlines exists (the few
 * published barangay contacts are Facebook pages, not phone lines). Never fill this in with
 * guessed or inferred numbers — a dead line dialled mid-emergency costs more than a missing row.
 * Only add entries confirmed directly with the barangay or its MDRRMO, and note the source here.
 */
export const barangayContacts: Partial<Record<Municipality, Record<string, EmergencyContact[]>>> = {}

export const getLocalContacts = (municipality: Municipality, barangay?: string): EmergencyContact[] => [
  ...(barangay ? barangayContacts[municipality]?.[barangay] ?? [] : []),
  ...municipalContacts[municipality],
]

export const toDialUri = (number: string) => `tel:${number.replace(/[^+\d]/g, '')}`

/** Which bundled list a hotline belongs to: the municipality name, or 'Provincial' / 'National'. */
export type ContactScope = Municipality | 'Provincial' | 'National'

/** Where a user-added contact is filed: 'mine' = the "My contacts" group, else a bundled group. */
export type CustomScope = ContactScope | 'mine'

/** Stable identity for a bundled hotline, used to store user-corrected numbers. */
export const contactKey = (scope: ContactScope, label: string) => `${scope}:${label}`

/** Group labels the contact editor offers, in display order. */
export const CONTACT_GROUPS = ['My contacts', ...MUNICIPALITIES, 'Provincial', 'National'] as const
export type ContactGroup = (typeof CONTACT_GROUPS)[number]

export const scopeFromGroup = (group: ContactGroup): CustomScope => (group === 'My contacts' ? 'mine' : group)
export const groupFromScope = (scope: CustomScope): ContactGroup => (scope === 'mine' ? 'My contacts' : scope)

export const isCustomScope = (value: unknown): value is CustomScope =>
  value === 'mine' || value === 'Provincial' || value === 'National' || (MUNICIPALITIES as readonly string[]).includes(value as string)

export const isContactScope = (value: unknown): value is ContactScope =>
  value === 'Provincial' || value === 'National' || (MUNICIPALITIES as readonly string[]).includes(value as string)

/**
 * Where the in-app "Refresh" pulls the latest hotline directory from: the JSON manifest
 * committed to this repository and served by GitHub's raw file host. Update
 * `data/hotlines.json` and the running apps pick it up without an app update.
 */
export const DIRECTORY_SOURCE = {
  label: 'github.com/TeSkiBoi/GabAI',
  url: 'https://raw.githubusercontent.com/TeSkiBoi/GabAI/main/data/hotlines.json',
} as const

/** Resolves a `contactKey` back to its bundled row, or null when no bundled contact matches. */
export function findBundledContact(key: string): { scope: ContactScope; contact: EmergencyContact } | null {
  const separator = key.indexOf(':')
  if (separator < 0) return null
  const scope = key.slice(0, separator)
  const label = key.slice(separator + 1)
  let list: EmergencyContact[] | undefined
  if (scope === 'Provincial') list = provincialContacts
  else if (scope === 'National') list = nationalContacts
  else if ((MUNICIPALITIES as readonly string[]).includes(scope)) {
    const municipality = scope as Municipality
    list = [...Object.values(barangayContacts[municipality] ?? {}).flat(), ...municipalContacts[municipality]]
  }
  const contact = list?.find((entry) => entry.label === label)
  return contact ? { scope: scope as ContactScope, contact } : null
}

/**
 * Loose check for hotline entry: 3–15 digits (911, 143, barangay lines qualify) plus
 * the usual phone punctuation. Deliberately looser than the profile phone validator.
 */
export const isEmergencyNumber = (value: string) => {
  const digits = value.replace(/\D/g, '')
  return digits.length >= 3 && digits.length <= 15 && /^[\d\s()+.-]+$/.test(value.trim())
}

/** What kind of office a question is asking for: `ask` matches the question, `label` matches hotline labels. */
const AGENCY_MATCHERS: { ask: RegExp; label: RegExp }[] = [
  { ask: /\b(fire|sunog|nasunog|bumbero|bfp)\b/i, label: /fire|bfp/i },
  { ask: /\b(police|pulis|pnp|nakaw|magnanakaw|ninakawan|krimen|crime|holdap)\b/i, label: /pnp|police/i },
  {
    ask: /\b(hospitals?|ospital|ambulans\w*|medical|medika|doktor|doctor|sakit|masakit|sugat|nasugatan|injur\w*|red cross|health)\b/i,
    label: /hospital|red cross|ambulance|health/i,
  },
  { ask: /\b(coast guard|dagat|bangka|ferry|pantalan|port|sea)\b/i, label: /coast guard/i },
  {
    ask: /\b(mdrrmo|pdrrmo|bdrrmc|rescue|saklolo|disaster|kalamidad|bagyo|typhoon|lindol|earthquake|baha|binaha|nabaha|flood\w*|landslide|guho|gumuho|evacuat\w*|bakwit|storm)\b/i,
    label: /mdrrmo|pdrrmo|bdrrmc|rrmc|rescue|emergency/i,
  },
  {
    ask: /\b(municipal hall|munisipyo|mayor|alkalde|lgu|barangay hall|kapitan|provincial|kapitolyo|capitol|gobyerno|government)\b/i,
    label: /municipal hall|provincial government|barangay hall/i,
  },
]

/**
 * "Brgy. X" mentions, matched to a municipality. A bare barangay name is not enough —
 * dozens of names are ordinary words ('Tabi', 'Suha', 'Mainit'), so an explicit
 * `barangay`/`brgy` marker is required before the name.
 */
const BARANGAY_ALIASES = MUNICIPALITIES.flatMap((municipality) =>
  BARANGAYS[municipality].map((name) => ({
    name,
    municipality,
    pattern: new RegExp(`\\b(?:barangay|brgy|bgy)\\.?\\s+${name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i'),
  })),
)

export type ContactSearchPlace = { municipality?: Municipality; barangay?: string }

export type ContactSection = {
  title: string
  contacts: EmergencyContact[]
  /** No listed row matched the asked-for agency here — `contacts` holds the place's full hotline list instead. */
  fallback?: boolean
}

export type ContactSearchResult = {
  sections: ContactSection[]
  /** The question named a specific agency or hazard, so sections hold only the matching rows. */
  narrowed: boolean
  /** Municipalities the answer is scoped to (mentioned in the question, else the saved address). */
  municipalities: Municipality[]
}

/**
 * Searches the verified hotline directory for the rows that fit a question: the agency
 * it names (fire, police, medical, coast guard, disaster response, LGU) and the place
 * it names (municipality, `brgy X`, else the caller's saved municipality). When an
 * agency is given but no place, every municipality is searched. National numbers are
 * always included — 911 and the Red Cross apply to every emergency.
 */
export function searchContacts(query: string, place?: ContactSearchPlace): ContactSearchResult {
  const text = query.toLowerCase()
  const patterns = AGENCY_MATCHERS.filter(({ ask }) => ask.test(query)).map(({ label }) => label)
  const narrowed = patterns.length > 0
  const keep = (contact: EmergencyContact) => !narrowed || patterns.some((pattern) => pattern.test(contact.label))

  const mentioned = MUNICIPALITIES.filter((municipality) => text.includes(municipality.toLowerCase()))
  const brgyHit = BARANGAY_ALIASES.find(({ pattern }) => pattern.test(query))
  const municipalities = mentioned.length
    ? mentioned
    : brgyHit
      ? [brgyHit.municipality]
      : place?.municipality
        ? [place.municipality]
        : []

  const sections: ContactSection[] = []
  const local = (municipality: Municipality) =>
    getLocalContacts(
      municipality,
      municipality === brgyHit?.municipality ? brgyHit.name : municipality === place?.municipality ? place.barangay : undefined,
    )

  if (municipalities.length) {
    for (const municipality of municipalities) {
      const all = local(municipality)
      const matched = all.filter(keep)
      sections.push(matched.length ? { title: municipality, contacts: matched } : { title: municipality, contacts: all, fallback: true })
    }
  } else if (narrowed) {
    // No place anywhere — search every municipality and keep only the rows that fit.
    for (const municipality of MUNICIPALITIES) {
      const matched = local(municipality).filter(keep)
      if (matched.length) sections.push({ title: municipality, contacts: matched })
    }
  }

  const provincial = provincialContacts.filter(keep)
  sections.push(provincial.length ? { title: 'Provincial', contacts: provincial } : { title: 'Provincial', contacts: provincialContacts, fallback: true })
  sections.push({ title: 'National', contacts: nationalContacts })

  return { sections, narrowed, municipalities }
}
