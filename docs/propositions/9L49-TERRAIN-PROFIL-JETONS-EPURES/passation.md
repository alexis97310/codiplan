# 9L49-TERRAIN-PROFIL-JETONS-EPURES — passation

Reste à faire de 9L46 (« Migrer `/terrain/profil` (et son sous-écran neuf) vers les jetons « fiche
terrain épurée » du 13/11/2026 »). Aucune règle métier touchée, aucune migration.

## AUCUNE MIGRATION

Conforme à la consigne : rien dans `prisma/schema.prisma` n'a bougé.

## Ce qui a changé

### `app/(mobile)/terrain/profil/page.tsx`

- Le titre passe de `font-extrabold` (800) à `font-semibold` (600) — « 600 titres… pas de 700 »
  (décision du 13/11), et même graisse que le titre de « Ma journée ».
- Le bloc identité (nom, courriel, société) quittait un cadre en carte
  (`rounded-lg border … bg-app-surface`, tout en `font-bold`) : il devient une section neutre,
  séparée du bloc suivant par un seul filet `border-b` — même forme que chaque section
  d'information de la fiche (`app/(mobile)/terrain/[id]/page.tsx`, « Contact sur place », etc.).
  Le nom reste `font-semibold` (ce qu'il est, un fait principal) ; courriel et société passent en
  `text-app-encre-faible … font-medium`, comme toute ligne secondaire de la fiche.
- « Changer mon mot de passe » (un `<Link>` stylé à la main) et « Déconnexion » (un `<button>`
  stylé à la main, tous deux en `font-bold`) deviennent deux `<Button variant="outline" size="lg">`
  — le même composant que le bouton « Itinéraire » de la fiche. Ni l'un ni l'autre n'a besoin d'être
  la seule couleur d'action (bleu `--app-marque`) : ce sont des actions secondaires, pas le geste
  principal de l'écran — `variant="outline"` reste neutre (`bg-background`/`border-app-bord`,
  zonés), exactement ce que la maquette montre.
- `BoutonInstallerCodiplan` et `PastilleReseau` : INCHANGÉS. Le premier est **partagé avec le
  bureau** (`app/(apres-session)/installation/page.tsx`) — y toucher aurait changé un écran que la
  décision du 13/11 ne touche pas (« le bureau ne change pas »).

### `app/(mobile)/terrain/profil/mot-de-passe/page.tsx`

- L'en-tête (un lien de texte « ← Retour au profil » suivi d'un `<h1>` sur sa propre ligne) devient
  la même ligne à 60 px que celle de la fiche : un chevron seul (`Icone nom="chev-l"`, même
  `aria-label` que le lien de texte retiré — rien ne change pour un lecteur d'écran) et le titre à
  côté, `border-b` pour le filet. Un sous-écran de « Profil » suit la même forme que le sous-écran
  d'une intervention.
- Le champ « Mot de passe actuel » quittait le composant partagé `Champ`
  (`components/session/formulaire.tsx`, bordé, blanc) : il devient un champ inline aux classes
  `bg-app-terrain-champ-fond text-app-terrain-encre … border-none`, les mêmes que les champs déjà
  épurés de `rapport-automatique.tsx`/`checklist-terrain.tsx`.
- `ChampsNouveauMotDePasse` (les deux champs du mot de passe neuf, avec leurs deux coches en
  direct) est **partagé par quatre écrans de bureau** (`/mon-compte`, `/portail/mon-compte`,
  `/premier-acces`, `/enrolement`) que la décision du 13/11 ne touche pas. Y ajouter une option de
  zone aurait fait porter à un composant de bureau une branche qui ne sert jamais le bureau.
  **Un jumeau terrain**, `components/terrain/champs-nouveau-mot-de-passe.tsx`
  (`ChampsNouveauMotDePasseTerrain`) : même comportement exact (mêmes noms de champ `motDePasse`/
  `confirmation`, même logique de coche en direct), seule l'habillage change.
- Le bouton de soumission (`<Button type="submit" size="lg">`, variante par défaut = bleu
  `--app-marque`) était déjà conforme — c'est le seul geste principal de l'écran, et `--app-marque`
  ne dépend d'aucune zone (`#0053a1` au bureau comme au terrain). Seul `className` gagne `text-16`
  pour rester cohérent avec le reste de l'écran.

## Garde close mise à jour

`tests/unit/ui/composants-base.test.tsx` — « tous les boutons du terrain portent `size="lg"` » :
population close des `<Button>` de `app/(mobile)/**` + 5 fichiers de `components/terrain|interventions`,
33 → 35 (les deux `<Button>` neufs de `terrain/profil/page.tsx`). `tests/unit/ui/retouches-2a.test.ts`
compte une population DIFFÉRENTE et PLUS ÉTROITE (`FICHIERS_TERRAIN`, sept fichiers nommés) qui
n'inclut ni `terrain/profil/page.tsx` ni son sous-écran mot de passe : son total (32) ne bouge pas.

## Épreuves

- `pnpm test`, `pnpm test:isolation`, `CI=1 pnpm verify` : verts (voir ci-dessous).
- e2e ciblées rejouées sans modification, toutes vertes : `9l42-terrain-entete-profil-pastille.spec.ts`
  (8 scénarios, dont l'en-tête « Profil »/pastille et les deux gestes de compte rangés dans
  `<main>`), `9l46-finitions-liste-telephone-mdp-technicien.spec.ts` (le parcours complet premier
  accès → connexion → `/terrain/profil` → changement de mot de passe → nouvelle session, avec un
  mot de passe actuel faux puis le bon), `9i7b-pieces-remplacees.spec.ts`. Et
  `tests/e2e/tous-les-ecrans-rendent.spec.ts` (65 scénarios, 4 ignorés comme avant, 61 verts).
- Aucune épreuve neuve de comportement : rien n'a changé côté gestes, routes ou gardes — seule la
  mise en page. Le seul ajustement d'épreuve est la garde close ci-dessus (un compte, pas une
  assertion de comportement affaiblie).

