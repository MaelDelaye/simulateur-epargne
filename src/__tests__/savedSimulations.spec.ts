import { beforeEach, describe, expect, it, vi } from 'vitest'
import { isSnapshot, readSavedSimulations, SavedSimulationError, storageKey, writeSavedSimulations } from '../savedSimulations'
import type { SavedSimulation, SimulationSnapshot } from '../savedSimulations'

const snapshot = (): SimulationSnapshot => ({
  monthlySalary: 3000,
  parameters: {
    savings: 60000, monthlySavings: 200, investmentRate: 5, years: 20,
    projects: [{
      id: 4, name: 'Maison', propertyType: 'primary', monthlyNetIncome: 0,
      annualCharges: 1000, purchaseYear: 2, propertyPrice: 230000, deposit: 30000,
      loanRate: 3.5, loanYears: 20, propertyRate: 0,
    }],
  },
})
const entry = (): SavedSimulation => ({
  ...snapshot(), id: 'saved-1', name: 'Mon scénario', savedAt: '2026-10-12T10:00:00.000Z',
})

describe('saved simulations storage', () => {
  beforeEach(() => localStorage.clear())

  it('returns no saved simulations when the key does not exist', () => {
    expect(readSavedSimulations(localStorage)).toEqual([])
  })

  it('round-trips all parameters and the salary in a versioned envelope', () => {
    writeSavedSimulations(localStorage, [entry()])
    expect(JSON.parse(localStorage.getItem(storageKey)!)).toMatchObject({ version: 1 })
    expect(readSavedSimulations(localStorage)).toEqual([entry()])
    writeSavedSimulations(localStorage, [])
    expect(readSavedSimulations(localStorage)).toEqual([])
  })

  it.each(['{broken', '{}', '{"version":2,"simulations":[]}', '{"version":1,"simulations":[null]}'])(
    'rejects malformed or incompatible data without changing storage: %s', (raw) => {
      localStorage.setItem(storageKey, raw)
      expect(() => readSavedSimulations(localStorage)).toThrow(SavedSimulationError)
      expect(localStorage.getItem(storageKey)).toBe(raw)
    },
  )

  it('rejects duplicate IDs and malformed metadata', () => {
    for (const entries of [
      [entry(), entry()], [{ ...entry(), name: ' ' }], [{ ...entry(), savedAt: 'invalid' }],
    ]) {
      localStorage.setItem(storageKey, JSON.stringify({ version: 1, simulations: entries }))
      expect(() => readSavedSimulations(localStorage)).toThrow(SavedSimulationError)
    }
  })

  it('validates unknown input before handing it to the simulator', () => {
    expect(isSnapshot(snapshot())).toBe(true)
    for (const value of [
      null, {}, { ...snapshot(), monthlySalary: NaN },
      { ...snapshot(), parameters: { ...snapshot().parameters, projects: [null] } },
      { ...snapshot(), parameters: { ...snapshot().parameters, years: 3 } },
      { ...snapshot(), parameters: { ...snapshot().parameters, projects: [snapshot().parameters.projects[0], snapshot().parameters.projects[0]] } },
    ]) expect(isSnapshot(value)).toBe(false)
    const invalid = snapshot()
    invalid.parameters.projects[0]!.id = Number.MAX_SAFE_INTEGER
    expect(isSnapshot(invalid)).toBe(false)
  })

  it('propagates storage access and quota errors', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => { throw new DOMException('Denied', 'SecurityError') })
    expect(() => readSavedSimulations(localStorage)).toThrow('Denied')
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new DOMException('Full', 'QuotaExceededError') })
    expect(() => writeSavedSimulations(localStorage, [entry()])).toThrow('Full')
  })
})
