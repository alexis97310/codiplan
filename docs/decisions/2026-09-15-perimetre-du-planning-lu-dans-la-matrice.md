# Le périmètre du planning se lit dans la matrice, il ne se recopie pas dans la requête

*15/09/2026 — R5-01, première étape de l'application du technicien.*

## Contexte

R5-01 pose le choix en toutes lettres : *« ou bien le filtrage par capacité
arrive, ou bien la restriction est écrite dans la requête ; les deux se
défendent, et les mêler donnerait deux lectures d'un même critère. »*

La matrice de RG-DRO-03 (`lib/auth/habilitations.ts`) donne
`consulter_planning` en **restreint** au technicien depuis le lot 0. Mesuré le
15/09/2026 : elle n'a **qu'un seul appelant dans tout le dépôt**, son propre
scénario unitaire — `grep -rl consulter_planning` rend deux fichiers, le module
et son test. *Une matrice normative que personne ne lit est une règle écrite qui
ne garde rien.*

## Options écartées

**Écrire `role === technicien` dans la requête du dépôt.** C'est la recopie
d'une ligne de matrice à un endroit que rien ne confronte à elle : le jour où un
second rôle reçoit le `○` — un chef d'équipe, un intérimaire —, la requête
resterait juste sur sa propre lecture et fausse sur la règle, **sans rougir**.
C'est la divergence du §9 (01/09), et elle serait dans le sens permissif si la
recopie était oubliée, restrictif si elle vieillissait.

**Un filtrage par capacité générique** — une couche qui intercepterait toute
lecture et y appliquerait la matrice. Elle supposerait que chaque capacité se
traduise en un filtre, ce qui est faux de la plupart d'entre elles
(`valider_rapport` n'est pas un `where`). *Une abstraction bâtie sur un seul cas
est une abstraction qui décidera mal du second.*

**Porter la restriction en base.** Ce serait la garantie la plus forte, et c'est
un **arbitrage de cloisonnement** (§8) : une quatorzième forme de politique,
avec sa liste close, ses gardiens et son jumeau. R5-01 dit lui-même *« aucune
nouvelle donnée, aucune migration »*. La question est posée à Alexis plutôt que
tranchée en séance.

## Choix

**La matrice décide, le dépôt applique.** `lib/interventions/perimetre-technicien.ts`
lit `niveau(role, "consulter_planning")` et rend **trois verdicts** — complet,
restreint à sa propre identité, aucun. Le dépôt en tire un fragment de `where`,
écrit une seule fois pour ses trois lectures.

Trois conséquences, et la dernière est celle qu'on saute :

- **La personne restreinte est l'identité de la session**, jamais une valeur
  reçue d'un écran : *une désignation se dérive d'un contexte authentifié*
  (L1-02e). Un paramètre choisirait qui l'on regarde.
- **L'accès « aucun » LÈVE** au lieu de rendre une liste vide. Un planning vide
  et un planning interdit ne se corrigent pas au même endroit.
- **La garantie vit dans la couche applicative, et le dépôt l'écrit.**
  `tests/isolation/planning-du-technicien.test.ts` lit **deux** interventions
  sous le contexte cloisonné du technicien avant que le dépôt n'en retranche
  une : c'est le témoin qui empêche la mesure suivante d'être creuse, et c'est
  aussi l'aveu de ce que la base ne tient pas.

## Conséquences

Aucune migration, aucune colonne, aucun écran. Un rôle du portail qui
atteindrait `listerPlanning` reçoit désormais un refus — aucun chemin ne l'y
mène aujourd'hui, et c'en est la raison : *un trou qu'aucun appelant n'exerce se
ferme au moment où il coûte zéro.*

**Condition de réouverture, vérifiable :** le jour où un arbitrage décide que la
base doit porter la restriction par personne — c'est-à-dire le jour où une
quatorzième forme de politique est écrite —, ce module cesse d'être la garantie
et devient au plus une commodité d'affichage, et le filtre applicatif se retire
pour ne pas faire deux lectures d'un même critère.
