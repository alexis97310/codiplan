# 9L04D-TERRAIN-CHECKLIST-EPUREE — passation

Aucune migration, aucun changement de schéma. Ce lot redessine la tuile de saisie checklist du terrain
(`components/terrain/checklist-terrain.tsx`, CK5/9K21) selon la fiche « épurée » validée par Alexis le
13/11/2026 : pastilles ✓ ✕ – pour conforme/non-conforme/sans-objet, coche ronde pour « fait », segments
pleine largeur pour un choix à 2-4 options, rubriques repliables, avancement « Checklist · N sur M » +
état réseau, plus de bouton global « Afficher le détail ».

## 1. Ce qui a été mesuré avant d'écrire une ligne

- **Le composant existant** (`ChecklistTerrain`) avait un seul bouton « Afficher/Masquer le détail » global
  (jamais par rubrique), des boutons rectangulaires `<Button>` pour conforme/non-conforme/sans-objet, une
  case native (`CaseACocher`) pour « fait », et un `<select>` pour TOUT choix dans une liste, quel que soit
  le nombre d'options.
- **Le retrait d'une réponse déjà écrite côté serveur N'EXISTE PAS** (point 3 du ticket demandait de le
  mesurer). `enregistrerReponses` (`lib/checklists/depot.ts`) n'a jamais eu de chemin de suppression, et
  `validerReponsePoint` refuse systématiquement une valeur vide pour chacun des cinq types. Plus bas que
  l'application : la migration `20261109080000_checklists_socle_9k08` n'accorde que
  `GRANT SELECT, INSERT, UPDATE ON "checklist_reponse"` au rôle applicatif — **aucun `DELETE`**. Une ligne
  déjà écrite ne peut donc être effacée sans migration (accorder le privilège, et sous RLS une politique pour
  lui) : hors de portée de ce lot (« AUCUNE migration »). Mesuré et PINNÉ par un test isolation (voir §3) —
  j'ai essayé la suppression còté serveur (`DELETE FROM checklist_reponse` via Prisma, bypass de
  `validerReponsePoint`), elle échoue avec `permission denied for table checklist_reponse` sous le rôle
  applicatif ; revenu en arrière.
  - **Ce qui marche quand même, localement** : un second appui sur une pastille retire la clé de l'état React
    ET de la différence envoyée à la file hors réseau (`ajouterSaisie`) — donc un point répondu PUIS retiré
    AVANT envoi ne part jamais vers le serveur. Une fois la réponse déjà synchronisée, un second appui ne la
    retire plus réellement côté serveur (silencieusement sans effet réseau, mais visible localement tant que
    l'écran n'est pas rechargé — après rechargement, la réponse reviendrait, lue depuis le serveur). C'est la
    moitié « sinon dis-le » du point 3.
- **Aucun lot 9L04C n'existe** dans le dépôt (vérifié : aucun répertoire `docs/propositions/9L04C*`, aucune
  entrée dans `docs/arbitrages.md`) : ce lot est le premier à poser le style « épuré » en code. Les jetons de
  couleur du style (`#E6E8EC`, `#F1F3F6`, `#111827`, `#5B6472`, les pleins vert/rouge) n'existaient pas
  encore dans `app/globals.css` — ils y sont posés ici, sous un préfixe DÉDIÉ (`--app-terrain-*`), jamais en
  réécrivant les jetons `--app-bord`/`--app-encre`/etc. existants (qui restent ceux du bureau, inchangés).
- **Conflit avec D143 (point 11, 30/09/2026)** : `tests/unit/ui/retouches-2a.test.ts` exige 700 minimum sur
  tout texte de 12-13 px, partout dans `app/`/`components/`. La fiche épurée demande l'inverse
  (« 500 libellés, 600 titres et boutons ; pas de 700 »). **Signalé et tranché par un nouvel arbitrage**,
  D252 (`docs/arbitrages.md`) : D143 reste la règle partout, sept lignes de `checklist-terrain.tsx` entrent
  dans la liste d'exemption (fermée dans les deux sens) avec leur condition de réouverture.

