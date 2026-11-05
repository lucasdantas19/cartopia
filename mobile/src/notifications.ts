import * as Notifications from 'expo-notifications'
import { Platform } from 'react-native'
import { registerDevice } from './api'

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: false,
    shouldSetBadge: false,
  }),
})

export async function requestAndRegisterNotifications(token: string) {
  if (Platform.OS === 'web') return 'unsupported' as const

  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('deliveries', {
      name: 'Entregas',
      importance: Notifications.AndroidImportance.DEFAULT,
    })
  }

  const current = await Notifications.getPermissionsAsync()
  const permissions = current.granted
    ? current
    : await Notifications.requestPermissionsAsync()
  if (!permissions.granted) return 'denied' as const

  const pushToken = (await Notifications.getExpoPushTokenAsync()).data
  await registerDevice({
    push_token: pushToken,
    platform: Platform.OS === 'ios' ? 'ios' : 'android',
  }, token)
  return 'registered' as const
}
