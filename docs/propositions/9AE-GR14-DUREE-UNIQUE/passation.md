# 9AE-GR14-DUREE-UNIQUE — passation

## Ce que j'ai changé

Une seule maison pour l'écriture d'une durée : `enDuree` (`lib/calendar/duree.ts`), et deux
commits pour l'y faire converger.

- **GR14-T1a** — `dureeCarteAffichee` (`app/(back-office)/planning/carte.ts`), qui portait déjà
  la bonne écriture (« 45 min », « 1 h 30 », « 2 h 00 »), délègue désormais à `enDuree` pour
  tout ce qui n'est pas son `null` de durée nulle ou inconnue. Aucun changement de comportement
  sur cette fonction : `tests/unit/planning/carte.test.ts` et
  `tests/unit/interventions/bouton-cloturer.test.ts` (qui l'importe indirectement via
  `components/interventions/bouton-cloturer.tsx`) restent verts sans modification.
- **GR14-T1b** — les TROIS copies locales sont supprimées : `minutes()`
  (`interventions/[id]/page.tsx`), `minutes()` (`interventions/[id]/bon/page.tsx`),
  `enHeuresEtMinutes()` (`terrain/[id]/page.tsx`). Les deux premières complétaient le reste des
  minutes à DEUX CHIFFRES avant de tester l'heure nulle — écart nommé par le ticket : « 05 min »
  au lieu de « 5 min », « 00 min » au lieu de « 0 min », sous l'heure. Pour l'exploitation : la
  fiche intervention (blocs Réalisation, Pauses, Valorisation), le bon d'intervention imprimable
  et le compteur terrain écrivent désormais tous la même chose pour la même durée — plus aucun
  écran ne montre un zéro de tête que les deux autres ne montrent pas.

Aucune migration, aucune ligne de semis, aucun prix, **aucune règle de gestion changée** — les
valeurs numériques (arrondi au quart d'heure, plancher d'une heure, taux) sont strictement
identiques ; seule l'ÉCRITURE du texte change.

## Ce que j'ai mesuré

- **Tests unitaires neufs** : `tests/unit/calendar/duree.test.ts` (7 valeurs : `0`, `5`, `45`,
  `65`, `90`, `690`, `120`, `32880` minutes → `"0 min"`, `"5 min"`, `"45 min"`, `"1 h 05"`,
  `"1 h 30"`, `"11 h 30"`, `"2 h 00"`, `"548 h 00"`) et
  `tests/unit/calendar/duree-une-seule-ecriture.test.ts` (gardien : les trois écrans importent
  `@/lib/calendar/duree` et ne redéfinissent ni `minutes()` ni `enHeuresEtMinutes()`, avec sa
  mise en échec — une copie locale réintroduite dans le texte est bien détectée par le motif du
  gardien, sans toucher au fichier réel).
- `pnpm test` : 275 fichiers, 2950 tests, verts après T1a puis après T1b.
- `pnpm format:check`, `pnpm typecheck`, `pnpm lint` : verts après chaque commit.
- **Captures AVANT/APRÈS** (`docs/propositions/9AE-GR14-DUREE-UNIQUE/captures/`), à 1280 et
  375 px, sur les trois écrans du ticket, prises par un spec neuf
  (`tests/e2e/captures-gr14-duree-unique.spec.ts`, env `CAPTURES_GR14`) sur SA PROPRE
  intervention (`GR14CAP`, id fixe, jamais une fixture `SCENE.*`) : `cloturee`, un segment fermé
  de 5 minutes, une pause fermée de 8 minutes — deux durées à un seul chiffre, seules capables de
  révéler l'écart. Une fois sur le code d'AVANT le lot (les quatre fichiers touchés remis
  temporairement au contenu du commit `d4f3d7a`, `lib/calendar/duree.ts` et ses deux tests
  déplacés hors du dépôt le temps de la capture — jamais commités, restaurés à l'identique du
  commit livré ensuite, vérifié par `git diff --stat`, vide), une fois sur le code livré.
  - **AVANT** (`captures/avant/`) : fiche — « Temps validé (minutes) : **05 min** »,
    « D. Guérin — …(**05 min**) », « Temps mesuré par le compteur : **05 min** »,
    « Temps validé : **05 min** », pause « (**08 min**) » ; bon — « Durée : **05 min** »,
    « Temps total sur site : **05 min** » ; terrain — compteur affiché **5 min** (`0`→`"0 min"`
    déjà correct côté terrain avant le lot, seule la fiche/le bon portaient le zéro de tête ; le
    cas à un chiffre choisi ici, 5 min, est bien celui qui distinguait les trois écritures).
  - **APRÈS** (`captures/apres/`) : les mêmes blocs écrivent tous **5 min** / **8 min**, sans
    zéro de tête.
- `CI=1 pnpm verify:full` en entier, au premier plan, en un seul appel, à la toute fin (voir
  sortie ci-dessous du dernier commit) : format, typecheck, lint, test, test:isolation, build,
  et l'e2e complet, vert.

## Ce que j'ai tranché et pourquoi

