import { Tabs } from 'expo-router'
import { Platform, Text, type ColorValue } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

function TabIcon({ symbol, color }: { symbol: string; color: ColorValue }) {
  return (
    <Text
      accessibilityElementsHidden
      importantForAccessibility="no"
      style={{ color, fontSize: 23, fontWeight: '700' }}
    >
      {symbol}
    </Text>
  )
}

export default function TabLayout() {
  const insets = useSafeAreaInsets()
  const bottomInset = Platform.OS === 'android'
    ? Math.max(insets.bottom, 24)
    : insets.bottom

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: '#7c3aed',
        tabBarInactiveTintColor: '#665d70',
        tabBarLabelStyle: {
          fontSize: 12,
          fontWeight: '700',
        },
        tabBarStyle: {
          backgroundColor: '#fffaf4',
          borderTopColor: '#e5dcef',
          height: 58 + bottomInset,
          paddingBottom: bottomInset + 6,
          paddingTop: 6,
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Início',
          tabBarIcon: ({ color }) => <TabIcon symbol="⌂" color={color} />,
        }}
      />
      <Tabs.Screen
        name="journeys"
        options={{
          title: 'Viagens',
          tabBarIcon: ({ color }) => <TabIcon symbol="✉" color={color} />,
        }}
      />
      <Tabs.Screen
        name="account"
        options={{
          title: 'Conta',
          tabBarIcon: ({ color }) => <TabIcon symbol="◉" color={color} />,
        }}
      />
    </Tabs>
  )
}
