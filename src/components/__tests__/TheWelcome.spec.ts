import { mount } from '@vue/test-utils'
import { describe, expect, it, vi } from 'vitest'
import TheWelcome from '../TheWelcome.vue'
import WelcomeItem from '../WelcomeItem.vue'

describe('TheWelcome', () => {
  it('renders all five resource sections with icons', () => {
    const wrapper = mount(TheWelcome)
    expect(wrapper.findAllComponents(WelcomeItem)).toHaveLength(5)
    expect(wrapper.findAll('h3').map((heading) => heading.text()))
      .toEqual(['Documentation', 'Tooling', 'Ecosystem', 'Community', 'Support Vue'])
    expect(wrapper.findAll('i svg')).toHaveLength(5)
    for (const link of wrapper.findAll('a[target="_blank"]')) {
      expect(link.attributes('href')).toMatch(/^https:\/\//)
      expect(link.attributes('rel')).toBe('noopener')
    }
  })

  it('requests opening the README only when its link is clicked', async () => {
    const fetch = vi.fn().mockResolvedValue(new Response())
    vi.stubGlobal('fetch', fetch)
    const wrapper = mount(TheWelcome)
    expect(fetch).not.toHaveBeenCalled()
    await wrapper.get('a[href="javascript:void(0)"]').trigger('click')
    expect(fetch).toHaveBeenCalledExactlyOnceWith('/__open-in-editor?file=README.md')
  })
})
