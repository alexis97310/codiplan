# Captures — 9EA-TP-UX3-1-REGISTRE-2

AVANT/APRÈS du registre des interventions (`/interventions`), QE-8 (a) : colonnes par onglet, actions de ligne, sélection, Suivi « Sous garantie, ouvertes », cartes sous 900 px.

- **AVANT** — commit `616b4bdc` (`9ED-TP-UX3-D2-DEMANDES — passation`), le dernier commit de `main` avant ce ticket. Pris dans un worktree temporaire dédié (`git worktree add --detach 616b4bdc`), avec le même semis de démonstration (`pnpm db:seed`).
- **APRÈS** — commit livré par ce ticket (voir `git log` sur `main` pour le dernier commit de la série `9EA-TP-UX3-1-REGISTRE-2`), sur le même semis.
- Date des captures : 07/10/2026.

Les deux séries rejouent le **même fichier**, `tests/e2e/captures-9ea2-registre-2.spec.ts` (contrôlé par la variable d'environnement `CAPTURES_9EA2`, muette tant qu'elle n'est pas posée — `pnpm test:e2e` ordinaire n'écrit donc jamais ces fichiers), sur les **données de démonstration du semis**, jamais une scène à part : ce ticket ne change aucune règle de gestion ni aucune donnée, et le même semis vaut des deux côtés de la comparaison.

## Écrans capturés, à 1280 px puis 375 px

- `a-planifier` — onglet « À planifier »
- `aujourdhui` — onglet « Aujourd'hui »
- `en-retard` — onglet « En retard »
- `en-cours` — onglet « En cours »
- `bloquees` — onglet « Suspendues »
- `a-controler` — onglet « À contrôler »
- `toutes` — onglet « Toutes »
- `compact` — densité « Compact »

Et, au bureau seulement (≥ 901 px, choix du pilote C5 : la sélection et les actions de ligne n'existent pas sur les cartes du téléphone) :

- `selection-aujourdhui-1280` — une sélection active sur l'onglet « Aujourd'hui » (la barre de sélection, « Transmettre… », « Exporter », « Vider la sélection »)
- `fenetre-poser-1280` — la fenêtre ouverte par le bouton « Poser » (onglet « À planifier »)

## Ce que les captures montrent

**AVANT** : un tableau à huit colonnes identiques sur tous les onglets (Référence, Client, Machine, Site, Technicien, Date planifiée, Priorité — avec son tiret cadratin, « P1 — critique » —, Statut), aucune case de sélection, aucun bouton d'action de ligne, aucune carte sous 900 px (le tableau défile horizontalement).

**APRÈS** : un jeu de colonnes propre à chaque onglet (« Intervention » qui porte la référence, la nature et les machines ; « Client · Site » ; « Ancienneté »/« Durée » sur « À planifier » ; « Depuis »/« Motif »/« Pièce attendue » sur « Suspendues » ; « Compteur » sur « En cours » ; « Rapport » sur « À contrôler »), la priorité en sigle coloré (`<Priorite court/>`), les actions « Poser »/« Déplacer… »/« Transmettre… »/« Contrôler », une case de sélection sur « À planifier »/« Aujourd'hui »/« Toutes » avec sa barre collée en haut, et des cartes (jamais le tableau) sous 900 px.
