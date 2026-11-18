# 9L16-AGENCE-SITE-PROPAGEE — passation

Démarré le 18/11/2026 à 10:22 (Nouméa), budget 90 min.

## La règle tenue

Décision d'Alexis du 10/11/2026 : quand un site change
d'agence, ses interventions OUVERTES suivent la nouvelle agence dans la MÊME
transaction que l'écriture de la fiche ; les interventions CLÔTURÉES gardent
l'ancienne agence — l'historique ne se réécrit pas.

**« Ouverte » est ici celle d'`estFige`** (`lib/interventions/cycle-de-vie.ts`)
— annulée et clôturée sont les deux seules figées — et non celle de
`STATUTS_INTERVENTION_FERMES` (FICHE-360-1), qui range aussi `terminee` parmi
les fermées pour un compteur d'affichage. Mesuré sur `81894e0` : l'agence
était recopiée du site à la création de l'intervention
(`lib/interventions/depot.ts` ~632) et jamais resynchronisée
(`lib/sites/depot.ts`, `modifierSite`).

## Ce qui est livré

### Point 1 — la propagation

`lib/interventions/cycle-de-vie.ts` :

- `STATUTS_INTERVENTION_OUVERTS` — la liste des statuts qui NE sont PAS
  `estFige`, extraite et exportée plutôt que recopiée : c'est elle, et pas
  `STATUTS_INTERVENTION_FERMES`, qui dit quelles interventions suivent.

`lib/interventions/depot.ts` :

- `jourStocke` est exportée (inchangée) — `lib/sites/depot.ts` en a besoin
  pour convertir `date_planifiee` en `JourLocal`, et la recopier aurait été
  une seconde écriture du même critère.

`lib/sites/depot.ts` (`modifierSite`) :

- Quand `agence_id` change réellement (passage, pas maintien), AVANT
  d'écrire la fiche : lecture de toutes les interventions du site dont le
  statut est dans `STATUTS_INTERVENTION_OUVERTS`, puis
  `tx.intervention.updateMany` pose la nouvelle agence sur ces lignes
  SEULEMENT — toujours dans la transaction de `avecContexteApplicatif`
  ouverte par `modifierSite`, donc atomique avec l'écriture de la fiche.
  Aucune comparaison de société n'est écrite sur cette lecture : la
  politique RLS de forme « parc » la porte déjà (même discipline que le
  reste du module).
- `interventionsHorsOuvertureNouvelleAgence` — SIGNALE, sans rien corriger,
  les interventions déjà posées (`date_planifiee` ou `creneau_debut` non
  nuls) dont le créneau tombe hors des horaires ou sur un jour fermé de la
  NOUVELLE agence. Rejoue `verdictOuverture` (`lib/interventions/pose.ts`),
  la MÊME lecture qu'à la pose, contre le calendrier de la CIBLE
  (`chargerCalendrierAgence`) — jamais une seconde règle. Une agence cible
  sans calendrier refuse toute ligne posée, comme à la pose (I7).
- `ResultatEcriture` porte deux champs optionnels, posés seulement sur ce
  chemin : `interventionsDeplacees` (le compte) et `interventionsASignaler`
  (`{id, numero}[]`).

`app/api/sites/[id]/modifier/route.ts` :

- Le compte-rendu voyage par des NOMBRES, jamais par du texte (même
  discipline que `/api/interventions/transmettre`) : `?agenceSuivies=<n>` et
  `?agenceASignaler=<numero>` répété une fois par intervention signalée.

`app/(back-office)/sites/presentation.ts` :

- `texteAgencePropagee({suivies, aRevoir})` — compose le message depuis le
  dictionnaire et `motDansUnePhrase("agence")` (le mot imposé ne s'écrit pas
  en dur dans `fr.ts`, §3 D5/D47 — mesuré : une première version l'écrivait
  et le gardien du vocabulaire a rougi, corrigée avant commit).

`app/(back-office)/sites/[id]/page.tsx` :

