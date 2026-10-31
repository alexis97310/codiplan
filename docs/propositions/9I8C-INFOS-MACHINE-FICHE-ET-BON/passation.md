# 9I8C-INFOS-MACHINE-FICHE-ET-BON — passation

Démarré le 31/10/2026 à 20:37 (Nouméa), budget 150 min.

## Ce qui est livré (points 1 à 5)

### Point 1 — migration

**`20261031210000_annee_fabrication_machine_9i8c`** — à jouer en production et
sur le site de test, dans cet ordre, comme toute migration (`pnpm db:deploy`).
Elle ajoute UNE colonne, additive, sans réécrire aucune ligne existante :

- `machine.annee_fabrication` — entier, nullable, sans défaut.
- Contrainte `machine_annee_fabrication_bornes` : `NULL` ou `[1900, 2100]`.

**Bornes FIXES, et non « 1900 à l'année courante + 1 »** comme le ticket le
proposait en option : une contrainte `CHECK` n'accepte que des expressions
IMMUTABLES, et PostgreSQL refuse `current_date`/`now()` dans une contrainte.
1900 et 2100 couvrent largement le parc réel et son horizon. Le gardien
`tests/unit/calendar/sans-date-courante-implicite.test.ts` interdit la même
lecture côté application (`lib/machines/saisie.ts` porte les mêmes bornes,
`BORNE_ANNEE_FABRICATION_MIN`/`MAX`, documentées pour ne pas diverger en
silence du CHECK).

Aucune politique RLS touchée.

### Point 2 — saisie

Champ facultatif « Année de fabrication (plaque) » dans
`components/parc/formulaire-machine.tsx` (création ET modification), à côté
de « Date de vente » et « Fin de garantie ». Validé côté serveur par
`champsMachine` (`lib/machines/saisie.ts`) : vide accepté (→ `null`), une
année hors `[1900, 2100]` ou non numérique refusée (motif générique
`machine.refus.saisie`, le même que pour les autres champs de ce formulaire).
Affiché sur la fiche machine (`/parc/[id]`), à côté de « Année de vente ».

Le gabarit d'import Excel des équipements (`lib/imports/modeles.ts`,
`CHAMPS_EQUIPEMENTS_ECARTES`) écarte nommément la colonne — même raison que
les trois dates déjà non exposées : lire un entier, l'écrire et éprouver son
annulation sont un ticket de CE gabarit, pas de celui-ci.

Épreuves : `tests/unit/machines/saisie.test.ts` (valeur valide, vide, hors
bornes des deux côtés, bornes incluses, texte non numérique).

### Point 3 — fiche intervention (bureau)

La tuile Machine montre, sous le lien déjà existant (modèle + n° de série,
inchangé) : année de fabrication, date de vente, date de mise en service
(chacune SEULEMENT si renseignée), et la garantie — TOUJOURS une ligne,
« Garantie : non renseignée » si `garantie_fin` est vide.

**La date de référence de la garantie** : aucun champ « date de réalisation »
n'existe au chapitre 11 — j'ai repris la précédence déjà écrite pour l'en-tête
du bon (`lib/interventions/bon.ts`, `clotureeLe`/`dateDocumentAffichee`) : la
clôture si elle existe (plus proche du travail réellement fait), sinon la
date planifiée, sinon l'instant présent à l'agence (cas résiduel : une
intervention ni clôturée ni planifiée, visible sur la fiche bureau mais pas
sur le bon, qui exige un travail fait).

Composition partagée : `lib/machines/presentation.ts`
(`etatGarantieMachine`, `libelleEtatGarantieMachine`, `lignesDetailMachine`),
lue depuis une nouvelle lecture dédiée `datesDesMachines`
(`lib/machines/depot.ts`) — pour que la tuile et le bon ne divergent jamais
(§9, 01/09). Épreuves : `tests/unit/machines/presentation.test.ts`.

### Point 4 — bon d'intervention

Même information, mêmes lignes partagées, sur les DEUX versions (client et
interne) — rien d'interne n'y entre, la frontière client/interne reste celle
des montants seuls, inchangée. `lib/interventions/bon.ts` lit les quatre
colonnes dans la MÊME requête que marque/référence/numéro de série (discipline
déjà en place dans ce module, qui ne passe jamais par `lib/machines/depot.ts`
pour ses propres lectures) et les porte dans un nouveau champ
`BonIntervention.machinesDetaillees`, parallèle à `machinesIdentifiees`
(inchangé, pour ne rien casser des épreuves existantes : `bon-3.test.ts`,
`tests/e2e/bon-3.spec.ts`).

### Point 5 — fiche terrain

Lecture seule, au même endroit que la machine déjà affichée : SEULEMENT
l'année de fabrication et l'état de garantie (pas les deux dates de vente et
de mise en service — hors de ce qu'un technicien a besoin de savoir sur le
terrain). Même précédence de date de référence que les points 3 et 4. Le
libellé du matériel (`libelleMaterielComplet`) n'est pas touché : il reste
partagé avec la fiche bureau et la carte de planning, et aucun de leurs
écrans n'a changé.

## Ce qui N'EST PAS livré

### Point 6 — captures

**Non fait**, et je le dis plutôt que de l'escamoter : à l'heure où j'ai fini
le point 5 (T0 + 58 min), il restait trop peu de budget pour construire une
scène e2e dédiée (une machine avec plaque renseignée, une intervention
clôturée ET une en cours, deux viewports, bureau ET terrain, bon en version
client) sans risquer de ne pas finir la passation et `verify:full` dans les
150 minutes. J'ai préféré livrer un code vérifié et testé plutôt qu'un lot
incomplet avec un `verify:full` jamais tenté.

Pour les prendre à la main : se connecter en back-office, ouvrir une fiche
machine (`/parc/[id]/modifier`) et renseigner une année de fabrication ;
ouvrir une intervention clôturée dont le site porte cette machine
(`/interventions/[id]`, tuile Machine) ; ouvrir son bon
(`/interventions/[id]/bon`) ; se connecter côté technicien et ouvrir la même
fiche sous `/terrain/[id]`. Capturer à 375 et 1280 px à chaque écran. Pour
voir les deux états de garantie, poser une `garantie_fin` passée sur une
machine et future sur une autre.

## Décisions prises sans ouvrir de ticket

- **Bornes fixes [1900, 2100]** plutôt que « année courante + 1 » — voir
  point 1 ci-dessus. Condition de réouverture : si une borne dynamique
  devient nécessaire, elle ne peut vivre que côté application (Zod), jamais
  dans la contrainte `CHECK`.
- **Date de référence de la garantie = clôture, sinon planifiée, sinon
  l'instant présent** — reprise de la précédence déjà écrite pour l'en-tête
  du bon (RÉSERVES-9I7C), appliquée à un troisième cas (la fiche bureau) qui
  ne l'avait pas encore. Aucune règle métier nouvelle : une lecture cohérente
  d'une règle déjà tranchée.
- **`machinesIdentifiees` (bon) inchangé**, une nouvelle liste
  `machinesDetaillees` ajoutée à côté — pour ne pas risquer de casser
  `bon-3.test.ts`/`tests/e2e/bon-3.spec.ts`, qui verrouillent sa forme exacte.

## Suite possible

- Les captures du point 6, à la main ou par un e2e dédié (gabarit :
  `tests/e2e/9i8b-conditions-de-facturation-sans-montant.spec.ts`).
- Si Alexis veut l'année de fabrication importable par Excel : lever
  l'écart nommé dans `CHAMPS_EQUIPEMENTS_ECARTES` (lecture d'un entier,
  écriture, annulation — un ticket à lui seul).
