const amountFormatter = new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 20 })

export function formatAmount(value: number): string {
  return Number.isFinite(value) ? amountFormatter.format(value).replace(/[\u00a0\u202f]/g, ' ') : ''
}

export function parseAmount(value: string): number {
  const normalized = value.replace(/\s/g, '').replace(',', '.')
  return /^-?\d+(?:\.\d*)?$/.test(normalized) ? Number(normalized) : NaN
}

export function groupAmountInput(value: string): string {
  const normalized = value.replace(/\s/g, '').replace('.', ',')
  if (!/^-?\d*(?:,\d*)?$/.test(normalized)) return value
  const [integer = '', decimals] = normalized.split(',')
  const grouped = integer.replace(/\B(?=(\d{3})+(?!\d))/g, ' ')
  return decimals === undefined ? grouped : `${grouped},${decimals}`
}
