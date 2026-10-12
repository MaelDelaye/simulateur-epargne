export const durations = [5, 10, 15, 20, 25] as const
export const propertyTypes = [
  { value: 'primary', label: 'Résidence principale' },
  { value: 'secondary', label: 'Résidence secondaire' },
  { value: 'rental', label: 'Investissement locatif' },
] as const
export type PropertyType = typeof propertyTypes[number]['value']

export interface PropertyProject {
  id: number
  name: string
  propertyType: PropertyType
  monthlyNetIncome: number
  purchaseYear: number
  propertyPrice: number
  deposit: number
  loanRate: number
  loanYears: number
  propertyRate: number
}

export interface SimulationParameters {
  savings: number
  monthlySavings: number
  projects: PropertyProject[]
  investmentRate: number
  years: number
}

export interface Projection {
  year: number
  cash: number
  investment: number
  contributions: number
  propertyIncome: number
  deposits: number
  investmentInterest: number
  property: number
  debt: number
  loanInterest: number
  repayments: number
  monthlyPayments: number
  available: number
  netWorth: number
}

export function initialDeposits(parameters: SimulationParameters): number {
  return parameters.projects.filter((project) => project.purchaseYear === 0)
    .reduce((total, project) => total + project.deposit, 0)
}

export function investmentAmount(parameters: SimulationParameters): number {
  return Math.max(0, parameters.savings - initialDeposits(parameters))
}

export function loanAmount(project: PropertyProject): number {
  return project.propertyPrice - project.deposit
}

export function projectName(project: PropertyProject): string {
  return project.name.trim() || `Projet immobilier ${project.id}`
}

export function propertyMonthlyIncome(project: PropertyProject): number {
  return project.propertyType === 'primary' ? 0 : project.monthlyNetIncome
}

export function validateProject(project: PropertyProject): string[] {
  const errors: string[] = []
  if (!propertyTypes.some((type) => type.value === project.propertyType)) {
    errors.push('Sélectionnez un type de bien immobilier valide.')
  }
  if (project.propertyType !== 'primary' && (!Number.isFinite(project.monthlyNetIncome) ||
      project.monthlyNetIncome < 0 || project.monthlyNetIncome > 100_000_000)) {
    errors.push('Les revenus nets mensuels doivent être compris entre 0 et 100 000 000 €.')
  }
  if ([project.propertyPrice, project.deposit].some((value) =>
    !Number.isFinite(value) || value < 0 || value > 100_000_000)) {
    errors.push('Le prix et l’apport doivent être compris entre 0 et 100 000 000 €.')
  }
  if (project.deposit > project.propertyPrice) {
    errors.push('L’apport ne peut pas dépasser le prix du bien immobilier.')
  }
  if (!Number.isInteger(project.purchaseYear) || project.purchaseYear < 0 || project.purchaseYear > 25) {
    errors.push('L’année d’achat doit être un entier compris entre 0 (départ) et 25.')
  }
  if (!Number.isFinite(project.loanRate) || project.loanRate < 0 || project.loanRate > 30) {
    errors.push('Le taux du prêt doit être compris entre 0 et 30 %.')
  }
  if (!Number.isFinite(project.propertyRate) || project.propertyRate < -20 || project.propertyRate > 20) {
    errors.push('L’évolution immobilière doit être comprise entre −20 et 20 %.')
  }
  if (!durations.some((duration) => duration === project.loanYears)) {
    errors.push('La durée du prêt doit être de 5, 10, 15, 20 ou 25 ans.')
  }
  return errors
}

export function validateParameters(parameters: SimulationParameters): string[] {
  const errors: string[] = []
  if (!Number.isFinite(parameters.savings) || parameters.savings < 0 || parameters.savings > 100_000_000) {
    errors.push('L’épargne de départ doit être comprise entre 0 et 100 000 000 €.')
  }
  if (!Number.isFinite(parameters.monthlySavings) || parameters.monthlySavings < 0 ||
      parameters.monthlySavings > 100_000_000) {
    errors.push('L’épargne mensuelle doit être comprise entre 0 et 100 000 000 €.')
  }
  if (parameters.projects.length === 0) errors.push('Ajoutez au moins un projet immobilier.')
  parameters.projects.forEach((project, index) => {
    errors.push(...validateProject(project).map((error) => `Projet ${index + 1} : ${projectName(project)} — ${error}`))
  })
  if (Math.round(initialDeposits(parameters) * 100) > Math.round(parameters.savings * 100)) {
    errors.push('Les apports des achats au départ dépassent votre épargne disponible.')
  }
  if (!Number.isFinite(parameters.investmentRate) || parameters.investmentRate < -50 || parameters.investmentRate > 50) {
    errors.push('Le rendement du placement doit être compris entre −50 et 50 %.')
  }
  if (!durations.some((duration) => duration === parameters.years)) {
    errors.push('La durée de simulation doit être de 5, 10, 15, 20 ou 25 ans.')
  }
  return errors
}

