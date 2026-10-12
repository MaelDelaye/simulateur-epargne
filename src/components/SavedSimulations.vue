<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { isSnapshot, readSavedSimulations, SavedSimulationError, writeSavedSimulations } from '../savedSimulations'
import type { SavedSimulation, SimulationSnapshot } from '../savedSimulations'

const props = defineProps<SimulationSnapshot>()
const emit = defineEmits<{
  load: [snapshot: SimulationSnapshot]
  compare: [simulation: SavedSimulation]
  remove: [id: string]
}>()
const name = ref('')
const saved = ref<SavedSimulation[]>([])
const message = ref('')
const error = ref('')
const menu = ref<HTMLDetailsElement | null>(null)

function closeMenu() {
  if (!menu.value) return
  menu.value.open = false
  menu.value.querySelector('summary')?.focus()
}
const date = (value: string) => new Intl.DateTimeFormat('fr-FR', {
  dateStyle: 'short', timeStyle: 'short',
}).format(new Date(value))

function withStorage(operation: (storage: Storage) => void) {
  error.value = ''
  message.value = ''
  try {
    operation(window.localStorage)
  } catch (cause) {
    if (cause instanceof DOMException && ['SecurityError', 'QuotaExceededError'].includes(cause.name)) {
      error.value = cause.name === 'QuotaExceededError'
        ? 'Le stockage du navigateur est plein. La sauvegarde n’a pas été enregistrée.'
        : 'Le stockage local est inaccessible. Autorisez son accès dans les réglages du navigateur.'
    } else if (cause instanceof SavedSimulationError) {
      error.value = cause.message
    } else {
      throw cause
    }
  }
}

onMounted(() => withStorage((storage) => { saved.value = readSavedSimulations(storage) }))

function save() {
  if (!name.value.trim()) {
    message.value = ''
    error.value = 'Donnez un nom à la simulation avant de la sauvegarder.'
    return
  }
  if (!isSnapshot(props)) {
    message.value = ''
    error.value = 'Corrigez les paramètres et le salaire avant de sauvegarder la simulation.'
    return
  }
  withStorage((storage) => {
    const entries = readSavedSimulations(storage)
    const entry: SavedSimulation = {
      id: crypto.randomUUID(), name: name.value.trim(), savedAt: new Date().toISOString(),
      parameters: {
        ...props.parameters,
        projects: props.parameters.projects.map((project) => ({ ...project })),
      },
      monthlySalary: props.monthlySalary,
    }
    const next = [...entries, entry]
    writeSavedSimulations(storage, next)
    saved.value = next
    name.value = ''
    message.value = `« ${entry.name} » a été sauvegardée.`
  })
}

function load(id: string) {
  withStorage((storage) => {
    const entries = readSavedSimulations(storage)
    const entry = entries.find((item) => item.id === id)
    if (!entry) {
      error.value = 'Cette sauvegarde n’existe plus dans le navigateur.'
      saved.value = entries
      return
    }
    saved.value = entries
    emit('load', { parameters: structuredClone(entry.parameters), monthlySalary: entry.monthlySalary })
    message.value = `« ${entry.name} » a été chargée.`
  })
}

function remove(id: string) {
  withStorage((storage) => {
    const entries = readSavedSimulations(storage)
    const entry = entries.find((item) => item.id === id)
    if (!entry) {
      error.value = 'Cette sauvegarde n’existe plus dans le navigateur.'
      saved.value = entries
      return
    }
    const next = entries.filter((item) => item.id !== id)
    writeSavedSimulations(storage, next)
    saved.value = next
    emit('remove', id)
    message.value = `« ${entry.name} » a été supprimée.`
  })
}

function compare(id: string) {
  withStorage((storage) => {
    const entries = readSavedSimulations(storage)
    const entry = entries.find((item) => item.id === id)
    saved.value = entries
    if (!entry) {
      error.value = 'Cette sauvegarde n’existe plus dans le navigateur.'
      return
    }
    emit('compare', structuredClone(entry))
    closeMenu()
  })
}
</script>

<template>
  <details ref="menu" class="save-menu" @keydown.esc.prevent="closeMenu">
    <summary class="save-menu-trigger" aria-label="Gérer les simulations sauvegardées" title="Simulations sauvegardées">
      <svg width="21" height="21" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
        <path d="M4 3h13l4 4v14H3V3h1Z" /><path d="M7 3v6h10V3M7 21v-8h10v8M14 3v4" />
      </svg>
    </summary>
  <section class="saved-simulations parameter-card" aria-label="Simulations sauvegardées">
    <h2>Simulations sauvegardées</h2>
    <form @submit.prevent="save">
      <label for="simulation-name">Nom de la simulation</label>
      <div class="input-unit"><input id="simulation-name" v-model="name" type="text" placeholder="Mon scénario" /></div>
      <button class="save-button" type="submit">Sauvegarder la simulation</button>
    </form>
    <p v-if="error" role="alert" class="storage-error">{{ error }}</p>
    <p v-if="message" role="status" class="field-hint">{{ message }}</p>
    <ul v-if="saved.length" class="saved-list">
      <li v-for="entry in saved" :key="entry.id">
        <div><strong>{{ entry.name }}</strong><span class="field-hint">{{ date(entry.savedAt) }}</span></div>
        <div class="saved-actions">
          <button class="text-button" :aria-label="`Charger ${entry.name}`" @click="load(entry.id)">Charger</button>
          <button class="text-button" :aria-label="`Comparer ${entry.name}`" @click="compare(entry.id)">Comparer</button>
          <button class="text-button" :aria-label="`Supprimer la simulation ${entry.name}`" @click="remove(entry.id)">Supprimer</button>
        </div>
      </li>
    </ul>
    <p v-else class="field-hint">Aucune simulation sauvegardée.</p>
    <p class="field-hint">Sauvegarde manuelle, sans remplacement des scénarios existants. Charger remplace les paramètres affichés, sans sauvegarder les modifications en cours. Données financières conservées uniquement dans ce navigateur, non chiffrées ; effacer les données du site supprime les sauvegardes.</p>
  </section>
  </details>
</template>
