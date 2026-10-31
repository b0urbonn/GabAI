import { router, useFocusEffect } from 'expo-router'
import { useSQLiteContext } from 'expo-sqlite'
import { useCallback, useState } from 'react'
import { StyleSheet, TextInput, View } from 'react-native'

import { RandomAvatarPreview } from '@/components/AvatarArt'
import { FAB_CLEARANCE } from '@/components/EmergencyFab'
import { AppText } from '@/components/ui/AppText'
import { FadeIn } from '@/components/ui/FadeIn'
import { GroupedCard } from '@/components/ui/GroupedCard'
import { Icon } from '@/components/ui/Icon'
import { Banner, Note, PageHeader } from '@/components/ui/Layout'
import { ListRow } from '@/components/ui/ListRow'
import { Screen } from '@/components/ui/Screen'
import { Touchable } from '@/components/ui/Touchable'
import { profileGroups, type ProfileInfo } from '@/data/profile'
import { getProfile } from '@/db/profile'
import { NICKNAME_MAX_LENGTH } from '@/db/settings'
import { useSettings } from '@/providers/SettingsProvider'
import { radius, space, typeRamp } from '@/theme/tokens'
import { useTheme } from '@/theme/useTheme'

export default function ProfileScreen() {
  const db = useSQLiteContext()
  const { colors, scale } = useTheme()
  const { settings, updateSettings } = useSettings()
  const [profile, setProfile] = useState<ProfileInfo>({})
  const [error, setError] = useState('')
  const [nicknameDraft, setNicknameDraft] = useState('')
  const [nicknameEditing, setNicknameEditing] = useState(false)

  useFocusEffect(
    useCallback(() => {
      getProfile(db)
        .then(setProfile)
        .catch(() => setProfile({}))
    }, [db]),
  )

  const fullName = profile.name?.trim() ?? ''
  const nickname = settings.nickname.trim()
  const displayName = fullName || nickname
  const hasDistinctNickname = Boolean(
    fullName && nickname && fullName.toLowerCase() !== nickname.toLowerCase(),
  )
  const location = [profile.barangay, profile.municipality].filter(Boolean).join(', ')
  const subtitle = [
    location || (!hasDistinctNickname ? 'Stored only on this device' : ''),
  ]
    .filter(Boolean)
    .join(' · ')

  const commitNickname = () => {
    setNicknameEditing(false)
    const trimmed = nicknameDraft.trim().slice(0, NICKNAME_MAX_LENGTH)
    if (!trimmed || trimmed === nickname) return
    setError('')
    updateSettings({ nickname: trimmed }).catch(() =>
      setError('Unable to save nickname. Please try again.'),
    )
  }

  return (
    <Screen bottomSpace={FAB_CLEARANCE}>
      <PageHeader title="Profile" />

      <FadeIn>
      <View style={styles.identity}>
        <RandomAvatarPreview size={104} />

        <AppText variant="headline" align="center">
          {displayName || 'Your profile'}
        </AppText>

        {nicknameEditing ? (
          <View
            style={[
              styles.nicknameFieldWrap,
              { backgroundColor: colors.surface, borderColor: colors.teal },
            ]}
          >
            <TextInput
              autoFocus
              value={nicknameDraft}
              onChangeText={setNicknameDraft}
              onBlur={commitNickname}
              placeholder="Your nickname"
              placeholderTextColor={colors.inkSoft}
              autoCapitalize="words"
              autoComplete="off"
              autoCorrect={false}
              maxLength={NICKNAME_MAX_LENGTH}
              returnKeyType="done"
              onSubmitEditing={commitNickname}
              accessibilityLabel="Nickname"
              style={[
                styles.nicknameField,
                { color: colors.ink, fontSize: typeRamp.body.fontSize * scale },
              ]}
            />
          </View>
        ) : (
          <Touchable
            onPress={() => {
              setNicknameDraft(settings.nickname)
              setNicknameEditing(true)
            }}
            accessibilityRole="button"
            accessibilityLabel="Edit nickname"
            style={[
              styles.nicknameChip,
              { backgroundColor: colors.surface, borderColor: colors.line },
            ]}
          >
            <AppText variant="small" tone={nickname ? 'default' : 'soft'} weight="600">
              {nickname || 'Add nickname'}
            </AppText>
            <Icon name="edit" size={13} color={colors.inkSoft} />
          </Touchable>
        )}

        {subtitle ? (
          <AppText variant="caption" tone="soft" align="center">
            {subtitle}
          </AppText>
        ) : null}
      </View>
      </FadeIn>

      {error ? <Banner text={error} tone="error" /> : null}

      <FadeIn delay={110}>
      <GroupedCard style={styles.menu}>
        {profileGroups.map((group) => (
          <ListRow
            key={group.id}
            title={group.title}
            leading={group.icon}
            onPress={() =>
              router.push({ pathname: '/profile/[group]', params: { group: group.id } })
            }
          />
        ))}
      </GroupedCard>
      </FadeIn>

      <Note>
        Stored only on this device in a local database. Nothing is uploaded. You can export a backup
        from Settings.
      </Note>
    </Screen>
  )
}

const styles = StyleSheet.create({
  identity: {
    alignItems: 'center',
    paddingVertical: space[2],
    gap: space[1],
  },
  nicknameChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space[1],
    borderRadius: radius.group,
    borderWidth: 1,
    paddingHorizontal: space[3],
    paddingVertical: space[1],
    marginTop: space[1],
  },
  nicknameFieldWrap: {
    justifyContent: 'center',
    borderRadius: radius.group,
    borderWidth: 1,
    marginTop: space[1],
  },
  nicknameField: {
    minHeight: 40,
    minWidth: 160,
    paddingHorizontal: space[3],
    paddingVertical: space[1],
    textAlign: 'center',
    fontWeight: '600',
  },
  menu: { marginTop: space[5] },
})
