<script setup lang="ts">
import { computed, reactive } from 'vue'
import AmountInput from './components/AmountInput.vue'
import { formatAmount } from './amount'
import { calculateSimulation, durations, initialDeposits, investmentAmount, loanAmount, monthlyPayment, validateProject } from './simulation'
import type { Projection, PropertyProject, SimulationParameters } from './simulation'

const defaults: SimulationParameters = {
  savings: 60000, monthlySavings: 0, investmentRate: 5, years: 20,
  projects: [{ id: 1, purchaseYear: 0, propertyPrice: 230000, loanRate: 3.5,
    deposit: 30000, loanYears: 20, propertyRate: 0 }],
}
const parameters = reactive<SimulationParameters>(structuredClone(defaults))
let nextProjectId = 2
const result = computed(() => calculateSimulation(parameters))
const errors = computed(() => result.value.errors)
const investment = computed(() => investmentAmount(parameters))
const depositsAtStart = computed(() => initialDeposits(parameters))
const allocationValid = computed(() => Number.isFinite(parameters.savings) &&
  parameters.savings >= 0 && parameters.savings <= 100_000_000 &&
  parameters.projects.every((project) => Number.isFinite(project.deposit) && project.deposit >= 0 &&
    Number.isInteger(project.purchaseYear) && project.purchaseYear >= 0 && project.purchaseYear <= 25) &&
  Math.round(depositsAtStart.value * 100) <= Math.round(parameters.savings * 100))
const projection = computed(() => result.value.projection)
const final = computed(() => projection.value.at(-1))
const projectPayment = (project: PropertyProject) =>
  monthlyPayment(loanAmount(project), project.loanRate, project.loanYears)
const totalLoanInterest = computed(() => parameters.projects
  .filter((project) => project.purchaseYear <= parameters.years)
  .reduce((sum, project) => sum + projectPayment(project) * project.loanYears * 12 - loanAmount(project), 0))

function addProject() {
  parameters.projects.push({ id: nextProjectId++, purchaseYear: 0, propertyPrice: 200000,
    deposit: 0, loanRate: 3.5, loanYears: 20, propertyRate: 0 })
}

function resetParameters() {
  Object.assign(parameters, structuredClone(defaults))
  nextProjectId = 2
}
const euro = (value: number) => new Intl.NumberFormat('fr-FR', {
  style: 'currency', currency: 'EUR', maximumFractionDigits: 0,
}).format(value)
const preciseEuro = (value: number) => new Intl.NumberFormat('fr-FR', {
  style: 'currency', currency: 'EUR', minimumFractionDigits: 2, maximumFractionDigits: 2,
}).format(value)
const chartMax = computed(() => Math.max(1, ...projection.value.flatMap((row) => [row.netWorth, row.available, row.debt])))
const chartMin = computed(() => Math.min(0, ...projection.value.map((row) => row.netWorth)))
const x = (year: number) => 70 + year / parameters.years * 710
const y = (value: number) => 235 - (value - chartMin.value) / (chartMax.value - chartMin.value) * 210
const points = (key: 'netWorth' | 'available' | 'debt') =>
  projection.value.map((row) => `${x(row.year)},${y(row[key])}`).join(' ')
const ticks = computed(() => Array.from({ length: 5 }, (_, index) =>
  chartMin.value + (chartMax.value - chartMin.value) * index / 4))
const yearTicks = computed(() => Array.from({ length: 6 }, (_, index) => parameters.years * index / 5))

function exportCsv() {
  const headings = ['Année', 'Épargne liquide', 'Placement', 'Versements mensuels cumulés', 'Apports cumulés', 'Intérêts du placement', 'Valeur des biens',
    'Capital restant dû', 'Intérêts des prêts cumulés', 'Mensualités cumulées', 'Mensualité totale après achats', 'Épargne mobilisable', 'Patrimoine net']
  const keys: (keyof Projection)[] = ['year', 'cash', 'investment', 'contributions', 'deposits', 'investmentInterest', 'property',
    'debt', 'loanInterest', 'repayments', 'monthlyPayments', 'available', 'netWorth']
  const lines = projection.value.map((row) => keys.map((key) =>
    key === 'year' ? String(row[key]) : row[key].toFixed(2).replace('.', ',')).join(';'))
  const url = URL.createObjectURL(new Blob(['\uFEFF', headings.join(';'), '\n', lines.join('\n')],
    { type: 'text/csv;charset=utf-8;' }))
  const link = document.createElement('a')
  link.href = url
  link.download = `simulation-epargne-${parameters.years}-ans.csv`
  link.click()
  URL.revokeObjectURL(url)
}
</script>

