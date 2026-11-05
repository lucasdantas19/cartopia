import { Stack, useRouter } from 'expo-router'
import * as Notifications from 'expo-notifications'
import { useEffect } from 'react'
import { SessionProvider } from '../src/context/SessionContext'

export default function RootLayout() {
  const router = useRouter()

  useEffect(() => {
    const subscription = Notifications.addNotificationResponseReceivedListener((response) => {
      const data = response.notification.request.content.data as {
        publicId?: string
        token?: string
        role?: 'sender' | 'recipient'
      }
      if (!data.publicId || !data.token) return
      router.push({
        pathname: '/track',
        params: {
          publicId: data.publicId,
          token: data.token,
          fromAccount: data.role ?? '',
        },
      })
    })

    return () => subscription.remove()
  }, [router])

  return (
    <SessionProvider>
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="(tabs)" />
      </Stack>
    </SessionProvider>
  )
}
