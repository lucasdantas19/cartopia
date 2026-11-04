import { createDraftStore } from './deliveryDraftStore'

export const deliveryDraftStore = createDraftStore({
  getItem: async (key) => window.sessionStorage.getItem(key),
  setItem: async (key, value) => window.sessionStorage.setItem(key, value),
  deleteItem: async (key) => window.sessionStorage.removeItem(key),
})
