import { Tabs } from 'expo-router/js-tabs'
import { View } from 'react-native'

import { AppHeader } from '@/components/AppHeader'
import { EmergencyFab } from '@/components/EmergencyFab'
import { TabBar } from '@/components/TabBar'
import { useTheme } from '@/theme/useTheme'

export default function TabsLayout() {
  const { colors } = useTheme()
  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <Tabs
        backBehavior="history"
        tabBar={(props) => <TabBar {...props} />}
        screenOptions={{ header: () => <AppHeader />, sceneStyle: { backgroundColor: colors.background }, tabBarHideOnKeyboard: true, animation: 'fade' }}
      >
        <Tabs.Screen name="index" options={{ title: 'Home' }} />
        <Tabs.Screen name="guides" options={{ title: 'Guides' }} />
        <Tabs.Screen name="capture" options={{ title: 'Capture' }} />
        <Tabs.Screen name="chat" options={{ title: 'GabAI', headerShown: false }} />
        <Tabs.Screen name="profile" options={{ title: 'Profile' }} />
      </Tabs>
      <EmergencyFab />
    </View>
  )
}
