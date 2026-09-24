# 44-CONTRAT-SITE-1-REPRISE-3 — passation

## Ce que j'ai changé (et ce que ça change pour l'exploitation)

- **`components/ui/carte-entite.tsx`** : un champ `id` FACULTATIF sur chaque
  compteur de `CarteEntite`, rendu en `data-compteur` sur son conteneur.
  Aucun changement visuel, aucun changement de comportement pour
  l'exploitation — une prise stable pour un scénario de bout en bout, rien de
  plus.
- **`app/(back-office)/sites/page.tsx`** : les compteurs « équipements » et
  « trajet » de la carte `/sites` portent désormais `id: "equipements"` et
  `id: "trajet"`. Aucun effet visible.
- **`tests/e2e/listes-1.spec.ts`** : la première épreuve visait TOUS les `<b>`
  de la première carte de `/sites` (attendu 2). Depuis CONTRAT-SITE-1, cette
  carte peut porter une TROISIÈME pastille (« Contrat », facultative) — et la
  première carte de la démonstration la porte justement. L'épreuve vise
  maintenant les deux compteurs FIXES (équipements, trajet) par leur
  `data-compteur`, ce qui reste vrai que la pastille contrat s'affiche ou non.
- **`tests/e2e/parcours-creer-puis-planifier.spec.ts`** : l'épreuve
  « PLANIFIER refuse... » choisit maintenant le SECOND site Ducos
  (`siteDeDucos("desc")`, nouveau paramètre d'ordre sur la fonction
  existante) plutôt que le premier, et attend le formulaire « Affecter »
  avant d'affirmer la disparition du formulaire « Planifier ». Aucun des deux
  changements ne touche à un écran ni à une règle de gestion — uniquement la
  mise en scène de l'épreuve.
- **Rien d'autre** : aucune ligne ajoutée au semis, aucune migration
  nouvelle, aucun site réel coché — le territoire du ticket est respecté à la
  lettre.
- **`main` local porte maintenant tout CONTRAT-SITE-1** (fusion en avance
  rapide de cette branche) — la fonctionnalité sort enfin de la boucle
  41 → 42 → 43 → 44 où elle restait bloquée sur une branche `-garde`. Rien
  n'est poussé sur le dépôt distant.

## Ce que j'ai mesuré (comptes AVANT/APRÈS)

