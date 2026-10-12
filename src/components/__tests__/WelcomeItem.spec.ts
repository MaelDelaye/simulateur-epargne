import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import WelcomeItem from '../WelcomeItem.vue'

describe('WelcomeItem', () => {
  it('renders the icon, heading and default slots in their respective containers', () => {
    const wrapper = mount(WelcomeItem, {
      slots: {
        icon: '<svg aria-label="Test icon"></svg>',
        heading: 'Section title',
        default: '<p>Section content</p>',
      },
    })
    expect(wrapper.get('i svg').attributes('aria-label')).toBe('Test icon')
    expect(wrapper.get('h3').text()).toBe('Section title')
    expect(wrapper.get('.details p').text()).toBe('Section content')
  })

  it('renders empty containers when no slots are provided', () => {
    const wrapper = mount(WelcomeItem)
    expect(wrapper.get('i').text()).toBe('')
    expect(wrapper.get('h3').text()).toBe('')
    expect(wrapper.get('.details').text()).toBe('')
  })
})
