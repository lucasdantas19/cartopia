import * as SecureStore from 'expo-secure-store'
import {
  listRecentDeliveries as listFromStore,
  removeRecentDelivery as removeFromStore,
  saveRecentDelivery as saveToStore,
  type RecentDelivery,
  type RecentDeliveryStorage,
} from './recentDeliveriesStore'

const storage: RecentDeliveryStorage = {
  getItem: (key) => SecureStore.getItemAsync(key),
  setItem: (key, value) => SecureStore.setItemAsync(key, value),
  deleteItem: (key) => SecureStore.deleteItemAsync(key),
}

export function listRecentDeliveries() {
  return listFromStore(storage)
}

export function saveRecentDelivery(item: RecentDelivery) {
  return saveToStore(storage, item)
}

export function removeRecentDelivery(publicId: string) {
  return removeFromStore(storage, publicId)
}