export function monthlyPayment(amount: number, annualRate: number, years: number): number {
  if (amount === 0) return 0
  const months = years * 12
  const rate = annualRate / 100 / 12
  if (rate === 0) return amount / months
  return amount * rate / -Math.expm1(-months * Math.log1p(rate))
}

export function calculateSimulation(parameters: SimulationParameters): {
  projection: Projection[]
  errors: string[]
} {
  const errors = validateParameters(parameters)
  if (errors.length) return { projection: [], errors }

  const states = parameters.projects.map((project) => ({
    project, debt: 0,
    payment: monthlyPayment(loanAmount(project), project.loanRate, project.loanYears),
  }))
  const monthlyRate = Math.expm1(Math.log1p(parameters.investmentRate / 100) / 12)
  const rows: Projection[] = []
  let investment = parameters.savings
  let investmentInterest = 0
  let deposits = 0
  let loanInterest = 0
  let repayments = 0
  let propertyIncome = 0

  for (let month = 0; month <= parameters.years * 12; month++) {
    if (month > 0) {
      const gain = investment * monthlyRate
      const income = states.reduce((sum, state) => sum +
        (month > state.project.purchaseYear * 12 ? propertyMonthlyIncome(state.project) : 0), 0)
      investmentInterest += gain
      propertyIncome += income
      investment += gain + parameters.monthlySavings + income
      for (const state of states) {
        const elapsed = month - state.project.purchaseYear * 12
        if (elapsed <= 0 || elapsed > state.project.loanYears * 12) continue
        const interest = state.debt * state.project.loanRate / 100 / 12
        const repayment = Math.min(state.payment, state.debt + interest)
        loanInterest += interest
        repayments += repayment
        state.debt = Math.max(0, state.debt + interest - repayment)
        if (elapsed === state.project.loanYears * 12) state.debt = 0
      }
    }
    if (month % 12 !== 0) continue
    const year = month / 12
    const purchases = states.filter((state) => state.project.purchaseYear === year)
    const requiredDeposit = purchases.reduce((sum, state) => sum + state.project.deposit, 0)
    // Compare at cent precision to avoid rejecting an exactly funded purchase due to rounding.
    if (Math.round(requiredDeposit * 100) > Math.round(investment * 100)) {
      const money = (value: number) => new Intl.NumberFormat('fr-FR', {
        style: 'currency', currency: 'EUR', minimumFractionDigits: 2,
      }).format(value)
      return {
        projection: [],
        errors: [`Année ${year} : capital insuffisant pour les apports des projets ${purchases
          .map((state) => `${parameters.projects.indexOf(state.project) + 1} (${projectName(state.project)})`).join(', ')}. ` +
          `${money(requiredDeposit)} nécessaires, ${money(investment)} disponibles. ` +
          'Réduisez les apports, augmentez l’épargne ou reportez les achats.'],
      }
    }
    investment = Math.max(0, investment - requiredDeposit)
    deposits += requiredDeposit
    purchases.forEach((state) => { state.debt = loanAmount(state.project) })

    const purchased = states.filter((state) => state.project.purchaseYear <= year)
    const property = purchased.reduce((sum, state) => sum + state.project.propertyPrice *
      (1 + state.project.propertyRate / 100) ** (year - state.project.purchaseYear), 0)
    const debt = purchased.reduce((sum, state) => sum + state.debt, 0)
    const monthlyPayments = purchased.reduce((sum, state) => sum +
      (year - state.project.purchaseYear < state.project.loanYears ? state.payment : 0), 0)
    rows.push({
      year, cash: 0, investment, contributions: parameters.monthlySavings * month,
      deposits, propertyIncome, investmentInterest, property, debt, loanInterest, repayments,
      monthlyPayments, available: investment, netWorth: investment + property - debt,
    })
  }
  return { projection: rows, errors: [] }
}

export function simulate(parameters: SimulationParameters): Projection[] {
  const result = calculateSimulation(parameters)
  if (result.errors.length) throw new RangeError(result.errors.join(' '))
  return result.projection
}