## Captures AVANT/APRÈS

`tests/e2e/captures-9l49-terrain-profil-jetons-epures.spec.ts` (même recette que
`captures-9l42-terrain-entete-profil-pastille.spec.ts`) — AVANT pris sur le code d'avant ce lot,
via un worktree jetable sur `HEAD` (`git worktree add /tmp/9l49-avant HEAD`, avant le commit du
point 1, lien symbolique vers `node_modules`, `.env` copié — recette de
`[[captures-avant-apres-e2e]]` pour « le code d'avant est encore dans le répertoire de travail, pas
encore committé »), APRÈS rejoué sur le dépôt principal une fois le point 1 committé. Quatre
fichiers dans `docs/propositions/9L49-TERRAIN-PROFIL-JETONS-EPURES/captures/` :
`avant-profil.png`, `apres-profil.png`, `avant-mot-de-passe.png`, `apres-mot-de-passe.png`.

**`docs/captures/` (la galerie complète) n'a PAS été rejouée.** `pnpm captures:etat` le signale déjà
en sortie 0 (non bloquant) — mais le signale pour une trentaine de fichiers accumulés depuis la
prise du 14/11 (6d207f0), la plupart sans rapport avec ce lot (9L38 à 9L44 au moins). Rejouer cette
galerie exige une base jetable dédiée, un premier accès réel (mot de passe choisi hors dépôt) et
trois identités distinctes (compte, portail, multi-société) — un geste disproportionné au budget de
ce seul lot, et qui mélangerait dans un même commit la dérive de plusieurs lots antérieurs avec
celle de celui-ci. Laissé pour une relance dédiée du pilote, comme le fichier le documente déjà
(« Mis à jour par les tickets qui livrent, et par le pilote à chaque relance »).

## Feuille de route

`lib/feuille-de-route/contenu.ts` — un élément « Livré depuis le 31/10 » neuf : « « Profil » et son
écran de changement de mot de passe migrés vers les jetons de la fiche terrain « épurée » … —
(9L49) ». Aucun élément « à écrire » ne portait ce point précis (ni 9L46 ni 9L42 n'en avaient
laissé un, seulement la mention narrative dans leurs passations respectives) : rien à retirer, un
seul ajout.

## État du dépôt

Ce worktree (`codiplan-voie1`) tourne déjà en HEAD détachée sur un commit de `main` (état hérité, pas
posé par ce lot) — quatre commits ajoutés par-dessus `c2a812aeb` (9L48), `git log --oneline -15`
ci-dessous. Arbre propre après le dernier commit.
