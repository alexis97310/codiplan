# 9L61-PRET-2-ECRANS-BUREAU — passation

## Ce qui a été fait

Lot 2/3 du module de prêt d'équipement (décision d'Alexis du 27/11/2026, D287),
sur le socle de 9L60 (modèle, dépôt, capacité `gerer_prets`, aucune migration
nouvelle — le socle de 9L60 portait déjà tout le schéma des trois lots).

### Point 1 — les écrans du bureau

- **`/parametres/prets`** (écran neuf) : le parc de prêt — liste des appareils
  (désignation, marque, modèle, n° de série, statut écrit en clair, activité),
  création, modification, bascule « Passer en révision » / « Remettre
  disponible » (verrouillée tant qu'un appareil est `prete`, l'état visé
  toujours ENVOYÉ, jamais déduit — même discipline que le référentiel
  matériel), bascule actif/inactif. Rangé sous **Paramètres > Référentiels**,
  à côté de « Référentiel matériel » (justification du choix contre `/parc` :
  `appareil_pret` est un référentiel de la SOCIÉTÉ — D287 point 1 — jamais une
  donnée client, exactement le périmètre de `/parametres/materiel` ; `/parc`
  cloisonne par client ET site, un périmètre que ce module n'a pas). Porte
  neuve dans `lib/navigation/portes-parametrage.ts`, sans texte de maquette à
  reprendre (aucune ligne de `codiplan-maquette-complete.html` ne dessine ce
  module, postérieur à D95 — même précédent que la porte « Checklists »).
- **Fiche intervention** : carte « Prêt d'appareil ». Sans prêt en cours et
  `gerer_prets` (porte complète, intervention non figée) : formulaire de
  sortie (appareil disponible, date de sortie, retour prévu, état au départ,
  observations). Un prêt en cours : l'appareil, la date de retour prévue, un
  badge « En retard » si dépassée, et le geste « Enregistrer le retour »
  (verrouillé si `gerer_prets` manque). La carte ne se rend PAS s'il n'y a
  rien à montrer ni à faire — à la différence de la carte Machine (toujours
  rendue, RG-INT-01 donne un sens à son absence) : l'absence d'un prêt n'a
  elle-même aucune règle à nommer.
- **Fiche client** : bloc « Prêts d'appareils », les vingt plus récents (en
  cours ET historique, `listerPretsDuClient`), chacun lié à l'intervention qui
  l'a motivé, marqué « En cours » / « Retourné ».
- **Tableau de bord** : carte « Prêts en retard » (`BlocPretsEnRetard`, même
  patron que `BlocDonneesACompleter`), visible à `peutPleinement(role,
  "gerer_prets")` — `gerer_prets` ne porte aucun ○ (ADMS/DIR/RM/RS/ADV au
  complet), `peut` et `peutPleinement` coïncident donc ici ; `peutPleinement`
  est tout de même celui qu'on lit, pour rester cohérent avec les routes.
- **`lib/prets/depot.ts`** : trois fonctions neuves (`modifierAppareilPret`,
  `basculerActiviteAppareilPret`, `changerStatutAppareilPret`, plus le type
  `StatutManuelAppareilPret`) et une lecture neuve pour la fiche client
  (`listerPretsDuClient`). Deux erreurs nommées : `AppareilPretIntrouvable`,
  `StatutAppareilVerrouille` (un appareil `prete` refuse la bascule manuelle —
  seul le retour le fait changer d'état).
- **Six routes neuves**, toutes `exigerCapaciteComplete("gerer_prets")` — la
  passation de 9L60 le demandait explicitement, même si `gerer_prets` ne
  porte aucun ○ (la porte complète et la porte simple coïncident en pratique,
  mais la consigne vaut par cohérence avec la doctrine D153) :
  `app/api/parametres/prets/creer`, `.../[id]/modifier`, `.../[id]/statut`,
  `.../[id]/activite`, `app/api/interventions/[id]/preter`,
  `app/api/prets/[id]/retour`.

### Point 2 — gardiens dérivés remis en phase

- `tests/unit/auth/route-capacite.ts` : les six routes ajoutées à
  `ROUTE_CAPACITE` ET à `PORTE_COMPLETE`. `tests/unit/auth/porte.test.ts` : le
  compte de routes gardées passe de 119 à 125.
- `scripts/lib/chemins-de-depot.ts` : `lib/prets` RETIRÉ de
  `MODULES_SANS_CHEMIN` (le module a désormais un chemin réel). Six des neuf
  fonctions de `lib/prets/depot.ts` retirées de `FONCTIONS_SANS_CHEMIN`
  (`creerAppareilPret`, `listerAppareilsPret`, `sortirPret`,
  `enregistrerRetourPret`, `listerPretsEnCours`, `listerPretsEnRetard` ont
  toutes un appelant réel désormais). Les trois variantes « Dans »
  (`creerAppareilPretDans`, `sortirPretDans`, `enregistrerRetourPretDans`)
  RESTENT exemptées — motif corrigé : elles ne sont appelées
  qu'INTRA-module, même raison que `creerAgenceDans` (le gardien ne trace pas
  un appel interne au même fichier de dépôt).
