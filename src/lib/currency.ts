const etbCurrencyFormatter = new Intl.NumberFormat('en-ET', {
  currency: 'ETB',
  style: 'currency',
})

export function formatEtbAmount(amountMinor: number): string {
  return etbCurrencyFormatter.format(amountMinor / 100)
}

export function formatUsdAmount(amountMinor: number): string {
  return `$${(amountMinor / 100).toFixed(2)}`
}

export function formatUsdWholeAmount(amountMinor: number): string {
  return `$${(amountMinor / 100).toFixed(0)}`
}
