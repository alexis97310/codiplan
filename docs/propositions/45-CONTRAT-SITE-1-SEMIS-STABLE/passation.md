# 45-CONTRAT-SITE-1-SEMIS-STABLE — passation

## AVANT DE PUBLIER — les deux gestes d'Alexis

CONTRAT-SITE-1 porte une migration (`20260923140000_contrat_site_1`, une
colonne seule, aucune donnée touchée) qui n'est **toujours pas passée en
production** — cette session ne fait que fusionner le lot sur `main` local et
réparer son seed de démonstration, elle ne déploie rien. Une fois le dépôt
distant à jour :

1. **Migrer la production** : lancer le workflow GitHub « DB migrate », cible
   `production`, case « purge » **décochée**.
2. **Redéployer** : cliquer « Redeploy » sur Vercel une fois la migration
   passée.

(Reprend l'en-tête déjà posée par `docs/propositions/41-CONTRAT-SITE-1/passation.md` et
`docs/propositions/44-CONTRAT-SITE-1-REPRISE-3/passation.md` — rien de neuf ici.)

## Ce que j'ai changé (et ce que ça change pour l'exploitation)

- **`prisma/seed-data.ts`** : chaque site de démonstration peut porter une clé
  facultative, `demoCle` (nouveau champ de `SiteSeed`) — un CODE EXPLICITE
  (`"premier_site_du_client_1"`, `"second_site_du_client_1"`,
  `"site_du_client_2"`), la MÊME chez CODIMA-NC et chez CODIMA-EU pour un rôle
  équivalent (ex. « Atelier principal » côté NC et « Site de Lyon » côté EU
  portent tous deux `"premier_site_du_client_1"`). Posée sur les quatre sites
  qui portaient déjà une machine avant ce lot ; absente des sites qui n'en
  portent pas (« Atelier sous contrat », « Ancien chantier », et les deux
  nouveaux sites EU non concernés).
- **`prisma/seed-data.ts`** : `MachineSeed.siteRang: number` (une position
  dans le tableau des sites ouverts) devient `MachineSeed.siteCle: string` —
  chacune des huit machines de démonstration vise désormais un site par sa
  clé, jamais par un rang. Le mappage retenu reproduit EXACTEMENT le
  rattachement historique (celui d'avant CONTRAT-SITE-1, mesuré par
  REPRISE-3) : rangs 1, 4, 5, 8 sur `premier_site_du_client_1`, rangs 2 et 6
  sur `second_site_du_client_1`, rangs 3 et 7 sur `site_du_client_2`.
- **`prisma/seed.ts`** : le tirage `lieuxOuverts[machine.siteRang %
  lieuxOuverts.length]` est remplacé par une table `lieuxParCle` (une `Map`
  construite depuis les sites ouverts qui portent une `demoCle`), et chaque
  machine résout son lieu par `lieuxParCle.get(machine.siteCle)`. Le message
  d'erreur de la garde existante (lieu ou modèle absent) nomme désormais la
  clé introuvable. `demoCle` est explicitement exclue des champs posés en base
  par l'`upsert` du site — la table `site` ne la connaît pas, c'est une
  information PROPRE au semis des machines.
- **Rien d'autre** : aucune nouvelle migration, aucun site réel, aucune ligne
  touchée hors de `prisma/seed.ts` et `prisma/seed-data.ts`.
