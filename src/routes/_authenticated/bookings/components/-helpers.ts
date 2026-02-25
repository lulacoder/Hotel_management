// Shared formatting and status helpers for the customer bookings UI.
export const formatDate = (dateStr: string) => {
  // Human-friendly booking date for list/detail surfaces.
  return new Date(dateStr).toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}

export const formatPrice = (cents: number) => {
  // Price storage is cents; convert to display currency.
  return `$${(cents / 100).toFixed(2)}`
}

export const getRoomTypeName = (type: string) => {
  // Map internal room type keys to customer-facing labels.
  switch (type) {
    case 'single':
      return 'Single Room'
    case 'double':
      return 'Double Room'
    case 'suite':
      return 'Suite'
    case 'deluxe':
      return 'Deluxe Room'
    default:
      return type
  }
}

export const canCancel = (status: string) => {
  // Cancellation is only allowed before stay completion.
  return ['held', 'pending_payment', 'confirmed'].includes(status)
}
