import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import HelloWorld from '../HelloWorld.vue'

describe('HelloWorld', () => {
  it('renders and updates its message prop', async () => {
    const wrapper = mount(HelloWorld, { props: { msg: 'Hello' } })
    expect(wrapper.get('h1').text()).toBe('Hello')
    await wrapper.setProps({ msg: 'Updated' })
    expect(wrapper.get('h1').text()).toBe('Updated')
  })

  it('links to Vite and Vue documentation safely in a new tab', () => {
    const wrapper = mount(HelloWorld, { props: { msg: 'Hello' } })
    expect(wrapper.findAll('a').map((link) => link.attributes('href')))
      .toEqual(['https://vite.dev/', 'https://vuejs.org/'])
    for (const link of wrapper.findAll('a')) {
      expect(link.attributes()).toMatchObject({ target: '_blank', rel: 'noopener' })
    }
  })
})
