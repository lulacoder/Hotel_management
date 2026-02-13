export const formatDate = (dateStr: string) => {
  return new Date(dateStr).toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}

export const formatPrice = (cents: number) => {
  return `$${(cents / 100).toFixed(2)}`
}

export const getRoomTypeName = (type: string) => {
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
  return ['held', 'confirmed'].includes(status)
}
