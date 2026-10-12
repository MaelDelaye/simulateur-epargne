<script setup lang="ts">
import { computed } from 'vue'
import { calculateSimulation } from '../simulation'
import type { SimulationParameters, Projection } from '../simulation'
import type { SavedSimulation } from '../savedSimulations'

const props = defineProps<{ active: SimulationParameters; saved: SavedSimulation }>()
defineEmits<{ close: [] }>()
const activeResult = computed(() => calculateSimulation(props.active))
const savedResult = computed(() =>
  calculateSimulation({
    ...props.saved.parameters,
    years: props.active.years,
  }),
)
const activeFinal = computed(() => activeResult.value.projection.at(-1))
const savedFinal = computed(() => savedResult.value.projection.at(-1))
const metrics: { key: keyof Projection; label: string }[] = [
  { key: 'netWorth', label: 'Patrimoine net' },
  { key: 'available', label: 'Épargne mobilisable' },
  { key: 'investmentInterest', label: 'Intérêts du placement' },
  { key: 'property', label: 'Valeur des biens' },
  { key: 'debt', label: 'Dette restante' },
  { key: 'monthlyPayments', label: 'Mensualité totale' },
  { key: 'propertyIncome', label: 'Revenus immobiliers cumulés' },
  { key: 'propertyCharges', label: 'Charges immobilières cumulées' },
]
const euro = (value: number) =>
  new Intl.NumberFormat('fr-FR', {
    style: 'currency',
    currency: 'EUR',
    maximumFractionDigits: 0,
  }).format(value)
const allValues = computed(() =>
  [...activeResult.value.projection, ...savedResult.value.projection].flatMap((row) => [
    row.netWorth,
    row.available,
  ]),
)
const min = computed(() => Math.min(0, ...allValues.value))
const max = computed(() => Math.max(1, ...allValues.value))
const x = (year: number) => 70 + (year / props.active.years) * 710
const y = (value: number) => 235 - ((value - min.value) / (max.value - min.value)) * 210
const points = (rows: Projection[], key: 'netWorth' | 'available') =>
  rows.map((row) => `${x(row.year)},${y(row[key])}`).join(' ')
const ticks = computed(() =>
  Array.from({ length: 5 }, (_, i) => min.value + ((max.value - min.value) * i) / 4),
)
</script>

<template>
  <article class="chart-card comparison" aria-label="Comparaison de simulations">
    <div class="section-heading">
      <div>
        <h2>Simulation active vs {{ saved.name }}</h2>
        <p>
          Les deux scénarios sont recalculés sur {{ active.years }} ans. Écarts = active −
          enregistrée.
        </p>
      </div>
      <button class="text-button" @click="$emit('close')">Fermer la comparaison</button>
    </div>
    <div
      v-if="activeResult.errors.length || savedResult.errors.length"
      class="error-panel"
      role="alert"
    >
      <p v-for="error in activeResult.errors" :key="`active-${error}`">
        Simulation active : {{ error }}
      </p>
      <p v-for="error in savedResult.errors" :key="`saved-${error}`">
        {{ saved.name }} : {{ error }}
      </p>
    </div>
    <template v-else-if="activeFinal && savedFinal">
      <div class="chart-legend">
        <span><i class="legend-net"></i>Active : patrimoine net (plein), épargne (pointillé)</span>
        <span
          ><i class="legend-available"></i>{{ saved.name }} : patrimoine net (plein), épargne
          (pointillé)</span
        >
      </div>
      <svg
        class="chart"
        viewBox="0 0 810 280"
        role="img"
        aria-labelledby="comparison-title comparison-description"
      >
        <title id="comparison-title">
          Comparaison sur {{ active.years }} ans avec {{ saved.name }}
        </title>
        <desc id="comparison-description">
          Patrimoine net actif : {{ euro(activeFinal.netWorth) }} ; enregistré :
          {{ euro(savedFinal.netWorth) }}. Le tableau présente les chiffres clés et leurs écarts.
        </desc>
        <g v-for="tick in ticks" :key="tick">
          <line x1="70" x2="780" :y1="y(tick)" :y2="y(tick)" class="gridline" />
          <text x="58" :y="y(tick) + 4" text-anchor="end">{{ Math.round(tick / 1000) }} k€</text>
        </g>
        <polyline :points="points(activeResult.projection, 'netWorth')" class="line net" />
        <polyline :points="points(savedResult.projection, 'netWorth')" class="line available" />
        <polyline
          :points="points(activeResult.projection, 'available')"
          class="line net comparison-dashed"
        />
        <polyline
          :points="points(savedResult.projection, 'available')"
          class="line available comparison-dashed"
        />
        <g v-for="index in 6" :key="index">
          <text :x="x((active.years * (index - 1)) / 5)" y="262" text-anchor="middle">
            {{ (active.years * (index - 1)) / 5 }} ans
          </text>
        </g>
      </svg>
      <div class="table-scroll" tabindex="0" role="region" aria-label="Chiffres clés comparés">
        <table>
          <caption class="sr-only">
            Chiffres clés à
            {{
              active.years
            }}
            ans et écarts entre les scénarios
          </caption>
          <thead>
            <tr>
              <th scope="col">À {{ active.years }} ans</th>
              <th scope="col">Simulation active</th>
              <th scope="col">{{ saved.name }}</th>
              <th scope="col">Écart</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="metric in metrics" :key="metric.key">
              <th scope="row">{{ metric.label }}</th>
              <td>{{ euro(activeFinal[metric.key]) }}</td>
              <td>{{ euro(savedFinal[metric.key]) }}</td>
              <td>
                {{ activeFinal[metric.key] > savedFinal[metric.key] ? '+' : ''
                }}{{ euro(activeFinal[metric.key] - savedFinal[metric.key]) }}
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </template>
  </article>
</template>
