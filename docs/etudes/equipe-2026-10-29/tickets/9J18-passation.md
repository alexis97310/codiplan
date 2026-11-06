# 9J18-SUITE-A-DONNER-ECRAN — passation

Budget : T0 17:00 (Pacific/Noumea), limite 150 min. Terminé sans dépasser T0+90 pour le code neuf.

## Contradiction signalée, puis résolue par le dépôt frozen lui-même

Le ticket demande (point 2) que « Qualifier » crée la ligne au statut `a_qualifier`. Mais
`lib/suite-a-donner/depot.ts` (hors territoire, « quatre fonctions, pas plus », 9J17) n'offre
QUE `qualifierSuite`, qui crée la ligne **directement** à `qualifiee` — et son propre docblock dit en
toutes lettres : « `a_qualifier` reste l'état de naissance porté par le schéma... aucun écran de ce
ticket n'en a besoin (9J18) ». Plutôt que de m'arrêter, j'ai suivi cette note explicitement adressée à
ce ticket : le bouton « Qualifier » appelle `qualifierSuite` telle quelle, et la ligne naît `qualifiee`,
jamais `a_qualifier` (qui reste un état théorique du schéma, jamais atteint en pratique). Le mot
« à_qualifier » qui apparaît dans `lib/suite-a-donner/lecture.ts` et à l'écran est une lecture
**virtuelle** (une intervention clôturée sans ligne `SuiteADonner`), jamais une colonne.

## Point par point

1. **Onglet** (`app/(back-office)/interventions/suites-a-donner/`) — un EMPLACEMENT de plus dans
   `OngletsRegistre`, même famille que « À facturer » (pas la forme `?onglet=` de D164, qui suppose le
   MÊME modèle des deux côtés — ici `SuiteADonner` est une table voisine). `lib/suite-a-donner/lecture.ts`
   (nouveau fichier, jamais `depot.ts`) lit les deux formes : interventions clôturées sans ligne encore, et
   lignes `SuiteADonner` à leur statut réel. Aucune seconde politique RLS.
2. **Qualification manuelle** — `app/api/interventions/suites-a-donner/qualifier/route.ts` vérifie les
   trois conditions (clôturée, `suite_a_donner` non vide, pas déjà qualifiée) AVANT d'appeler
   `qualifierSuite` ; lecture et écriture ne sont PAS dans la même transaction (`suite_a_donner.
   intervention_origine_id` ne porte pas d'unicité — un double clic très rapide pourrait en théorie créer
   deux lignes ; risque nommé, pas caché, fermeture hors territoire : aucune migration).
3. **Déplacement de la reprise** (FLX-6/7) — `app/(back-office)/interventions/suites-a-donner/[id]/
   replanifier/` réutilise `lib/interventions/creneaux.ts` à l'identique des paramètres que construit
   `verdict-pose/route.ts` (calendrier, occupations, absence), sans l'exclusion `NOT: {id}` (l'intervention
   n'existe pas encore). Le technicien de l'intervention d'ORIGINE est pré-sélectionné ; s'il est absent,
   un avertissement le dit — jamais de bascule silencieuse sur un autre.
