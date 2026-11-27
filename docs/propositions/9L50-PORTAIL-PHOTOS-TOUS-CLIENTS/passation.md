# 9L50-PORTAIL-PHOTOS-TOUS-CLIENTS — passation

## Ce que la mesure a trouvé, et pourquoi elle contredit le contexte du ticket

Le ticket partait d'un constat correct sur les PHOTOS (revue de 9L28) mais d'une
hypothèse fausse sur les INTERVENTIONS : « le compte portail voit déjà les
interventions de ses clients ». Mesuré avant toute écriture : **non**.

`ContexteSession.clientId` (D70, `docs/arbitrages.md:2422`) est une désignation
**unique par lecture** — « l'appelant désigne, la base dispose », et
`app_poser_perimetre_client` ne reçoit qu'un seul client à la fois. Chaque écran
du portail (`/portail`, `/portail/interventions`, `/portail/interventions/[id]`,
`/portail/interventions/[id]/bon`, et la route `/api/documents/[id]/octets`)
résolvait ce client en prenant le **PREMIER** rattachement du compte sur la
société active (`rattachements.find(...)` ou `rattachements[0]`), jamais tous.
Un compte à deux clients de la même société ne voyait donc, de bout en bout,
que les interventions — et les photos — du premier : la liste des
interventions porte **exactement le même défaut** que celui relevé sur les
photos, pas un périmètre déjà correct auquel aligner les photos.

## Ce qui a été réparé, et sur quel périmètre

Aucune politique RLS n'a changé — D70 reste entière, `app.client_id` reste une
désignation unique par lecture. La réparation est côté application, par un
nouvel utilitaire `premierSucces` (`lib/portail/depot.ts`) :

- **Lecture PAR IDENTIFIANT** (une fiche d'intervention, un bon, les octets
  d'une photo) : `premierSucces` essaie chaque rattachement de la société
  active, dans l'ordre, et s'arrête au premier qui réussit — jamais un
  agrégat, une ligne n'appartenant qu'à un seul client.
- **LISTE** (`/portail/interventions`) : chaque client rattaché est interrogé
  séparément et les résultats sont **concaténés**, puis triés par date de
  création décroissante (même tri qu'avant).

Fichiers touchés :
- `lib/portail/depot.ts` — `premierSucces`, exporté.
- `app/(portail)/portail/interventions/page.tsx` — liste agrégée sur tous les
  rattachements de la société active.
- `app/(portail)/portail/interventions/[id]/page.tsx` — la fiche se résout en
  essayant chaque client ; le contexte RÉSOLU (celui qui a rendu la fiche) est
  réutilisé pour les commentaires, l'historique et le parc — jamais une
  seconde résolution qui pourrait tomber sur un autre client que celui de la
  fiche.
- `app/(portail)/portail/interventions/[id]/bon/page.tsx` — même principe pour
  `bonInterventionDuParc`.
- `app/api/documents/[id]/octets/route.ts` — la route des photos essaie
  chaque client rattaché avant de rendre 404.

## Ce qui N'A PAS été touché, nommément

Pour rester sur le périmètre du ticket (« sans élargir au-delà »), les autres
écrans qui désignent encore le PREMIER rattachement n'ont pas été changés :
`/portail` (page d'accueil, tuiles de sites/machines), `/portail/contacts`,
`/portail/demandes`, `/portail/machines/[id]`, `/portail/mon-compte`. Un compte
à deux clients y voit encore seulement le parc, les contacts, les demandes et
la fiche machine du premier. **C'est un gap nommé, pas un oubli silencieux** —
à reprendre dans un ticket dédié si Alexis le juge utile ; la même technique
(`premierSucces` pour une lecture par id, concaténation pour une liste)
s'y applique à l'identique.

## Épreuves

- `tests/isolation/9l50-portail-photos-tous-clients.test.ts` — sous la vraie
  politique RLS, avec un second rattachement JETABLE (ajouté en `beforeAll`,
  retiré en `afterAll`, jamais une mutation du fixture `PORTAIL_A_CLIENT`
  partagé par d'autres fichiers) : photo du second client vue via
  `premierSucces`, premier rattachement seul ne la voit pas, autre société
  réduit la liste essayée à `[]` avant toute tentative (jamais une levée),
  intervention non close toujours refusée, liste des interventions agrégée
  sur les deux clients, fiche d'intervention résolue sur le second client.
- `tests/e2e/captures-9l50-portail-photos-tous-clients.spec.ts` — bout en
  bout, 375 et 1280 px : la liste `/portail/interventions` porte les
  interventions des deux clients, le bon d'une intervention du second montre
  sa photo (image réelle, PNG 1×1, `naturalWidth > 0`). APRÈS seulement
  (même motif que `captures-9l28-portail-bon-photos.spec.ts`, voisin direct :
  un AVANT fidèle exige de rejouer le code d'avant ce ticket sous un serveur
  reconstruit, hors budget).
- Rejoués sans régression : `tests/e2e/captures-9l28-portail-bon-photos.spec.ts`
  (4/4) et `tests/e2e/tous-les-ecrans-rendent.spec.ts` (63 passés, 4 ignorés
  comme avant).

`pnpm test` (6104 passés), `pnpm test:isolation` (2587 passés), `pnpm lint`,
`pnpm typecheck` verts à chaque étape.

## Ce qui n'a pas été refait : les captures plein-site

`pnpm captures:etat` signale un retard **déjà présent avant ce lot** — la
liste des chemins changés depuis `6d207f0` porte des fichiers sans rapport
avec ce ticket (`app/api/terrain/...`, `components/machines/...`,
`lib/i18n/fr.ts`, etc., hérités de lots antérieurs qui n'ont pas rejoué la
procédure). Rejouer `scripts/captures.mts` exige une base jetable neuve, un
build de production, un amorçage de compte par lien suivi manuellement, et
quatre identités distinctes (bureau, portail, multi-société) — un geste
plein-site, disproportionné pour un lot scopé aux photos du portail, et qui
ne ferait que déplacer la dette déjà accumulée sans la résorber (les écrans
non liés à ce ticket resteraient de toute façon photographiés à cette prise).
Signalé plutôt que tu, comme demandé : à reprendre en tant que ticket propre
si la dérive doit être résorbée.

## Aucune migration, aucun arbitrage

Aucune colonne manquante. Aucune règle de gestion ne change — D70 reste
entière, c'est sa MÉCANIQUE d'application (pas la politique RLS) qui gagne un
second mode d'emploi pour les lectures qui en ont plusieurs à essayer. Rien à
écrire dans `docs/arbitrages.md`.
