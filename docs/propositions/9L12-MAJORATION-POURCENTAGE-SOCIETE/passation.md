# 9L12-MAJORATION-POURCENTAGE-SOCIETE — passation

Démarré le 18/11/2026 à 05:20 (Nouméa), budget 120 min.

## La règle tenue

Décision d'Alexis du 10/11/2026 (option 1) : le calcul de la majoration hors
ouverture (D12, RG-INT-08) lit désormais le pourcentage RÉGLÉ PAR LA SOCIÉTÉ
(`societe.majoration_hors_ouverture_pct`) — plus de +50 % en dur. Le
pourcentage qui a servi à facturer est FIGÉ dans `valorisation_figee` à la
clôture, et une intervention CLÔTURÉE ne le relit plus jamais. Le barème du
portail (`/portail/tarifs`) et le calcul lisent la MÊME donnée, par la MÊME
fonction — ils ne peuvent plus diverger.

## Ce qui est livré

### Point 1 — la lecture, partagée

`lib/tarification/majoration.ts` :

- `TAUX_MAJORATION` (la constante fixe) devient `TAUX_MAJORATION_HISTORIQUE` —
  même rôle que `REGLE_HISTORIQUE` (`lib/tarification/valorisation.ts`) : elle
  ne sert plus qu'à relire une intervention clôturée AVANT cette décision et
  dont la décomposition n'a pas été figée (migration non rétroactive,
  `valorisation_figee` encore `null`).
- `tauxMajorationDepuisPourcentage(pct: Prisma.Decimal): TauxMajoration | null`
  — fonction PURE qui convertit le `Decimal(5,2)` de la société en fraction
  EXACTE (`.times(100)`, jamais `.toFixed` : ce dernier est le marqueur que
  `tests/unit/money/sans-decimales-en-dur.test.ts` refuse partout hors
  `lib/money`, pourcentage compris — mesuré, la première version de ce
  module l'utilisait et le gardien a rougi). `null` si le pourcentage est
  négatif — aucune contrainte `CHECK` ne l'empêche en base aujourd'hui.
- `lireTauxMajorationSociete(tx, societeId)` — lit la colonne et applique la
  fonction ci-dessus ; c'est la fonction que `lib/interventions/depot.ts`
  appelle, et que `app/api/portail/tarifs/lecture.ts` aurait appelée aussi si
  elle ne portait pas déjà la MÊME colonne dans sa lecture combinée (« un seul
  appel serveur », 9J20) — la source est donc la même colonne, interprétée
  par la même fonction, jamais deux lectures qui pourraient diverger.
- `majorationHorsOuverture` reçoit un cinquième paramètre, `tauxMajoration:
  TauxMajoration | null`, et un cinquième motif,
  `intervention.majoration.pourcentage_invalide` (prononcé comme
  `technicien_absent`/`calendrier_absent` : c'est le dépôt qui a lu la
  société et rapporte `null`). **Le taux n'est vérifié que si le créneau
  tombe hors ouverture** : un créneau ENTIÈREMENT dans l'ouverture rend zéro
  quel que soit le taux, y compris un taux invalide qu'on n'a pas besoin de
  connaître pour rendre zéro — même raison que pour `mainDoeuvre`, qui elle
  reste vérifiée plus tôt (la devise du zéro en dépend).

`lib/interventions/depot.ts` :

- `majorationDeLIntervention` prend désormais le taux en PARAMÈTRE (fourni
  par l'appelant) plutôt que de le lire lui-même — ses deux appelants
  (`valoriserEnDirect`, `majorationApplicableALIntervention`) le lisent CHACUN
  selon leur propre cas, exactement comme `regle`/`REGLE_HISTORIQUE` déjà en
  place pour la règle d'arrondi.
- `valoriserEnDirect` (clôture, fiche pas-encore-close) reçoit `regle` ET
  `tauxMajoration` du même geste.
- La clôture (`cloturerIntervention`) lit le taux COURANT au moment où elle
  calcule — c'est lui qui est FIGÉ sur `valorisation_figee`, pour toujours.
- `lireFicheIntervention` : trois cas, inchangés dans leur principe
  (9I8A1-REPRISE-9I8A) — clôturée AVEC décomposition figée → relit le JSON,
  jamais de recalcul ; pas encore close → taux COURANT ; clôturée AVANT cette
  migration SANS décomposition figée → `TAUX_MAJORATION_HISTORIQUE`, jamais
  le réglage actuel (même raison que `REGLE_HISTORIQUE` pour ce même cas).
- `majorationApplicableALIntervention` (l'aperçu sans montant, écran de
  signature / bon client) lit le taux COURANT — c'est toujours un aperçu
  avant clôture, jamais un rejeu d'une intervention close.

`lib/i18n/fr.ts` : la clé `intervention.majoration.pourcentage_invalide`,
rangée avec les quatre autres motifs de la majoration (desormais cinq).

### Point 2 — épreuves

- **Unitaires** (`tests/unit/tarification/majoration.test.ts`) : société à
  25 %, à 50 % (même supplément que l'ancien taux fixe, valeur comparée par
  comportement — la fraction n'est pas réduite, 5000/10000 plutôt que 1/2,
  et c'est la même valeur, pas la même représentation), à 0 % (permis :
  aucun supplément, quel que soit le créneau), pourcentage négatif refusé
  (`null`), le taux n'est vérifié QUE si le créneau tombe hors ouverture (un
  créneau entièrement ouvert reste à zéro avec un taux `null`), deux
  sociétés à deux taux appliqués au même créneau donnent deux suppléments
  différents. 26 scénarios, tous verts.
- **Isolation** :
  - `tests/isolation/9j20-portail-tarifs.test.ts` — un pourcentage réglé
    chez A (25 %) n'apparaît jamais dans le barème de B (60 %), et
    réciproquement (forme « société », I1), restauré après coup.
  - `tests/isolation/valorisation-intervention.test.ts` — nouveau bloc
    RG-INT-08 : une société à 25 % sur un créneau ENTIÈREMENT hors ouverture
    rend un supplément au quart de la main-d'œuvre (jamais la moitié de
    D12) ; une intervention close À 25 % garde EXACTEMENT son montant figé
    quand la société passe ensuite à 60 % (aucun recalcul, aucune donnée de
    production, aucun montant deviné).
