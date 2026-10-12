import { mount } from '@vue/test-utils'
import { nextTick } from 'vue'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import SavedSimulations from '../SavedSimulations.vue'
import { readSavedSimulations, storageKey } from '../../savedSimulations'
import type { SimulationSnapshot } from '../../savedSimulations'

const snapshot = (): SimulationSnapshot => ({
  monthlySalary: 3000,
  parameters: {
    savings: 60000, monthlySavings: 200, investmentRate: 5, years: 20,
    projects: [{
      id: 1, name: 'Maison', propertyType: 'primary', monthlyNetIncome: 0,
      annualCharges: 1000, purchaseYear: 0, propertyPrice: 230000, deposit: 30000,
      loanRate: 3.5, loanYears: 20, propertyRate: 0,
    }],
  },
})

describe('SavedSimulations', () => {
  beforeEach(() => localStorage.clear())

  it('keeps the panel collapsed until the save icon is opened and closes on Escape', async () => {
    const wrapper = mount(SavedSimulations, { props: snapshot(), attachTo: document.body })
    expect(wrapper.get<HTMLDetailsElement>('details').element.open).toBe(false)
    expect(wrapper.get('summary').attributes('aria-label')).toBe('Gérer les simulations sauvegardées')
    wrapper.get<HTMLDetailsElement>('details').element.open = true
    await wrapper.get('details').trigger('toggle')
    expect(wrapper.get<HTMLDetailsElement>('details').element.open).toBe(true)
    await wrapper.get('#simulation-name').trigger('keydown', { key: 'Escape' })
    expect(wrapper.get<HTMLDetailsElement>('details').element.open).toBe(false)
    expect(document.activeElement).toBe(wrapper.get('summary').element)
  })

  it('creates independent named saves and restores the list after remount', async () => {
    const props = snapshot()
    const wrapper = mount(SavedSimulations, { props })
    expect(wrapper.text()).toContain('Aucune simulation sauvegardée')
    await wrapper.get('#simulation-name').setValue('  Scénario A  ')
    await wrapper.get('form').trigger('submit')
    expect(wrapper.get('[role="status"]').text()).toContain('Scénario A')
    props.parameters.savings = 80000
    await wrapper.get('#simulation-name').setValue('Scénario B')
    await wrapper.get('form').trigger('submit')
    const entries = readSavedSimulations(localStorage)
    expect(entries).toHaveLength(2)
    expect(entries[0]!.parameters.savings).toBe(60000)
    expect(entries[1]!.parameters.savings).toBe(80000)
    expect(entries[0]!.id).not.toBe(entries[1]!.id)
    wrapper.unmount()
    const reopened = mount(SavedSimulations, { props: snapshot() })
    await nextTick()
    expect(reopened.findAll('.saved-list li')).toHaveLength(2)
    await reopened.get('[aria-label="Comparer Scénario A"]').trigger('click')
    expect(reopened.emitted('compare')?.[0]?.[0]).toMatchObject({ name: 'Scénario A', ...snapshot() })
    expect(reopened.get<HTMLDetailsElement>('details').element.open).toBe(false)
    await reopened.get('[aria-label="Charger Scénario A"]').trigger('click')
    expect(reopened.emitted('load')?.[0]?.[0]).toEqual(snapshot())
    await reopened.get('[aria-label="Supprimer la simulation Scénario A"]').trigger('click')
    expect(readSavedSimulations(localStorage).map((entry) => entry.name)).toEqual(['Scénario B'])
    expect(reopened.emitted('remove')).toHaveLength(1)
    expect(reopened.findAll('.saved-list li')).toHaveLength(1)
  })

  it('rejects blank names and invalid parameters without saving', async () => {
    const wrapper = mount(SavedSimulations, { props: snapshot() })
    await wrapper.get('form').trigger('submit')
    expect(wrapper.get('[role="alert"]').text()).toContain('Donnez un nom')
    await wrapper.get('#simulation-name').setValue('Test')
    await wrapper.setProps({ monthlySalary: NaN })
    await wrapper.get('form').trigger('submit')
    expect(wrapper.get('[role="alert"]').text()).toContain('Corrigez')
    expect(localStorage.getItem(storageKey)).toBeNull()
  })

  it('reports corrupt data and never overwrites it', async () => {
    localStorage.setItem(storageKey, '{corrupt')
    const wrapper = mount(SavedSimulations, { props: snapshot() })
    await nextTick()
    expect(wrapper.get('[role="alert"]').text()).toContain('illisibles')
    await wrapper.get('#simulation-name').setValue('Test')
    await wrapper.get('form').trigger('submit')
    expect(localStorage.getItem(storageKey)).toBe('{corrupt')
    expect(wrapper.find('[role="status"]').exists()).toBe(false)
  })

  it('reports unavailable storage', async () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => { throw new DOMException('Denied', 'SecurityError') })
    const wrapper = mount(SavedSimulations, { props: snapshot() })
    await nextTick()
    expect(wrapper.get('[role="alert"]').text()).toContain('inaccessible')
  })

  it('does not report success or change its list on quota failure', async () => {
    const wrapper = mount(SavedSimulations, { props: snapshot() })
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new DOMException('Full', 'QuotaExceededError') })
    await wrapper.get('#simulation-name').setValue('Test')
    await wrapper.get('form').trigger('submit')
    expect(wrapper.get('[role="alert"]').text()).toContain('plein')
    expect(wrapper.find('[role="status"]').exists()).toBe(false)
    expect(wrapper.findAll('.saved-list li')).toHaveLength(0)
  })

  it('reads the latest storage before saving and handles a save removed in another tab', async () => {
    const wrapper = mount(SavedSimulations, { props: snapshot() })
    await wrapper.get('#simulation-name').setValue('A')
    await wrapper.get('form').trigger('submit')
    const anotherTab = mount(SavedSimulations, { props: snapshot() })
    await anotherTab.get('#simulation-name').setValue('B')
    await anotherTab.get('form').trigger('submit')
    await wrapper.get('#simulation-name').setValue('C')
    await wrapper.get('form').trigger('submit')
    expect(readSavedSimulations(localStorage).map((entry) => entry.name)).toEqual(['A', 'B', 'C'])
    localStorage.removeItem(storageKey)
    await wrapper.get('[aria-label="Charger A"]').trigger('click')
    expect(wrapper.get('[role="alert"]').text()).toContain('n’existe plus')
    expect(wrapper.emitted('load')).toBeUndefined()
  })
})