4. **Intervention de reprise** (FLX-11) — `lib/suite-a-donner/reprise.ts` (nouveau fichier, PAS
   `depot.ts`). `jugerPose` (`lib/interventions/depot.ts`, déjà exportée pour `verdict-pose`) est appelée
   directement sur une ligne VIRTUELLE (uuid déjà tiré, statut `a_planifier`) : les mêmes refus
   RG-PLA-03/04/06/07 qu'une pose ordinaire, aucune règle recopiée. **Le lien se pose APRÈS la création**,
   jamais avant comme D176 (`creerIntervention`/demande) : `intervention_reprise_id` est une clé étrangère
   vers la ligne qu'on s'apprête à créer, la poser avant violerait la contrainte. La garde contre un double
   envoi est donc un `updateMany` conditionnel APRÈS le `create`, qui lève (classe d'erreur dédiée) si une
   autre requête a gagné la course — `$transaction` défait alors la création orpheline.
   - **Type `curatif`, PROVISOIRE** : `TypeIntervention.reprise` désigne déjà la reprise DE MATÉRIEL
     (chapitre 11.2, un sens différent). Décision d'Alexis attendue au ticket 9J12.
   - **Non repris, scope réduit faute de temps** : les machines de l'intervention d'origine (le ticket ne
     les mentionne pas), le contact et la référence client. Le forfait de déplacement EST repris tel quel
     (`forfait_deplacement_id` de l'origine — `forfaitDeDeplacement`, qui le recalculerait depuis la zone,
     n'est pas exportée de `lib/interventions/depot.ts`).
5. **Priorité héritée** (FLX-9) — directement dans `creerReprise` : `priorite: origine.priorite`. Aucune
   valeur neuve sur `PrioriteIntervention`.
6. **Clôture automatique au rattachement** — `cloturerSuiteSiReprise` (`lib/suite-a-donner/reprise.ts`),
   appelée depuis `app/api/interventions/[id]/cloturer/route.ts` APRÈS une clôture acceptée (le SEUL
   endroit où une intervention se clôture, quelle que soit son origine). Deux transactions, jamais une
   seule — un déclencheur APPLICATIF, jamais PostgreSQL, comme demandé.
7. **Captures** — `tests/e2e/captures-9j18-suite-a-donner.spec.ts`, sa propre scène jetable (agence DUCOS,
   jamais le semis partagé — mémoire « e2e-semis-partage-parallele »). Trois épreuves, AVANT/APRÈS,
   375/1280 px, dans `docs/etudes/equipe-2026-10-29/tickets/9J18-captures/`. Corrigé au passage : le
   bandeau de motif de l'onglet empruntait le ton rouge du refus même pour un succès — visible sur la
   première capture APRÈS avant correction ; `CLASSES_TON` choisit désormais le ton sur la clé.
   **Pas de variante « cartes » mobile** : le tableau unique s'appuie sur le défilement horizontal de
   `CadreDefilant`, jamais une seconde structure DOM comme `ListeCartes` du registre principal — lisible à
   375 px sur la capture, mais un écart nommé plutôt qu'un oubli.

## Gardiens câblés en chemin (non prévus par le ticket, découverts en jouant `pnpm test`)

- `scripts/lib/chemins-de-depot.ts` — `qualifierSuite` et `cloturer` retirées de `FONCTIONS_SANS_CHEMIN`
  (appelées réellement) ; `lib/suite-a-donner` retiré de `MODULES_SANS_CHEMIN` (le module entier a
  maintenant un chemin, via `lecture.ts`/`reprise.ts`/`depot.ts`). `enregistrerAccord`/`marquerPieceRecue`
  restent exemptées, motif réécrit : cibles de FLX-2/FLX-3/FLX-8, toujours futures.
- `tests/unit/auth/porte.test.ts` (D153) — les deux routes neuves dans `ROUTE_CAPACITE`/`PORTE_COMPLETE`
  (`modifier_planning`, porte complète — aucun ○ technicien), compte de routes 96 → 98.
- `tests/unit/i18n/vocabulaire-impose.test.ts` (D172) — « replanifier » est un synonyme FERMÉ du
  glossaire (→ « Déplacer… ») ; toutes les VALEURS du dictionnaire renommées (« À déplacer », pas
  « À replanifier » ; « Confirmer le déplacement »...). Seuls les IDENTIFIANTS TECHNIQUES (le statut de
  schéma `a_replanifier`, la fonction `creerReprise`, le segment de route `/replanifier`) gardent le mot —
  L0-11 ne couvre que ce qu'un humain LIT.
- `tests/unit/dates/comparaison-civile.test.ts` (DATES-1) — exemption nommée pour l'écran de
  déplacement : l'instant lu (`maintenant(calendrier.fuseau).instant`) est passé à `creneauxDisponibles`,
  qui le compare à d'autres INSTANTS (créneaux candidats), jamais à une `@db.Date` — même famille que la
  route `verdict-pose`, hors du périmètre de ce gardien (`app/api`).
- `docs/constitution/organisation-du-code.md` §6 — section `lib/suite-a-donner/` étendue (`lecture.ts`,
  `reprise.ts`, le type `curatif` provisoire) ; sommaires `components/`/`prisma/`/`tests/`/`docs/` décalés
  de l'ajout et remis à jour dans le sommaire à lignes.

## Épreuves

- `tests/isolation/suite-a-donner-reprise.test.ts` (nouveau) — `creerReprise` confrontée au chemin de
  production réel (`jugerPose`) : création + lien même transaction, priorité héritée, refus si statut
  invalide, et le CHEVAUCHEMENT (RG-PLA-03) avec preuve qu'aucune ligne orpheline ni aucun lien ne
  survit au refus. `cloturerSuiteSiReprise` testée séparément (insertion directe d'une reprise `cloturee`,
  hors matrice D8 — hors sujet pour cette fonction précise).
- `tests/e2e/captures-9j18-suite-a-donner.spec.ts` — la chaîne réelle qualifier → déplacer → confirmer,
  jusqu'à la redirection vers la fiche de la nouvelle intervention.
- Non testé automatiquement : la clôture automatique de bout en bout via l'écran (fermer réellement la
  fiche de la reprise jusqu'à `cloturee` suppose le cycle complet affecter → transmettre → terminer →
  clôturer, hors budget) — couverte par l'isolation ci-dessus pour `cloturerSuiteSiReprise` seule, et par
  lecture de code pour le branchement (trois lignes dans `cloturer/route.ts`).

## Ce qui reste à faire (prochains tickets, déjà nommés par le territoire)

1. **9J12** — trancher le nom du type de l'intervention de reprise (`curatif` aujourd'hui, provisoire).
2. **FLX-2 / FLX-3 / FLX-8** — les écrans qui appellent `enregistrerAccord`/`marquerPieceRecue`
   (actuellement atteignables seulement par appel direct, comme ce ticket le fait dans sa scène e2e).
3. Reprendre machines/contact/référence client de l'intervention d'origine vers la reprise, si jugé utile —
   non fait, le ticket ne les nommait pas.
4. Une variante mobile en cartes pour l'onglet, si la densité du tableau à 375 px devient un problème réel
   (aujourd'hui lisible, voir les captures).

## Vérification jouée

`CI=1 pnpm verify` (format:check, typecheck, lint, test, test:isolation, build) — tous verts, à chaque
point. `pnpm test` (5525), `pnpm test:isolation` (1909) rejoués en entier plusieurs fois pendant le
ticket, verts à la fin. `test:e2e` : le seul spec neuf a été joué isolément (3/3 verts, captures prises) ;
`verify:full` (qui inclut tout `test:e2e`) est laissé à la file, comme demandé.
