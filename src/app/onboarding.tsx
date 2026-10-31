import { router } from 'expo-router'
import { useSQLiteContext } from 'expo-sqlite'
import { useState } from 'react'
import { Keyboard, KeyboardAvoidingView, Platform, StyleSheet } from 'react-native'

import { AddressField } from '@/components/AddressField'
import { randomAvatarSeed } from '@/components/MicahAvatar'
import { DetailsStep } from '@/components/onboarding/DetailsStep'
import { FeatureStep, type FeatureSlide } from '@/components/onboarding/FeatureStep'
import { IdentityStep } from '@/components/onboarding/IdentityStep'
import { ProfileFieldInput } from '@/components/ProfileFieldInput'
import { WelcomeShowcase } from '@/components/WelcomeShowcase'
import { Button } from '@/components/ui/Button'
import { GroupedCard } from '@/components/ui/GroupedCard'
import { Banner } from '@/components/ui/Layout'
import { Screen } from '@/components/ui/Screen'
import {
  profileGroups,
  type ProfileField,
  type ProfileGroup,
  type ProfileInfo,
} from '@/data/profile'
import { validateField, validateProfile } from '@/data/profileValidation'
import { getProfile, saveProfile } from '@/db/profile'
import { useSettings } from '@/providers/SettingsProvider'
import { space } from '@/theme/tokens'

const FEATURE_SLIDES: readonly FeatureSlide[] = [
  {
    scene: 'disaster',
    category: 'Disaster Preparedness',
    title: 'Be Prepared. Stay Safe.',
    subtitle: 'Practical checklists and local hazard guides ready anytime, even offline.',
    imageLabel:
      'Marinduque Morion responder holding a disaster preparedness checklist with an emergency go-bag, water, and flashlight',
  },
  {
    scene: 'firstAid',
    category: 'First Aid Assistance',
    title: 'Know First Aid. Save Lives.',
    subtitle: 'Clear, step-by-step emergency care guides when every second counts.',
    imageLabel: 'Marinduque Morion responder performing CPR next to a first aid kit',
  },
  {
    scene: 'assistant',
    category: 'Offline AI Assistant',
    title: 'Your Safety Companion, Anytime.',
    subtitle: 'Instant safety and first aid guidance whenever you need it — no internet required.',
    imageLabel: 'Marinduque Morion responder consulting the offline GabAI assistant on a tablet',
  },
]

const WELCOME_STEP = 0
const FEATURE_START_STEP = 1
const FEATURE_END_STEP = FEATURE_START_STEP + FEATURE_SLIDES.length - 1
const IDENTITY_STEP = FEATURE_END_STEP + 1
const PERSONAL_STEP = IDENTITY_STEP + 1
const HEALTH_STEP = PERSONAL_STEP + 1
const TOTAL_STEPS = HEALTH_STEP + 1

const personalGroup = profileGroups.find((group) => group.id === 'personal')!
const healthGroup = profileGroups.find((group) => group.id === 'health')!
const pickFields = (group: ProfileGroup, keys: string[]) =>
  keys.map((key): ProfileField => group.fields.find((field) => field.key === key)!)

/** Personal page: name and phone as text cells, plus one combined Address (barangay + municipality) cell. */
const PERSONAL_TEXT_FIELDS = pickFields(personalGroup, ['name', 'phone'])
const PERSONAL_KEYS = ['name', 'phone', 'municipality', 'barangay']
const HEALTH_FIELDS = healthGroup.fields
const HEALTH_KEYS = HEALTH_FIELDS.map((field) => field.key)