- Lit `?agenceSuivies=`/`?agenceASignaler=` et affiche un second bandeau
  (`BandeauEtat`, ton `avertissement` si une intervention est signalée,
  sinon `information`), À CÔTÉ du bandeau « Les modifications ont été
  enregistrées. », jamais à sa place.

`app/(back-office)/presentation.ts` :

- `entierPositif` est EXTRAITE de `planning/page.tsx` (qui la gardait en
  fonction locale pour `?transmis=`/`?techniciens=`/`?echecsCourriel=`) et
  partagée : `/sites/[id]` en a besoin mot pour mot pour `?agenceSuivies=`.
  `planning/page.tsx` l'importe désormais au lieu de la redéfinir.

`lib/i18n/fr.ts` : six nouvelles clés `sites.agence_propagee.*`, toutes
arrêtées AVANT le mot imposé.

### Point 2 — épreuves

- **Isolation** (`tests/isolation/site-agence-propagee.test.ts`, 3
  scénarios, tous verts) :
  - les ouvertes (à planifier, en cours, terminée) suivent la nouvelle
    agence et le compte rendu (`interventionsDeplacees`) vaut exactement
    3 ; la clôturée et l'annulée gardent l'ancienne ;
  - une ouverte déjà posée (statut `planifiee`, créneau fixé) sur une
    CIBLE sans aucun calendrier est déplacée ET signalée
    (`interventionsASignaler`) — jamais refusée, jamais corrigée d'office ;
  - un témoin d'isolation (I1) : l'intervention de la société B
    (`INTERVENTION_B1`, fixture partagée) n'est pas touchée par un
    changement d'agence joué sous la société A, la lecture des « ouvertes »
    ne portant aucun filtre de société écrit en TypeScript.
- **E2E** (`tests/e2e/9l16-agence-site-propagee.spec.ts`, écrite, typée,
  lintée — voir « Ce qui manque » ci-dessous pour son exécution par
  `pnpm test:e2e`) : scène propre, préfixée `9L16-`, deux agences (la cible
  sans calendrier), un site et trois interventions (ouverte sans créneau,
  ouverte posée, clôturée) créés directement en base en `beforeAll` et
  supprimés en `afterAll`. Le scénario change le rattachement à l'écran
  (`?edition=site`), vérifie le message (« 2 … ont suivi la nouvelle
  agence », le numéro de la signalée visible, ceux de l'ouverte-sans-créneau
  et de la clôturée absents), puis relit la base pour confirmer qui a bougé
  et qui a gardé l'ancienne agence.
  **Rejoué à la main, hors du lanceur `pnpm test:e2e`** (voir « Ce qui
  manque ») : un serveur de production construit et démarré directement,
  un vrai navigateur Chromium, exactement le même parcours — connexion,
  `?edition=site`, changement de rattachement, lecture du message, relecture
  de la base — avec le même résultat que les captures ci-dessous le
  montrent : 2 déplacées, 1 signalée par son numéro, la clôturée inchangée.

- **Captures** (`docs/propositions/9L16-AGENCE-SITE-PROPAGEE/captures/`, 375
  et 1280 px, AVANT/APRÈS) — prises à la main contre un serveur de
  production réel (voir « Ce qui manque »), même scène que le scénario e2e
  (deux agences, la cible sans calendrier ; trois interventions — ouverte
  sans créneau n°910001, ouverte posée n°910002, clôturée n°910003) :
  - `avant-formulaire-{375,1280}.png` — le formulaire d'édition, la
    nouvelle agence choisie, avant « Enregistrer » ;
  - `apres-compte-rendu-{375,1280}.png` — après l'enregistrement : le
    bandeau « Les modifications ont été enregistrées. » ET le second
    bandeau du compte-rendu — « 2 interventions ouvertes ont suivi la
    nouvelle agence. Attention : 1 intervention déjà posée tombe hors des
    horaires de la nouvelle agence (n°910002) à revoir. » — et la liste des
    interventions du site qui montre la clôturée (n°910003) toujours
    rattachée, inchangée.