- `tests/e2e/tous-les-ecrans-rendent.spec.ts` : `/parametres/prets` est
  DÉRIVÉE du dépôt (aucun segment dynamique), elle apparaît toute seule dans
  la population et rend 200 — aucune modification de ce fichier n'était
  nécessaire.

### Point 3 — épreuves

`tests/e2e/9l61-prets-ecrans-bureau.spec.ts` (1280 ET 375 px, `mode:
"serial"`) : cycle complet création d'un appareil → sortie depuis la fiche
intervention → verrouillage du statut → retour → disponibilité retrouvée →
historique « Retourné » sur la fiche client ; la carte « Prêts en retard »
du tableau de bord (un prêt posé directement en base, retour prévu DANS LE
PASSÉ — calculé depuis `Date.now()`, jamais un calendrier en dur) avec son
lien vers l'intervention ; un technicien, sur une fiche où un prêt est
pourtant EN COURS, ne voit ni « Prêter un appareil » ni « Enregistrer le
retour ». Un correctif a suivi : la désignation de l'appareil créé par
l'épreuve était un gabarit littéral (`` `9L61 appareil créé ${largeur}` ``)
passé à `getByText` — une requête d'écran traverse un gabarit comme une
concaténation (L0-11) ; devenue un UUID nu, le nettoyage retrouve les lignes
créées par une liste plutôt qu'un motif de nom.

### Point 4 — captures AVANT/APRÈS, 1280 et 375 px

`docs/propositions/9L61-PRET-2-ECRANS-BUREAU/captures/` : les quatre écrans
touchés ou créés. L'AVANT vient d'un **worktree séparé** au commit
`deadc850b` (9L60, le socle sans écran) — même compte, mêmes identifiants de
démonstration (CODIMA-NC) que l'APRÈS, pour que la comparaison porte sur
l'écran et rien d'autre. `/parametres/prets` n'existant pas avant ce lot,
son « avant » est l'absence de l'écran (capture d'une 404). L'APRÈS vient de
`tests/e2e/zz-captures-9l61-prets-ecrans-bureau.spec.ts`, COMMITÉ pour que la
paire se rejoue.

**Ouvert, faute de temps** : `scripts/captures.mts` (le catalogue
`docs/captures/`, qui photographie TOUT le produit sur une base jetable
dédiée avec amorçage de compte) n'a pas été rejoué. Ce n'est pas le même
geste que les captures avant/après ci-dessus — c'est une seconde prise,
plus lourde, qui démontre que RIEN d'autre n'a bougé. `pnpm captures:etat`
dira s'il a dérivé depuis la dernière prise (`2f7142b`, voir
`docs/captures/README.md`) ; ce lot touche `app/(back-office)/clients/[id]/
page.tsx`, `app/(back-office)/interventions/[id]/page.tsx`,
`app/(back-office)/tableau-de-bord/page.tsx`,
`app/(back-office)/parametres/prets/page.tsx` et `components/tableau-de-bord/
bloc-prets-en-retard.tsx` — le catalogue EST à rejouer.

## `docs/arbitrages.md`

**Aucune entrée neuve.** Ce lot construit les écrans d'un cadrage déjà
entièrement tranché (D287, 9L60) ; les choix d'implémentation qu'il a fallu
faire (le rattachement à Paramètres plutôt qu'à Parc, les tons des badges de
statut, l'icône de la porte) découlent directement de D287 et des conventions
déjà posées ailleurs (référentiel matériel, lecture ouverte/écriture gardée)
— aucun n'ouvre une question de règle de gestion, un montant, un délai, ou un
assouplissement d'invariant.

## MIGRATION

**Aucune.** Le schéma complet des trois lots est posé depuis 9L60 ; ce lot
n'ajoute aucune colonne, aucune table.

## Vérification

`pnpm test` : 544 fichiers, 6132 tests, vert. `pnpm test:isolation` : 270
fichiers, 2609 tests, vert. `npx playwright test
tests/e2e/9l61-prets-ecrans-bureau.spec.ts` : 6/6, vert (1280 et 375 px).
`npx playwright test tests/e2e/tous-les-ecrans-rendent.spec.ts` : 62 passés,
4 ignorés (routes hors périmètre de ce lot), vert — `/parametres/prets` y
figure et rend 200. `CI=1 pnpm verify` (format + typecheck + lint + test +
test:isolation + build) : vert.

## Ce qui reste pour le lot 3

Le bon de prêt signé à la remise (signataire, signature, document figé) —
les cinq colonnes réservées par la migration de 9L60
(`signataire_nom`, `signataire_qualite`, `signature_objet_cle`,
`bon_document_id`, `date_signature`) ne sont toujours écrites par aucun lot.
