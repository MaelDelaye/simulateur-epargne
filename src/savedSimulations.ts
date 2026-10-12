import { validateParameters } from './simulation'
import type { PropertyProject, SimulationParameters } from './simulation'

export const storageKey = 'horizon.simulations.v1'
export class SavedSimulationError extends Error {}

export interface SimulationSnapshot {
  parameters: SimulationParameters
  monthlySalary: number
}

export interface SavedSimulation extends SimulationSnapshot {
  id: string
  name: string
  savedAt: string
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value)
}

function isProject(value: unknown): value is PropertyProject {
  if (!isRecord(value)) return false
  return isFiniteNumber(value.id) && Number.isSafeInteger(value.id) && value.id > 0 &&
    value.id < Number.MAX_SAFE_INTEGER &&
    typeof value.name === 'string' &&
    typeof value.propertyType === 'string' && ['primary', 'secondary', 'rental'].includes(value.propertyType) &&
    ['monthlyNetIncome', 'annualCharges', 'purchaseYear', 'propertyPrice', 'deposit',
      'loanRate', 'loanYears', 'propertyRate'].every((key) => isFiniteNumber(value[key]))
}

export function isSnapshot(value: unknown): value is SimulationSnapshot {
  if (!isRecord(value) || !isRecord(value.parameters)) return false
  const parameters = value.parameters
  if (!isFiniteNumber(parameters.savings) || !isFiniteNumber(parameters.monthlySavings) ||
      !isFiniteNumber(parameters.investmentRate) || !isFiniteNumber(parameters.years) ||
      !Array.isArray(parameters.projects) || !parameters.projects.every(isProject)) return false
  const ids = parameters.projects.map((project) => project.id)
  if (new Set(ids).size !== ids.length) return false
  // Build the typed parameters after checking every field of the persisted input.
  const checked: SimulationParameters = {
    savings: parameters.savings,
    monthlySavings: parameters.monthlySavings,
    investmentRate: parameters.investmentRate,
    years: parameters.years,
    projects: parameters.projects,
  }
  return validateParameters(checked).length === 0 &&
    isFiniteNumber(value.monthlySalary) && value.monthlySalary >= 0 && value.monthlySalary <= 100_000_000
}

export function readSavedSimulations(storage: Storage): SavedSimulation[] {
  const raw = storage.getItem(storageKey)
  if (raw === null) return []
  let value: unknown
  try {
    value = JSON.parse(raw)
  } catch (error) {
    if (error instanceof SyntaxError) {
      throw new SavedSimulationError('Les sauvegardes sont illisibles. Les données existantes n’ont pas été modifiées.')
    }
    throw error
  }
  if (!isRecord(value) || value.version !== 1 || !Array.isArray(value.simulations)) {
    throw new SavedSimulationError('Format de sauvegarde incompatible. Les données existantes n’ont pas été modifiées.')
  }
  const simulations: SavedSimulation[] = []
  for (const entry of value.simulations) {
    if (!isRecord(entry) || !isSnapshot(entry) || typeof entry.id !== 'string' || !entry.id ||
        typeof entry.name !== 'string' || !entry.name.trim() ||
        typeof entry.savedAt !== 'string' || !Number.isFinite(Date.parse(entry.savedAt))) {
      throw new SavedSimulationError('Une sauvegarde est invalide. Les données existantes n’ont pas été modifiées.')
    }
    simulations.push({
      id: entry.id, name: entry.name, savedAt: entry.savedAt,
      parameters: entry.parameters, monthlySalary: entry.monthlySalary,
    })
  }
  if (new Set(simulations.map((entry) => entry.id)).size !== simulations.length) {
    throw new SavedSimulationError('Les identifiants des sauvegardes sont invalides. Les données existantes n’ont pas été modifiées.')
  }
  return simulations
}

export function writeSavedSimulations(storage: Storage, simulations: SavedSimulation[]): void {
  storage.setItem(storageKey, JSON.stringify({ version: 1, simulations }))
}