## 2. Ce qui a été fait

- **`app/globals.css`** : huit jetons neufs (`--app-terrain-filet`, `--app-terrain-champ-fond`,
  `--app-terrain-encre`, `--app-terrain-encre-secondaire`, `--app-terrain-vert-plein(-encre)`,
  `--app-terrain-rouge-plein(-encre)`), déclarés dans les DEUX apparences (`maquette` — les valeurs mesurées
  le 13/11 ; `tableau` — dérivées de ses propres teintes voisines, même patron que le reste du bloc).
- **`lib/theme/apparence.ts`** : les huit jetons ajoutés à `JETONS` (liste close, gardée dans les deux sens).
- **`tests/unit/theme/echelle-typographique.test.ts`** : le témoin de compte de jetons (40→48) mis à jour —
  c'était un témoin, pas un plafond, et c'est écrit en toutes lettres dans son propre commentaire.
- **`lib/i18n/fr.ts`** : `checklist.terrain.non_conforme` capitalisé en « Non conforme » (point 5 — la seule
  des trois options qui ne l'était pas déjà ; la même clé sert au terrain, aux bons CK8 et à la fiche bureau
  CK9, tous mis à jour sans y toucher). Clés neuves : légende, « sur », « Hors réseau », « à envoyer »,
  « obligatoire », les cinq symboles (✓ ✕ – ▾ ▸) — chacun un seul endroit si un essai terrain demande des
  lettres à la place.
