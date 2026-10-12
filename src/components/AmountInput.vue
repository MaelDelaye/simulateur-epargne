<script setup lang="ts">
import { ref, watch } from 'vue'
import { formatAmount, groupAmountInput, parseAmount } from '../amount'

const model = defineModel<number>({ required: true })
const draft = ref(formatAmount(model.value))

watch(model, (value) => {
  if (!Object.is(parseAmount(draft.value), value)) draft.value = formatAmount(value)
})

function onInput(event: Event) {
  const input = event.target
  if (!(input instanceof HTMLInputElement)) return
  const charactersBeforeCursor = input.value
    .slice(0, input.selectionStart ?? input.value.length)
    .replace(/\s/g, '').length
  draft.value = groupAmountInput(input.value)
  input.value = draft.value
  let cursor = 0
  let characters = 0
  while (cursor < draft.value.length && characters < charactersBeforeCursor) {
    if (!/\s/.test(draft.value.charAt(cursor))) characters++
    cursor++
  }
  input.setSelectionRange(cursor, cursor)
  model.value = parseAmount(draft.value)
}

function onBlur() {
  if (Number.isFinite(model.value)) draft.value = formatAmount(model.value)
}
</script>

<template>
  <input type="text" inputmode="decimal" :value="draft" @input="onInput" @blur="onBlur" />
</template>
