import type { AccountDelivery, SavedRecipient } from '../services/api'

export function deliveriesForRecipient(deliveries: AccountDelivery[], recipient: SavedRecipient): AccountDelivery[] {
  const email = recipient.email?.trim().toLowerCase()
  const name = recipient.name.trim().toLowerCase()

  return deliveries.filter((delivery) => {
    if (email && delivery.recipient_email) {
      return delivery.recipient_email.trim().toLowerCase() === email
    }

    return delivery.recipient_name.trim().toLowerCase() === name
  })
}
