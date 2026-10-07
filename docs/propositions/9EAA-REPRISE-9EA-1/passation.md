# Passation — 9EAA-REPRISE-9EA-1

Reprise de 9EA-TP-UX3-1-REGISTRE-1 — rejouer la garde `9EA-TP-UX3-1-REGISTRE-1-garde`
sur `main` à jour, puis `CI=1 pnpm verify:full` en entier (la session 9EA-1 ne l'avait
lancé qu'en partie).

## Ce que j'ai changé, et ce que ça change pour l'exploitation

- **Les 4 commits de la garde ont été rejoués tels quels** (`git cherry-pick`) sur une
  branche partant d'`origin/main` à jour (`c59ab0b1`) : les composants de base (A), les
  onglets à compteur et les filtres compacts (B, C), et la décision D174 (D). Un seul
  conflit, additif et sans enjeu de sens : D174 (ce lot) et D175 (posée entre-temps par
  9EC-TP-UX3-E-ABSENCES, déjà sur `main`) cohabitent dans `docs/arbitrages.md`, chacune
  gardant son numéro. Pour l'exploitation, rien de nouveau par rapport à ce que 9EA-1
  avait déjà livré — cette reprise n'ajoute aucune fonctionnalité.
- **Trois épreuves bout en bout, que le nouveau registre à 8 onglets rendait fausses,
  ont été corrigées** (détail dans « ce que j'ai tranché »). Aucune des trois ne
  révélait un défaut du code livré par 9EA-1 : toutes les trois vérifiaient une
  prémisse que D174 a délibérément changée (tuiles KPI retirées, un second lien
  « Tout effacer » posé par `LigneResume`, la route `/interventions/a-facturer` qui
  existe désormais pour de vrai). Pour l'exploitation : rien ne change à l'écran: ce
  sont les épreuves qui rattrapent l'écran, pas l'inverse.

## Ce que j'ai mesuré (comptes AVANT/APRÈS)

- **`pnpm test`** (unitaires) : 398 fichiers, 4217 tests, tous verts — après les
  corrections des trois spécimens e2e (le gardien `sans-chaine-visible-en-dur` n'était
  pas en cause ici, aucune chaîne littérale introduite).
- **Les trois spécimens corrigés, rejoués seuls** (`captures-9cm-etats.spec.ts`,
  `messages-tpa4a.spec.ts`, `tous-les-ecrans-rendent.spec.ts`) : 64 passed, 3 skipped
  (scène partagée, non liés à cette reprise), 0 failed.
- **`CI=1 pnpm verify:full`, deux passages complets** :
  - 1er passage (avant correction) : format/typecheck/lint/test/isolation/build +
    `feries:horizon` + `audit:partitions` tous verts ; l'outil a coupé à 30 minutes en
    plein `test:e2e` (limite de l'outil, pas un défaut du code) — mais pas avant d'avoir
    déjà montré 3 échecs dans la sortie partielle.
  - Rejeu isolé de `pnpm test:e2e` seul (60 minutes) sur le 1er passage : confirmé
    **3 failed, 36 skipped, 2 did not run, 986 passed (42.7 min)** — les 3 échecs
    exactement ceux pressentis par la reprise (tuiles KPI, lien doublon, route
    `/interventions/a-facturer`).
  - 2e passage, après les trois corrections, **intégral en un seul appel** :
    **990 passed, 36 skipped, 0 failed**, terminé à 14h05 (Nouméa) / 03h05 UTC le
    07/10/2026.
- **Fichiers du ticket 9EA-1** (ceux que sa passation dit avoir créés) : les 11 fichiers
  nommés sont tous `git ls-files`-trouvés après le rejeu — aucun fichier créé mais non
  commité par la session 9EA-1.

## Ce que j'ai tranché, et pourquoi

- **Le conflit D174/D175 dans `docs/arbitrages.md`** : additif, aucune phrase des deux
  décisions n'entrait en contradiction avec l'autre — fusionné en gardant les deux
  blocs, D175 avant D174 dans le fichier (parce que D175 était déjà sur `main`), chaque
  décision gardant son numéro d'origine. Pas de réouverture de ticket : le texte de
  chacune des deux décisions reste mot pour mot celui écrit par sa propre session.
- **`captures-9cm-etats.spec.ts`** — le test capturait `[data-bloc="kpi-en-cours"]` sur
  `/interventions`, une tuile que D174 retire explicitement (« les onglets portent
  désormais le même renseignement par leur compteur »). Il n'y a plus rien d'équivalent
  à capturer sur cet écran : l'onglet qui remplace la tuile (`OngletsRegistre`) partage
  déjà le composant `Onglets` d'autres écrans (`/demandes`, `/vgp`) et ne porte pas le
  risque de lien imbriqué que la capture visait à prouver absent. Le test a été
  **retiré** (pas élargi) — même geste que `tuiles-sans-doublon.test.ts`, déjà corrigé
  par 9EA-1 au niveau unitaire (4 → 2 tuiles). La capture PNG archivée
  (`docs/propositions/9CM-RETOUCHES-2B-REPRISE/captures/interventions-tuiles-1280.png`)
  reste en place, non régénérée : elle documente un état d'avant ce ticket.
- **`messages-tpa4a.spec.ts` (IN-07)** — `getByRole("link", {name: "Tout effacer"})`
  résout désormais à DEUX éléments : celui du bandeau d'erreur IN-07 (dans
  `role="status"`, ce que le test éprouve) et celui que `LigneResume` pose en plus,
  assumé par la passation de 9EA-1 elle-même (« Elle double désormais le compte... »).
  `.first()` cible le premier dans l'ordre du DOM — qui est précisément le lien du
  bandeau IN-07, puisqu'il est rendu plus haut dans `page.tsx` que `LigneResume`. Même
  recette que le piège #50 déjà noté par 9EA-1 pour `registre-2.spec.ts`/
  `registre-3.spec.ts` : ni une assertion affaiblie, ni un périmètre élargi, le bon
  élément reste celui ciblé.
- **`tous-les-ecrans-rendent.spec.ts`** — le test datait d'avant la route dédiée
  (9EJ-CORRECTIFS-AUDIT-TUILES-ID, quand `/interventions/a-facturer` tombait dans
  `[id]`) et attendait un 404. La route existe désormais
  (`app/(back-office)/interventions/a-facturer/page.tsx`) : elle répond 200, avec un
  refus nommé (`RefusAcces`, QT-2/D152) pour le compte d'épreuve
  (`COMPTE_ADMIN_SOCIETE_EPREUVE`, qui ne porte pas `preparer_facturation`). L'assertion
  a été **remplacée** pour prouver ce nouveau contrat réel (200, refus nommé, jamais 404
  ni 500) — le rendu pour un rôle autorisé est déjà éprouvé par
  `tests/e2e/registre-ux3-1.spec.ts`, pas dupliqué ici.
- **Les captures PNG régénérées par le rejeu complet de la suite e2e** (une quinzaine de
  tickets antérieurs, plus quelques fichiers jamais commités) ont été restaurées
  (`git checkout --`) ou supprimées (`git clean -f`) avant chaque commit — aucun écran
  n'a changé visuellement dans ce lot, donc aucune capture ne devait changer.

## Ce que je n'ai PAS fait

- **Je n'ai pas pu relire le ticket original** `tickets/recales/9EA-TP-UX3-1-REGISTRE-1.md`
  ni ses ADDENDA RECALAGE 1 et 2 : ce fichier n'existe nulle part sur le poste (aucune
  trace dans l'historique git de ce dépôt, aucun répertoire `tickets/` dans les trois
  copies de travail connues — `/home/aplou/codiplan`, `/home/aplou/codiplan-voie1`,
  `/home/aplou/codiplan-voie2`). Le tableau du point 3 de la reprise s'appuie à la place
  sur `docs/arbitrages.md` (D174, rang 1) et sur la passation de 9EA-1 elle-même — les
  deux seules sources disponibles. Si un addendum contenait une précision que ni l'un ni
  l'autre ne porte, elle n'a pas pu être vérifiée ici.
- **Aucune fonctionnalité nouvelle** : rien de 9EA-TP-UX3-1-REGISTRE-2, rien de
  FACTURE-1, aucune migration, aucune ligne de semis, aucun prix — conforme aux
  interdits du lot. Les 4 parties du ticket 9EA-1 étaient déjà toutes livrées par la
  garde ; cette reprise n'a eu à en refaire aucune.
- **Pas de rebase final sur `origin/main`** au sens d'un nouveau commit de fusion :
  `origin/main` n'avait pas avancé entre le début et la fin de cette session (vérifié au
  moment de rendre la main), donc rien à rejouer.

