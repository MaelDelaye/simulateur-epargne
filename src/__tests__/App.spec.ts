import { mount } from '@vue/test-utils'
import { nextTick } from 'vue'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import App from '../App.vue'

const money = (value: number) =>
  new Intl.NumberFormat('fr-FR', {
    style: 'currency',
    currency: 'EUR',
    maximumFractionDigits: 0,
  })
    .format(value)
    .replace(/\s/g, ' ')
const text = (value: string) => value.replace(/\s/g, ' ')

describe('App', () => {
  beforeEach(() => localStorage.clear())

  it('displays each loan payment as a percentage of salary and updates it reactively', async () => {
    const wrapper = mount(App)
    expect(wrapper.find('.project-debt-ratio').exists()).toBe(false)
    await wrapper.get('#monthly-salary').setValue('3000')
    expect(text(wrapper.get('.project-debt-ratio').text())).toBe('· 38,7 % du salaire')
    await wrapper.get('#loan-rate-1').setValue('0')
    expect(text(wrapper.get('.project-debt-ratio').text())).toBe('· 27,8 % du salaire')
    await wrapper.get('.add-project-button').trigger('click')
    await wrapper.get('#loan-rate-2').setValue('0')
    expect(wrapper.findAll('.project-debt-ratio')).toHaveLength(2)
    expect(text(wrapper.findAll('.project-debt-ratio')[1]!.text())).toBe('· 27,8 % du salaire')
    await wrapper.get('#property-price-1').setValue('30000')
    expect(text(wrapper.findAll('.project-debt-ratio')[0]!.text())).toBe('· 0 % du salaire')
    await wrapper.get('#loan-rate-1').setValue('-1')
    expect(
      wrapper.get('.property-projects .parameter-card').find('.project-debt-ratio').exists(),
    ).toBe(false)
  })

  it.each(['', '0', '-1', 'abc'])(
    'hides loan-to-salary percentages for salary "%s"',
    async (salary) => {
      const wrapper = mount(App)
      await wrapper.get('#monthly-salary').setValue('3000')
      await wrapper.get('#monthly-salary').setValue(salary)
      expect(wrapper.find('.project-debt-ratio').exists()).toBe(false)
    },
  )

  it('compares a save without loading it, updates the active scenario and closes on deletion', async () => {
    const wrapper = mount(App)
    await wrapper.get('#simulation-name').setValue('Référence')
    await wrapper.get('.saved-simulations form').trigger('submit')
    await wrapper.get('#savings').setValue('80000')
    await wrapper.get('[aria-label="Comparer Référence"]').trigger('click')
    expect(wrapper.find('.comparison').exists()).toBe(true)
    expect(wrapper.get<HTMLInputElement>('#savings').element.value).toBe('80 000')
    const before = wrapper.get('.comparison tbody').text()
    await wrapper.get('#monthly-savings').setValue('500')
    expect(wrapper.get('.comparison tbody').text()).not.toBe(before)
    await wrapper.get('.comparison button').trigger('click')
    expect(wrapper.find('.comparison').exists()).toBe(false)
    await wrapper.get('[aria-label="Comparer Référence"]').trigger('click')
    await wrapper.get('[aria-label="Supprimer la simulation Référence"]').trigger('click')
    expect(wrapper.find('.comparison').exists()).toBe(false)
  })

  it('saves and reloads all inputs, salary and projects and generates unique IDs after loading', async () => {
    const wrapper = mount(App)
    await wrapper.get('#savings').setValue('90000')
    await wrapper.get('#monthly-salary').setValue('4000')
    await wrapper.get('#monthly-savings').setValue('500')
    await wrapper.get('.add-project-button').trigger('click')
    await wrapper.get('#property-type-2').setValue('rental')
    await wrapper.get('#net-income-2').setValue('700')
    await wrapper.get('#purchase-year-2').setValue('3')
    await wrapper.get('#simulation-name').setValue('Deux biens')
    await wrapper.get('.saved-simulations form').trigger('submit')
    const projection = wrapper.get('tbody').text()
    await wrapper.get('.parameters > .section-heading button').trigger('click')
    expect(wrapper.findAll('.property-projects .parameter-card')).toHaveLength(1)
    await wrapper.get('[aria-label="Charger Deux biens"]').trigger('click')
    expect(wrapper.get<HTMLInputElement>('#savings').element.value).toBe('90 000')
    expect(wrapper.get<HTMLInputElement>('#monthly-salary').element.value).toBe('4 000')
    expect(wrapper.get<HTMLInputElement>('#monthly-savings').element.value).toBe('500')
    expect(wrapper.get<HTMLInputElement>('#net-income-2').element.value).toBe('700')
    expect(wrapper.get<HTMLSelectElement>('#purchase-year-2').element.value).toBe('3')
    expect(wrapper.get('tbody').text()).toBe(projection)
    await wrapper.get('.add-project-button').trigger('click')
    expect(wrapper.find('#property-price-3').exists()).toBe(true)
    wrapper.unmount()
    const reopened = mount(App)
    await nextTick()
    await reopened.get('[aria-label="Charger Deux biens"]').trigger('click')
    expect(reopened.get('tbody').text()).toBe(projection)
    await reopened.get('[aria-label="Supprimer la simulation Deux biens"]').trigger('click')
    expect(reopened.get('tbody').text()).toBe(projection)
    expect(reopened.findAll('.saved-list li')).toHaveLength(0)
  })

  it.each([
    ['3000', 1050],
    ['4000', 1400],
    ['2500,50', 875.175],
    ['0', 0],
  ])(
    'displays 35 percent of a net monthly salary of %s without changing the projection',
    async (salary, limit) => {
      const wrapper = mount(App)
      const initialProjection = wrapper.get('tbody').text()
      await wrapper.get('#monthly-salary').setValue(salary)
      const expected = new Intl.NumberFormat('fr-FR', {
        style: 'currency',
        currency: 'EUR',
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      }).format(limit)
      expect(text(wrapper.get('#debt-limit').text())).toBe(`${text(expected)} / mois`)
      expect(wrapper.get('tbody').text()).toBe(initialProjection)
      await wrapper.get('.parameters > .section-heading button').trigger('click')
      expect(wrapper.get<HTMLInputElement>('#monthly-salary').element.value).toBe('0')
    },
  )

  it.each(['', '-1', 'abc', '100000001'])(
    'shows an explicit error for invalid salary "%s"',
    async (salary) => {
      const wrapper = mount(App)
      await wrapper.get('#monthly-salary').setValue(salary)
      expect(wrapper.get('#monthly-salary').attributes('aria-invalid')).toBe('true')
      expect(wrapper.get('[role="alert"]').text()).toContain('Le salaire mensuel')
      expect(wrapper.get('#debt-limit').text()).toContain('—')
      expect(wrapper.find('table').exists()).toBe(true)
      await wrapper.get('#monthly-salary').setValue('3000')
      expect(wrapper.find('[role="alert"]').exists()).toBe(false)
    },
  )

  it.each(['secondary', 'rental'])(
    'hides and ignores charges for %s and restores them for primary',
    async (propertyType) => {
      const wrapper = mount(App)
      await wrapper.get('#investment-rate').setValue('0')
      await wrapper.get('#annual-charges-1').setValue('1000')
      await wrapper.get('#property-type-1').setValue(propertyType)
      expect(wrapper.find('#annual-charges-1').exists()).toBe(false)
      expect(text(wrapper.findAll('tbody tr').at(-1)!.findAll('td')[0]!.text())).toBe(money(30000))
      expect(text(wrapper.findAll('tbody tr').at(-1)!.findAll('td').at(-1)!.text())).toBe(money(0))
      await wrapper.get('#property-type-1').setValue('primary')
      expect(wrapper.get<HTMLInputElement>('#annual-charges-1').element.value).toBe('1 000')
      expect(text(wrapper.findAll('tbody tr').at(-1)!.findAll('td')[0]!.text())).toBe(money(10000))
    },
  )

  it('deducts charges, displays their cumulative cost and resets the input', async () => {
    const wrapper = mount(App)
    expect(wrapper.get<HTMLInputElement>('#annual-charges-1').element.value).toBe('0')
    await wrapper.get('#investment-rate').setValue('0')
    await wrapper.get('#annual-charges-1').setValue('1000')
    const cells = wrapper.findAll('tbody tr').at(-1)!.findAll('td')
    expect(text(cells[0]!.text())).toBe(money(10000))
    expect(text(cells[3]!.text())).toBe(money(0))
    expect(text(cells.at(-1)!.text())).toBe(money(20000))
    await wrapper.get('.add-project-button').trigger('click')
    expect(wrapper.get<HTMLInputElement>('#annual-charges-2').element.value).toBe('0')
    await wrapper.get('.parameters > .section-heading button').trigger('click')
    expect(wrapper.get<HTMLInputElement>('#annual-charges-1').element.value).toBe('0')
  })

  it('alerts on unaffordable charges and recovers when monthly savings cover them', async () => {
    const wrapper = mount(App)
    await wrapper.get('#edit-project-name-1').trigger('click')
    await wrapper.get('#project-name-1').setValue('Maison')
    await wrapper.get('#project-name-1').trigger('keydown', { key: 'Enter' })
    await wrapper.get('#investment-rate').setValue('0')
    await wrapper.get('#annual-charges-1').setValue('31000')
    expect(wrapper.get('[role="alert"]').text()).toContain(
      'Année 1 : capital insuffisant pour les charges annuelles des projets Maison',
    )
    expect(wrapper.find('table').exists()).toBe(false)
    await wrapper.get('#monthly-savings').setValue('3000')
    expect(wrapper.find('[role="alert"]').exists()).toBe(false)
    await wrapper.get('#annual-charges-1').setValue('-1')
    expect(wrapper.get('[role="alert"]').text()).toContain('Les charges annuelles')
  })

  it('renames projects independently, uses their names in alerts and resets them', async () => {
    const wrapper = mount(App)
    expect(wrapper.find('#project-name-1').exists()).toBe(false)
    await wrapper.get('#edit-project-name-1').trigger('click')
    await wrapper.get('#project-name-1').setValue('Appartement Lyon')
    await wrapper.get('#project-name-1').trigger('keydown', { key: 'Enter' })
    expect(wrapper.get('.project-heading h3').text()).toContain('Appartement Lyon')
    await wrapper.get('.add-project-button').trigger('click')
    expect(wrapper.get('#edit-project-name-2').attributes('aria-label')).toBe(
      'Renommer Projet immobilier 2',
    )
    expect(wrapper.find('[aria-label="Supprimer Appartement Lyon"]').exists()).toBe(true)
    await wrapper.get('#loan-rate-1').setValue('-1')
    expect(wrapper.get('[role="alert"]').text()).toContain('Appartement Lyon')
    await wrapper.get('#loan-rate-1').setValue('3.5')
    await wrapper.get('#purchase-year-1').setValue('2')
    await wrapper.get('#savings').setValue('0')
    expect(wrapper.get('[role="alert"]').text()).toContain('Appartement Lyon')
    await wrapper.get('#edit-project-name-1').trigger('click')
    await wrapper.get('#project-name-1').setValue('   ')
    await wrapper.get('#project-name-1').trigger('blur')
    expect(wrapper.get('.project-heading h3').text()).toContain('Projet immobilier 1')
    await wrapper.get('.parameters > .section-heading button').trigger('click')
    expect(wrapper.find('#project-name-1').exists()).toBe(false)
    expect(wrapper.get('.project-heading h3').text()).toContain('Projet immobilier 1')
    expect(wrapper.findAll('.property-projects .parameter-card')).toHaveLength(1)
  })

  it('focuses the name editor and cancels changes with Escape', async () => {
    const wrapper = mount(App, { attachTo: document.body })
    await wrapper.get('#edit-project-name-1').trigger('click')
    expect(document.activeElement).toBe(wrapper.get('#project-name-1').element)
    await wrapper.get('#project-name-1').setValue('Cancelled name')
    await wrapper.get('#project-name-1').trigger('keydown', { key: 'Escape' })
    expect(wrapper.find('#project-name-1').exists()).toBe(false)
    expect(wrapper.get('.project-heading h3').text()).toContain('Projet immobilier 1')
    expect(document.activeElement).toBe(wrapper.get('#edit-project-name-1').element)
    await wrapper.get('#edit-project-name-1').trigger('click')
    await wrapper.get('#project-name-1').setValue('  Maison  ')
    await wrapper.get('#project-name-1').trigger('blur')
    expect(wrapper.get('.project-heading h3').text()).toContain('Maison')
  })

  it.each(['secondary', 'rental'])(
    'allows income for %s and ignores it when switching back to primary',
    async (propertyType) => {
      const wrapper = mount(App)
      expect(wrapper.get<HTMLSelectElement>('#property-type-1').element.value).toBe('primary')
      expect(wrapper.find('#net-income-1').exists()).toBe(false)
      await wrapper.get('#investment-rate').setValue('0')
      await wrapper.get('#property-type-1').setValue(propertyType)
      expect(wrapper.get<HTMLInputElement>('#net-income-1').element.value).toBe('0')
      await wrapper.get('#net-income-1').setValue('500')
      const cells = wrapper.findAll('tbody tr').at(-1)!.findAll('td')
      expect(text(cells[0]!.text())).toBe(money(150000))
      expect(text(cells[3]!.text())).toBe(money(0))
      expect(text(cells[9]!.text())).toBe(money(120000))
      await wrapper.get('#property-type-1').setValue('primary')
      expect(wrapper.find('#net-income-1').exists()).toBe(false)
      expect(text(wrapper.findAll('tbody tr').at(-1)!.findAll('td')[0]!.text())).toBe(money(30000))
      await wrapper.get('#property-type-1').setValue(propertyType)
      expect(wrapper.get<HTMLInputElement>('#net-income-1').element.value).toBe('500')
      await wrapper.get('.parameters > .section-heading button').trigger('click')
      expect(wrapper.get<HTMLSelectElement>('#property-type-1').element.value).toBe('primary')
      expect(wrapper.find('#net-income-1').exists()).toBe(false)
    },
  )

  it('keeps types and income independent between projects and validates income', async () => {
    const wrapper = mount(App)
    await wrapper.get('.add-project-button').trigger('click')
    await wrapper.get('#property-type-2').setValue('rental')
    await wrapper.get('#net-income-2').setValue('-1')
    expect(wrapper.get('[role="alert"]').text()).toContain(
      'Projet 2 : Projet immobilier 2 — Les revenus nets mensuels',
    )
    expect(wrapper.find('#net-income-1').exists()).toBe(false)
    await wrapper.get('#net-income-2').setValue('1000')
    expect(wrapper.find('[role="alert"]').exists()).toBe(false)
    await wrapper.get('#purchase-year-2').setValue('25')
    expect(text(wrapper.findAll('tbody tr').at(-1)!.findAll('td').at(-1)!.text())).toBe(money(0))
  })

  it('starts with one project, formatted amounts and a 20-year projection', () => {
    const wrapper = mount(App)
    expect(wrapper.findAll('.property-projects .parameter-card')).toHaveLength(1)
    expect(wrapper.find('[aria-label^="Supprimer"]').exists()).toBe(false)
    expect(wrapper.get<HTMLInputElement>('#savings').element.value).toBe('60 000')
    expect(wrapper.get<HTMLInputElement>('#property-price-1').element.value).toBe('230 000')
    expect(wrapper.get<HTMLInputElement>('#investment').element.value).toBe('30 000')
    expect(wrapper.get('#investment').attributes('readonly')).toBeDefined()
    expect(wrapper.findAll('tbody tr')).toHaveLength(21)
    expect(wrapper.get('.duration-options .active').text()).toBe('20 ans')
    expect(wrapper.find('[role="alert"]').exists()).toBe(false)
    expect(wrapper.get('svg.chart').attributes('role')).toBe('img')
    expect(wrapper.get('svg.chart title').text()).toContain('20 ans')
  })

  it('reallocates savings and recalculates the loan when amounts change', async () => {
    const wrapper = mount(App)
    await wrapper.get('#savings').setValue('80000')
    expect(wrapper.get<HTMLInputElement>('#investment').element.value).toBe('50 000')
    await wrapper.get('#deposit-1').setValue('20000')
    expect(wrapper.get<HTMLInputElement>('#investment').element.value).toBe('60 000')
    await wrapper.get('#property-price-1').setValue('250000')
    const project = wrapper.get('.property-projects .parameter-card')
    expect(text(project.text())).toContain(money(230000))
    expect(text(wrapper.get('tbody tr').text())).toContain(money(80000))
  })

  it.each([5, 10, 15, 20, 25])('switches the simulation to %s years', async (years) => {
    const wrapper = mount(App)
    const button = wrapper
      .findAll('.duration-options button')
      .find((item) => item.text() === `${years} ans`)!
    await button.trigger('click')
    expect(button.attributes('aria-pressed')).toBe('true')
    expect(wrapper.findAll('tbody tr')).toHaveLength(years + 1)
    expect(wrapper.get('.summary-card.primary p').text()).toContain(`${years} ans`)
    expect(wrapper.get('svg.chart title').text()).toContain(`${years} ans`)
  })

  it('adds independent projects, removes them and keeps unique input IDs', async () => {
    const wrapper = mount(App)
    await wrapper.get('.add-project-button').trigger('click')
    await wrapper.get('.add-project-button').trigger('click')
    expect(wrapper.findAll('.property-projects .parameter-card')).toHaveLength(3)
    await wrapper.get('#property-price-2').setValue('100000')
    expect(wrapper.get<HTMLInputElement>('#property-price-1').element.value).toBe('230 000')
    expect(text(wrapper.get('tbody tr').text())).toContain(money(530000))
    await wrapper.get('[aria-label="Supprimer Projet immobilier 2"]').trigger('click')
    expect(wrapper.find('#property-price-2').exists()).toBe(false)
    await wrapper.get('.add-project-button').trigger('click')
    expect(wrapper.find('#property-price-4').exists()).toBe(true)
    const ids = wrapper.findAll('input, select').map((input) => input.attributes('id'))
    expect(new Set(ids).size).toBe(ids.length)
  })

  it('resets values and projects without mutating the defaults', async () => {
    const wrapper = mount(App)
    for (let iteration = 0; iteration < 2; iteration++) {
      await wrapper.get('#savings').setValue('90000')
      await wrapper.get('#property-price-1').setValue('300000')
      await wrapper.get('#monthly-savings').setValue('500')
      await wrapper.get('.add-project-button').trigger('click')
      await wrapper.get('.parameters > .section-heading button').trigger('click')
      expect(wrapper.findAll('.property-projects .parameter-card')).toHaveLength(1)
      expect(wrapper.get<HTMLInputElement>('#savings').element.value).toBe('60 000')
      expect(wrapper.get<HTMLInputElement>('#property-price-1').element.value).toBe('230 000')
      expect(wrapper.get<HTMLInputElement>('#monthly-savings').element.value).toBe('0')
    }
  })

  it('includes monthly savings without treating contributions as interest', async () => {
    const wrapper = mount(App)
    await wrapper.get('#investment-rate').setValue('0')
    await wrapper.get('#monthly-savings').setValue('200')
    const cells = wrapper.findAll('tbody tr').at(-1)!.findAll('td')
    expect(text(cells[0]!.text())).toBe(money(78000))
    expect(text(cells[1]!.text())).toBe(money(48000))
    expect(text(cells[3]!.text())).toBe(money(0))
    expect(text(wrapper.findAll('.summary-card')[2]!.get('strong').text())).toBe(money(0))
  })

  it('defers the property and withdraws its deposit at the purchase year', async () => {
    const wrapper = mount(App)
    await wrapper.get('#investment-rate').setValue('0')
    await wrapper.get('#purchase-year-1').setValue('2')
    expect(wrapper.get<HTMLInputElement>('#investment').element.value).toBe('60 000')
    const rows = wrapper.findAll('tbody tr')
    expect(text(rows[0]!.findAll('td')[4]!.text())).toBe(money(0))
    expect(text(rows[2]!.findAll('td')[0]!.text())).toBe(money(30000))
    expect(text(rows[2]!.findAll('td')[4]!.text())).toBe(money(230000))
    expect(text(rows[2]!.findAll('td')[5]!.text())).toBe(money(200000))
  })

  it('excludes an out-of-horizon purchase and includes it when the horizon grows', async () => {
    const wrapper = mount(App)
    await wrapper.get('#investment-rate').setValue('0')
    await wrapper.get('#purchase-year-1').setValue('25')
    expect(wrapper.get('.property-projects').text()).toContain('Achat hors horizon')
    expect(text(wrapper.findAll('tbody tr').at(-1)!.findAll('td')[4]!.text())).toBe(money(0))
    await wrapper.findAll('.duration-options button').at(-1)!.trigger('click')
    expect(wrapper.get('.property-projects').text()).not.toContain('Achat hors horizon')
    expect(text(wrapper.findAll('tbody tr').at(-1)!.findAll('td')[4]!.text())).toBe(money(230000))
  })

  it('alerts on insufficient future capital and recovers after adjusting savings', async () => {
    const wrapper = mount(App)
    await wrapper.get('#purchase-year-1').setValue('2')
    await wrapper.get('#investment-rate').setValue('0')
    await wrapper.get('#savings').setValue('10000')
    expect(wrapper.get('[role="alert"]').text()).toContain('Année 2 : capital insuffisant')
    expect(wrapper.find('table').exists()).toBe(false)
    expect(wrapper.find('.export-button').exists()).toBe(false)
    await wrapper.get('#monthly-savings').setValue('1000')
    expect(wrapper.find('[role="alert"]').exists()).toBe(false)
    expect(wrapper.find('table').exists()).toBe(true)
  })

  it('accepts exactly funded fractional deposits without displaying a negative balance', async () => {
    const wrapper = mount(App)
    await wrapper.get('#savings').setValue('0,3')
    await wrapper.get('#deposit-1').setValue('0,1')
    await wrapper.get('.add-project-button').trigger('click')
    await wrapper.get('#deposit-2').setValue('0,2')
    expect(wrapper.find('[role="alert"]').exists()).toBe(false)
    expect(wrapper.get<HTMLInputElement>('#investment').element.value).toBe('0')
  })

  it.each([
    ['#deposit-1', '250000', 'L’apport ne peut pas dépasser'],
    ['#savings', '', 'L’épargne de départ'],
    ['#monthly-savings', '-1', 'L’épargne mensuelle'],
    ['#loan-rate-1', '-1', 'Le taux du prêt'],
    ['#property-rate-1', '21', 'L’évolution immobilière'],
    ['#investment-rate', '51', 'Le rendement du placement'],
  ])('surfaces invalid input in %s', async (selector, value, message) => {
    const wrapper = mount(App)
    await wrapper.get(selector).setValue(value)
    expect(wrapper.get('[role="alert"]').text()).toContain(message)
    expect(wrapper.find('.summary-grid').exists()).toBe(false)
  })

  it('exports the displayed projection with numeric CSV columns and releases the URL', async () => {
    const createObjectURL = vi.fn<(blob: Blob) => string>().mockReturnValue('blob:simulation')
    const revokeObjectURL = vi.fn()
    vi.stubGlobal(
      'URL',
      class extends URL {
        static override createObjectURL = createObjectURL
        static override revokeObjectURL = revokeObjectURL
      },
    )
    let download = ''
    let href = ''
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (
      this: HTMLAnchorElement,
    ) {
      download = this.download
      href = this.getAttribute('href') ?? ''
    })
    const wrapper = mount(App)
    await wrapper.get('#property-type-1').setValue('rental')
    await wrapper.get('#net-income-1').setValue('500')
    await wrapper.get('.add-project-button').trigger('click')
    await wrapper.get('#annual-charges-2').setValue('1000')
    await wrapper.get('.export-button').trigger('click')
    expect(download).toBe('simulation-epargne-20-ans.csv')
    expect(href).toBe('blob:simulation')
    expect(createObjectURL).toHaveBeenCalledTimes(1)
    const blob = createObjectURL.mock.calls[0]![0]
    expect(blob.type).toBe('text/csv;charset=utf-8;')
    const csv = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader()
      reader.onload = () => resolve(String(reader.result))
      reader.onerror = () => reject(reader.error)
      reader.readAsText(blob)
    })
    const lines = csv.trim().split('\n')
    expect(lines).toHaveLength(22)
    expect(lines[0]).toContain('Apports cumulés')
    expect(lines[0]).toContain('Mensualité totale après achats')
    expect(lines[0]).toContain('Revenus immobiliers nets cumulés')
    expect(lines[0]).toContain('Charges immobilières cumulées')
    for (const line of lines) expect(line.split(';')).toHaveLength(15)
    expect(lines[1]!.split(';').slice(0, 5)).toEqual(['0', '0,00', '30000,00', '0,00', '30000,00'])
    expect(lines.at(-1)!.split(';')[13]).toBe('120000,00')
    expect(lines.at(-1)!.split(';')[14]).toBe('20000,00')
    expect(revokeObjectURL).toHaveBeenCalledExactlyOnceWith('blob:simulation')
  })
})