### `pnpm verify`

`typecheck`, `lint`, `test` (5969 tests), `test:isolation` (2297 tests) —
tous verts. `format:check` non rejoué séparément (aucun écart constaté par
`lint`/`typecheck`, et aucun fichier n'a été écrit par un outil qui
l'ignorerait). `build` : voir ci-dessous.

## Ce qui manque et n'est PAS livré

**Le scénario e2e n'a pas pu être rejoué jusqu'au bout PAR `pnpm test:e2e`
LUI-MÊME** — un défaut d'environnement de ce poste, reproduit à l'identique
sur un scénario e2e PRÉEXISTANT et non modifié par ce lot
(`tests/e2e/sites-adresse-sans-commune.spec.ts`), donc sans rapport avec le
code livré ici : le script `pnpm run build` impose
`--max-old-space-size=6144`, et chaque tentative sur ce poste épuise ce
plafond pendant la vérification des types, quel que soit l'état du cache
Next. `pnpm test` et `pnpm test:isolation`, qui ne dépendent ni de
`next build` ni d'un navigateur, restent eux intégralement verts.

**La RÈGLE a néanmoins été éprouvée dans un vrai navigateur, contre un vrai
build de production** — hors du lanceur, par un `next build` direct dont le
tas n'est pas plafonné par le script (`NODE_OPTIONS=--max-old-space-size=9216
pnpm exec next build`, qui aboutit), puis un `next start` manuel sur ce
build, puis Chromium (`--no-sandbox`, requis par ce conteneur) rejouant
EXACTEMENT le parcours du scénario e2e — connexion, `?edition=site`,
changement de rattachement, lecture du message, relecture de la base. Les
quatre captures ci-dessus, et le JSON relu en base après coup (910001 et
910002 sur la nouvelle agence, 910003 sur l'ancienne), en sont la preuve.

Un humain disposant d'un poste sans le plafond mémoire de `pnpm run build`
peut rejouer `tests/e2e/9l16-agence-site-propagee.spec.ts` tel quel
(`PORT=3100 pnpm exec playwright test
tests/e2e/9l16-agence-site-propagee.spec.ts`) pour que `pnpm test:e2e`
couvre lui-même ce dernier maillon.

## Décisions prises sans ouvrir de ticket

- **La liste des statuts « ouverts » est `STATUTS_INTERVENTION_OUVERTS`
  (`!estFige`), pas `STATUTS_INTERVENTION_FERMES`** : une `terminee` n'a pas
  encore de rapport clos au sens de I5, elle suit donc la nouvelle agence
  comme une `en_cours`. La décision d'Alexis ne nomme que les clôturées
  comme gardant l'ancienne ; une relecture au chapitre 10 ou aux
  arbitrages pourrait un jour nommer `terminee` autrement, auquel cas
  `STATUTS_INTERVENTION_OUVERTS` s'aligne dessus comme son commentaire le
  prévoit déjà.
- **Une intervention signalée est DÉPLACÉE quand même** (son `agence_id`
  change), avec son créneau INCHANGÉ : la décision d'Alexis dit que
  l'ouverte suit toujours la nouvelle agence ; le signalement n'est qu'un
  avertissement sur un créneau devenu incohérent, jamais un second régime
  de propagation.
- **Le compte-rendu voyage par l'URL, en nombres et en numéros
  d'intervention, jamais par du texte** — précédent direct de
  `/api/interventions/transmettre` (9CP-PG-G14B-TRANSMETTRE-GROUPE),
  rejoué à l'identique plutôt qu'inventé.

## Suite possible

Aucune limitation connue sur la règle elle-même. Le seul reste est de faire
rejouer `tests/e2e/9l16-agence-site-propagee.spec.ts` par `pnpm test:e2e`
lui-même, sur un poste sans le plafond mémoire du script `build` — la règle
est déjà éprouvée par ailleurs (isolation, et à la main dans un vrai
navigateur).