- **`components/terrain/checklist-terrain.tsx`** : réécrit. `Avancement` (trait 3 px + « Checklist · N sur M »
  + état réseau, `compterEnAttente`/`online`/`offline`, même patron que `BoutonEnvoyer`), `Legende`,
  `PastillesConformite` (trois `<button>` SÉPARÉS, jamais un `.map()` — le gardien L0-11 confond sinon la
  valeur interne et le libellé affiché, exactement le piège que l'ancien code documentait déjà),
  `CocheRonde` (`role="checkbox"`, nommée par le libellé DU POINT, jamais le nom générique du type — deux
  points « Fait » restent distincts), `SegmentsChoix` (`role="radiogroup"`/`"radio"`, ≤ 4 options ; au-delà,
  le `<select>` gardé), `PointLigne` (une ligne, 64 px mini, « Obligatoire » bleu 13 px SEULEMENT tant que le
  point n'est pas répondu), `Rubrique` (repliable, `aria-expanded`, complète ⇒ repliée D'ELLE-MÊME — la
  formule `ouvert = manuel ?? !complete` ouvre par défaut tant qu'incomplète, et le manuel ne prime sur la
  complétude que si la personne a rouvert explicitement). Le saut CK7 (« Terminer » refusé → lien qui déplie
  et saute) ouvre désormais la RUBRIQUE du point visé, pas un drapeau global.
- **`docs/arbitrages.md`** : D252.

## 3. Épreuves

- **`tests/isolation/checklist-domaine.test.ts`** : un scénario neuf pinne, en clair, que `valeur: null`
  est refusé par `enregistrerReponses` aujourd'hui (`checklist.refus.valeur_invalide`), et que la réponse déjà
  écrite reste intacte — la preuve du constat du §1, pas une supposition.
- **`tests/unit/terrain/checklist-terrain.test.tsx`** (neuf — AUCUNE épreuve unitaire n'existait pour ce
  composant avant ce lot, relevé en l'écrivant) : avancement 0→1, retrait par second appui (avec son effet
  sur l'avancement), « Obligatoire » qui disparaît/revient, rubrique qui se replie puis se rouvre, coche
  ronde, segment de choix. Chaque épreuve scope ses requêtes par `id` de point (`within(ligneDuPoint(...))`)
  ou par état ARIA (`expanded: false`) plutôt que par un nom littéral — un libellé de point de fixture
  (« Nettoyage effectué », « Bon ») n'est pas une clé du dictionnaire, et le gardien L0-11 instrumente aussi
  les requêtes d'écran DANS les fichiers de test.
- **E2E mis à jour** (UI changée, même règle prouvée — détail scène par scène) :
  - `9k21-checklist-terrain-saisie.spec.ts` : plus de clic « Afficher le détail » ; le résumé devient
    l'avancement (« Checklist · N sur M ») ; le choix (3 options) passe par un segment choisi PAR POSITION
    (jamais par son nom accessible, une valeur de fixture) ; la case « fait » n'a plus de filtre de nom (un
    seul `checkbox` sur la fiche).
  - `9k22-checklist-hors-reseau.spec.ts` : retrait du clic « Afficher le détail » (n'existe plus) ; le clic
    sur la pastille « Conforme » reste identique (même nom accessible).
  - `9k23-checklist-blocage-terminer.spec.ts` : retrait de l'assertion sur le bouton « Masquer le détail »
    (disparu) — la preuve du dépli reste la visibilité de la pastille du point visé, qui existait déjà juste
    après dans le même test.
  - `9k24-checklist-bons.spec.ts`, `9k25-checklist-fiche-bureau.spec.ts`, `9k30a-checklist-gabarits-valides.spec.ts` :
    rejoués SANS modification, verts — la capitalisation de « Non conforme » ne les touche pas (ils ne
    comparent jamais ce mot à un littéral).
  - `tests/e2e/tous-les-ecrans-rendent.spec.ts` : rejoué, vert.
- `pnpm test`, `pnpm test:isolation`, `pnpm typecheck`, `pnpm lint`, `pnpm format:check` : verts.

## 4. Captures

À 375 px, dans `docs/propositions/9L04D-TERRAIN-CHECKLIST-EPUREE/captures/`, AVANT (code d'avant ce lot,
obtenu par un `git stash` temporaire des trois fichiers qui rendent l'écran — `app/globals.css`,
`checklist-terrain.tsx`, `lib/i18n/fr.ts` — jamais poussé, retiré après usage) et APRÈS (ce lot, commité) :
- `entretien-pont-vide` : une checklist de 15 points (3 rubriques de 5), rien de répondu.
- `entretien-pont-moitie` : la rubrique « Sécurité » complète (repliée D'ELLE-MÊME en APRÈS — en AVANT, la
  notion n'existe pas, la fiche reste à plat), « Structure » à moitié.
- `installation` : une seconde checklist, plus courte, pour le contraste.
- `hors-reseau-file` : mode avion, une réponse en file.

Le spec Playwright qui les a produites (`tests/e2e/zz9l04d-captures.spec.ts`, préfixe « zz » = jetable) a été
RETIRÉ après usage, une fois les PNG extraits — même convention que les captures AVANT/APRÈS d'autres lots.

**NON FAIT, par manque de temps** : `scripts/captures.mts` (le jeu de captures GLOBAL, `docs/captures/`)
n'a pas été rejoué. La procédure (`docs/captures/README.md`) demande une base locale jetable, un build de
production, un serveur dédié et un premier mot de passe choisi via un lien d'amorçage — un enchaînement
plus lourd que le budget du lot ne permettait d'absorber en fin de session sans risquer de le laisser dans un
état intermédiaire. `docs/captures/` reste donc daté du commit qui y est inscrit, antérieur à ce lot — à
rejouer par qui prend la suite, ou par la file.

## 5. Ce que ce lot NE fait PAS (lu dans le ticket)

- Pas de « Tout conforme » par rubrique (délibéré, anti-complaisance).
- Pas de détail d'un point non conforme (suite, commentaire, photo) — un lot à part, avec migration (9L04I).
- Pas de tolérance/dernier relevé sur `valeur_mesuree` (déjà backlogué, lot 4).
- Le style « épuré » n'est posé QUE sur `ChecklistTerrain` — « Ma journée », la fiche terrain hors checklist,
  la coquille hors réseau restent dans leur habillage actuel (D124 non amendé pour eux par CE lot ; ce sera
  le travail des tickets voisins, 9L04E et suivants).
