import { describe, expect, it } from 'vitest'
import {
  calculateSimulation, durations, initialDeposits, investmentAmount, loanAmount,
  monthlyPayment, simulate, validateParameters, validateProject,
} from '../simulation'
import type { PropertyProject, SimulationParameters } from '../simulation'

const project = (id = 1, overrides: Partial<PropertyProject> = {}): PropertyProject => ({
  id, purchaseYear: 0, propertyPrice: 230000, deposit: 30000,
  loanRate: 3.5, loanYears: 20, propertyRate: 0, ...overrides,
})
const parameters = (overrides: Partial<SimulationParameters> = {}): SimulationParameters => ({
  savings: 60000, monthlySavings: 200, investmentRate: 5, years: 20,
  projects: [project()], ...overrides,
})

describe('financial helpers', () => {
  it('deducts only initial deposits from initial investment', () => {
    const input = parameters({
      projects: [project(), project(2, { deposit: 10000 }), project(3, { purchaseYear: 5 })],
    })
    expect(initialDeposits(input)).toBe(40000)
    expect(investmentAmount(input)).toBe(20000)
    expect(loanAmount(input.projects[0]!)).toBe(200000)
  })

  it('calculates a fixed-rate monthly loan payment', () => {
    expect(monthlyPayment(200000, 3.5, 20)).toBeCloseTo(1159.919435, 5)
  })

  it('handles zero interest and fully cash-funded purchases', () => {
    expect(monthlyPayment(120000, 0, 10)).toBe(1000)
    expect(monthlyPayment(0, 3.5, 20)).toBe(0)
  })
})

describe('simulation', () => {
  it.each(durations)('preserves accounting identities throughout %s years', (years) => {
    const input = parameters({ years })
    const rows = simulate(input)
    expect(rows).toHaveLength(years + 1)
    expect(rows[0]!.netWorth).toBe(input.savings)
    for (const row of rows) {
      expect(row.investment).toBeCloseTo(input.savings + row.contributions - row.deposits + row.investmentInterest, 6)
      expect(row.debt).toBeCloseTo(Math.max(0, 200000 - row.repayments + row.loanInterest), 6)
      expect(row.available).toBe(row.investment)
      expect(row.netWorth).toBeCloseTo(row.investment + row.property - row.debt, 6)
    }
  })

  it.each([0, 5, -10, -50, 50, 0.0000001])('matches compounded monthly deposits at %s percent', (investmentRate) => {
    const input = parameters({ investmentRate })
    const rows = simulate(input)
    const factor = (1 + investmentRate / 100) ** (1 / 12)
    let balance = 30000
    expect(rows[0]!.contributions).toBe(0)
    expect(rows[0]!.investmentInterest).toBe(0)
    for (let year = 1; year <= input.years; year++) {
      for (let month = 0; month < 12; month++) balance = balance * factor + input.monthlySavings
      expect(rows[year]!.investment).toBeCloseTo(balance, 5)
      expect(rows[year]!.contributions).toBe(200 * 12 * year)
      expect(rows[year]!.investmentInterest).toBeCloseTo(balance - 30000 - 200 * 12 * year, 5)
    }
  })

  it('preserves annual compound growth without monthly savings', () => {
    const rows = simulate(parameters({ monthlySavings: 0 }))
    for (const row of rows) expect(row.investment).toBeCloseTo(30000 * 1.05 ** row.year, 6)
  })

  it('accumulates savings from zero at zero yield without inventing interest', () => {
    const last = simulate(parameters({
      savings: 0, investmentRate: 0, projects: [project(1, { propertyPrice: 0, deposit: 0 })],
    })).at(-1)!
    expect(last.investment).toBe(48000)
    expect(last.investmentInterest).toBe(0)
    expect(last.netWorth).toBe(48000)
  })

  it('withdraws a future deposit after that month’s contribution and starts the loan at purchase', () => {
    const rows = simulate(parameters({
      savings: 10000, monthlySavings: 100, investmentRate: 0, years: 10,
      projects: [project(1, {
        purchaseYear: 2, propertyPrice: 50000, deposit: 12000,
        loanRate: 0, loanYears: 5, propertyRate: 10,
      })],
    }))
    expect(rows[0]).toMatchObject({ investment: 10000, property: 0, debt: 0, monthlyPayments: 0 })
    expect(rows[2]).toMatchObject({ investment: 400, property: 50000, debt: 38000, repayments: 0, deposits: 12000 })
    expect(rows[2]!.monthlyPayments).toBeCloseTo(38000 / 60, 8)
    expect(rows[3]!.debt).toBeCloseTo(38000 * 4 / 5, 6)
    expect(rows[3]!.property).toBeCloseTo(55000, 6)
    expect(rows[7]).toMatchObject({ debt: 0, monthlyPayments: 0, loanInterest: 0 })
    expect(rows[2]!.netWorth).toBeCloseTo(rows[1]!.netWorth + 1200, 6)
  })

  it('aggregates simultaneous and staggered purchases with independent loan terms', () => {
    const rows = simulate(parameters({
      savings: 100000, monthlySavings: 0, investmentRate: 0,
      projects: [
        project(),
        project(2, { propertyPrice: 140000, deposit: 40000, loanRate: 0, loanYears: 5 }),
        project(3, { purchaseYear: 5, propertyPrice: 100000, deposit: 20000, loanRate: 0, loanYears: 10 }),
      ],
    }))
    expect(rows[0]).toMatchObject({ investment: 30000, property: 370000, debt: 300000, netWorth: 100000 })
    expect(rows[5]).toMatchObject({ investment: 10000, property: 470000, deposits: 90000 })
    expect(rows[5]!.monthlyPayments).toBeCloseTo(monthlyPayment(200000, 3.5, 20) + 80000 / 120, 6)
    expect(rows[20]).toMatchObject({ debt: 0, monthlyPayments: 0 })
    expect(rows[20]!.loanInterest).toBeCloseTo(monthlyPayment(200000, 3.5, 20) * 240 - 200000, 6)
  })

  it('does not count a deposit withdrawal as an investment loss', () => {
    const input = parameters({ projects: [project(1, { purchaseYear: 2 })] })
    const rows = simulate(input)
    for (const row of rows) {
      expect(row.investmentInterest).toBeGreaterThanOrEqual(0)
      expect(row.investmentInterest).toBeCloseTo(row.investment - input.savings - row.contributions + row.deposits, 6)
    }
  })

  it('excludes purchases after the horizon and includes purchases exactly at its end', () => {
    const input = parameters({ investmentRate: 0, years: 5 })
    const outside = simulate({ ...input, projects: [project(1, { purchaseYear: 6 })] }).at(-1)!
    expect(outside).toMatchObject({ property: 0, debt: 0, deposits: 0, investment: 72000 })
    const atEnd = simulate({ ...input, projects: [project(1, { purchaseYear: 5 })] }).at(-1)!
    expect(atEnd).toMatchObject({ property: 230000, debt: 200000, deposits: 30000, repayments: 0 })
  })

  it('supports cash-funded purchases without loan payments', () => {
    const rows = simulate(parameters({ projects: [project(1, { propertyPrice: 30000 })] }))
    for (const row of rows) expect(row).toMatchObject({ debt: 0, monthlyPayments: 0, repayments: 0, loanInterest: 0 })
  })

  it('rejects combined future deposits that cannot be funded', () => {
    const input = parameters({
      savings: 10000, monthlySavings: 0, investmentRate: 0,
      projects: [project(1, { purchaseYear: 2, deposit: 6000 }), project(2, { purchaseYear: 2, deposit: 6000 })],
    })
    const result = calculateSimulation(input)
    expect(result.projection).toEqual([])
    expect(result.errors[0]).toMatch(/Année 2.*capital insuffisant.*1, 2/)
    expect(simulate.bind(null, input)).toThrow(RangeError)
  })

  it('accepts an exactly funded purchase at cent precision', () => {
    const input = parameters({
      savings: 0.3, monthlySavings: 0, investmentRate: 0,
      projects: [project(1, { propertyPrice: 1, deposit: 0.1 }), project(2, { propertyPrice: 1, deposit: 0.2 })],
    })
    const result = calculateSimulation(input)
    expect(result.errors).toEqual([])
    expect(result.projection[0]!.investment).toBe(0)
    expect(investmentAmount(input)).toBe(0)
  })
})