- **`enDuree` vit dans `lib/calendar/`**, comme demandé par le ticket, en import direct
  (`@/lib/calendar/duree`) — jamais ajoutée à `lib/calendar/index.ts` : `enHeure`
  (`parametrage.ts`), la fonction sœur qui lit l'heure du jour, n'y est pas non plus, et les
  trois écrans qui l'utilisent importent déjà `@/lib/calendar/fuseau` de la même façon.
- **`dureeCarteAffichee` garde sa signature et son `null` propre** : c'est la seule des quatre
  fonctions à avoir un sens différent (« pas de durée à afficher » plutôt qu'« une durée de zéro
  minute ») ; `enDuree` ne porte que la conversion, jamais la décision d'afficher ou de taire.
- **Le compteur terrain (`enHeuresEtMinutes`) écrivait déjà `0 min` pour zéro** — la même chose
  qu'`enDuree` — mais avec sa PROPRE implémentation. Elle est supprimée comme les deux autres :
  la duplication était le défaut visé par le ticket, même quand le résultat ne divergeait pas
  encore sur ce cas précis.
- **Une seule intervention pour les trois écrans de capture** (`GR14CAP`), au lieu de trois
  fixtures séparées : le ticket le demande (« sur une intervention ERGO14- créée et supprimée »),
  et une seule ligne `cloturee` avec un segment et une pause suffit à exercer les trois routes.
- **`vue_technicien_le` posé dans la fixture, avant la clôture** : sans quoi la première visite
  de `/terrain/<id>` par le technicien affecté tente d'écrire cette colonne
  (`marquerVuParTechnicien`) sur une ligne déjà `cloturee` — refusé par la contrainte
  d'immuabilité (I5, « Intervention clôturée : elle ne se modifie plus sans trace »). Écart
  découvert en écrivant la capture, hors périmètre de ce ticket (voir pièges plus bas).
- **La clôture (`statut='cloturee'`) est posée en tout dernier geste** de la fixture, après le
  segment, la mise à jour des temps et la pause : la même contrainte d'immuabilité refuse toute
  écriture ultérieure sur la ligne.

## Ce que je n'ai PAS fait

- Aucune règle de gestion touchée : arrondi au quart d'heure, plancher d'une heure, taux — tout
  est identique avant/après, seule l'écriture du texte change.
- Aucune migration, aucune ligne de semis, aucun prix.
- Je n'ai pas touché `enHeure` (`lib/calendar/parametrage.ts`), qui lit l'heure du jour et non
  une durée — hors périmètre, et son test (`tests/unit/calendar/parametrage.test.ts`) reste
  inchangé.
- Je n'ai pas touché `components/interventions/bouton-cloturer.tsx` ni `planning/statistiques.tsx`
  (9AF), ni les autres écrans nommés « hors lot » par le ticket (trajets, prestations, sites,
  libellés de saisie).
- Je n'ai pas corrigé le fait qu'une intervention `cloturee` propose encore le bouton
  « Démarrer l'intervention » sur `/terrain/<id>` (visible sur `captures/apres/terrain-compteur-*.png`)
  — hors périmètre de GR14, qui porte sur l'écriture d'une durée, pas sur les actions proposées.

## Les pièges pour la session suivante

- **Une intervention `cloturee` ne se modifie plus du tout, y compris `vue_technicien_le`** :
  toute fixture e2e qui pose une intervention close ET la fait visiter par le technicien affecté
  doit poser `vue_technicien_le` non nul À LA CRÉATION, avant de passer le statut à `cloturee` —
  sinon `marquerVuParTechnicien` (appelée à chaque ouverture de `/terrain/<id>`) échoue sur la
  contrainte d'immuabilité (I5). Ce n'est pas propre à GR14 : tout futur spec de capture visitant
  `/terrain/<id>` sur une ligne déjà close portera le même risque.
- **`minutesArrondies` est toujours un multiple de 15, `minutesFacturees` toujours ≥ 60** — le
  bug « 05 min » ne peut se voir QUE sur `minutesReelles` (= `temps_valide_min` brut), sur
  `tempsMesureMin`/`tempsValideMin`, sur un segment ou une pause : une fixture qui ne poserait
  qu'un `temps_valide_min` élevé (comme `bon-intervention.spec.ts`, 120 minutes) ne l'aurait
  jamais montré.
- Le spec de capture (`tests/e2e/captures-gr14-duree-unique.spec.ts`) est resté dans le dépôt
  (même convention que `captures-gr13-fiche-telephone.spec.ts`) — sa scène `GR14CAP` est FIXE et
  distincte de toute `SCENE.*` partagée ; il ne s'exécute qu'à la demande (jamais dans
  `pnpm test:e2e` ordinaire, `DOSSIER` valant `""` sinon).

## Ce qui reste à faire

Rien d'identifié dans le périmètre de ce ticket. Le gain GR14 de l'audit du 26/09/2026
(constat G17) est livré ; les tickets 9AF (`planning/statistiques.tsx`), 9AG (trajets), 9AH
(prestations/sites) et 9AI (libellés de saisie) restent à traiter séparément, comme prévu par le
territoire de ce lot.
