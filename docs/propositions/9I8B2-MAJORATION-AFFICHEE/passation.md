# 9I8B2-MAJORATION-AFFICHEE — passation

Démarré le 31/10/2026 à 23:45 (Nouméa), budget 90 min. Décision d'Alexis
(31/10/2026 ~21:10) : correctif à faire AVANT le gel de la démo (lundi
02/11 12:00).

## Le défaut mesuré par le pilote

`majorationApplicableALIntervention` (`lib/interventions/depot.ts`)
rejouait `majorationDeLIntervention` avec une main-d'œuvre PLACEHOLDER
(`zero(devise)`), puis décidait sur `verdict.majoration.supplement.valeur >
0`. Or `supplement = arrondi(assiette × 1/2)` et `assiette` est calculée À
PARTIR de cette même main-d'œuvre (`lib/tarification/majoration.ts`) :
avec une main-d'œuvre à zéro, `assiette` et `supplement` valent TOUJOURS
zéro, quelles que soient les minutes réellement hors ouverture. La mention
« hors heures d'ouverture : majoration applicable » ne pouvait donc jamais
s'afficher sur le chemin NON FIGÉ (écran de signature du technicien, bon
d'une intervention non close ou close sans `valorisation_figee`) — alors
que le docblock affirmait l'inverse (« le taux est une fraction du créneau,
indépendante de la valeur de la main-d'œuvre »).

Le chemin FIGÉ (une intervention déjà clôturée, dont le bon relit
`valorisation_figee`) n'est PAS touché par ce défaut : il porte la vraie
main-d'œuvre, calculée une fois pour toutes à la clôture.

## Ce qui est livré

### Point 1 — correctif

`majorationApplicableALIntervention` se décide désormais sur
`verdict.majoration.minutesHorsOuverture > 0` — qui ne dépend que du
créneau et du calendrier, jamais de la main-d'œuvre. Le placeholder
`zero(devise)` reste (aucun chiffre réel n'est demandé ni n'en sort : seule
la PRÉSENCE d'une main-d'œuvre compte pour que le verdict soit « connu »,
jamais « inconnue »). Docblock corrigé pour dire la vérité ci-dessus.

Un mode qui ne facture pas d'heures (`forfait`) continue de rendre faux
sans même poser la question au calendrier — ce garde-fou n'a pas changé.

### Point 2 — épreuves

- **Isolation** (`tests/isolation/bon-intervention.test.ts`) : trois cas,
  appelant directement `lignesConditionsFacturation` (exporté par
  `depot.ts`) sur SA PROPRE ligne construite en mémoire (pas d'intervention
  en base — seul un technicien rattaché à `AGENCE_A` est posé, pour que
  `majorationDeLIntervention` puisse lire son agence) :
  - créneau EN PARTIE hors ouverture de `CALENDRIER_A` (8 h–12 h), mode
    `temps_passe` → la ligne de majoration s'affiche ;
  - créneau ENTIÈREMENT dans l'ouverture (même bornes que le test déjà
    existant plus haut dans le fichier) → elle ne s'affiche pas ;
  - mode `forfait`, même créneau hors ouverture que le premier cas → elle
    ne s'affiche pas non plus.
- **E2E** (`tests/e2e/9i8b2-majoration-affichee.spec.ts`), SA PROPRE scène
  (client/site/deux interventions, préfixées `zz9I8B2`) :
  - une intervention `en_cours`, créneau 11 h–13 h un lundi de la scène sur
    DUCOS (ouverture 7 h 30–11 h 30 puis 13 h–17 h, `DEMO-NOUMEA`) — 30 min
    ouvertes, 90 min hors ouverture, donc ni l'un ni l'autre en totalité —
    vue sur `/terrain/[id]` (écran de signature) : la phrase s'affiche,
    aucun montant ni dans le HTML ni dans les réponses de
    `/api/terrain/instantane` (même garantie que
    `9i8b-conditions-de-facturation-sans-montant.spec.ts`) ;
  - une intervention `cloturee`, `valorisation_figee` posée directement
    avec une majoration CONNUE et POSITIVE (même patron que
    `captures-9i8a1-regle-facturation.spec.ts`, chemin FIGÉ — inchangé par
    ce lot, simplement rejoué pour prouver qu'il continue de dire vrai) —
    vue sur la version CLIENT du bon : même phrase, aucun montant.

Les deux captures (voir plus bas) sont prises AVANT l'assertion qui
distingue le code d'avant et d'après ce correctif, pour que le run AVANT
(rouge attendu sur le premier scénario) les produise quand même.

### Point 3 — captures

AVANT (worktree sur `077886f3f`, le commit qui précède le point 1 de ce
lot) et APRÈS (HEAD), via `CAPTURE_PHASE=avant|apres` lu par le spec e2e
lui-même. Dans `docs/propositions/9I8B2-MAJORATION-AFFICHEE/captures/` :

- `terrain-signature-majoration-375-avant.png` / `-apres.png` — la phrase
  est absente avant, visible après ;
- `bon-client-majoration-375-avant.png` / `-apres.png` et
  `-1280-avant.png` / `-apres.png` — identiques aux deux temps (chemin
  figé, non touché par ce correctif).

## Décisions prises sans ouvrir de ticket

- **Le placeholder `zero(devise)` reste en main-d'œuvre** plutôt que
  `null` : `null` ferait lever le motif « main_doeuvre_absente » (lu comme
  « inconnue »), alors que cette question est en réalité hors sujet pour un
  booléen qui ne lit jamais le supplément. Aucune règle métier nouvelle :
  une lecture plus exacte du code déjà écrit par 9I8B-CONDITIONS-DE-
  FACTURATION-SANS-MONTANT.
- **Aucune migration, aucun changement de signature publique** — seule la
  condition interne à une fonction non exportée a changé ; `depuis` de
  `lignesConditionsFacturation` (la seule fonction exportée du voisinage) a
  un contrat inchangé.

## Suite possible

Aucune connue à ce jour — le chemin figé et les trois réglages de 9I8A ne
sont pas concernés.
