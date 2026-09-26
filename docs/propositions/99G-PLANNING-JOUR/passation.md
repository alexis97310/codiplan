# 99G-PLANNING-JOUR — passation

## Ce que j'ai changé

Sur `/planning?vue=jour` :

- **L'en-tête dit désormais QUI EST LÀ et QUI EST BLOQUÉ, avant le compte des
  trous.** `resumeDesTechniciens` (`app/(back-office)/planning/carte.ts`)
  compose « N technicien(s) », et — seulement s'il y en a — « · K agenda(s)
  bloqué(s) (Prénom, Prénom) », tiré des colonnes `bloquee` de la journée. Le
  résultat est composé À CÔTÉ du résumé existant (`resumeDesTrous`), jamais à
  sa place : `resumeEnTeteDeJournee` (`app/(back-office)/planning/page.tsx`)
  joint les deux par « · », et le texte de `resumeDesTrous` lui-même n'a pas
  changé d'un caractère.
- **La légende de la vue jour (quatre entrées, mêmes couleurs, mêmes clés)
  est remontée AU-DESSUS de la grille**, juste sous l'en-tête, en une seule
  ligne à 1280 px — elle ne reste plus dupliquée sous la table. La légende de
  la vue SEMAINE (`<Legende />`) n'a pas bougé.
- Quatre clés neuves dans `lib/i18n/fr.ts` : `planning.resume_technicien_un`,
  `planning.resume_techniciens`, `planning.resume_agenda_bloque_un`,
  `planning.resume_agendas_bloques` — accordées via `decompte()`, jamais un
  « s » retranché (AT-07).

**Pour l'exploitation** : à 1280 px, l'en-tête de la vue jour se lit
maintenant « 4 techniciens · 1 agenda bloqué (D. Guérin) · 48 créneaux
libres · pas de 30 min » d'un coup d'œil, sans défiler jusqu'à la légende —
voir la capture ci-dessous.

## Ce que j'ai tranché, et pourquoi

**`resumeDesTechniciens` vit dans `carte.ts`, pas dans `page.tsx`.** Le
territoire du ticket nomme `page.tsx` (« VueJour et ses aides »),
`lib/i18n/fr.ts`, l'épreuve neuve et la passation — pas `carte.ts`
nommément. Mais le ticket demande aussi une épreuve *« unitaire de
préférence sur une fonction pure de résumé »*, et **aucun `page.tsx` du
dépôt n'exporte de fonction pure testée en unitaire** — `carte.ts` est
justement le module que PLANNING-2 a créé pour cette raison précise (« Séparé
de `page.tsx` pour que ces fonctions PURES s'éprouvent seules, sans lever de
contexte cloisonné »), et il est déjà importé par `VueJour`. Ouvrir un second
fichier pour « une fonction pure de la vue jour, testable seule » aurait été
une seconde écriture du même motif (§9, 01/09). `resumeDesTechniciens` y est
donc entrée, avec un mot dans son docstring pour dire qu'elle résume
l'EN-TÊTE et non une carte — le nom du fichier ne colle plus tout à fait,
mais je n'ai pas renommé le fichier ni déplacé les trois fonctions
existantes : un renommage aurait élargi le territoire sans nécessité.

**La colonne SANS technicien (`technicienId` nul) ne compte pas comme un
technicien.** `resumeDesTechniciens` filtre d'abord `technicienId !== null`
avant de compter — une colonne sans personne à nommer (celle des
interventions non affectées, si la vue jour venait à en montrer une) n'est
pas quelqu'un qui « est là ». Elle ne peut de toute façon jamais être
`bloquee` : `construireJournee` (`lib/interventions/journee.ts`, l.304-306)
n'évalue le blocage d'agenda QUE pour un `technicienId` non nul. Couvert par
le test « la colonne SANS technicien ne compte pas comme un technicien »
(`tests/unit/planning/carte.test.ts`).

**Un nom que l'annuaire refuse (`etat: "refusee"` ou `"non_demandee"`) est
tu, jamais inventé.** `nomSeul` (`lib/interventions/personnes.ts`) rend
`null` dans ces cas ; `resumeDesTechniciens` filtre les `null` et n'ouvre la
parenthèse que s'il reste au moins un nom — le COMPTE de blocages, lui, reste
toujours vrai (« 1 agenda bloqué » sans parenthèse plutôt que de ne rien
dire). Couvert par le test « un nom refusé par le cloisonnement est tu ».

