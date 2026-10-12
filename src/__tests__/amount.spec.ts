import { describe, expect, it } from 'vitest'
import { formatAmount, groupAmountInput, parseAmount } from '../amount'

describe('amount formatting', () => {
  it.each([
    [0, '0'],
    [10000, '10 000'],
    [1000000, '1 000 000'],
    [10000.25, '10 000,25'],
    [-10000, '-10 000'],
  ])('formats %s as %s and parses it back', (value, formatted) => {
    expect(formatAmount(value)).toBe(formatted)
    expect(parseAmount(formatted)).toBe(value)
  })

  it.each([NaN, Infinity, -Infinity])('does not display non-finite value %s', (value) => {
    expect(formatAmount(value)).toBe('')
  })

  it.each(['', 'abc', '1,2,3', '10 euros', '1e3', '--1'])('rejects "%s"', (value) => {
    expect(parseAmount(value)).toBeNaN()
  })

  it('accepts French nonbreaking spaces and decimal points', () => {
    expect(parseAmount('10\u202f000,25')).toBe(10000.25)
    expect(parseAmount('10\u00a0000.25')).toBe(10000.25)
  })

  it.each([
    ['10000', '10 000'],
    ['10000,', '10 000,'],
    ['10000.25', '10 000,25'],
    ['1 000 000', '1 000 000'],
    ['-10000', '-10 000'],
    ['', ''],
    ['abc', 'abc'],
  ])('groups input "%s" as "%s"', (input, expected) => {
    expect(groupAmountInput(input)).toBe(expected)
  })
})
