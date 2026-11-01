import type { KeyboardTypeOptions } from 'react-native'

import type { IconName } from '@/components/ui/Icon'

export const REGIONS = ['MIMAROPA'] as const
export const PROVINCES = ['Marinduque'] as const
export const MUNICIPALITIES = ['Boac', 'Buenavista', 'Gasan', 'Mogpog', 'Santa Cruz', 'Torrijos'] as const
export type Municipality = (typeof MUNICIPALITIES)[number]

export const BLOOD_TYPES = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-', "Don't know"] as const

export const PROFILE_VALUE_MAX_LENGTH = 180

export type ProfileField = {
  key: string
  label: string
  placeholder?: string
  keyboardType?: KeyboardTypeOptions
  input?: 'text' | 'region' | 'province' | 'municipality' | 'barangay' | 'bloodType' | 'date' | 'phone'
}

export type ProfileGroup = {
  id: 'personal' | 'health' | 'contact'
  title: string
  description: string
  icon: IconName
  fields: ProfileField[]
}

export const profileGroups: ProfileGroup[] = [
  {
    id: 'personal',
    title: 'Personal information',
    description: 'Your details and address in Marinduque.',
    icon: 'profile',
    fields: [
      { key: 'name', label: 'Full name', placeholder: 'Your full name' },
      { key: 'birthday', label: 'Date of birth', placeholder: 'YYYY-MM-DD', input: 'date' },
      { key: 'phone', label: 'Phone number', placeholder: 'e.g. 0917 123 4567', input: 'phone' },
      { key: 'region', label: 'Region', placeholder: 'Choose your region', input: 'region' },
      { key: 'province', label: 'Province', placeholder: 'Choose your province', input: 'province' },
      { key: 'municipality', label: 'City / Municipality', placeholder: 'Choose your city or municipality', input: 'municipality' },
      { key: 'barangay', label: 'Barangay', placeholder: 'Choose your barangay', input: 'barangay' },
    ],
  },
  {
    id: 'health',
    title: 'Health information',
    description: 'Important details about your health.',
    icon: 'heart',
    fields: [
      { key: 'blood', label: 'Blood type', placeholder: 'Choose your blood type', input: 'bloodType' },
      { key: 'allergies', label: 'Allergies', placeholder: 'e.g. Penicillin, seafood' },
      { key: 'conditions', label: 'Medical conditions', placeholder: 'e.g. Asthma, hypertension' },
      { key: 'medications', label: 'Current medications', placeholder: 'e.g. Maintenance medicines' },
    ],
  },
  {
    id: 'contact',
    title: 'Emergency contact',
    description: 'Someone to reach in an emergency.',
    icon: 'phone',
    fields: [
      { key: 'contactName', label: 'Contact name', placeholder: 'Full name' },
      { key: 'relationship', label: 'Relationship', placeholder: 'e.g. Parent, spouse, sibling' },
      { key: 'contactPhone', label: 'Phone number', placeholder: 'e.g. 0917 123 4567', input: 'phone' },
    ],
  },
]

export const PROFILE_KEYS = profileGroups.flatMap((group) => group.fields.map((field) => field.key))

export type ProfileInfo = Record<string, string>

export const getProfileGroup = (id: string | undefined) => profileGroups.find((group) => group.id === id)
