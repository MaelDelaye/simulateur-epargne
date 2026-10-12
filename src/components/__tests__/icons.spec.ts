import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import IconCommunity from '../icons/IconCommunity.vue'
import IconDocumentation from '../icons/IconDocumentation.vue'
import IconEcosystem from '../icons/IconEcosystem.vue'
import IconSupport from '../icons/IconSupport.vue'
import IconTooling from '../icons/IconTooling.vue'

describe.each([
  ['IconCommunity', IconCommunity, '20', '20'],
  ['IconDocumentation', IconDocumentation, '20', '17'],
  ['IconEcosystem', IconEcosystem, '18', '20'],
  ['IconSupport', IconSupport, '20', '20'],
  ['IconTooling', IconTooling, '24', '24'],
] as const)('%s', (_, component, width, height) => {
  it('renders its SVG dimensions and a nonempty vector path', () => {
    const wrapper = mount(component)
    expect(wrapper.element.tagName.toLowerCase()).toBe('svg')
    expect(wrapper.attributes()).toMatchObject({
      xmlns: 'http://www.w3.org/2000/svg', width, height,
    })
    expect(wrapper.get('path').attributes('d')).toBeTruthy()
    expect(wrapper.attributes('fill') ?? wrapper.get('path').attributes('fill')).toBe('currentColor')
  })

  it('forwards attributes to the SVG root', () => {
    const wrapper = mount(component, { attrs: { id: 'icon', 'aria-label': 'Resource' } })
    expect(wrapper.attributes()).toMatchObject({ id: 'icon', 'aria-label': 'Resource' })
  })
})
