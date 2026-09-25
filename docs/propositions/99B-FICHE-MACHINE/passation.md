# 99B-FICHE-MACHINE — passation

## Ce que j'ai changé (et ce que ça change pour l'exploitation)

`app/(back-office)/parc/[id]/page.tsx` :

- **La ligne « Prochaine VGP » du `dl.kv` d'identité porte désormais le même
  repère visuel que le registre `/vgp`.** Un `Badge` coloré au même ton que
  `tonEtat` (`lib/vgp/libelles.ts`) — rouge quand l'échéance déduite est
  passée, vert/orange/gris selon l'état sinon — précède la phrase déjà
  affichée (inchangée : « Échéance dépassée — 01/04/2026 (177 jours) », etc.).
  Avant ce ticket, cette phrase s'affichait en texte noir uniforme, sans
  aucun repère de gravité ni lien — une machine dépassée depuis six mois se
  lisait exactement comme une machine à jour.
- **Un lien « Enregistrer la vérification » apparaît vers
  `/vgp/enregistrer/<id de la machine>`** quand l'échéance est CONNUE
  (dépassée ou à venir) — jamais quand elle vaut « à déterminer » ou « aucun
  rythme déclaré », qui n'ont rien à enregistrer contre. C'est le même chemin
  d'écriture que la colonne « Action » du registre (`/vgp/enregistrer/[id]`,
  qui attend l'`id` de la MACHINE — vérifié en lisant `lireMachine(contexte,
  id)` dans cette page).
- **Le lien « ‹ Retour au parc » gagne une zone cliquable de 32 px de haut**
  (mesurée à 32 px après le changement, voir « Ce que j'ai mesuré ») et un
  texte à 13 px — la même correction que 98-TABLEAU-2 avait déjà appliquée
  aux liens du tableau de bord pour le même audit.

`lib/vgp/libelles.ts` :

- **`TONS_ETAT`, `tonEtat` et `libelleEtatCourt` ont été déplacés** depuis
  `app/(back-office)/vgp/page.tsx`, à côté de `libelleEcheance` qui y vivait
  déjà. Le registre les importe désormais au lieu de les déclarer localement
  — comportement inchangé, confirmé par les épreuves e2e existantes
  (`vgp-retard-visible.spec.ts`, `vgp-4.spec.ts`) qui restent vertes sans
  retouche.

`lib/i18n/fr.ts` : une clé neuve, `machine.fiche.vgp_enregistrer` (« Enregistrer
la vérification »).

Pour l'exploitation : un ADV ou un technicien qui ouvre la fiche d'une machine
voit immédiatement, sans passer par le registre, si sa VGP est en retard — et
peut enregistrer la vérification reçue sans quitter la fiche pour chercher la
machine dans `/vgp`.

## Ce que j'ai mesuré (comptes AVANT/APRÈS)

- **Zone cliquable du lien « Retour au parc »** : l'audit du 25/09/2026
  (constat 31) la mesurait à ~18 px. Après ce ticket, mesurée par
  `boundingBox()` sur la fiche de `NUS-SPL-2022-0007` (Playwright, 1280 px) :
  **32 px** exactement.
- **Zone cliquable du lien « Enregistrer la vérification »** (neuf) : mesurée
  à **16 px** — ticket ne l'exigeait qu'au lien de retour, mais c'est un écart
  laissé volontairement pour la session suivante (voir plus bas).
- **`pnpm test`** : 267 fichiers, 2868 tests, tous verts (y compris le
  gardien `sans-chaine-visible-en-dur`, qui a d'abord rougi deux fois pendant
  ce lot — voir « Ce que j'ai tranché »).
- **`CI=1 pnpm verify:full`** : vert de bout en bout — format, typecheck,
  lint, tests unitaires, `test:isolation`, build, `feries:horizon`,
  `audit:partitions`, et 288 épreuves e2e (285 passées, 3 ignorées, 0 échec),
  `vgp-retard-visible.spec.ts` et `vgp-4.spec.ts` compris, sans retouche.
- **Captures** : `docs/propositions/99B-FICHE-MACHINE/captures/`, la fiche de
  la machine dépassée du semis à 375 et 1280 px (badge rouge, phrase, lien
  d'enregistrement visibles aux deux largeurs, aucun débordement mesuré).

## Ce que j'ai tranché et pourquoi

- **`tonEtat`/`TONS_ETAT`/`libelleEtatCourt` déplacés ENSEMBLE**, alors que le
  ticket ne nommait que les deux premiers. Le badge de la fiche a besoin d'un
  texte court à afficher (« Échéance dépassée », « Information reçue »…) — la
  seule source existante de ce texte était `libelleEtatCourt`, privée de
  `/vgp`. L'écrire une seconde fois dans la fiche aurait été exactement la
  faute que ce dépôt répète de refuser (§9, 01/09) : deux lectures du même
  critère qui divergent en silence dès que l'une des deux change. La déplacer
  avec `tonEtat` coûte une fonction de plus dans `lib/vgp/libelles.ts`, pas
  une réécriture.
- **Le badge affiche le libellé COURT (`libelleEtatCourt`), pas la phrase
  entière, dans le `Badge`.** `Badge` (`components/ui/badge.tsx`) est
  `whitespace-nowrap`, et le docblock de `/vgp` documente déjà un débordement
  mesuré (D128) quand un badge porte plus qu'un mot. Mettre la phrase
  complète (« Échéance dépassée — 01/04/2026 (177 jours) ») dans un badge
  nowrap aurait réintroduit ce même défaut à 375 px — vérifié : la capture
  375 px ne montre aucun débordement avec le libellé court + la phrase en
  texte normal juste en dessous.
- **`type TonBadge` importé dans `lib/vgp/libelles.ts` depuis
  `@/components/ui/badge`.** Aucun fichier de `lib/` n'importait jusqu'ici
  depuis `components/`, mais aucun gardien ni règle écrite ne l'interdit
  (vérifié : `docs/constitution/organisation-du-code.md` ne porte pas encore
  de section `lib/vgp/` qui poserait la règle, et le seul gardien de
  frontière trouvé, `tests/unit/gardiens/frontiere-serveur-client.test.ts`,
  ne porte que sur `"use client"`, absent de `badge.tsx`). Import de TYPE
  uniquement, effacé à la compilation — pas de dépendance d'exécution créée.
- **La phrase du dictionnaire n'est PAS passée par une variable locale avant
  d'entrer dans le JSX.** Première version : `const phrase = libelleEcheance(
  information) ?? t(...)` puis `{phrase}`. Le gardien `sans-chaine-visible-en-
  dur` a rougi : sa résolution de constantes (`constantesLitterales`) ne
  reconnaît pas `t(...)` comme un accès au dictionnaire quand il est
  DANS une déclaration `const` hors JSX, et confond la CLÉ (
  `"machine.fiche.vgp_a_determiner"`) avec le texte visible. Corrigé en
  écrivant l'expression directement dans le JSX (comme le code d'avant ce
  ticket le faisait déjà, dans un `return`, jamais un `const`).
- **La requête e2e vers la machine dépassée utilise `.locator(…, {
  hasText })`, jamais `getByRole(…, { name: MACHINE_DEPASSEE })`.** Même
  gardien, seconde rougeur : `getByRole` avec une option `name` est une
  « requête d'écran » au sens du gardien, et `MACHINE_DEPASSEE` est une
  constante de test résolue littéralement. `hasText` sur `.locator()` n'est
  pas dans son périmètre (`REQUETES_ROLE`/`REQUETES_TEXTE`,
  `tests/unit/outils/rendu-visible.ts`) — le même choix que
  `vgp-retard-visible.spec.ts` fait déjà pour la même raison.
- **La capture est repliée DANS l'épreuve neuve** (`fiche-machine-vgp.spec.ts`)
  plutôt que dans un second fichier de captures dédié. Le territoire du
  ticket ne nommait qu'« l'épreuve neuve » (singulier) ; ajouter un second
  fichier e2e aurait débordé cette liste sans nécessité — la recette
  `CAPTURES_<NOM>` du dépôt marche aussi bien à l'intérieur d'un spec
  fonctionnel.

## Ce que je n'ai PAS fait

- Je n'ai pas donné 32 px au lien « Enregistrer la vérification » (mesuré à
  16 px) : le ticket ne demandait cette taille que pour le lien de retour, et
  l'étendre à un lien que je créais moi-même aurait été une décision
  d'ergonomie non demandée. Voir « pièges » ci-dessous.
- Je n'ai pas touché `/vgp` au-delà de l'import (aucune ligne de logique
  modifiée dans `app/(back-office)/vgp/page.tsx`, seulement le retrait des
  trois déclarations déplacées et l'ajustement des imports).
- Je n'ai forgé, modifié ni supprimé aucune ligne de semis : la machine
  dépassée éprouvée est lue telle que `prisma/seed-data.ts` la pose déjà.
- Je n'ai pas ajouté de test unitaire pour `tonEtat`/`libelleEtatCourt` dans
  leur nouvel emplacement : ils n'avaient pas de test unitaire dédié avant ce
  déplacement non plus (seulement les épreuves e2e de `/vgp`), et je n'ai pas
  changé leur comportement.

## Les pièges pour la session suivante

- **Le lien « Enregistrer la vérification » est à 16 px de haut**, sous le
  seuil de 32 px que ce même audit (constat 4, 98-TABLEAU-2 ; constat 31, ce
  ticket) a déjà posé ailleurs comme la norme des liens d'action de cette
  application. Si un futur ticket étend cette norme à TOUS les liens
  d'action (pas seulement ceux nommés par un constat précis), celui-ci en
  fait partie.
- **`lib/vgp/libelles.ts` importe maintenant `type TonBadge` depuis
  `components/ui/badge.tsx`** — le premier import de `lib/` vers
  `components/` que j'ai trouvé dans ce dépôt. Si un gardien de frontière
  `lib/` → `components/` est écrit un jour, ce fichier sera le premier à
  rougir ; c'est un import de TYPE, sans coût d'exécution, mais la session
  qui pose ce gardien devra en décider le sort (le déplacer, ou dupliquer
  l'union de tons).
- **Le gardien `sans-chaine-visible-en-dur` rougit sur toute variable locale
  qui enveloppe un appel `t(...)` avant d'entrer en JSX** — pas seulement sur
  un littéral direct. Une prochaine réécriture de `vgpAffichee` (ou de toute
  fonction similaire) qui réintroduirait un `const phrase = … ?? t(...)`
  suivi de `{phrase}` fera rougir ce même gardien, pour la même raison
  structurelle (sa résolution de constantes ne reconnaît `t` que dans un
  contexte qui porte les accesseurs du dictionnaire, absent de
  `constantesLitterales`).

## Ce qui reste à faire

- Rien de bloquant pour ce ticket : les cinq étapes demandées sont faites,
  `pnpm test` et `CI=1 pnpm verify:full` sont verts, la passation est à jour.
- Décision ouverte, non tranchée ici faute de mandat : uniformiser à 32 px
  TOUS les liens d'action de la fiche machine (« Enregistrer la
  vérification », « + Intervention », les liens client/site du `dl.kv`), au
  lieu de les corriger un audit à la fois.
