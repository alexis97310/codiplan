# 65-ABSENCES-3 — passation

## Ce que j'ai changé (et ce que ça change pour l'exploitation)

Sur `/absences`, chaque référence d'intervention affichée dans le bandeau
« Interventions rendues à la file à planifier » (après une pose) et dans le
panneau d'aperçu SAV-12 (« Voir l'impact », avant la pose) est désormais un
**lien** vers `/interventions/{id}` — la fiche où « Affecter » existe déjà —
au lieu d'un texte inerte. Le bandeau « rendues à la file » porte en plus,
en tête, un lien « Voir dans le registre » vers `/interventions?vue=a_planifier`
(la vue livrée par 52-REGISTRE-1).

**Pour le bureau** : après avoir bloqué un agenda, le planificateur clique
directement une référence rendue à la file pour ouvrir sa fiche et la
réaffecter, au lieu de recopier « INT-00312 » ou « Local-6E8098 » à la main
dans la recherche du registre.

Le texte visible n'a pas changé — même titre, même préfixe/suffixe
d'aperçu, mêmes références (`referenceAffichee`, I10) — seule leur nature
JSX a changé (texte → `Link`).

## Ce que j'ai mesuré (comptes AVANT/APRÈS)

- **AVANT** (lecture du code, 25/09 03h35) : `listeDesInterventions` composait
  une chaîne jointe par `", "` en dehors du JSX, rendue dans un `<p>` — aucun
  `<a>`/`<Link>` dans le bandeau ni dans l'aperçu.
- **APRÈS**, mesuré par `tests/e2e/absences-3.spec.ts` contre la vraie base :
  scène `ABS3-` (un technicien forgé, deux interventions planifiées les
  11 et 13/02/2030), absence posée sur la même période → le bandeau
  `role="status"` filtré sur `absences.rendues_titre` porte **exactement
  trois liens** : `Voir dans le registre` (`href="/interventions?vue=a_planifier"`),
  et une référence par intervention rendue, chacune vers
  `/interventions/{id}`. Cliquer la première ouvre bien
  `/interventions/{interventionA}`, dont le `<h1>` contient la référence ET
  `statut.a_planifier`.
- `pnpm typecheck`, `pnpm lint`, `pnpm format:check` : verts.
- `pnpm test` : 257 fichiers, 2771 tests, verts (inchangé hors le dictionnaire).
- `pnpm test:isolation` : 122 fichiers, 1226 tests, verts.
- `pnpm build` : compilation de production réussie.
- `pnpm feries:horizon`, `pnpm audit:partitions` : verts.
- `pnpm test:e2e` : 237 tests passés (236 avant ce lot + les deux épreuves de
  `absences-3.spec.ts`, l'une des deux servant aussi de capture), 3 ignorés —
  inchangé.

## Ce que j'ai tranché et pourquoi

- **Une seule épreuve e2e, pas deux.** Une première version séparait la
  preuve (clic + fiche) de la capture (screenshot). La seconde posait sa
  PROPRE absence sur la même période pour la même personne, mais les deux
  interventions étaient déjà reparties en file par la première pose (statut
  `a_planifier`, `date_planifiee = null`) : la seconde déclaration ne
  rendait plus rien, et la page retombait sur `/absences` sans le paramètre
  `?rendues=`. Fusionné en une seule épreuve : la capture se prend juste
  avant le clic qui quitte `/absences`.
- **Le séparateur entre les liens passe par le dictionnaire**
  (`absences.reference_separateur`, `", "`), composé DANS le JSX
  (`Link` par `Link`) plutôt que par une chaîne assemblée à l'avance : une
  chaîne littérale directement dans le JSX (même un simple `", "`) est prise
  par le gardien L0-11, et aucune composition hors JSX ne peut porter un
  `Link`. Vérifié : `tests/unit/i18n/sans-chaine-visible-en-dur.test.ts`
  reste vert.
- **`libelleApercu` scindée en deux** : `libelleApercuAnnonce(compte)` ne
  rend plus que le préfixe/suffixe textuel (« Cette absence rendra N
  intervention(s) à la file : »), la liste des références est rendue à part
  par le même composant `ListeLiensInterventions` que le bandeau « rendues »
  — une seule fabrique de liens, jamais deux qui pourraient diverger.
- **`listeDesInterventions` (la version texte) est supprimée**, n'ayant plus
  d'appelant après ce lot ; `listeDesAgences` et la constante `SEPARATEUR`
  restent, toujours utilisées pour le bandeau « Rupture de service » que ce
  ticket n'a pas touché.
- **Le lien « Voir dans le registre » est placé après le titre et avant la
  liste des références**, à l'intérieur du même bandeau « rendues à la
  file » — c'est la lecture retenue d'« en tête du bandeau » : la carte KPI
  « Demandes à valider : Sans objet » et le bandeau « Rupture de service »
  ne portent aucun lien de plus, hors territoire du ticket.

## Ce que je n'ai PAS fait

- Aucune migration, aucune ligne de semis, aucun prix — interdits du ticket.
- La carte KPI « Demandes à valider » n'a pas été touchée.
- `lib/absences/` n'a pas été modifié (lecture seule, comme prescrit).
- Le bandeau « Rupture de service » (agences) n'affiche aucun lien : le
  ticket ne porte que sur les *interventions* rendues à la file, jamais sur
  les agences en rupture.
- Aucun style visuel nouveau (couleur, badge) au-delà de la classe
  `underline` déjà en usage ailleurs dans le dépôt pour un lien inline
  (`app/(back-office)/planning/statistiques.tsx`).

## Les pièges pour la session suivante

- **Une seconde pose sur la même période, pour la même personne, ne rend
  plus rien** une fois que les interventions visées sont déjà reparties en
  file (`date_planifiee = null`, `statut = a_planifier`) : toute épreuve qui
  rejouerait `poserLAbsence` deux fois sur la scène `ABS3-` échouerait sur
  l'assertion `toHaveURL(/\/absences\?rendues=/)`. Poser une seconde fois
  exigerait soit une seconde scène, soit de replanifier les interventions
  entre les deux poses.
- Le composant `ListeLiensInterventions` résout `referenceAffichee` sur
  `{ id, numero }` — si un jour l'écran affiche le numéro réel (I10, première
  synchronisation), le texte du lien changera de lui-même, sans rien à
  toucher ici.

## Ce qui reste à faire

- Rien d'identifié dans le périmètre de ce ticket. Le bandeau « Rupture de
  service » (agences) reste sans lien — hors territoire, à trancher dans un
  ticket séparé si le bureau le demande.
