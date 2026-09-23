# 41-CONTRAT-SITE-1 — passation

## Avant de publier, Alexis fait DEUX gestes

1. Lancer le workflow de migration de la base de production (`db:deploy`
   déploie `20260923140000_contrat_site_1` — une seule colonne, `NOT NULL
   DEFAULT false`, aucune donnée touchée).
2. Relancer la publication (« Redeploy ») sur Vercel.

## Ce que j'ai changé (et ce que ça change pour l'exploitation)

- **Une colonne** : `site.sous_contrat` (booléenne, défaut `false`), posée par
  la migration `20260923140000_contrat_site_1`. Rien d'autre — ni date, ni
  référence, ni montant, ni table de contrat : le vrai module Contrats
  (chapitre 7/M3, aperçu `contrats()` de la maquette) reste reporté (décision
  9). Tous les sites démarrent décochés, y compris ceux déjà en production —
  c'est Alexis qui coche.
- **Fiche site** (`/sites/[id]`) : une case « Sous contrat de maintenance »
  dans le formulaire de modification, gardée par la MÊME capacité
  (`gerer_client_site`) que le reste de la fiche — un rôle qui ne l'a pas
  (le technicien, notamment) ne voit pas la case, alors que la fiche reste
  lisible. L'état est aussi affiché en lecture, indépendamment du rôle : une
  pastille orange « Sous contrat de maintenance » quand c'est vrai, RIEN
  quand ce ne l'est pas.
- **Carte site** (`/sites`) : une pastille supplémentaire, libellée
  « Contrat », affichée seulement si `sous_contrat` est vrai. Ordre des
  pastilles : équipements (rouge), habilitations (vert, si exigées),
  contrat (orange), trajet (gris).
