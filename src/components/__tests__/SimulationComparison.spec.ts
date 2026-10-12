import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import SimulationComparison from '../SimulationComparison.vue'
import type { SimulationParameters } from '../../simulation'
import type { SavedSimulation } from '../../savedSimulations'

const parameters = (): SimulationParameters => ({
  savings: 60000,
  monthlySavings: 0,
  investmentRate: 0,
  years: 5,
  projects: [
    {
      id: 1,
      name: 'Maison',
      propertyType: 'primary',
      monthlyNetIncome: 0,
      annualCharges: 0,
      purchaseYear: 0,
      propertyPrice: 30000,
      deposit: 30000,
      loanRate: 0,
      loanYears: 5,
      propertyRate: 0,
    },
  ],
})
const saved = (): SavedSimulation => ({
  id: 'saved',
  name: 'Référence',
  savedAt: '2026-10-12T10:00:00Z',
  monthlySalary: 3000,
  parameters: { ...parameters(), savings: 50000, years: 25 },
})
const normalized = (value: string) => value.replace(/\s/g, ' ')

describe('SimulationComparison', () => {
  it('compares both scenarios at the active horizon with four curves and signed differences', () => {
    const reference = saved()
    const wrapper = mount(SimulationComparison, {
      props: { active: parameters(), saved: reference },
    })
    expect(wrapper.get('h2').text()).toContain('Référence')
    expect(wrapper.get('svg title').text()).toContain('5 ans')
    expect(wrapper.findAll('polyline')).toHaveLength(4)
    const cells = wrapper.get('tbody tr').findAll('td')
    expect(cells.map((cell) => normalized(cell.text()))).toEqual([
      '60 000 €',
      '50 000 €',
      '+10 000 €',
    ])
    expect(reference.parameters.years).toBe(25)
    expect(wrapper.findAll('tbody tr')).toHaveLength(8)
  })

  it('updates active metrics and curves without changing the saved scenario', async () => {
    const reference = saved()
    const wrapper = mount(SimulationComparison, {
      props: { active: parameters(), saved: reference },
    })
    const before = wrapper.findAll('polyline')[0]!.attributes('points')
    await wrapper.setProps({ active: { ...parameters(), monthlySavings: 200, years: 10 } })
    expect(normalized(wrapper.get('tbody tr').findAll('td')[0]!.text())).toBe('84 000 €')
    expect(wrapper.get('svg title').text()).toContain('10 ans')
    expect(wrapper.findAll('polyline')[0]!.attributes('points')).not.toBe(before)
    expect(reference.parameters).toEqual(saved().parameters)
  })

  it('identifies errors of either scenario and hides misleading comparison figures', async () => {
    const reference = saved()
    reference.parameters.projects[0]!.annualCharges = 100000
    const wrapper = mount(SimulationComparison, {
      props: { active: parameters(), saved: reference },
    })
    expect(wrapper.get('[role="alert"]').text()).toContain('Référence : Année 1')
    expect(wrapper.find('svg').exists()).toBe(false)
    expect(wrapper.find('table').exists()).toBe(false)
    await wrapper.setProps({ saved: saved(), active: { ...parameters(), savings: 0 } })
    expect(wrapper.get('[role="alert"]').text()).toContain('Simulation active')
  })

  it('emits a close event', async () => {
    const wrapper = mount(SimulationComparison, { props: { active: parameters(), saved: saved() } })
    await wrapper.get('button').trigger('click')
    expect(wrapper.emitted('close')).toHaveLength(1)
  })
})
