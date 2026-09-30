# La trace de déplanification — pourquoi cinq colonnes, et pas une clé

_Ticket 9CC-DEPLANIFIEE-1, 30 septembre 2026. Constat 38 de l'audit
d'ergonomie du 25/09/2026, décision d'Alexis du 26/09/2026 (série 1, point 3,
`claude/decisions-alexis-26-09.md`)._

## 1. Contexte

Depuis R3-14, poser un blocage d'agenda (`declarerAbsence`,
`lib/absences/depot.ts`) rend à la file « À planifier » toute intervention
posée sur la période, en effaçant `date_planifiee`, `creneau_debut` et
`creneau_fin` (le technicien, lui, reste — voir l'en-tête de ce fichier).
L'audit du 25/09 a constaté qu'une fois reposée dans la file, une carte ne dit
plus rien de la raison ni de l'ancien créneau : le planificateur qui l'ouvre
ne sait pas si elle a toujours été « à planifier », ou si elle vient d'être
délogée par une absence — ni depuis quand, ni pour quel jour elle était
prévue.

## 2. Options écartées

| Option | Pourquoi elle est écartée |
|---|---|
| **Clé étrangère vers `absence.id`** | La levée d'un blocage (`leverLeBlocage`) **supprime** la ligne `absence` — c'est la règle depuis R3-14, écrite en toutes lettres dans son en-tête (« il se supprime, il ne se "refuse" pas »). Une clé `Restrict` interdirait la levée tant qu'une intervention déplanifiée existe ; une clé `SetNull` effacerait la trace au moment précis où le constat 38 la réclame — après la levée, l'absence n'a plus de nom. |
| **Relire le journal d'audit (`journal_audit`)** | Le déclencheur `journal_audit` conserve déjà `valeurs_avant`, qui porte l'ancienne date. Mais aucun écran ne le lit aujourd'hui, et le lire depuis un écran de planning en ferait un INDEX plutôt qu'une trace — exactement la réserve que `leverLeBlocage` écrit déjà dans son en-tête (« ressusciter un créneau depuis le journal d'audit serait une seconde source d'un fait que la table ne porte plus »). Une requête sur `journal_audit` filtrée par table et par colonne, pour chaque carte de la file, serait en outre un aller-retour par carte sous une latence dont ce dépôt se méfie déjà (§9, 23/08). |
| **Table à part (`intervention_deplanification`)** | Une ligne par déplanification, jointe à l'intervention. Écartée pour la même raison que `vue_technicien_le` (AVERTISSEMENTS-1) n'a pas ouvert de table : il n'y a qu'UNE trace active par intervention à la fois — une repose l'efface entièrement — et une table à part porterait une historisation qu'aucun écran ne demande. Le jour où l'historique des déplanifications devient un besoin, il vit dans le journal d'audit, qui le porte déjà. |
| **Cinq colonnes NULLABLES sur `intervention`, sans clé** (retenu) | Reprend la forme de `vue_technicien_le` : nullable, sans contrainte, effacée à la prochaine écriture qui la rend caduque. |

## 3. Choix retenu

Cinq colonnes sur `intervention` (voir `prisma/schema.prisma` et la migration
`20260930120000_deplanifiee_1`) :

- `deplanifiee_date` (`DATE`) — l'ancienne `date_planifiee` ;
- `deplanifiee_creneau_debut`, `deplanifiee_creneau_fin` (`TIMESTAMP(3)`) —
  `NULL` si la ligne n'avait pas d'heure (file d'attente datée sans heure,
  PARCOURS-1) ;
- `deplanifiee_absent_id` (`UUID`) — une IDENTITÉ, désignée comme
  `technicien_id` l'est déjà (aucune table `technicien` du chapitre 11
  n'existe encore, CLAUDE.md §6), jamais `absence.id` ;
- `deplanifiee_le` (`TIMESTAMPTZ(3)`) — l'instant de la pose, dans le fuseau
  de l'agence (`instantDeLAgence`), la même source que `vue_technicien_le`.

Écrites par `declarerAbsence` dans la MÊME transaction que la déplanification
elle-même (`traceDeDeplanification`, `lib/absences/periode.ts`, fonction
pure) — jamais une seconde écriture qui pourrait diverger. Effacées (remises à
`NULL`) par `deplacerIntervention` dès qu'une nouvelle date est posée : la
trace ne survit pas à ce qu'elle annonçait.

## 4. Conséquences

**La levée d'un blocage ne restaure toujours rien.** La trace survit à la
levée — c'est même tout son objet, puisque l'absence elle-même disparaît à ce
moment-là — mais `leverLeBlocage` ne touche aucune des cinq colonnes :
`date_planifiee` reste `NULL`, et c'est la levée qui l'a toujours dit.

**Aucune règle de gestion n'est modifiée.** Le critère de déplanification
(`interventionsADeplanifier`), le verdict de pose (`jugerPose`) et la levée
sont inchangés ; seul un fait déjà présent dans la transaction est recopié
avant d'être effacé.

**Le portail.** Les cinq colonnes suivent la RLS de ligne de `intervention`
(forme « parc », inchangée par cette migration — voir le fichier de
migration). Aucun écran de portail ne lit `intervention` aujourd'hui
(`app/(portail)/portail/page.tsx`, « le portail ne lit que le parc ») ; le
jour où il le ferait, ces colonnes resteraient hors de sa sélection tant que
personne ne les y ajoute explicitement (D94) — ce document ne tranche pas ce
jour-là, il note seulement qu'il n'est pas atteint par cette migration.

**Une intervention déplanifiée AVANT ce ticket n'a aucune trace.** Le journal
d'audit porte l'ancienne date (`valeurs_avant`), mais rien ne le relit : ces
lignes redeviennent des cartes « à planifier » ordinaires, sans mention.

**Point ouvert, à confirmer par Alexis (voir la passation du ticket) :**
l'affichage retenu lit `deplanifiee_date` — le jour de l'absence — pour le
« JJ/MM » de la mention, jamais `deplanifiee_le` (l'instant où le blocage a
été posé), qui est écrit mais pas montré à ce jour.
