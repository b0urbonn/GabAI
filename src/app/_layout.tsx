import { Stack } from 'expo-router'
import { SQLiteProvider, type SQLiteDatabase } from 'expo-sqlite'
import { StatusBar } from 'expo-status-bar'
import { useCallback, useEffect, useRef, useState } from 'react'
import { ActivityIndicator, Platform, Pressable, Text, View } from 'react-native'
import { SafeAreaProvider } from 'react-native-safe-area-context'

import { DATABASE_NAME, migrateDbIfNeeded } from '@/db/migrations'
import { isWebDatabasePaused, openWebDatabaseHere, waitForWebDatabaseLock } from '@/db/webDatabaseLock'
import { SettingsProvider, useSettings } from '@/providers/SettingsProvider'
import { palette } from '@/theme/tokens'
import { useTheme } from '@/theme/useTheme'

const WEB_DATABASE_LOCK_TIMEOUT_MS = 10_000

export default function RootLayout() {
  const [webDatabaseLockReady, setWebDatabaseLockReady] = useState(Platform.OS !== 'web')
  const [webDatabaseLockTimedOut, setWebDatabaseLockTimedOut] = useState(false)
  const [webDatabaseLockError, setWebDatabaseLockError] = useState<Error | null>(null)
  const [webDatabasePaused] = useState(() => Platform.OS === 'web' && isWebDatabasePaused())
  const [databaseReady, setDatabaseReady] = useState(false)
  const [databaseError, setDatabaseError] = useState<Error | null>(null)
  const databaseErrorReported = useRef(false)

  const initializeDatabase = useCallback(async (db: SQLiteDatabase) => {
    await migrateDbIfNeeded(db)
    setDatabaseReady(true)
  }, [])

  const reportDatabaseError = useCallback((error: Error) => {
    if (databaseErrorReported.current) return
    databaseErrorReported.current = true
    queueMicrotask(() => setDatabaseError(error))
  }, [])

  useEffect(() => {
    if (Platform.OS !== 'web' || webDatabasePaused) return

    let isMounted = true
    const lockWaitTimeout = setTimeout(() => {
      if (isMounted) setWebDatabaseLockTimedOut(true)
    }, WEB_DATABASE_LOCK_TIMEOUT_MS)

    waitForWebDatabaseLock().then(() => {
      if (!isMounted) return
      clearTimeout(lockWaitTimeout)
      setWebDatabaseLockReady(true)
    }).catch((error: unknown) => {
      console.error('Could not coordinate the web SQLite database lock.', error)
      if (!isMounted) return
      clearTimeout(lockWaitTimeout)
      setWebDatabaseLockError(error instanceof Error ? error : new Error(String(error)))
    })

    return () => {
      isMounted = false
      clearTimeout(lockWaitTimeout)
    }
  }, [webDatabasePaused])

  return (
    <SafeAreaProvider>
      {webDatabasePaused ? (
        <DatabaseErrorScreen
          title="GabAI is open in another tab"
          message="Your saved data is available there. You can move GabAI back here; the other tab will pause."
          onReload={openWebDatabaseHere}
          actionLabel="Open in this tab"
        />
      ) : webDatabaseLockError ? (
        <DatabaseErrorScreen message="The browser could not reserve GabAI's saved database. Open the app in a secure browser context, then reload." onReload={reloadPage} />
      ) : databaseError ? (
        <DatabaseErrorScreen message={getDatabaseErrorMessage(databaseError)} onReload={reloadPage} />
      ) : webDatabaseLockReady ? (
        <View style={{ flex: 1 }}>
          <SQLiteProvider databaseName={DATABASE_NAME} onInit={initializeDatabase} onError={reportDatabaseError}>
            <SettingsProvider fallback={<BootScreen />}>
              <AppNavigator />
            </SettingsProvider>
          </SQLiteProvider>
          {!databaseReady ? <BootScreen /> : null}
        </View>
      ) : webDatabaseLockTimedOut ? (
        <DatabaseErrorScreen
          title="GabAI is waiting to open saved data"
          message="Move GabAI here to continue with your saved data. The other tab will pause. If it runs an older version, close that tab once, then this page will continue automatically."
          onReload={openWebDatabaseHere}
          actionLabel="Open in this tab"
        />
      ) : (
        <BootScreen message="Waiting for another GabAI tab to release the saved database. Close it to continue here." />
      )}
    </SafeAreaProvider>
  )
}

function AppNavigator() {
  const { colors, scheme } = useTheme()
  const { settings } = useSettings()
  return (
    <>
      <StatusBar style={scheme === 'dark' ? 'light' : 'dark'} />
      <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.background } }}>
        <Stack.Protected guard={settings.onboarded}>
          <Stack.Screen name="(tabs)" />
          <Stack.Screen
            name="guide/[id]"
            options={{ presentation: 'formSheet', sheetGrabberVisible: true, sheetAllowedDetents: [0.75, 1], contentStyle: { backgroundColor: colors.surface } }}
          />
          <Stack.Screen name="emergency" options={{ animation: 'slide_from_bottom' }} />
          <Stack.Screen name="notifications" />
          <Stack.Screen name="settings" />
          <Stack.Screen name="chat-settings" />
          <Stack.Screen name="about" />
          <Stack.Screen name="profile/[group]" />
        </Stack.Protected>
        <Stack.Protected guard={!settings.onboarded}>
          <Stack.Screen name="onboarding" options={{ gestureEnabled: false }} />
        </Stack.Protected>
      </Stack>
    </>
  )
}

function BootScreen({ message }: { message?: string } = {}) {
  return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: palette.light.background, paddingHorizontal: 24 }}>
      <ActivityIndicator color={palette.light.teal} />
      {message ? <Text style={{ color: palette.light.inkSoft, fontSize: 14, lineHeight: 20, marginTop: 12, textAlign: 'center' }}>{message}</Text> : null}
    </View>
  )
}

function DatabaseErrorScreen({
  title = 'GabAI could not open saved data',
  message,
  onReload,
  actionLabel = 'Reload',
}: {
  title?: string
  message: string
  onReload?: () => void
  actionLabel?: string
}) {
  return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: palette.light.background, padding: 24 }}>
      <Text style={{ color: palette.light.ink, fontSize: 20, fontWeight: '700', textAlign: 'center' }}>{title}</Text>
      <Text style={{ color: palette.light.inkSoft, fontSize: 14, lineHeight: 20, marginTop: 12, textAlign: 'center' }}>{message}</Text>
      {onReload ? (
        <Pressable
          accessibilityRole="button"
          onPress={onReload}
          style={({ pressed }) => ({
            backgroundColor: palette.light.teal,
            borderRadius: 10,
            marginTop: 20,
            opacity: pressed ? 0.85 : 1,
            paddingHorizontal: 24,
            paddingVertical: 12,
          })}
        >
          <Text style={{ color: '#fff', fontSize: 15, fontWeight: '600' }}>{actionLabel}</Text>
        </Pressable>
      ) : null}
    </View>
  )
}

function reloadPage() {
  if (typeof window !== 'undefined') window.location.reload()
}

function getDatabaseErrorMessage(error: Error) {
  if (error.message.includes('createSyncAccessHandle') || error.message.includes('Access Handles cannot be created')) {
    return 'Saved browser data is already open in another tab. Close all other GabAI tabs, then reload this page. Your saved data has not been erased.'
  }
  return 'Reload the app to try again. If the problem continues, share the full error message with the app maintainer.'
}
