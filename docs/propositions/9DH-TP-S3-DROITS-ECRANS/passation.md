# 9DH-TP-S3-DROITS-ECRANS — passation

## Ce que j'ai changé, et ce que ça change pour l'exploitation

D153 (`docs/arbitrages.md`) applique les constats PA-02, PA-01, CS6, CS31, PA-25,
CS14, IN-29, PV-49, TR-4 de l'audit du 28/09 : un écran offrait un formulaire que
sa route refusait déjà, dans les deux sens (trop ouvert pour certains rôles, trop
fermé pour d'autres).

- **Une seconde porte**, `exigerCapaciteComplete` (`lib/auth/porte.ts`), s'appuie
  sur `peutPleinement` plutôt que `peut` : elle ferme le `○`, là où `exigerCapacite`
  le laisse passer. Les treize routes d'écriture du taux horaire, des forfaits, du
  matériel et des prestations l'appellent désormais — le `○` de la direction sur
  `parametrer_societe` (PA-02) n'ouvre plus que la LECTURE.
- **Agences, plages et pas-créneau** passent sous `administrer_agences` (déjà
  existante, D37) : aucun `○`, donc plus personne que `admin_societe` n'y écrit.
  La LECTURE de la liste et du détail du calendrier reste ouverte à tout rôle non
  technicien (choix délibéré, voir plus bas) ; seuls « Nouvelle agence »,
  « Modifier » et les formulaires de plages/pas-créneau suivent la capacité, avec
  un repli en texte simple côté lecture.
- **Deux capacités nouvelles** dans `lib/auth/habilitations.ts` : `regler_trajets`
  (ADMS et ADV au `●`, direction au `○`, PA-25/D107) et `consulter_clients_sites`
  (lecture seule des clients/sites pour ADMS, DIR, RM, RS, ADV, CS6).
- **Les exigences d'habilitation sur un site** passent de `administrer_utilisateurs`
  à `gerer_client_site` (CS31) — elles portent sur un site, pas sur un compte.
- **Équipe et habilitations** (`/parametres/equipe`, `/parametres/habilitations`)
  sont désormais entièrement fermées à qui n'a pas `administrer_utilisateurs` :
  ces deux écrans n'ont aucune lecture utile sans l'écriture (liste des
  techniciens à administrer, référentiel à gérer), à la différence des écrans de
  tarifs.
- **Clients, sites et contacts** : les formulaires d'identité, de contact et
  d'exigence, jusqu'ici rendus à tout rôle non technicien, suivent désormais
  `gerer_client_site`. RM et RS, qui n'ont jamais eu cette capacité, lisent
  maintenant ces fiches (`consulter_clients_sites`) sans y voir de formulaire.
- **IN-29** : « Ajouter une machine » (sans AUCUNE garde jusqu'ici) suit
  `qualifier_affecter`. « Planifier » est désormais MASQUÉ plutôt que montré
  refusé, comme « reprendre »/« clôturer » le font déjà. **« Déplacer »
  n'a PAS changé** : j'ai d'abord masqué tout son formulaire sans
  `modifier_planning`, avant de mesurer que `tests/e2e/intervention-technicien
  -select.spec.ts:263` éprouve une décision ANTÉRIEURE et délibérée (extension
  de la revue Codex, 20/09/2026) — un rôle sans cette capacité garde la date,
  l'heure et la durée de « Déplacer », seule la LISTE NOMINATIVE du technicien
  disparaît, la route refusant le reste au SUBMIT. Revenu sur ce point précis
  avant de committer.
- **PV-49** : le bouton « Enregistrer » d'une VGP se masque hors périmètre du
  technicien restreint, via `dansLePerimetreVgp` (extraite de
  `lib/vgp/verification.ts`, D131, pour que l'écrit et l'écran jugent avec la
  MÊME fonction). Le texte `vgp.verifier.refus.introuvable` devient
  « Cette machine n'est pas dans votre périmètre. ».
- **Menu** : `nav.clients` et `vocabulaire.site.pluriel` suivent désormais
  `consulter_clients_sites` — RM et RS voient « Clients » et « Sites ».
- **La page d'index `/parametres`** ne liste plus que les portes qu'un rôle peut
  ouvrir (`porteOuverte`, `lib/navigation/portes-parametrage.ts`).

Pour l'exploitation : un responsable matériel ou SAV peut désormais consulter les
fiches client/site et les atteindre depuis le menu, sans jamais voir un bouton
qu'une route lui refuserait. La direction garde la LECTURE des tarifs et des
trajets, plus jamais l'écriture. L'ADV règle les trajets par zone, ce qu'aucune
ligne de la matrice ne lui permettait avant ce lot.

## Ce que j'ai mesuré

- `pnpm typecheck`, `pnpm lint`, `pnpm format:check` : verts après chaque étape.
- `pnpm vitest run tests/unit` : 372 fichiers, 3910 tests, verts.
- `pnpm test:isolation` : 149 fichiers, 1355 tests, verts (y compris le fichier
  neuf `tests/isolation/droits-ecrans-tp-s3.test.ts`, 7 épreuves contre la VRAIE
  base : direction refusée sur un taux horaire et sur une agence ; administrateur
  de société accepté sur l'agence ; ADV accepté sur le trajet de la zone sud ;
  ADV ET direction tous deux acceptés pour exiger une habilitation sur un site).
- **Régression e2e, mesurée en lançant les fichiers un à un puis par petits
  groupes** (le danger explicite du PIÈGE CONNU du ticket) : `ecrans-largeur-utile
  .spec.ts`, `materiel-replie.spec.ts`, `visuel-2.spec.ts`, `agences-etat-visible
  .spec.ts`, `equipe.spec.ts`, `equipe-1.spec.ts`, `equipe-agence-inactive.spec.ts`,
  `habilitations.spec.ts`, `plancher-12-pages.spec.ts`, `ergo14-trajets.spec.ts`,
  `captures-9ai-gr14-libelles-saisie.spec.ts`, `captures-9ah-gr14-prestations-sites
  .spec.ts`, `captures-tpa5-libelles-throwaway.spec.ts`, `cases-parametrage-44
  .spec.ts`, `focus-visible-et-plancher-typographique.spec.ts`,
  `tous-les-ecrans-rendent.spec.ts` (41 routes, 38 passées + 3 `skip` attendus).
  **Trois régressions réelles trouvées et corrigées** (voir § tranché) ; **deux
  échecs mesurés comme préexistants**, sans rapport avec ce lot : `agences-etat
  -visible.spec.ts:199` et `cases-parametrage-44.spec.ts:34` rougissent UNIQUEMENT
  quand ils tournent en parallèle avec d'autres fichiers (comptage d'un état
  partagé pollué par une autre scène), et passent seuls à chaque fois — même
  famille que le piège connu de 46-SELECTEURS-1 cité par un autre lot. Je n'ai
  touché ni leur assertion ni leur scène.
- Pas de capture AVANT/APRES prise (voir § « pas fait »).
- **`CI=1 pnpm verify:full` joué en entier, au premier plan, un seul appel** (33,7
  minutes pour la seule section `test:e2e` : 802 passés, 7 `skip` attendus, 3
  rouges). Les trois rouges, un par un :
  - `intervention-technicien-select.spec.ts:263` — RÉGRESSION RÉELLE de ce lot
    (« Déplacer » masqué en entier au lieu de perdre son seul champ technicien,
    voir § tranché). **Corrigée avant ce commit**, relancée seule : verte.
  - `planning-survol-cases.spec.ts:177` — relancé seul : vert. Pollution par un
    autre fichier du même lot parallèle, sans rapport avec ce ticket (aucun
    fichier touché par 9DH ne concerne le planning).
  - `planning-laissees-sous-la-grille.spec.ts:121` — relancé seul : **rouge
    aussi**. Sans rapport mesurable avec ce lot (vue jour du planning, légende
    et liste des laissées — aucun fichier de mon territoire n'y touche). Je ne
    l'ai pas corrigé : hors territoire (`lib/navigation`, auth, clients/sites,
    parametres — pas le planning), et deux rouges de ma propre épreuve
    auraient arrêté ce lot, mais celle-ci n'est pas la mienne. Nommé ici pour
    la session suivante.

## Ce que j'ai tranché, et pourquoi

- **Lecture ouverte vs fermeture complète sur `/parametres/agences`** : mon premier
  geste fermait TOUTE la page (liste et détail) à qui n'a pas `administrer_agences`
  — cohérent avec « administrer_agences n'a aucun `○` », mais j'ai mesuré que ça
  cassait trois e2e qui ouvrent ces pages en ADV pour des raisons de mise en page,
  et que le ticket lui-même annonçait « lecture ouverte » pour l'ADV. J'ai donc
  tranché pour le même régime que le reste de `/parametres/*` : LECTURE ouverte à
  tout rôle non technicien, ÉCRITURE seule derrière la capacité. Les deux écrans
  entièrement-écriture (`/parametres/agences/nouvelle`, `.../modifier`) restent
  fermés en entier — rien à y lire sans le droit d'y écrire.
- **`/parametres/equipe` et `/parametres/habilitations` restent fermés en entier**
  (pas de repli lecture) : à la différence des tarifs, ces deux écrans n'ont pas
  de lecture distincte de leur écriture qui vaille la peine — ils étaient déjà
  réservés à `admin_societe` avant ce lot (toutes les épreuves existantes qui les
  ouvrent utilisent déjà ce compte), donc aucune régression mesurée.
- **Le compte de trois scénarios e2e changé** (`materiel-replie.spec.ts`,
  `visuel-2.spec.ts`, et une épreuve de `ecrans-largeur-utile.spec.ts`) : chacun
  ouvrait une session ADV pour éprouver une mise en page ou un filtre, en
  s'appuyant par accident sur un formulaire que la route refusait déjà (D131/D153).
  J'ai changé la MISE EN SCÈNE (le compte), jamais l'assertion.
- **`dansLePerimetreVgp` extraite plutôt que dupliquée** : l'écran et l'écriture
  doivent juger avec exactement la même règle (D131), sans quoi l'un pourrait
  montrer un bouton que l'autre refuse, ou l'inverse.
- **Aucun ajout au tableau `regler_trajets`** au-delà d'ADMS/ADV/DIR, et
  `consulter_clients_sites` strictement ADMS/DIR/RM/RS/ADV : respecte « n'ajoute
  personne d'autre » du ticket.

## Ce que je n'ai PAS fait

- **Aucune capture AVANT/APRES.** Le ticket en demande cinq, dont trois en
  RESPONSABLE SAV ou sur un rôle « sans `modifier_planning` ». **Aucun compte
  `responsable_sav` ni `responsable_materiel` n'existe dans le semis**
  (`prisma/seed-data.ts` ne porte que `direction`, `adv`, `admin_societe` et
  quatre techniciens) — et ce ticket interdit toute ligne de semis neuve. Les
  captures pour ces deux rôles sont donc matériellement impossibles sans
  enfreindre l'interdiction, et je ne les ai pas improvisées. Les captures
  faisables (direction sur `/parametres` et `/parametres/taux-horaire`, ADV sur
  `/parametres/trajets`) n'ont pas non plus été prises, par manque de temps dans
  ce lot — c'est un manque, pas un choix.
- **Aucune épreuve e2e neuve pour RM/RS** — même raison : pas d'identité. Les
  épreuves unitaires (`tests/unit/navigation/barre-par-role.test.tsx`,
  `tests/unit/auth/habilitations.test.ts`) couvrent leur comportement sans base
  ni navigateur.
- Rien à ajouter ici au-delà du § « mesuré » : `CI=1 pnpm verify:full` A été
  joué en entier (voir ci-dessus), avec un seul rouge non corrigé et nommé
  (`planning-laissees-sous-la-grille.spec.ts`, hors territoire).

## Les pièges pour la session suivante

- **Toute capacité sans `restreint` ferme TOUT LE MONDE, pas seulement l'écriture**
  — `administrer_agences`, `administrer_utilisateurs`, `regler_trajets` (hors
  ADMS/ADV/DIR) n'ont aucun `○`. Avant de gater un écran entier derrière une telle
  capacité, vérifier qu'aucune épreuve existante n'ouvre cet écran avec un compte
  qui n'a QUE la lecture en tête (`grep -rn "ouvrirUneSession" tests/e2e | ...`,
  puis `grep` le chemin visé) — c'est exactement ce qui a cassé trois fichiers
  dans ce lot avant d'être corrigé.