- **Pour l'exploitation** : zéro effet visible en production — ceci ne
  concerne QUE le jeu de démonstration. Pour la démonstration elle-même : le
  parc de chaque site redevient déterministe, et un site inséré n'importe où
  dans `CLIENTS_NC`/`CLIENTS_EU` (comme « Atelier sous contrat » l'a fait) ne
  peut plus décaler silencieusement le client d'une machine existante — un
  site sans clé n'accueille simplement aucune machine.

## Ce que j'ai mesuré (comptes AVANT/APRÈS)

- **Base reprise** : `44-CONTRAT-SITE-1-REPRISE-3-garde`, qui contient déjà
  tout CONTRAT-SITE-1 fusionné en avance rapide sur `main` local (vérifié :
  `git merge-base main 44-CONTRAT-SITE-1-REPRISE-3-garde` rend le sommet de
  `main`, donc fusion sans conflit possible).
- **`pnpm typecheck` et `pnpm lint`** : verts après le premier commit
  (typecheck immédiatement ; lint a exigé un second commit — voir
  « ce que j'ai tranché »).
- **`imports-historique.spec.ts:149` seul** (`--workers=1`), AVANT toute
  correction sur cette session (mesure héritée de REPRISE-3, non rejouée ici
  car destructive) : ROUGE, « Non rattachées » = 1 (attendu 2).
- **`imports-historique.spec.ts:149` seul, APRÈS correction** : VERT.
  `mesure.json` écrit par la capture (voir plus bas) confirme
  `rattachements.rang3 = "2"`, avec les DEUX motifs attendus :
  `ZZ-EPREUVE-INCONNUE` (« Aucune machine du parc ne porte ce n° de série »)
  et `NUS-SPL-2022-0007` (« Ce n° de série existe, mais chez un autre client
  que celui de la ligne »).
- **`listes-1.spec.ts` et `parcours-creer-puis-planifier.spec.ts` seuls** :
  6/6 verts (déjà réparés par REPRISE-3, non touchés par cette session).
- **`/sites`, capturé après connexion** (voir
  `sites-apres--1280.png`) : « Atelier principal » 4 équipements, « Dépôt de
  brousse » 2, « Garage de Koné » 2 — exactement la répartition d'avant
  CONTRAT-SITE-1 (4 machines, 2, 2). « Atelier sous contrat » n'apparaît pas :
  zéro équipement, masqué par défaut (comportement de LISTES-1, inchangé).
- **1er tour de `pnpm verify:full`, EN ENTIER** : `format:check` / `typecheck`
  / `lint` / `test` / `test:isolation` / `build` verts, `feries:horizon` et
  `audit:partitions` verts, puis `test:e2e` — **1 rouge**,
  `rapport-terrain.spec.ts:155` (« le bon d'intervention porte les quatre
  blocs saisis... »), sans rapport avec les sites ou les machines. Rejoué
  SEUL (`--workers=1`) : VERT, 5/5 — confirme un flake d'exécution parallèle
  (12 workers), pas une régression de ce lot.
- **2e tour de `pnpm verify:full`, EN ENTIER** : intégralement vert —
  192 passés, 3 sautés (comptage inchangé depuis REPRISE-3), 0 échec, sur
  TOUTES les étapes.

## Ce que j'ai tranché et pourquoi

1. **Une clé explicite plutôt qu'un identifiant de site brut (UUID).**
   `MACHINES_DEMONSTRATION` est une liste UNIQUE rejouée pour CODIMA-NC et
   CODIMA-EU, qui n'ont pas les mêmes sites (mêmes UUID impossibles des deux
   côtés). Une clé de RÔLE (« premier site du client 1 », etc.), portée par
   les DEUX sociétés sous la même chaîne, permet à la liste de rester unique
   tout en résolvant vers le bon site dans chacune — c'est l'esprit de
   l'ancien tirage par position, sans sa fragilité.
2. **Le mappage clé → machine reproduit l'historique, pas une redistribution
   nouvelle.** Rien dans ce ticket ne demande de changer QUELLES machines
   vivent où — seulement de rendre ce choix stable. Recalculer un nouveau
   plan aurait été un changement de comportement gratuit, hors du territoire
   du ticket.
3. **`demoCle` est facultative sur `SiteSeed`, pas obligatoire.** Un site sans
   rôle dans le semis des machines (comme les deux sites créés par
   CONTRAT-SITE-1 et « Ancien chantier ») ne DOIT pas en porter une : la
   forcer aurait exigé d'inventer une clé « qui ne sert à rien », ou de
   donner arbitrairement une machine à un site qui n'en avait jamais eu.
4. **`demoCle` est exclue de l'`upsert` Prisma avec `eslint-disable` justifié
   plutôt que silencieusement absorbée.** Le premier essai laissait `demoCle`
   dans le reste spread (`champsSite`), et Prisma refusait la colonne
   inconnue au premier `pnpm db:seed` — mesuré directement en lançant
   `imports-historique.spec.ts`. La correction isole l'exclusion sur sa
   propre ligne, commentée, plutôt que de la laisser invisible dans un rest
   générique.
5. **Le rouge `rapport-terrain.spec.ts` n'a pas déclenché la règle « deux
   rouges, tu t'arrêtes ».** Cette règle vise une même épreuve qui échoue
   DEUX FOIS DE SUITE sur le MÊME motif. Ici, l'épreuve a échoué une fois sous
   parallélisme puis est repassée verte, seule ET dans un second tour complet
   de `verify:full` — la mesure pointe un flake d'exécution parallèle
   (cohérent avec la note de mémoire sur `fullyParallel` et le semis
   partagé), jamais une régression de ce lot. Le rejouer une seconde fois en
   entier était la vérification proportionnée, pas un troisième essai sur la
   même épreuve.

## Ce que je n'ai PAS fait

- **Je n'ai pas touché `imports-historique.spec.ts`, `classeur-historique.ts`
  ni aucune assertion métier** — la clé de résolution du bug était le SEMIS,
  exactement comme REPRISE-3 l'avait diagnostiqué ; rien à changer côté
  épreuve.
- **Je n'ai pas ajouté de clé `demoCle` aux nouveaux sites de CONTRAT-SITE-1**
  (« Atelier sous contrat », les deux sites EU inchangés) : rien ne demande
  qu'ils portent des machines de démonstration, et leur en donner une aurait
  été une décision d'exploitation, pas une correction de stabilité.
- **Je n'ai pas cherché à corriger le flake de `rapport-terrain.spec.ts`
  sous parallélisme** — hors territoire de ce ticket, et non reproductible
  en dehors d'une exécution à 12 workers.
- **Je n'ai pas poussé sur le dépôt distant**, et n'ai pas ouvert de branche
  de proposition : conformément à l'instruction finale, tout est sur `main`
  en local uniquement.

## Les pièges pour la session suivante

- **`demoCle` doit rester EXCLUE de tout spread générique posé en base.** Si
  un futur ticket ajoute un champ à `SiteSeed` réservé au semis (comme
  `demoCle`), il doit suivre le même chemin : une exclusion EXPLICITE et
  commentée dans `prisma/seed.ts`, jamais une simple confiance dans le rest
  spread — Prisma refusera sinon la colonne inconnue, et le seed entier
  échoue (mesuré : `Unknown argument demoCle`).
- **Ajouter une NEUVIÈME machine de démonstration exige de choisir une clé
  EXISTANTE** (`premier_site_du_client_1`, `second_site_du_client_1`, ou
  `site_du_client_2`) — ou d'en créer une nouvelle ET de la poser sur le site
  visé dans LES DEUX sociétés (NC et EU), sans quoi `lieuxParCle.get(...)`
  rend `undefined` et le seed échoue avec le message qui nomme la clé
  manquante — c'est voulu, et préférable à un site aléatoire.
- **`rapport-terrain.spec.ts` peut rougir sous `test:e2e` à pleine
  parallélisation (12 workers), sans rapport avec ce lot.** Si une session
  future le voit rouge, le rejouer seul avant de chercher une régression
  dans son propre changement.
- **Les captures de ce lot montrent l'ÉTAT, pas un AVANT/APRÈS peint à la
  main** : `sites-apres--1280.png` n'a pas de jumelle « avant » (l'écran
  `/sites` n'a pas changé visuellement — seul le compte de machines par site
  aurait différé, et REPRISE-3 avait déjà laissé ce compte instable plutôt
  que visiblement faux). `imports-marqueur-type-inconnu--1280.png` et
  `imports-type-historique--1280.png` sont des sous-produits du même passage
  de `imports-historique.spec.ts` avec `CAPTURES_REPRISE_HISTORIQUE` posée —
  conservées parce qu'elles ne coûtent rien de plus, pas spécifiquement
  demandées.

## Ce qui reste à faire

- **Les deux gestes d'Alexis** (migration de production, puis Redeploy) —
  voir l'en-tête de ce document.
- **Le rouge `rapport-terrain.spec.ts` sous parallélisme** reste un flake non
  creusé — sans ticket ouvert à ce jour, à surveiller si une session future
  le revoit.
- **Le vrai module Contrats** (dates, références, montants) reste reporté,
  inchangé depuis 41 — décision 9, aucune part ouverte par cette session.