## Les pièges pour la session suivante

- **`tickets/recales/` n'existe pas dans ce dépôt.** Si une future reprise cite un
  chemin sous ce répertoire, vérifier d'abord son existence avant de s'appuyer sur son
  contenu supposé — ici, il a fallu substituer la décision d'arbitrage et la passation
  du lot d'origine, qui ne portent pas forcément tout ce qu'un addendum de recalage
  aurait précisé.
- **Rejouer la suite e2e complète régénère les PNG de toute capture non gardée par une
  variable d'environnement** (`CAPTURES_*` absente ⇒ écriture directe dans
  `docs/propositions/*/captures/`) : `git status --porcelain` après tout
  `pnpm exec playwright test`/`test:e2e` montrera une quinzaine de tickets étrangers
  modifiés, plus quelques fichiers jamais commités avant. Toujours `git checkout --`
  puis `git clean -f` sur `docs/propositions/` avant de composer un commit, comme la
  passation de 9EA-1 l'avait déjà noté pour ses propres relectures.
- **`CI=1 pnpm test:e2e` seul prend ~40-43 minutes** sur ce poste : un appel à
  `verify:full` complet dépasse la limite de 30 minutes de l'outil au premier passage ;
  prévoir un second appel borné à 60 minutes pour `test:e2e` seul si le premier coupe,
  plutôt que de relancer `verify:full` en entier une deuxième fois juste pour ça.

## Ce qui reste à faire

- **9EA-TP-UX3-1-REGISTRE-2** : colonnes par onglet, cellules composées, actions de
  ligne, sélection multiple, les deux derniers choix de Suivi, cartes au téléphone — rien
  de nouveau depuis la passation de 9EA-1, inchangé par cette reprise.
- **FACTURE-1** : la liste « à facturer », ses décomptes et son export sur
  `/interventions/a-facturer` — l'emplacement et la garde d'accès restent prêts, inchangés.
- **Si le fichier `tickets/recales/9EA-TP-UX3-1-REGISTRE-1.md` est retrouvé** (restauré
  ailleurs, ou le chemin était simplement erroné dans cette reprise), relire ses ADDENDA
  RECALAGE 1 et 2 en premier : ils n'ont jamais été consultés ici, faute de fichier.
