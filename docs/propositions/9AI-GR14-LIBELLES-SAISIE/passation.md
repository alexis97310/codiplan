# 9AI-GR14-LIBELLES-SAISIE — passation

## Ce que j'ai changé

Cinq champs saisis en minutes (audit GR du 26/09/2026, constat G17 → gain GR14, ticket 5/5) ne
disaient l'unité que par un mot ou une parenthèse nue, sans donner de repère à qui saisit. Leurs
libellés portent désormais l'unité ET un exemple qui suit `enDuree` — « en minutes — ex. 90 =
1 h 30 » — plutôt qu'un « (minutes) » qui laissait deviner la conversion :

- **GR14-T5a** — trois libellés changés en place, valeurs complètes dans `lib/i18n/fr.ts`, aucune
  composition dans un `.tsx` : `intervention.deplacement.duree` (bloc Planifier/Déplacer de
  `/interventions/<id>`), `prestations.duree_minutes` (`/parametres/prestations`),
  `site.temps_trajet_min` (`/sites/<id>` et `/sites/nouveau`).
- **GR14-T5b** — `intervention.cloture.temps_valide` servait DEUX usages : le champ de saisie de
  la clôture (minutes) ET l'affichage de la valorisation, déjà en heures via `enDuree`. Le même
  libellé disait donc « (minutes) » à côté d'une valeur en heures. Nouvelle clé
  `intervention.cloture.temps_valide_saisie` pour le champ ; la clé d'origine redevient un
  libellé d'AFFICHAGE, sans unité en dur (« Temps validé »). `tests/e2e/fiche-cloturer.spec.ts`
  lit la nouvelle clé.
- **GR14-T5c** — `/parametres/trajets` : nouvelle clé `trajets.champ_minutes` pour
  `etiquetteChamp()`. Le champ de réglage n'a AUCUNE unité visible (son étiquette est
  `sr-only`) : c'est le seul des cinq où le lecteur d'écran est le seul destinataire de
  l'unité et de l'exemple — rien ne change à l'écran pour un utilisateur voyant, donc ce
  point n'a PAS de capture (voir plus bas). `trajets.minutes` garde sa valeur, seule pour le
  décompte de `duree()` (« 4 h 00 (240 minutes) »).

Pour l'exploitation : quiconque saisit une durée sur ces cinq champs voit maintenant un exemple
concret de la conversion minutes → heures, au lieu de deviner ou de se tromper d'ordre de
grandeur (90 saisi en pensant « 1 h 30 » écrivait déjà 90 minutes, mais rien ne le confirmait à
l'écran). Aucune règle de gestion, aucun type de champ, aucune migration : les valeurs restent
des minutes en base, seuls les libellés changent.

## Ce que j'ai mesuré

- **Test unitaire neuf** (`tests/unit/i18n/durees-en-minutes.test.ts`), étendu à chaque commit :
  vérifie que chacune des quatre clés de saisie (`intervention.deplacement.duree`,
  `prestations.duree_minutes`, `site.temps_trajet_min`, `intervention.cloture.temps_valide_saisie`,
  `trajets.champ_minutes`) contient « en minutes » et l'exemple exact produit par `enDuree(90)`
  (jamais recopié en dur — si le formateur change, le test change avec lui) ; et que
  `intervention.cloture.temps_valide` (affichage) ne contient PAS « minutes ».
- **Captures AVANT/APRÈS** (`docs/propositions/9AI-GR14-LIBELLES-SAISIE/captures/`, à 1280 et
  375 px), prises par un spec neuf (`tests/e2e/captures-9ai-gr14-libelles-saisie.spec.ts`, env
  `CAPTURES_9AI`) — sa propre scène préfixée `ERGO14L-` (un client, un site, deux interventions :
  l'une `a_planifier` pour le bloc Planifier, l'autre `terminee` avec un temps mesuré pour le
  bloc Clôturer, jamais replié pour ce statut), créée en `beforeAll` et supprimée en `afterAll`.
  `/parametres/prestations` et `/sites/nouveau` n'ont eu besoin d'aucune donnée forgée : leur
  formulaire de création s'affiche sans dépendre du catalogue ni d'un client choisi.
  - **AVANT** (`lib/i18n/fr.ts`, `interventions/[id]/page.tsx`, `parametres/trajets/page.tsx`
    remis temporairement au contenu du commit parent `7a8dc97` par `git checkout 7a8dc97 --
    <3 fichiers>`, jamais commité, restauré ensuite — vérifié par `git diff --stat`, vide) :
    « Durée en minutes », « Durée (minutes) », « Temps de trajet depuis le rattachement
    (minutes) », « Temps validé (minutes) » sur le champ de saisie de la clôture.
  - **APRÈS** (code livré) : « Durée (en minutes — ex. 90 = 1 h 30) », « Temps de trajet depuis
    le rattachement (en minutes — ex. 90 = 1 h 30) », « Temps validé (en minutes — ex.
    90 = 1 h 30) » sur le champ, « Temps validé » (sans unité) sur l'affichage de la
    valorisation plus bas sur la même fiche — les deux visibles côte à côte sur
    `bloc-cloturer-1280.png`/`-375.png`.
  - À 375 px, les cinq libellés allongés retournent à la ligne proprement, sans chevauchement ni
    troncature (`bloc-planifier-375.png`, `bloc-cloturer-375.png`,
    `formulaire-prestations-375.png`, `formulaire-site-fiche-375.png`,
    `formulaire-site-nouveau-375.png`) — le point laissé NON MESURÉ par l'audit est donc réglé :
    rien à corriger côté mise en page.
- `pnpm format:check`, `pnpm typecheck` (`tsc --noEmit`), `pnpm lint` (`eslint --max-warnings 0`)
  et `pnpm test` (278 fichiers, 2966 tests) : verts avant chaque commit.

## Ce que j'ai tranché et pourquoi

- **Le champ de saisie et l'affichage de « Temps validé » ont désormais deux clés distinctes**
  (T5b) plutôt qu'un seul libellé conditionnellement composé : le ticket le demandait
  explicitement (« un libellé pour saisir, un pour lire »), et la paire est gardée par le même
  test unitaire (`temps_valide_saisie` passe la règle « en minutes + exemple »,
  `temps_valide` échoue si « minutes » y apparaît).
- **`trajets.champ_minutes` n'a pas de capture dédiée** : son étiquette est `sr-only`
  (`app/(back-office)/parametres/trajets/page.tsx`, `Reglage()`), donc son changement ne modifie
  aucun pixel — une capture AVANT/APRÈS montrerait deux images identiques. Le territoire du
  ticket listait les captures attendues et `/parametres/trajets` n'y figurait pas ; je m'y suis
  tenu plutôt que de produire deux images qui ne prouveraient rien.
- **Aucune valeur composée dans un `.tsx`** : les trois nouveaux libellés (T5a) et les deux clés
  neuves (T5b, T5c) sont des chaînes complètes dans `fr.ts`, jamais un gabarit recomposé au point
  d'usage — même discipline que le reste du dictionnaire (L0-11) et qu'exige
  `sans-chaine-visible-en-dur`.

## Ce que je n'ai PAS fait

- Aucune migration, aucune ligne de semis, aucun prix, aucune règle de gestion touchée : les
  champs restent des `number` saisis en minutes, la contrainte de base sur `trajets.refus`
  (1 à 1440 minutes entières) est inchangée.
- Je n'ai pas touché `parametres.pas` (« Pas des créneaux (minutes) »,
  `parametres/agences/composants.tsx:152`) : c'est un PAS de grille (1 à 480), pas une durée
  d'intervention — explicitement hors lot, question posée ci-dessous.
