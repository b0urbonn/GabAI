import { BARANGAYS } from '@/data/barangays'
import { BLOOD_TYPES, MUNICIPALITIES, PROVINCES, REGIONS, type Municipality, type ProfileInfo } from '@/data/profile'

const NAME_PATTERN = /^[A-Za-zÀ-ÖØ-öø-ÿ][A-Za-zÀ-ÖØ-öø-ÿ .'-]*$/
const PHONE_PATTERN = /^(09\d{9}|\+639\d{9}|0\d{8,9})$/
const ISO_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/
const PHONE_MESSAGE = 'Enter a valid PH number, e.g. 0917 123 4567 or +63 917 123 4567.'

const normalizePhone = (value: string) => value.replace(/[\s\-().]/g, '')

function validatePhone(value: string): string | undefined {
  return PHONE_PATTERN.test(normalizePhone(value)) ? undefined : PHONE_MESSAGE
}

function validateBirthday(value: string): string | undefined {
  if (!ISO_DATE_PATTERN.test(value)) return 'Use the format YYYY-MM-DD.'
  const [year, month, day] = value.split('-').map(Number)
  const date = new Date(year, month - 1, day)
  if (date.getFullYear() !== year || date.getMonth() !== month - 1 || date.getDate() !== day) return "This date doesn't exist."
  if (year < 1900) return 'Enter a year from 1900 onward.'
  if (date.getTime() > Date.now()) return "Date of birth can't be in the future."
  return undefined
}

/** Returns the error message for a field value, or undefined when valid. Empty fields are always valid. */
export function validateField(key: string, value: string, draft: ProfileInfo): string | undefined {
  const text = value.trim()
  if (!text) return undefined
  switch (key) {
    case 'name':
    case 'contactName':
      if (text.length < 2) return 'Enter at least 2 letters.'
      if (text.length > 80 || !NAME_PATTERN.test(text)) return 'Use letters only. Spaces, periods, apostrophes, and hyphens are OK.'
      return undefined
    case 'relationship':
      return NAME_PATTERN.test(text) ? undefined : 'Use letters only.'
    case 'phone':
      return validatePhone(text)
    case 'contactPhone': {
      const phoneError = validatePhone(text)
      if (phoneError) return phoneError
      if (normalizePhone(text) === normalizePhone(draft.phone ?? '')) return 'Use a different number from your own.'
      return undefined
    }
    case 'birthday':
      return validateBirthday(text)
    case 'region':
      return (REGIONS as readonly string[]).includes(text) ? undefined : 'Choose a region from the list.'
    case 'province':
      return (PROVINCES as readonly string[]).includes(text) ? undefined : 'Choose a province from the list.'
    case 'municipality':
      return (MUNICIPALITIES as readonly string[]).includes(text) ? undefined : 'Choose a municipality from the list.'
    case 'barangay': {
      const municipality = draft.municipality
      if (!municipality || !(MUNICIPALITIES as readonly string[]).includes(municipality)) return 'Choose a city or municipality first.'
      return BARANGAYS[municipality as Municipality].includes(text) ? undefined : 'Choose a barangay from the list.'
    }
    case 'blood':
      return (BLOOD_TYPES as readonly string[]).includes(text) ? undefined : 'Choose a blood type from the list.'
    default:
      return undefined
  }
}

/** Validates every given field; returns a map of field key → error message (empty when all valid). */
export function validateProfile(draft: ProfileInfo, keys: string[]): Record<string, string> {
  const errors: Record<string, string> = {}
  for (const key of keys) {
    const message = validateField(key, draft[key] ?? '', draft)
    if (message) errors[key] = message
  }
  return errors
}

/** Formats typed digits into YYYY-MM-DD as the user types ('199005' → '1990-05'). */
export function formatDateInput(text: string): string {
  const digits = text.replace(/\D/g, '').slice(0, 8)
  if (digits.length > 6) return `${digits.slice(0, 4)}-${digits.slice(4, 6)}-${digits.slice(6)}`
  if (digits.length > 4) return `${digits.slice(0, 4)}-${digits.slice(4)}`
  return digits
}

export function parseIsoDate(value: string): Date | null {
  if (!ISO_DATE_PATTERN.test(value)) return null
  const [year, month, day] = value.split('-').map(Number)
  const date = new Date(year, month - 1, day)
  return date.getFullYear() === year && date.getMonth() === month - 1 && date.getDate() === day ? date : null
}

export function toIsoDate(date: Date): string {
  const pad = (part: number) => String(part).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
}
