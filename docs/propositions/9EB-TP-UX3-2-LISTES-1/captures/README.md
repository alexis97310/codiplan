# Captures — 9EB-TP-UX3-2-LISTES-1

AVANT/APRÈS des listes `/clients` et `/sites` au gabarit de la maquette du 28/09 (QE-10 (a), QE-13c) : puces de vue à compteur, tri, résumé au-dessus de la grille, cartes au gabarit `.ent` (titre cliquable sur toute la carte, bande de chiffres alignée à gauche, donneur d'ordre).

- **AVANT** — commit `96046111` (`9EA-TP-UX3-1-REGISTRE-2 — passation`), le dernier commit de `main` avant ce ticket. Pris dans un worktree temporaire dédié (`git worktree add --detach 96046111`), avec le même `node_modules` (lien symbolique, aucune dépendance n'a changé) et le même semis de démonstration (`pnpm db:seed`, déjà présent sur la base de test).
- **APRÈS** — commit livré par ce ticket (voir `git log` sur `main` pour le dernier commit de la série `9EB-TP-UX3-2-LISTES-1`), sur le même semis.
- Date des captures : 07/10/2026.

Les deux séries rejouent le **même fichier**, `tests/e2e/zz-captures-9eb1.spec.ts` (contrôlé par la variable d'environnement `CAPTURES_9EB1`, muette tant qu'elle n'est pas posée — `pnpm test:e2e` ordinaire n'écrit donc jamais ces fichiers), sur **sa propre scène** (préfixée `9EB1-CAPT-`, créée en `beforeAll` et supprimée en `afterAll` par le fichier lui-même) : trois clients (un actif avec un code et un donneur d'ordre, un actif sans code, un inactif sous contrat) et leurs trois sites (un à zone connue, un à trajet inconnu — zone « Îles », sans estimation —, un sous contrat sur le client inactif). Les assertions du fichier restent minimales (`page.locator("main")` visible) pour qu'il passe sans modification sur le code d'AVANT, qui ne connaît ni les puces de vue, ni la bande de chiffres, ni la carte entière cliquable.

## Écrans capturés, à 1280 px puis 375 px

- `clients-defaut` — `/clients`, vue par défaut (« Actifs »)
- `clients-sans-code` — `/clients`, puce « Sans Code Winpro »
- `clients-tri-derniere-intervention` — `/clients`, vue « Tous », triée par « Dernière intervention »
- `sites-defaut` — `/sites`, vue par défaut (« Sites des clients actifs »)
- `sites-trajet-inconnu` — `/sites`, puce « Trajet inconnu »
- `sites-client` — `/sites?client=…`, filtré depuis un lien de fiche (le client inactif de la scène)

## Ce que les captures montrent

**AVANT** : `/clients` montre un `<select>` d'état (« Tous les clients »/Actifs/Inactifs), un grand bandeau « N Sans Code Winpro » au-dessus de la recherche, des cartes aux pastilles centrées (site, machines), un total en bas de liste, un titre souligné pour seul lien. `/sites` montre un bloc de filtres sans puce, des cartes à deux liens (client, puis site), des pastilles centrées (équipements, habilitations le cas échéant, contrat, trajet), aucun chiffre VGP.

**APRÈS** : quatre puces à compteur par liste (Actifs/Inactifs/Sans code/Tous pour les clients ; Sites des clients actifs/Trajet inconnu/Sans zone/Clients inactifs, plus « Sous contrat » à bascule, pour les sites), un résumé (« N clients »/« N sites · par client, puis par site ») au-dessus de la grille, un tri choisi pour les clients (Raison sociale/Nombre de machines/Dernière intervention), des cartes dont le titre ouvre toute la carte (un seul lien, étendu), une bande de chiffres alignée à gauche (sites, machines, à planifier, dernière intervention pour les clients ; machines, ouvertes, trajet, VGP dépassée pour les sites), le donneur d'ordre sur la carte client, et une pastille bleue « Sous contrat » sur la carte site (qui remplace la pastille jaune « Contrat »).