- Je n'ai pas rendu visible l'unité du champ de réglage des trajets (`etiquetteChamp()`, toujours
  `sr-only`) : rendre l'unité visible à l'écran serait un choix de mise en page, non mandaté par
  ce ticket (« hors lot : … la mise en page du champ trajets »).
- Je n'ai touché aucun message de refus (`fr.ts:2635`, `2782`/`trajets.refus`, `2396`/
  `parametres.pas.refus`), aucun affichage déjà en heures (9AE-9AH), et rien hors du territoire
  listé par le ticket.

## Les pièges pour la session suivante

- **`getByLabel(fr["clé neuve"])` dans un spec de capture casse le build AVANT** (piège déjà noté
  par `9AE`/`9AG`/`9AH`) : `tsconfig.json` inclut `tests/`, donc `next build` type-vérifie le
  spec contre le code retourné en arrière, où la clé n'existe pas encore. J'ai contourné ça pour
  le bloc Clôturer en repérant le champ par son attribut DOM stable
  (`input[name="temps_valide_min"]`) plutôt que par son libellé — l'assertion ne dépend alors ni
  de la clé ni de sa valeur, dans les deux états du code. Les trois autres captures utilisent des
  clés qui existaient déjà avant ce lot (seule leur VALEUR change), donc `fr["clé"]` y reste sûr.
- **`blocCloturerReplie` ne replie jamais le bloc Clôturer sur une intervention `terminee`**
  (`lib/interventions/action-principale.ts`) : c'est pour ça que la scène de capture utilise ce
  statut plutôt que `a_planifier`/`planifiee` — sur ces statuts-là, le bloc seraît replié derrière
  un refus « aucun temps mesuré » et le nouveau libellé ne serait pas visible sans un clic
  supplémentaire.
- **Question pour Alexis** : `parametres.pas` (« Pas des créneaux (minutes) »,
  `parametres/agences/composants.tsx:152`) mérite-t-il le même traitement (unité + exemple) ? Ce
  n'est pas une durée d'intervention saisie en minutes comme les cinq autres — c'est un pas de
  grille borné 1–480 — donc je l'ai laissé hors lot plutôt que d'étendre le territoire sans
  mandat, mais l'audit GR ne semble pas l'avoir couvert séparément.
- **Question pour Alexis** : faut-il un jour rendre visible l'unité du champ de réglage des
  trajets (`etiquetteChamp()`, toujours `sr-only`), maintenant que son texte porte l'exemple et
  pas seulement le mot « minutes » ? C'est un changement de mise en page, pas de libellé, donc je
  ne l'ai pas fait — mais un exemple utile à un lecteur d'écran l'est probablement aussi à un
  utilisateur voyant.

## Ce qui reste à faire

Les deux questions ci-dessus sont en attente d'arbitrage. Rien d'autre d'identifié dans le
périmètre de ce ticket — les cinq écrans du territoire ont été mesurés AVANT/APRÈS, et le gain
GR14 (constat G17, cinq tickets) est maintenant traité en entier (9AE à 9AI).