<template>
  <header class="topbar">
    <a class="brand" href="#main"><span class="brand-icon" aria-hidden="true">↗</span> horizon<span class="brand-dot">.</span></a>
    <span class="topbar-caption">SIMULATEUR DE PATRIMOINE</span>
    <span class="local-badge"><span aria-hidden="true">●</span> Vos données restent dans votre navigateur</span>
  </header>

  <main id="main">
    <section class="intro">
      <div>
        <p class="eyebrow">VOTRE AVENIR, EN CHIFFRES</p>
        <h1>Donnez une perspective<br />à votre épargne<span>.</span></h1>
        <p class="intro-description">Ajustez vos investissements et visualisez l’évolution de votre patrimoine.</p>
      </div>
      <div class="horizon-control">
        <span id="duration-label" class="control-label">Votre horizon de simulation</span>
        <div class="duration-options" role="group" aria-labelledby="duration-label">
          <button v-for="duration in durations" :key="duration" :class="{ active: parameters.years === duration }"
            :aria-pressed="parameters.years === duration" @click="parameters.years = duration">{{ duration }} ans</button>
        </div>
      </div>
    </section>

    <div class="workspace">
      <aside class="parameters" aria-label="Paramètres de simulation">
        <div class="section-heading"><h2>Vos paramètres</h2><button class="text-button" @click="resetParameters">Réinitialiser</button></div>
        <section class="parameter-card">
          <h3><span class="section-icon" aria-hidden="true">€</span> Épargne de départ</h3>
          <label for="savings">Épargne disponible</label>
          <div class="input-unit"><AmountInput id="savings" v-model="parameters.savings" /><span>€</span></div>
          <p class="field-hint">Les apports des achats au départ sont déduits. Le reste est placé jusqu’aux achats suivants.</p>
          <div class="inline-result"><span>Apports au départ</span><strong>{{ allocationValid ? euro(depositsAtStart) : '—' }}</strong></div>
          <div class="inline-result"><span>Placement financier</span><strong>{{ allocationValid ? euro(investment) : '—' }}</strong></div>
        </section>

        <section class="property-projects" aria-label="Projets immobiliers">
        <section v-for="(project, index) in parameters.projects" :key="project.id" class="parameter-card">
          <div class="project-heading"><h3><span class="section-icon blue" aria-hidden="true">⌂</span> Projet immobilier {{ index + 1 }}</h3>
            <button v-if="parameters.projects.length > 1" class="text-button" :aria-label="`Supprimer le projet immobilier ${index + 1}`" @click="parameters.projects.splice(index, 1)">Supprimer</button>
          </div>
          <label :for="`purchase-year-${project.id}`">Année d’achat</label>
          <select :id="`purchase-year-${project.id}`" v-model.number="project.purchaseYear">
            <option v-for="year in 26" :key="year - 1" :value="year - 1">{{ year === 1 ? 'Au départ (année 0)' : `Dans ${year - 1} an${year > 2 ? 's' : ''}` }}</option>
          </select>
          <p v-if="project.purchaseYear > parameters.years" class="field-hint">Achat hors horizon : ce projet n’est pas inclus dans les résultats actuels.</p>
          <div class="field-grid">
            <div><label :for="`property-price-${project.id}`">Prix du bien</label><div class="input-unit"><AmountInput :id="`property-price-${project.id}`" v-model="project.propertyPrice" /><span>€</span></div></div>
            <div><label :for="`deposit-${project.id}`">Apport personnel</label><div class="input-unit"><AmountInput :id="`deposit-${project.id}`" v-model="project.deposit" /><span>€</span></div></div>
            <div><label :for="`loan-rate-${project.id}`">Taux annuel du prêt</label><div class="input-unit"><input :id="`loan-rate-${project.id}`" v-model.number="project.loanRate" type="number" min="0" max="30" step="0.1" /><span>%</span></div></div>
            <div><label :for="`loan-years-${project.id}`">Durée du prêt</label><select :id="`loan-years-${project.id}`" v-model.number="project.loanYears"><option v-for="duration in durations" :key="duration" :value="duration">{{ duration }} ans</option></select></div>
          </div>
          <label :for="`property-rate-${project.id}`">Évolution annuelle de la valeur du bien</label>
          <div class="input-unit"><input :id="`property-rate-${project.id}`" v-model.number="project.propertyRate" type="number" min="-20" max="20" step="0.1" /><span>%</span></div>
          <div class="inline-result"><span>Montant du crédit</span><strong>{{ validateProject(project).length ? '—' : euro(loanAmount(project)) }}</strong></div>
          <p class="field-hint">Calcul automatique : prix du bien − apport personnel.</p>
          <div class="inline-result"><span>Mensualité hors assurance</span><strong>{{ validateProject(project).length ? '—' : preciseEuro(projectPayment(project)) }} <small>/ mois</small></strong></div>
          <p class="field-hint">L’apport est retiré du placement à l’achat. Le prêt commence à cette date, avec une première mensualité un mois plus tard.</p>
        </section>
        <button class="add-project-button" @click="addProject">+ Ajouter un projet immobilier</button>
        </section>

        <section class="parameter-card">
          <h3><span class="section-icon" aria-hidden="true">↗</span> Placement financier</h3>
          <label for="investment">Capital placé au départ</label>
          <div class="input-unit"><input id="investment" :value="allocationValid ? formatAmount(investment) : ''" type="text" readonly aria-describedby="investment-hint" /><span>€</span></div>
          <p id="investment-hint" class="field-hint">Épargne disponible − apports au départ. Les futurs apports restent placés jusqu’à l’achat.</p>
          <label for="monthly-savings">Épargne mensuelle supplémentaire</label>
          <div class="input-unit"><AmountInput id="monthly-savings" v-model="parameters.monthlySavings" aria-describedby="monthly-savings-hint" /><span>€/mois</span></div>
          <p id="monthly-savings-hint" class="field-hint">Ajoutée au placement en fin de mois, pendant toute la simulation, sans prélèvement sur l’épargne de départ.</p>
          <label for="investment-rate">Rendement annuel estimé</label>
          <div class="input-unit"><input id="investment-rate" v-model.number="parameters.investmentRate" type="number" min="-50" max="50" step="0.1" /><span>%</span></div>
          <p class="field-hint">Intérêts composés, réinvestis chaque année.</p>
          <div class="inline-result"><span>Versements cumulés à {{ parameters.years }} ans</span><strong>{{ final ? euro(final.contributions) : '—' }}</strong></div>
        </section>
      </aside>

      <section class="results" aria-label="Résultats de simulation">
        <div v-if="errors.length" class="error-panel" role="alert">
          <h2>Quelques paramètres à ajuster</h2>
          <ul><li v-for="error in errors" :key="error">{{ error }}</li></ul>
        </div>
        <template v-if="final">
          <div class="summary-grid" aria-live="polite">
            <article class="summary-card primary">
              <p>Patrimoine net à {{ parameters.years }} ans</p>
              <strong>{{ euro(final.netWorth) }}</strong>
              <span>Épargne + immobilier − dette restante</span>
            </article>
            <article class="summary-card">
              <p>Épargne mobilisable</p>
              <strong>{{ euro(final.available) }}</strong>
              <span>Valeur du placement à terme</span>
            </article>
            <article class="summary-card">
              <p>{{ final.investmentInterest < 0 ? 'Perte du placement' : 'Intérêts du placement' }}</p>
              <strong class="accent">{{ euro(final.investmentInterest) }}</strong>
              <span>Hors versements, avant fiscalité</span>
            </article>
          </div>

          <article class="chart-card">
            <div class="section-heading"><div><h2>Votre patrimoine dans le temps</h2><p>Une vision d’ensemble, année après année.</p></div><span class="pill">Projection sur {{ parameters.years }} ans</span></div>
            <div class="chart-legend"><span><i class="legend-net"></i>Patrimoine net</span><span><i class="legend-available"></i>Épargne mobilisable</span><span><i class="legend-debt"></i>Dette restante</span></div>
            <svg class="chart" viewBox="0 0 810 280" role="img" aria-labelledby="chart-title chart-description">
              <title id="chart-title">Évolution du patrimoine sur {{ parameters.years }} ans</title>
              <desc id="chart-description">Patrimoine net final : {{ euro(final.netWorth) }}. Épargne mobilisable : {{ euro(final.available) }}. Dette restante : {{ euro(final.debt) }}. Le détail annuel figure dans le tableau ci-dessous.</desc>
              <defs><linearGradient id="area" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="#15866b" stop-opacity=".13" /><stop offset="100%" stop-color="#15866b" stop-opacity="0" /></linearGradient></defs>
              <g v-for="tick in ticks" :key="tick"><line x1="70" x2="780" :y1="y(tick)" :y2="y(tick)" class="gridline" /><text x="58" :y="y(tick) + 4" text-anchor="end">{{ Math.round(tick / 1000) }} k€</text></g>
              <polygon :points="`${x(0)},${y(chartMin)} ${points('netWorth')} ${x(parameters.years)},${y(chartMin)}`" fill="url(#area)" />
              <polyline :points="points('netWorth')" class="line net" />
              <polyline :points="points('available')" class="line available" />
              <polyline :points="points('debt')" class="line debt" />
              <g v-for="year in yearTicks" :key="year"><text :x="x(year)" y="262" text-anchor="middle">{{ year === 0 ? 'Aujourd’hui' : `${year} ans` }}</text></g>
            </svg>
          </article>

          <div class="detail-grid">
            <article class="detail-card"><span class="detail-icon" aria-hidden="true">⌂</span><div><p>Valeur des biens à terme</p><strong>{{ euro(final.property) }}</strong><span>Capital restant dû total : {{ euro(final.debt) }}</span></div></article>
            <article class="detail-card"><span class="detail-icon" aria-hidden="true">%</span><div><p>Coût total des crédits</p><strong>{{ euro(totalLoanInterest) }}</strong><span>Intérêts sur la durée complète des prêts des achats inclus, hors assurance</span></div></article>
          </div>

          <article class="table-card">
            <div class="section-heading"><div><h2>Le détail de votre projection</h2><p>Montants en euros, arrondis à l’unité.</p></div><button class="export-button" @click="exportCsv"><span aria-hidden="true">↓</span> Exporter CSV</button></div>
            <div class="table-scroll" tabindex="0" role="region" aria-label="Projection annuelle, tableau défilant">
              <table>
                <caption class="sr-only">Projection annuelle de l’épargne et du patrimoine immobilier</caption>
                <thead><tr><th scope="col">Année</th><th scope="col">Placement</th><th scope="col">Versements cumulés</th><th scope="col">Apports cumulés</th><th scope="col">Intérêts cumulés</th><th scope="col">Immobilier</th><th scope="col">Dette restante</th><th scope="col">Mensualité totale après achats</th><th scope="col">Épargne mobilisable</th><th scope="col">Patrimoine net</th></tr></thead>
                <tbody><tr v-for="row in projection" :key="row.year" :class="{ 'last-row': row.year === parameters.years }"><th scope="row">{{ row.year === 0 ? 'Départ' : `${row.year} ans` }}</th><td>{{ euro(row.investment) }}</td><td>{{ euro(row.contributions) }}</td><td>{{ euro(row.deposits) }}</td><td>{{ euro(row.investmentInterest) }}</td><td>{{ euro(row.property) }}</td><td>{{ euro(row.debt) }}</td><td>{{ preciseEuro(row.monthlyPayments) }}</td><td>{{ euro(row.available) }}</td><td class="net-cell">{{ euro(row.netWorth) }}</td></tr></tbody>
              </table>
            </div>
          </article>
        </template>
        <aside class="assumptions">
          <h2><span aria-hidden="true">ⓘ</span> Comprendre cette simulation</h2>
          <p>Les apports des achats au départ sont déduits de l’épargne initiale et le reste est placé. Chaque achat futur intervient après le nombre d’années indiqué, après le versement mensuel de cette échéance : son apport est alors retiré du placement. Les apports simultanés doivent être finançables ensemble ; sinon une alerte bloque la projection. Le prix saisi est la valeur du bien à sa date d’achat. Les achats hors horizon ne sont pas inclus.</p>
          <p>Chaque crédit vaut le prix du bien moins son apport et commence à l’achat. La première mensualité est due le mois suivant. La valeur de chaque bien évolue seulement après son achat. Le patrimoine immobilier et la dette affichés sont les totaux de tous les projets achetés. Les intérêts du placement comprennent les gains réalisés avant le retrait des apports, sans compter les versements ni traiter les retraits comme des pertes.</p>
          <p><strong>Les mensualités du prêt et l’épargne mensuelle supplémentaire sont financées par vos revenus, en dehors de l’épargne de départ.</strong> L’épargne mensuelle est versée sur le placement en fin de mois et bénéficie du même rendement, avec un taux mensuel équivalent au taux annuel saisi. Les intérêts affichés excluent les versements. Aucun loyer ou autre revenu n’est ajouté à la projection. L’immobilier n’est pas de l’argent immédiatement disponible.</p>
          <p>Prêt à taux fixe, amorti mensuellement ; rendement annuel constant et intérêts capitalisés. Fiscalité, inflation, assurance, frais d’achat, de placement et d’entretien exclus. Les rendements ne sont pas garantis : cette estimation ne constitue pas un conseil financier.</p>
        </aside>
      </section>
    </div>
    <footer><span class="footer-brand">horizon.</span><span>Des hypothèses claires. Des décisions éclairées.</span></footer>
  </main>
</template>
