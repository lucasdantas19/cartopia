import { useEffect } from 'react'
import { useLocalSearchParams, useRouter } from 'expo-router'
import * as Linking from 'expo-linking'
import { ActivityIndicator } from 'react-native'
import { parseDeliveryLink } from '../../src/deepLinks'

export default function DeliveryDeepLinkScreen() {
  const router = useRouter()
  const params = useLocalSearchParams<{ publicId?: string }>()

  useEffect(() => {
    async function redirectToTracking() {
      const url = await Linking.getInitialURL()
      const parsed = url ? parseDeliveryLink(url) : null
      router.replace({
        pathname: '/track',
        params: {
          publicId: parsed?.publicId ?? params.publicId,
          token: parsed?.token,
        },
      })
    }

    void redirectToTracking()
  }, [params.publicId, router])

  return <ActivityIndicator style={{ flex: 1 }} color="#7c3aed" />
}
