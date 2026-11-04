import * as SecureStore from 'expo-secure-store'
import { createDraftStore } from './deliveryDraftStore'

export const deliveryDraftStore = createDraftStore({
  getItem: (key) => SecureStore.getItemAsync(key),
  setItem: (key, value) => SecureStore.setItemAsync(key, value),
  deleteItem: (key) => SecureStore.deleteItemAsync(key),
})
