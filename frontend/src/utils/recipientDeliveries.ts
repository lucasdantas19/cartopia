import type { AccountDelivery, SavedRecipient } from '../services/api'

export function filterSavedRecipients(recipients: SavedRecipient[], query: string): SavedRecipient[] {
  const normalizedQuery = query.trim().toLocaleLowerCase()
  if (!normalizedQuery) return recipients

  return recipients.filter((recipient) => [recipient.name, recipient.nickname, recipient.email]
    .filter(Boolean)
    .some((value) => value!.toLocaleLowerCase().includes(normalizedQuery)))
}

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