- **Ton « orange », pas un ton « jaune »** : `TonBadge`
  (`components/ui/badge.tsx`) ne connaît que cinq tons — bleu, rouge, vert,
  orange, gris — et aucun jaune. Le ticket autorisait explicitement ce repli
  (« ton orange de TonBadge si aucun jaune n'existe »), et je l'ai pris plutôt
  que d'ouvrir une sixième famille de ton pour une seule pastille : *une
  neuvième déclinaison de sens choisit parmi les tons déjà là* (doctrine
  écrite dans `badge.tsx`).
- **Filtre** : une case « Sous contrat uniquement » sur `/sites`, à côté de
  « Afficher aussi les lieux sans équipement », qui se compose avec les
  critères existants (`schemaRechercheSite.sous_contrat_seulement`, une
  comparaison directe sur la colonne — pas une clause de relation).
- **Jeu d'essai** : un troisième site fictif chez le client « Atelier Ducos »
  — « Atelier sous contrat (démonstration) », `sous_contrat: true` — posé
  dans `prisma/seed-data.ts`, visible sur les captures.

## Ce que j'ai mesuré (comptes AVANT/APRÈS)

- **Captures** dans ce dossier — `/sites` à 1280 et 390 px, la fiche du site
  sous contrat (lecture ET modification sur la même capture, la case cochée
  et la pastille de lecture apparaissant toutes deux sur la fiche) — prises
  par un spec e2e temporaire (non conservé, recette de
  [[captures-avant-apres-e2e]]) : AVANT avec les quatre fichiers d'écran
  revenus à `c54f5eb` (le commit d'avant ce lot), APRÈS sur le commit du lot,
  la case du site de démonstration cochée par le scénario lui-même avant la
  capture.
- **Effet de bord MESURÉ et attendu** : ajouter un site à `CLIENTS_NC` dans
  `prisma/seed-data.ts` change le compte total de sites de la société
  (4 → 5), et `INTERVENTIONS_DEMONSTRATION` assigne son lieu par
  `sitesEcrits[index % sitesEcrits.length]` (`prisma/seed.ts`) — un diviseur
  qui change redistribue une partie des interventions et machines de
  démonstration entre les sites existants. C'est documenté dans `seed.ts`
  comme une fragilité acceptée du générateur, pas une régression : la suite
  `pnpm test:e2e` complète (195 scénarios) ne montre aucune casse imputable à
  cette redistribution.
- **`pnpm typecheck`, `pnpm lint`, `pnpm format:check`** : verts.
- **`pnpm test`** : 2694 tests passés (249 fichiers) — 3 de plus qu'avant ce
  lot (`schemaModificationSite.sous_contrat`,
  `schemaRechercheSite.sous_contrat_seulement`).
- **`pnpm test:isolation`** : 1184 tests passés (115 fichiers) — 1 de plus
  (le filtre `sous_contrat_seulement` composé, éprouvé sur la vraie table,
  défaut `false` compris).
- **`pnpm build`** : vert.
- **`pnpm test:e2e`** (195 scénarios) : 189 passés, 2 ROUGES
  **PRÉ-EXISTANTS ET HORS TERRITOIRE** (voir plus bas), 3 sautés, 1 non joué
  — tous les scénarios de `tests/e2e/sites.spec.ts`, y compris les trois
  nouveaux de ce lot, sont VERTS.

## Ce que j'ai tranché et pourquoi

1. **La case envoie un champ caché `sous_contrat=0` à côté d'elle-même**
   (`app/(back-office)/sites/[id]/page.tsx` et
   `app/api/sites/[id]/modifier/route.ts`). Une case à cocher DÉCOCHÉE
   n'apparaît jamais dans `FormData` — à la différence de tout autre champ de
   ce formulaire, où l'absence signifie « ne touche pas à cette colonne ».
   Sans le champ caché, décocher la case puis enregistrer aurait laissé
   `sous_contrat` absent de la requête, donc INCHANGÉ : l'inverse exact du
   geste posé. Avec le champ caché toujours présent quand la case l'est,
   `formulaire.getAll("sous_contrat").includes("1")` donne un booléen
   explicite à chaque soumission de CETTE fiche, sans toucher au contrat
   « absent = ne touche pas » qu'un autre appelant partiel (un import futur)
   continue de voir.
2. **La case active n'est gardée par AUCUNE ligne nouvelle dans
   `lib/auth/habilitations.ts`** — j'ai relu ce fichier en lecture seule
   (territoire du ticket) et réutilisé `gerer_client_site`, la capacité que
   `/api/sites/[id]/modifier` exige déjà pour TOUT le formulaire. La
   visibilité de la case suit `peut(role, "gerer_client_site")`
   (`lib/auth/habilitations.ts`), le même calcul que
   `app/(back-office)/interventions/[id]/page.tsx` fait déjà pour ses propres
   blocs gardés — jamais une comparaison de rôle inventée pour ce ticket.
   **Le reste de la fiche (libellé, commune, agence…) n'est PAS gardé de la
   même façon** — c'est un état préexistant, hors du périmètre de ce ticket,
   que je n'ai pas touché.
3. **Le compteur de la pastille « Contrat » porte un `✓`, pas un nombre** —
   `compteurContrat` (`app/(back-office)/sites/presentation.ts`) rend
   `{ valeur: "✓", libelle: "Contrat", ton: "orange" }`. Aucune valeur
   numérique n'a de sens pour un fait binaire, et la maquette ne montre aucun
   exemple de pastille non numérique dans `.entity-meta` : j'ai choisi la
   forme la plus proche de ce que `CarteEntite` sait déjà rendre plutôt que
   d'ajouter un second mode d'affichage au composant.
4. **Le site fictif du jeu d'essai est un TROISIÈME site du client existant
   « Atelier Ducos »**, jamais un nouveau client — la demande ne porte que
   sur un site, et un client de plus aurait été hors de ce que le ticket
   demande.

## Ce que je n'ai PAS fait

- **Aucune partie du vrai module Contrats** (dates, références, montants,
  table dédiée) — la décision 9 le reporte explicitement, et ce lot n'en
  ouvre aucune part.
- **Je n'ai pas gardé le RESTE du formulaire de modification du site**
  (libellé, commune, zone, rattachement…) par la capacité — seule la case
  neuve l'est. Étendre la garde aux autres champs aurait dépassé le
  territoire de ce ticket (`app/(back-office)/sites/**` pour CETTE case, pas
  une reprise de l'écran entier).
- **Aucun ton « jaune » n'a été créé** dans `components/ui/badge.tsx` — le
  ticket autorisait le repli sur `orange`, et je l'ai pris.
- **Je n'ai pas coché de site réel** — tous les sites de production restent à
  `false` après la migration ; le site coché du jeu d'essai est fictif et
  décrit comme tel dans `prisma/seed-data.ts`.

## Les pièges pour la session suivante

- **`creerSite`/`modifierSite`/`supprimerSite` (`lib/sites/depot.ts`)
  n'acceptent PAS de `client: PrismaClient`** — contrairement aux fonctions
  de LECTURE du même fichier (`rechercherSites`, `compterSites`,
  `equipementsParSite`…). Un scénario d'isolation qui a besoin d'ÉCRIRE un
  site doit passer par `creerSiteDans`/`modifierSiteDans` (qui prennent une
  transaction) enveloppées dans
  `avecContexteApplicatif(contexte, fn, clientApp())` — sans quoi le
  scénario échoue sur `DATABASE_URL` non définie (le harnais d'isolation ne
  la pose jamais). C'est ce que
  `tests/isolation/ecran-site.test.ts` (`sous_contrat_seulement`) fait
  désormais, et c'est le modèle à reprendre.
- **Ajouter un site à `CLIENTS_NC`/`CLIENTS_EU` dans `prisma/seed-data.ts`
  redistribue les interventions ET les machines de démonstration** entre les
  sites de la société, via `sitesEcrits[index % sitesEcrits.length]`
  (`prisma/seed.ts`, la boucle qui écrit `INTERVENTIONS_DEMONSTRATION`). Ce
  n'est pas un défaut de ce lot — c'est une fragilité du générateur,
  documentée dans son propre commentaire — mais toute capture AVANT/APRÈS ou
  tout scénario qui compte des interventions par site doit s'attendre à ce
  qu'ajouter UN site déplace des lignes qui semblaient fixes.
- **J'ai fait UNE quasi-erreur pendant ce lot** : `git checkout <ancien
  commit> -- .` (sans lister de chemins) restaure TOUT le répertoire de
  travail à l'ancien commit, fichier par fichier, sans jamais le dire
  autrement qu'en `git status`. Rattrapé par `git reset --hard HEAD`
  immédiatement (rien n'avait été commité entre-temps), mais la bonne
  méthode pour comparer avant/après est de lister les chemins exacts
  (`git checkout <commit> -- app/chemin/precis.tsx`), jamais `-- .`.
- **Le rapport `pnpm test:e2e` porte DEUX rouges PRÉ-EXISTANTS**,
  confirmés SANS RAPPORT avec ce lot : `imports-historique.spec.ts`
  (« LE RAPPORT PRÉCÈDE L'ÉCRITURE… ») et
  `parcours-creer-puis-planifier.spec.ts` (« PLANIFIER refuse sans les
  quatre valeurs… »). Les deux fichiers n'ont pas été touchés depuis avant ce
  lot (`git log -1` les situe à `18a5fac` et avant), portent sur
  `imports`/`interventions`/`planning` — explicitement HORS TERRITOIRE de ce
  ticket — et `parcours-creer-puis-planifier.spec.ts` est le MÊME flake que
  40-PASTILLES-1 avait déjà signalé (« vert en 3,8 s » quand rejoué seul).
  Rejoué seul cette fois, `parcours-creer-puis-planifier` passe ;
  `imports-historique` échoue de façon reproductible mais IDENTIQUE, seul ou
  dans la suite complète — un défaut réel, mais dans un territoire que ce
  ticket interdit de toucher (`app/(back-office)/interventions/**`).

## Ce qui reste à faire

- **Investiguer `imports-historique.spec.ts`** — le rang 3 (« non
  rattachées ») ne compte plus 2 lignes ; la cause n'est pas identifiée
  (hors territoire de ce ticket, non creusée davantage).
- **Décider si la garde de capacité doit s'étendre au reste du formulaire de
  modification du site** (libellé, commune, agence…), qui reste visible à
  tout rôle aujourd'hui — un état préexistant que ce ticket n'a pas à
  corriger, mais que la case neuve rend plus visible par contraste.
- **Le vrai module Contrats** — reporté, decision 9, aucune part ouverte ici.
