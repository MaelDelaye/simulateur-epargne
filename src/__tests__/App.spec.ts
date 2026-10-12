import { mount } from '@vue/test-utils'
import { describe, expect, it, vi } from 'vitest'
import App from '../App.vue'

const money = (value: number) => new Intl.NumberFormat('fr-FR', {
  style: 'currency', currency: 'EUR', maximumFractionDigits: 0,
}).format(value).replace(/\s/g, ' ')
const text = (value: string) => value.replace(/\s/g, ' ')

describe('App', () => {
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
    const button = wrapper.findAll('.duration-options button').find((item) => item.text() === `${years} ans`)!
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
    await wrapper.get('[aria-label="Supprimer le projet immobilier 2"]').trigger('click')
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
    vi.stubGlobal('URL', class extends URL {
      static override createObjectURL = createObjectURL
      static override revokeObjectURL = revokeObjectURL
    })
    let download = ''
    let href = ''
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (this: HTMLAnchorElement) {
      download = this.download
      href = this.getAttribute('href') ?? ''
    })
    const wrapper = mount(App)
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
    for (const line of lines) expect(line.split(';')).toHaveLength(13)
    expect(lines[1]!.split(';').slice(0, 5)).toEqual(['0', '0,00', '30000,00', '0,00', '30000,00'])
    expect(revokeObjectURL).toHaveBeenCalledExactlyOnceWith('blob:simulation')
  })
})