- **Captures** (`docs/propositions/9L12-MAJORATION-POURCENTAGE-SOCIETE/
  captures/`, 375 et 1280 px, via `tests/e2e/captures-9l12-majoration-
  pourcentage-societe.spec.ts`, scène propre à ce lot, préfixée `zz9L12-`,
  nettoyée en `afterAll`) — une société réglée à 25 % (donnée de test,
  restaurée après coup) :
  - `apres-portail-tarifs-25pct-{375,1280}.png` — le barème du portail,
    « Majoration hors horaires d'ouverture : 25 % » ;
  - `apres-bon-cloturee-25pct-{375,1280}.png` — le bon (version interne)
    d'une intervention clôturée dont la décomposition figée porte 25 % : le
    bon n'affiche aucune ligne de majoration séparée (seul le total hors
    taxes est montré, et la phrase sans montant de 9I8B), donc le témoin est
    le TOTAL — 15 000 XPF (12 000 de main-d'œuvre + 3 000 à 25 %), jamais
    18 000 (ce que l'ancien +50 % aurait rendu).

### `pnpm verify`

`format:check`, `typecheck`, `lint`, `test` (5967 tests), `test:isolation`
(2294 tests), `build` — tous verts.

## Décisions prises sans ouvrir de ticket

- **Le taux n'est pas réduit à sa forme la plus simple** (`5000/10000` pour
  25 %, pas `1/4`) : `tauxMajorationDepuisPourcentage` construit la fraction
  directement depuis `pct × 100` (entier exact, `Decimal(5,2)`) sur
  `10 000` — la simplifier aurait demandé un calcul de PGCD pour un gain
  nul (`BigInt` ne borne pas la taille, et `arrondirAuPlusProche` ne voit
  qu'un quotient de deux entiers).
- **`TAUX_MAJORATION_HISTORIQUE` reste une fraction `1/2`**, jamais
  `50/100` : c'est la valeur qui existait avant ce lot, et la garder permet
  à l'épreuve unitaire de comparer un COMPORTEMENT (le supplément rendu),
  pas une forme interne.
- **Aucune ligne de majoration séparée n'est ajoutée au bon ou à la fiche** :
  mesuré, ni l'un ni l'autre n'affichait déjà ce détail avant ce lot (seul
  le total hors taxes, et la phrase sans montant de 9I8B) — ajouter cette
  ligne aurait été une décision d'affichage hors du périmètre de la
  décision d'Alexis du 10/11/2026, qui porte sur LA LECTURE du taux, pas sur
  ce qu'un écran en montre.
- **Pas de garde contre un pourcentage NUL par coïncidence avec un
  pourcentage ABSENT** : `societe.majoration_hors_ouverture_pct` est
  `NOT NULL` en base (`Decimal(5,2)`, migration `20260819000000_init`) — un
  pourcentage « absent » ne peut donc survenir que si la société elle-même
  est introuvable, auquel cas `lireTauxMajorationSociete` rend déjà `null`.

## Ce qui manque et n'est PAS livré

Aucune contrainte `CHECK` ne borne `majoration_hors_ouverture_pct` en base
(mesuré : aucune migration ne la pose, à la différence des trois colonnes de
`facturation_*` qui en portent une). Ce lot ne la pose pas — **aucune
migration**, par consigne du ticket. Le code refuse une valeur négative en
mémoire (`tauxMajorationDepuisPourcentage`), mais une valeur négative
resterait écrivable directement en base par qui en a le privilège. Aucune
route d'écriture n'existe aujourd'hui pour ce réglage (mesuré :
`majoration_hors_ouverture_pct` n'est écrite nulle part dans `app/`) — la
question ne se pose donc pas encore à l'exploitation, mais se posera le jour
où un écran de paramétrage l'exposera.

## Suite possible

Un écran de paramétrage pour `majoration_hors_ouverture_pct` (comme
`/parametres/tarifs` en porte un pour la règle d'arrondi) n'existe pas
encore — hors du périmètre de ce ticket, qui ne portait que sur la LECTURE.
