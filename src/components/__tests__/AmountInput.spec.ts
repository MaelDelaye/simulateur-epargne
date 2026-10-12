import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import AmountInput from '../AmountInput.vue'

describe('AmountInput', () => {
  it('formats the initial amount and forwards input attributes', () => {
    const wrapper = mount(AmountInput, {
      props: { modelValue: 10000.25 },
      attrs: { id: 'amount', 'aria-describedby': 'hint' },
    })
    expect(wrapper.element.value).toBe('10 000,25')
    expect(wrapper.attributes()).toMatchObject({
      id: 'amount',
      type: 'text',
      inputmode: 'decimal',
      'aria-describedby': 'hint',
    })
  })

  it.each([
    ['10000', '10 000', 10000],
    ['10 000,25', '10 000,25', 10000.25],
    ['10000.25', '10 000,25', 10000.25],
    ['-10000', '-10 000', -10000],
    ['0', '0', 0],
  ])('formats "%s" and emits the numeric model', async (typed, display, value) => {
    const wrapper = mount(AmountInput, { props: { modelValue: 100 } })
    await wrapper.get('input').setValue(typed)
    expect(wrapper.element.value).toBe(display)
    expect(wrapper.emitted('update:modelValue')?.at(-1)).toEqual([value])
  })

  it('does not emit a model update when the numeric value stays unchanged', async () => {
    const wrapper = mount(AmountInput, { props: { modelValue: 10000 } })
    await wrapper.get('input').setValue('10000')
    expect(wrapper.element.value).toBe('10 000')
    expect(wrapper.emitted('update:modelValue')).toBeUndefined()
  })

  it.each(['', 'abc', '1,2,3'])('emits NaN for invalid input "%s"', async (typed) => {
    const wrapper = mount(AmountInput, { props: { modelValue: 100 } })
    await wrapper.get('input').setValue(typed)
    expect(wrapper.emitted('update:modelValue')?.at(-1)).toEqual([NaN])
    await wrapper.trigger('blur')
    expect(wrapper.element.value).toBe(typed)
  })

  it('updates the display when the parent resets the model', async () => {
    const wrapper = mount(AmountInput, { props: { modelValue: 10000 } })
    await wrapper.setProps({ modelValue: 60000 })
    expect(wrapper.element.value).toBe('60 000')
    await wrapper.setProps({ modelValue: NaN })
    expect(wrapper.element.value).toBe('')
  })

  it('preserves an unfinished decimal until blur', async () => {
    const wrapper = mount(AmountInput, {
      props: {
        modelValue: 0,
        'onUpdate:modelValue': (value) => {
          void wrapper.setProps({ modelValue: value })
        },
      },
    })
    await wrapper.get('input').setValue('10000,')
    expect(wrapper.element.value).toBe('10 000,')
    await wrapper.trigger('blur')
    expect(wrapper.element.value).toBe('10 000')
  })

  it('keeps the caret beside the edited digit when inserting thousands spaces', async () => {
    const wrapper = mount(AmountInput, { props: { modelValue: 0 } })
    wrapper.element.value = '10000'
    wrapper.element.setSelectionRange(2, 2)
    await wrapper.trigger('input')
    expect(wrapper.element.value).toBe('10 000')
    expect(wrapper.element.selectionStart).toBe(2)
    expect(wrapper.element.selectionEnd).toBe(2)
  })
})
