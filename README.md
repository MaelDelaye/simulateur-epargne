# Horizon — Simulateur d’épargne

Application Vue 3 et TypeScript de simulation du patrimoine sur 5, 10, 15, 20 ou 25 ans. Les calculs sont effectués dans le navigateur, sans transmission des données financières.

## Utilisation

- Un projet immobilier est présent par défaut. Ajouter autant de projets que nécessaire, ou supprimer les projets supplémentaires. La réinitialisation restaure un seul projet.
- Chaque projet peut être nommé via l’icône crayon à côté de son titre. Entrée ou la sortie du champ valide le nom ; Échap annule la modification. Le nom apparaît dans le titre de sa carte, son bouton de suppression et les alertes. Un nom vide utilise « Projet immobilier » suivi de son identifiant ; renommer un projet ne modifie pas les calculs.
- Chaque projet possède son année d’achat (0 à 25), prix, apport, taux et durée du prêt, et évolution immobilière. Le crédit est calculé automatiquement : prix du bien − apport.
- Chaque projet est une résidence principale (par défaut), une résidence secondaire ou un investissement locatif. Pour les deux derniers types, saisir les revenus nets mensuels (0 € par défaut). Le montant saisi est conservé lors d’un changement de type, mais ignoré pour une résidence principale.
- Des charges annuelles supplémentaires (0 € par défaut) peuvent être saisies pour chaque projet, quel que soit le type de bien. Leur coût cumulé figure dans les résultats et l’export CSV.
- L’épargne disponible est la base de la simulation : seuls les apports des achats au départ sont déduits immédiatement. Le reste est placé ; les futurs apports sont retirés à la date d’achat.
- Une épargne mensuelle supplémentaire, nulle par défaut, peut être versée sur le placement pendant toute la simulation. Les versements cumulés apparaissent dans les résultats et l’export CSV, séparément des intérêts.
- La durée du prêt est indépendante de l’horizon de simulation.
- Les résultats se recalculent automatiquement : mensualité, intérêts, épargne mobilisable, valeur immobilière et patrimoine net.
- Le graphique et le tableau présentent la projection annuelle. L’export CSV inclut également les intérêts du crédit et les remboursements cumulés.
- Les apports simultanés doivent être couverts par le placement à la date d’achat. Sinon, la projection est bloquée avec une alerte indiquant l’année, les projets concernés, le capital nécessaire et le capital disponible.
- L’apport ne peut pas dépasser le prix du bien. Si l’apport couvre exactement le prix, aucun crédit n’est nécessaire et la mensualité est nulle.

## Hypothèses

**Capital placé au départ = épargne disponible − somme des apports des achats en année 0**. Il ne reste aucune épargne non investie. Un achat en année N intervient après N années de placement, après le versement mensuel de cette échéance et avant les mensualités du nouveau crédit. Le prix saisi est la valeur du bien à l’achat, hors frais d’achat. Sa valeur évolue uniquement après l’achat. **Montant du crédit = prix du bien − apport** pour chaque projet.

Les achats après l’horizon choisi ne sont pas inclus et restent configurés si l’horizon est ensuite allongé. Un achat à la dernière année est inclus avec sa valeur initiale et sa dette initiale, sans mensualité encore payée.

Chaque prêt à taux fixe est amorti mensuellement (taux annuel nominal divisé par 12), avec une première mensualité un mois après l’achat. À taux nul, la mensualité correspond au capital divisé par le nombre de mois. Les mensualités sont payées par des revenus externes : elles ne sont pas prélevées sur l’épargne simulée. Le tableau présente la mensualité totale en vigueur après les achats de chaque année. Le coût total des crédits inclut leur durée complète, même au-delà de l’horizon, mais exclut les achats hors horizon.

Le rendement du placement est annuel, constant, avec intérêts composés réinvestis. L’évolution de la valeur immobilière est également composée annuellement et vaut 0 % par défaut.

L’épargne mensuelle est financée par des revenus externes et versée en fin de mois. Le placement produit des intérêts au taux mensuel équivalent : **(1 + taux annuel / 100)^(1/12) − 1**. Les intérêts cumulés sont les gains ou pertes mensuels, y compris ceux réalisés avant les retraits d’apports. **Placement = épargne de départ + versements cumulés + revenus immobiliers nets cumulés − apports cumulés − charges immobilières cumulées + intérêts cumulés**. À rendement nul, il n’y a aucun intérêt. Le tableau et l’export CSV distinguent les versements, les revenus immobiliers, les apports, les charges et les intérêts.

Les charges annuelles sont constantes, prélevées sur le placement à chaque anniversaire de l’achat (première échéance un an après), après les revenus et versements mensuels mais avant les nouveaux achats à la même date. Elles continuent après remboursement du crédit et ne sont pas prélevées pour les projets non encore achetés. Les charges simultanées sont cumulées ; si le capital ne suffit pas, la projection est bloquée par une alerte indiquant l’année, les noms des projets et les montants. Elles réduisent le patrimoine et le capital produisant des intérêts, sans être comptées comme une perte de rendement. Ne pas saisir de charges déjà déduites des revenus nets immobiliers.

Les revenus nets mensuels des résidences secondaires et investissements locatifs sont constants et ajoutés au placement en fin de mois, dès le mois suivant l’achat, jusqu’à la fin de la simulation, y compris après remboursement du prêt. Ils produisent des intérêts à partir du mois suivant leur encaissement et peuvent financer les apports d’achats ultérieurs. Aucun revenu n’est généré avant l’achat, pour un achat hors horizon ou à la dernière échéance, ni pour une résidence principale. Le montant est déjà net des charges et de la fiscalité ; aucune nouvelle déduction n’est appliquée. Les mensualités des crédits restent financées séparément par des revenus externes, sans être déduites de ces revenus immobiliers.

**Épargne mobilisable** = valeur du placement.

**Patrimoine net** = épargne mobilisable + somme des valeurs des biens achetés − somme des capitaux restant dus.

La fiscalité n’est pas calculée : les revenus immobiliers saisis doivent déjà être nets. Seules les charges supplémentaires renseignées sont prélevées. Inflation, assurance, frais d’achat, frais de placement, entretien et revenus ou versements autres que ceux paramétrés ne sont pas pris en compte. Les résultats ne constituent pas un conseil financier et les rendements ne sont pas garantis.

## Développement

Node.js `^22.18.0` ou `>=24.12.0`.

```sh
npm install
npm run dev
```

Compilation et contrôle des types :

```sh
npm run build
```

## Tests unitaires

Vitest utilise Vue Test Utils et jsdom pour couvrir tous les composants Vue (y compris les composants du template et les icônes), la saisie des montants et le moteur financier. Les tests du simulateur couvrent notamment les projets multiples, les achats différés, les apports insuffisants, les versements mensuels et l’export CSV. Les fichiers de test sont également contrôlés par `npm run type-check`.

Exécuter la suite :

```sh
npm test
```

Relancer automatiquement les tests lors des modifications :

```sh
npm run test:watch
```