export default function OnboardingScreen() {
  const db = useSQLiteContext()
  const { settings, updateSettings } = useSettings()
  const [step, setStep] = useState(WELCOME_STEP)
  const [nickname, setNickname] = useState(settings.nickname)
  const [nameFocused, setNameFocused] = useState(false)
  const [draft, setDraft] = useState<ProfileInfo>({})
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [errors, setErrors] = useState<Record<string, string>>({})

  const trimmedNickname = nickname.trim()

  const goToStep = (nextStep: number) => {
    Keyboard.dismiss()
    setError('')
    setStep(nextStep)
  }

  const updateField = (key: string, value: string) => {
    const next: ProfileInfo = { ...draft, [key]: value }
    setDraft(next)
    setErrors((current) => {
      const updated = { ...current }
      if (key in updated) {
        const message = validateField(key, value, next)
        if (message) updated[key] = message
        else delete updated[key]
      }
      return updated
    })
  }

  const updateAddress = ({ municipality, barangay }: { municipality: string; barangay: string }) => {
    setDraft((current) => ({ ...current, municipality, barangay }))
    setErrors(({ municipality: _m, barangay: _b, ...rest }) => rest)
  }

  /** Validates `keys`; returns false and highlights fields when any are invalid. */
  const validateKeys = (keys: string[]) => {
    const found = validateProfile(draft, keys)
    if (Object.keys(found).length) {
      setErrors(found)
      setError('Please fix the highlighted fields.')
      return false
    }
    return true
  }

  const nextFromPersonal = () => {
    if (validateKeys(PERSONAL_KEYS)) goToStep(HEALTH_STEP)
  }

  /** Skipping the personal page discards anything typed there, so it isn't saved later. */
  const skipPersonal = () => {
    setDraft(({ name: _n, phone: _p, municipality: _m, barangay: _b, ...rest }) => rest)
    setErrors({})
    goToStep(HEALTH_STEP)
  }

  /** Finishes onboarding, saving the non-empty values of `keys` into the profile. */
  const complete = async (keys: string[]) => {
    if (saving) return
    if (!validateKeys(keys)) return
    setSaving(true)
    setError('')
    try {
      const entries = keys
        .map((key) => [key, draft[key]?.trim() ?? ''] as const)
        .filter(([, value]) => value)
      if (entries.length) {
        const profile = await getProfile(db)
        await saveProfile(db, { ...profile, ...Object.fromEntries(entries) })
      }

      await updateSettings({
        nickname: trimmedNickname,
        avatarSeed: settings.avatarSeed || randomAvatarSeed(),
        onboarded: true,
      })
      router.replace('/')
    } catch {
      setError('Unable to save. Please try again.')
      setSaving(false)
    }
  }

  if (step === WELCOME_STEP) {
    return (
      <WelcomeShowcase
        totalSteps={TOTAL_STEPS}
        onGetStarted={() => goToStep(FEATURE_START_STEP)}
      />
    )
  }

  const activeFeature =
    step >= FEATURE_START_STEP && step <= FEATURE_END_STEP
      ? FEATURE_SLIDES[step - FEATURE_START_STEP]
      : null

  return (
    <Screen topInset bottomSpace={space[6]} contentStyle={styles.screenContent}>
      <KeyboardAvoidingView
        style={styles.keyboard}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        {activeFeature && (
          <FeatureStep
            slide={activeFeature}
            current={step}
            total={TOTAL_STEPS}
            onSkip={() => goToStep(IDENTITY_STEP)}
            onBack={() => goToStep(step - 1)}
            onNext={() => goToStep(step + 1)}
          />
        )}

        {step === IDENTITY_STEP && (
          <IdentityStep
            nickname={nickname}
            focused={nameFocused}
            onNicknameChange={setNickname}
            onFocusChange={setNameFocused}
            onClear={() => setNickname('')}
            current={step}
            total={TOTAL_STEPS}
            onBack={() => goToStep(FEATURE_END_STEP)}
            onContinue={() => goToStep(PERSONAL_STEP)}
          />
        )}

        {step === PERSONAL_STEP && (
          <DetailsStep
            title={personalGroup.title}
            current={step}
            total={TOTAL_STEPS}
            onSkip={skipPersonal}
            onBack={() => goToStep(step - 1)}
            action={<Button label="Next" onPress={nextFromPersonal} />}
          >
            <GroupedCard>
              {PERSONAL_TEXT_FIELDS.map((field) => (
                <ProfileFieldInput
                  key={field.key}
                  field={field}
                  value={draft[field.key] ?? ''}
                  error={errors[field.key]}
                  onChange={(value) => updateField(field.key, value)}
                />
              ))}
              <AddressField
                municipality={draft.municipality ?? ''}
                barangay={draft.barangay ?? ''}
                error={errors.municipality ?? errors.barangay}
                onChange={updateAddress}
              />
            </GroupedCard>

            {error ? <Banner text={error} tone="error" /> : null}
          </DetailsStep>
        )}

        {step === HEALTH_STEP && (
          <DetailsStep
            title={healthGroup.title}
            current={step}
            total={TOTAL_STEPS}
            onSkip={() => complete(PERSONAL_KEYS)}
            onBack={() => goToStep(step - 1)}
            action={
              <Button
                label="Finish"
                onPress={() => complete([...PERSONAL_KEYS, ...HEALTH_KEYS])}
                loading={saving}
              />
            }
          >
            <GroupedCard>
              {HEALTH_FIELDS.map((field) => (
                <ProfileFieldInput
                  key={field.key}
                  field={field}
                  value={draft[field.key] ?? ''}
                  error={errors[field.key]}
                  onChange={(value) => updateField(field.key, value)}
                />
              ))}
            </GroupedCard>

            {error ? <Banner text={error} tone="error" /> : null}
          </DetailsStep>
        )}
      </KeyboardAvoidingView>
    </Screen>
  )
}

const styles = StyleSheet.create({
  screenContent: {
    flexGrow: 1,
  },
  keyboard: {
    flex: 1,
  },
})