- **`agences-etat-visible.spec.ts:199` et `cases-parametrage-44.spec.ts:34`
  rougissent en groupe, jamais seuls** — ne pas conclure d'un rouge sur ces deux
  lignes sans les relancer isolément.
- **`planning-laissees-sous-la-grille.spec.ts:121` rougit même SEUL**, mesuré
  pendant `verify:full` de ce lot — sans rapport apparent avec 9DH (vue jour du
  planning). À investiguer avant de l'imputer au hasard.
- **Avant de masquer un bloc entier d'une fiche, vérifier qu'aucune épreuve
  existante ne documente une décision ANTÉRIEURE plus fine** (champ caché plutôt
  que bloc entier) — c'est exactement ce qui est arrivé sur « Déplacer » de la
  fiche intervention : une revue du 20/09/2026 avait déjà décidé que seul le
  champ technicien disparaît. `grep -rn "<nom du bloc>" tests/e2e` avant de
  changer le RÉGIME d'un bloc, pas seulement sa capacité.
- **`lib/vgp/verification.ts` et `app/(back-office)/vgp/enregistrer/[id]/page.tsx`
  partagent désormais `dansLePerimetreVgp`** — toute évolution du périmètre VGP
  doit toucher cette seule fonction, jamais une copie dans l'écran.