- **Mesure d'ouverture** : `git log --oneline
  42-CONTRAT-SITE-1-REPRISE-garde..43-CONTRAT-SITE-1-REPRISE-2-garde` ne rend
  qu'un commit de fusion, et `git diff` entre les deux branches est VIDE — 43
  n'a rien produit d'utilisable. Base reprise : `42-CONTRAT-SITE-1-REPRISE-garde`
  seule, fusionnée sans conflit dans cette branche.
- **AVANT (mesuré sur cette branche, avant toute correction)** —
  `listes-1.spec.ts:30` : attendu `2`, reçu `3` (le décompte total des `<b>`
  de la première carte, qui porte désormais la pastille contrat).
- **1er tour de `pnpm verify:full`** (après les deux corrections déposées
  d'un coup, y compris une première hypothèse fausse sur la date) :
  `format:check`/`typecheck`/`lint`/`test`/`test:isolation`/`build` verts,
  puis `test:e2e` — **2 rouges** :
  `parcours-creer-puis-planifier.spec.ts:118` (« Ce technicien ne détient pas
  les habilitations exigées ici » — refus RÉEL, pas un timeout) et
  `imports-historique.spec.ts:149` (rang 3 : attendu `2`, reçu `1`).
  `listes-1.spec.ts` était déjà VERT à ce tour.
- **Diagnostic du refus « habilitations »** : `error-context.md` du run
  montrait la fiche plantée sur le site « Atelier principal » — exactement le
  site que `premierLieu()` (`tests/e2e/habilitations.spec.ts`, fonction
  DÉJÀ existante) ouvre pour EXIGER puis RETIRER une habilitation, sous
  `fullyParallel`. Ma première hypothèse (collision d'horaire avec
  `affichage-materiel.spec.ts`) était FAUSSE — gardée en commentaire
  secondaire dans le code, corrigée dans un second commit avec la cause
  réelle.
- **2e tour** : `format:check` rouge (fichier non formaté par mon propre
  commit) — corrigé par `prettier --write`, recommité.
- **3e tour de `pnpm verify:full`, EN ENTIER** : tout vert JUSQU'À `test:e2e`
  — **1 seul rouge**, `imports-historique.spec.ts:149`
  (191 passés, 1 échoué, 3 sautés). `listes-1.spec.ts` (3/3) et
  `parcours-creer-puis-planifier.spec.ts` (3/3, y compris l'épreuve visée)
  sont VERTS.
- **`imports-historique.spec.ts:149` rejoué SEUL** (`--workers=1`, hors
  suite complète) sur CETTE branche : ROUGE, message IDENTIQUE au mot près
  (« Non rattachées1entrent sans machine, avec leur motif ci-dessous » au
  lieu de « 2 ») — donc PAS une collision de parallélisme.
- **Le même scénario, seul, rejoué sur `42-CONTRAT-SITE-1-REPRISE-garde`
  AVANT toute correction de cette session** : ROUGE, message IDENTIQUE au
  caractère près. **Mesure clé : ce rouge préexiste à cette REPRISE-3, il
  n'est pas causé par mon travail.** `docs/propositions/41-CONTRAT-SITE-1/passation.md`
  le savait déjà (« la cause n'est pas identifiée ») ; cette session
  identifie la cause (voir « ce qui reste à faire ») sans la corriger, hors
  territoire.
- **`pnpm test`** : 2694 passés (249 fichiers), **`pnpm test:isolation`** :
  1184 passés (115 fichiers) — inchangés depuis 41.

## Ce que j'ai tranché et pourquoi

1. **`listes-1.spec.ts` vise les compteurs par `data-compteur`, jamais un
   total.** Le ticket proposait deux options (viser par attribut, ou viser
   une carte qui n'est pas sous contrat). J'ai choisi l'attribut : une carte
   qui « n'est pas sous contrat » dépend de l'ordre alphabétique du jeu de
   démonstration — un choix qui casserait au prochain site ajouté, exactement
   le défaut qui a produit ce ticket. L'attribut ne dépend d'aucun ordre.
2. **La cause du « PLANIFIER refuse... » instable est le SITE PARTAGÉ, pas
   l'heure.** Ma première lecture (collision de créneau avec
   `affichage-materiel.spec.ts`) était plausible mais FAUSSE — le message
   d'erreur mesuré au premier tour de `verify:full` (un refus « habilitations
   exigées », pas un timeout de formulaire) l'a contredite directement.
   `siteDeDucos("desc")` retient la fonction existante plutôt que d'en créer
   une seconde : un seul paramètre d'ordre, pas de duplication.
3. **Le décalage de date (+49 jours) reste dans le code, en défense
   secondaire, même s'il n'est plus LA cause.** Un site isolé à une date qui
   ne l'est pas resterait fragile au premier fichier qui s'y ajouterait — la
   défense en profondeur coûte trois lignes.
4. **Je n'ai PAS touché à `imports-historique.spec.ts`, à
   `prisma/seed-data.ts` ni à `prisma/seed.ts`**, alors que j'ai identifié
   leur rôle dans le rouge restant (voir ci-dessous) — strictement hors du
   territoire que ce ticket délimite (seuls `listes-1.spec.ts`,
   `parcours-creer-puis-planifier.spec.ts` et l'attribut `data-` de
   `carte-entite.tsx` sont autorisés), et la règle « deux rouges et tu
   t'arrêtes » s'applique : ce rouge est identique sur deux mesures
   indépendantes (cette branche, et `42-CONTRAT-SITE-1-REPRISE-garde` avant
   elle), donc reproductible et déterministe plutôt qu'un flake méritant un
   troisième essai — mais un rouge hors territoire ne s'attaque pas en le
   forçant, il se documente.
5. **`main` local reçoit une fusion en avance rapide plutôt qu'une nouvelle
   branche `-garde`.** L'instruction finale du ticket est explicite
   (« tu commites sur main en local ») et rompt la boucle des quatre
   dernières reprises, chacune laissant le travail sur une branche que la
   suivante devait re-fusionner. Le rouge restant est HORS TERRITOIRE et
   documenté, pas caché — la fusion ne prétend pas qu'il n'existe pas.

## Ce que je n'ai PAS fait

- **Je n'ai pas corrigé `imports-historique.spec.ts`** ni sa cause
  (voir ci-dessous) — hors territoire de ce ticket.
- **Je n'ai pas touché `prisma/seed-data.ts` ni `prisma/seed.ts`** — la
  fragilité que j'y ai identifiée (voir « ce qui reste à faire ») n'a reçu
  aucune correction.
- **Je n'ai pas modifié la moindre assertion métier pour la faire passer**,
  ni désactivé, ni sauté, ni allongé un délai comme unique réponse à une
  instabilité — les deux corrections livrées changent la MISE EN SCÈNE des
  épreuves (quel site, quel signal d'attente), jamais ce qu'elles vérifient.
- **Je n'ai pas repris `docs/propositions/41-CONTRAT-SITE-1/passation.md`**
  au-delà de la relire : elle portait déjà l'en-tête des deux gestes
  d'Alexis (migration production, puis Redeploy) et signalait déjà
  `imports-historique.spec.ts` comme rouge pré-existant non résolu — rien à
  y ajouter que cette passation-ci ne dise mieux.
- **Je n'ai pas supprimé les branches `4x-CONTRAT-SITE-1-*`** — elles restent
  en local, inertes, au cas où.

## Les pièges pour la session suivante

- **`imports-historique.spec.ts:149` — cause identifiée, PAS corrigée.**
  `prisma/seed.ts` assigne chaque machine de démonstration à un site par
  `lieuxOuverts[machine.siteRang % lieuxOuverts.length]` — une position dans
  un tableau, jamais un identifiant stable. CONTRAT-SITE-1 (41) a inséré
  « Atelier sous contrat (démonstration) » comme TROISIÈME site du client
  « Atelier Ducos » dans `CLIENTS_NC` (`prisma/seed-data.ts`) : ce site est
  `ouvert` (`client.actif && site.actif`, tous deux vrais), donc il s'ajoute
  à `lieuxOuverts` et DÉCALE l'index de tout ce qui suit. La machine de rang 3
  (`NUS-SPL-2022-0007`, `siteRang: 2`) atterrissait AVANT ce lot sur
  `lieuxOuverts[2]` = « Garage de Koné » (client « Garage du Nord » —
  un AUTRE client que celui de la ligne d'import `F-EPR-0006`, ce que le
  scénario attend et nomme « rang 3 »). Depuis l'ajout du site, elle atterrit
  sur `lieuxOuverts[2]` = « Atelier sous contrat (démonstration) », qui
  appartient au MÊME client que la ligne d'import — l'import la RATTACHE
  donc correctement au lieu de la rejeter, et le compte de « non rattachées »
  tombe de 2 à 1. **Ce n'est pas une régression de CONTRAT-SITE-1 en soi**,
  c'est une fragilité PRÉEXISTANTE du générateur (déjà documentée dans son
  propre commentaire, `prisma/seed.ts`) que ce lot a simplement fini par
  déclencher pour de bon. Options pour la session qui corrige, à trancher
  explicitement plutôt qu'à deviner : (a) indexer `lieuxOuverts` par un
  identifiant stable (ex. le libellé du site) au lieu d'une position ; (b)
  ancrer `imports-historique.spec.ts`/`classeur-historique.ts` sur un site
  désigné par NOM plutôt que par le résultat d'un calcul modulo ; (c) documenter
  que tout ajout de site à `CLIENTS_NC`/`CLIENTS_EU` exige de rejouer
  `imports-historique.spec.ts` et d'ajuster `RATTACHEMENTS_ATTENDUS` si besoin.
  Je n'ai pas de préférence tranchée entre les trois — je ne les ai pas
  creusées au-delà de ce diagnostic.
- **`siteDeDucos()` porte maintenant un paramètre d'ordre.** Un futur ajout à
  `tests/e2e/parcours-creer-puis-planifier.spec.ts` qui rappelle
  `siteDeDucos()` sans argument retombe sur le PREMIER site Ducos — le même
  que `habilitations.spec.ts` mute. Vérifier qu'aucune future épreuve de ce
  fichier ne complète un cycle PLANIFIER sur ce site par défaut sans y
  penser.
- **`CLAUDE_CODE_DISABLE_BACKGROUND_TASKS=1` tient** dans cette session : un
  seul appel `pnpm verify:full` au premier plan par tour, jusqu'à 3-4
  minutes chacun sur `test:e2e` — aucun besoin d'attendre une notification.
- **Cette session a fusionné DIRECTEMENT sur `main` local**, rompant le
  schéma `4x-...-garde` des trois reprises précédentes. Si une session
  future doit encore livrer une correction pour `imports-historique`, elle
  partira de `main` (qui porte déjà tout CONTRAT-SITE-1), pas d'une branche
  `44-...-garde`.

## Ce qui reste à faire

- **Corriger `imports-historique.spec.ts` / la fragilité du générateur de
  seed** — cause identifiée ci-dessus, aucune option tranchée. C'est le seul
  rouge qui reste sur `pnpm verify:full`.
- **Les DEUX gestes d'Alexis avant publication** (déjà notés en tête de
  `docs/propositions/41-CONTRAT-SITE-1/passation.md`, toujours valables,
  rien de nouveau ne les change) : lancer le workflow de migration de
  production (`20260923140000_contrat_site_1`, colonne seule, aucune donnée
  touchée), puis relancer « Redeploy » sur Vercel.
- **Le vrai module Contrats** (dates, références, montants) reste reporté —
  décision 9, aucune part ouverte par cette session.
