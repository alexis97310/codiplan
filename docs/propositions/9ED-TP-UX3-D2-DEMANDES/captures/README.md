# Captures — 9ED-TP-UX3-D2-DEMANDES

Commit photographié (APRÈS) : `05d50434d06f108e13a417c74ff5df15dadb0c5c`
Date : 2026-10-07

AVANT = commit `40c469f6` (main au départ du ticket), APRÈS = ce commit.
Scène jetable, préfixée « captures 9ED », créée et supprimée par le script de
capture (jamais une donnée de production, jamais le semis partagé) : un
client, un site avec commune, une machine, un contact donneur d'ordre avec
courriel, une demande `nouvelle`, une `qualifiee` (avec machine), une
`close_sans_suite`.

Deux largeurs (1280 et 375 px) pour chaque écran :

- `liste-a-traiter` — `/demandes` — colonnes Reçue / Client·site / Demande /
  Source, cellule de droite (urgence, état, « Qualifier »).
- `liste-traitees` — `/demandes?onglet=traitees` — colonne Suite.
- `fiche-nouvelle` — `/demandes/<id nouvelle>` — surtitre, titre
  « <client> · <site> », bloc « Transformer en intervention » en refus +
  Qualifier + Clore.
- `fiche-qualifiee` — `/demandes/<id qualifiee>` — le formulaire de création
  en ligne, préremplie (nature vide, priorité, machine, description).
- `fiche-close` — `/demandes/<id close_sans_suite>` — « Close sans suite » +
  motif, aucun formulaire.