- **Les trois écrans `agences/nouvelle`, `agences/[id]/modifier` et
  `agences/[id]` (calendrier)** ont chacun leur propre garde, distincte de la
  LISTE (`agences/page.tsx`) — ne pas supposer qu'une seule garde couvre les
  quatre fichiers.

## Ce qui reste à faire

1. Les cinq captures AVANT/APRES demandées (direction sur `/parametres` et
   `/parametres/taux-horaire` ; ADV sur `/parametres/trajets` ; responsable SAV
   sur `/clients/[id]` et `/sites/[id]` ; un rôle sans `modifier_planning` sur
   une fiche intervention). Les deux premières (ADMS/DIR, ADV) sont faisables
   immédiatement. Les deux dernières (RS) exigent une décision d'Alexis : créer
   un compte `responsable_sav`/`responsable_materiel` dans le semis (une
   décision de produit, pas un geste technique) avant de pouvoir les prendre.
2. Investiguer `planning-laissees-sous-la-grille.spec.ts:121`, rouge même seul,
   sans rapport mesurable avec ce lot — hors territoire de 9DH, jamais touché.
3. Valider avec Alexis le choix tranché ci-dessus (lecture ouverte sur
   `/parametres/agences`) : il s'écarte de la première lecture, plus stricte, du
   texte du ticket, au profit de la cohérence avec le reste de `/parametres/*`
   et de la non-régression mesurée.