**Un seul `<p>` compose l'en-tête entier**, plutôt que deux paragraphes
successifs : le texte le plus proche de l'audit (« 4 techniciens · 1 agenda
bloqué (Cédric) ») lit les deux résumés comme une seule phrase, séparée par
« · » comme le fait déjà `resumeDesTrous` en interne entre ses propres
morceaux (compte de trous, pas, à caler).

## Ce que j'ai mesuré (AVANT/APRÈS)

Capture Playwright réelle, 1280 × 800, scène propre (`guerin@codima.test`,
technicien de Ducos, bloqué 16 semaines après la semaine de scène — un
multiple de 7 plus loin que le plus grand déjà réservé par un autre fichier
e2e : 21/35/49/63/91/92/98/105) :
`docs/propositions/99G-PLANNING-JOUR/captures/en-tete-et-legende-1280.png`.

- En-tête : « 4 techniciens · 1 agenda bloqué (D. Guérin) · 48 créneaux
  libres · pas de 30 min ».
- La légende (« Occupé / Libre / Hors ouverture / Agenda bloqué — le dépôt
  sera refusé ») est visible en entier, sans défiler, juste sous l'en-tête.
- Un seul `<ul>` légende, enfant direct de la section — vérifié par
  `toHaveCount(1)` dans l'épreuve, pour être sûr qu'aucune n'est restée sous
  la grille par erreur d'édition.
- Le TÉMOIN : la veille (aucun blocage posé), l'en-tête ne contient aucune
  mention « agenda bloqué ».

## Épreuves

- `tests/unit/planning/carte.test.ts` — `resumeDesTechniciens`, 8 cas : 0
  technicien, colonne sans technicien exclue, 1/plusieurs techniciens sans
  blocage (accord singulier/pluriel), 1 bloqué avec nom, plusieurs bloqués
  joints par une virgule, nom refusé par l'annuaire (compte vrai, parenthèse
  absente). Aucun contexte cloisonné levé — un simple dictionnaire en
  fermeture, comme l'annuaire réel.
- `tests/e2e/planning-jour-en-tete.spec.ts` — ce que l'unitaire ne peut pas
  voir : la légende réellement remontée et visible sans défiler à 1280 px
  (`toBeInViewport()`), l'en-tête réel qui compose bien les deux résumés
  l'un à côté de l'autre sur la vraie grille, et le témoin sans blocage.
  Scène minimale — aucun technicien ni intervention créés : la vue jour
  donne déjà une colonne à chaque technicien actif (R2-14), une absence sur
  un technicien seedé (`guerin@codima.test`) suffit. `beforeAll` écrit en
  base (`ON CONFLICT DO NOTHING`) donc déclare `test.describe.configure({
  mode: "serial" })` — un gardien (`tests/unit/e2e-mise-en-scene.test.ts`)
  l'a fait rougir une première fois, faute de cette déclaration.

## Ce que je n'ai PAS fait

- Je n'ai touché ni à `lib/interventions/journee.ts` ni à la vue SEMAINE
  (`VueSemaine`, `<Legende />`) — hors territoire.
- Je n'ai posé aucune migration, aucune ligne de semis, aucun prix.
- Je n'ai pas renommé `carte.ts` ni déplacé les trois fonctions qui y
  vivaient déjà, malgré le nom devenu un peu étroit (voir plus haut).

## Pièges pour la session suivante

- Le jour de scène `MARDI + 112` (16 semaines) est désormais pris par
  `planning-jour-en-tete.spec.ts` ; les décalages déjà réservés par d'autres
  fichiers e2e sont 21/35/49/63/91/92/98/105 — un prochain ticket doit
  choisir un autre multiple de 7 au-delà de 112.
- `resumeDesTechniciens` vit dans `carte.ts`, un fichier nommé pour les
  cartes de la grille — pas un mauvais endroit fonctionnellement (voir
  ci-dessus), mais à chercher là plutôt que dans `page.tsx` si un futur
  ticket touche encore l'en-tête de la vue jour.

## `CI=1 pnpm verify:full`

Un seul passage, complet et vert : **296 passés, 3 sautés, 0 échec.**