describe('parameter validation', () => {
  it('accepts the default parameters', () => {
    expect(validateParameters(parameters())).toEqual([])
  })

  it.each([
    { savings: -1 }, { savings: NaN }, { savings: 100000001 },
    { monthlySavings: -1 }, { monthlySavings: Infinity },
    { investmentRate: -51 }, { investmentRate: 51 }, { investmentRate: NaN },
    { years: 0 }, { years: 7 }, { projects: [] },
  ])('rejects invalid global input %j', (overrides) => {
    const input = parameters(overrides)
    expect(validateParameters(input).length).toBeGreaterThan(0)
    expect(calculateSimulation(input).projection).toEqual([])
    expect(() => simulate(input)).toThrow(RangeError)
  })

  it.each([
    { propertyPrice: -1 }, { propertyPrice: NaN }, { propertyPrice: 100000001 },
    { deposit: -1 }, { deposit: Infinity }, { deposit: 250000 },
    { purchaseYear: -1 }, { purchaseYear: 26 }, { purchaseYear: 1.5 },
    { loanRate: -1 }, { loanRate: 31 }, { loanRate: NaN },
    { propertyRate: -21 }, { propertyRate: 21 }, { propertyRate: NaN },
    { loanYears: 0 }, { loanYears: 7 },
  ])('rejects invalid project input %j with a project-specific message', (overrides) => {
    const invalid = project(2, overrides)
    expect(validateProject(invalid).length).toBeGreaterThan(0)
    const errors = validateParameters(parameters({ projects: [project(), invalid] }))
    expect(errors.some((error) => error.startsWith('Projet 2 :'))).toBe(true)
  })

  it('rejects combined initial deposits above available savings', () => {
    const input = parameters({ projects: [project(), project(2, { deposit: 40000 })] })
    expect(validateParameters(input)).toContain('Les apports des achats au départ dépassent votre épargne disponible.')
  })
})
