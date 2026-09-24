# 55-FORMULAIRES-1 — passation

## Ce que j'ai changé

- `app/(back-office)/interventions/nouvelle/page.tsx` — un `<input type="hidden" name="id">`
  porte désormais un `uuidv7()` tiré **au rendu** de la page (une fois, en dehors de tout
  formulaire soumis). Le bouton « Créer » est remplacé par `BoutonCreer`
  (`app/(back-office)/interventions/nouvelle/bouton-creer.tsx`, composant client LOCAL, aucun
  composant partagé touché) : il se désactive au premier clic.
- `app/api/interventions/creer/route.ts` — l'`id` n'est plus tiré côté serveur à chaque requête.
  La route relit d'abord `champ(formulaire, "id")` ; s'il est un UUID valide, elle l'utilise,
  sinon elle retombe sur `uuidv7()` (comportement d'hier, inchangé pour tout appel qui ne porte
  pas ce champ — y compris un appel forgé qui omettrait l'`id`). Avant d'écrire, elle appelle
  `interventionDejaCreee(contexte, id)` : si une intervention porte déjà cet `id` **dans la
  société active**, rien n'est créé et la réponse est la MÊME redirection qu'un succès (303 vers
  sa fiche). Si l'écriture est malgré tout tentée avec un `id` qui existe déjà dans une AUTRE
  société (contrainte d'unicité globale sur `intervention.id`, I10), l'exception Prisma `P2002`
  est interceptée et traitée comme une panne technique ordinaire
  (`intervention.refus.erreur_serveur`) — jamais un crash, jamais la fiche d'autrui.
- `lib/interventions/depot.ts` — une seule fonction ajoutée, `interventionDejaCreee` : une
  lecture d'existence, SOUS LE CONTEXTE CLOISONNÉ (comme tout le reste du dépôt), qui rend `null`
  pour un `id` inconnu ou hors périmètre — les deux cas sont indiscernables depuis l'appelant,
  exactement l'effet recherché (I1). Aucune autre fonction du dépôt n'a été modifiée.

Ce que ça change pour l'exploitation : un double clic — ou un clic suivi d'un ré-essai sur
connexion lente, cas réel en Nouvelle-Calédonie (latence vers l'hébergeur, §1 du CLAUDE.md) — ne
pose plus deux interventions identiques pour une seule panne signalée.

## Ce que j'ai mesuré

AVANT (lecture du code, mesure du ticket, main `3e1f9fc`) : `id: uuidv7()` fabriqué à chaque
requête dans `route.ts` — deux soumissions du même formulaire = deux lignes distinctes,
vérifiable par lecture du code seule.

APRÈS — `pnpm verify` intégral, vert :
- `pnpm typecheck` : 0 erreur.
- `pnpm lint` : 0 avertissement.
- `pnpm test` : 254 fichiers, 2751 tests, tous verts (aucune régression sur le reste du dépôt).
- `pnpm test:isolation` : 120 fichiers, 1218 tests, tous verts, dont les 2 nouveaux de
  `tests/isolation/formulaires-1.test.ts`.
- `pnpm build` : réussi.
- `pnpm test:e2e tests/e2e/formulaires-1.spec.ts` : 1 test, vert (39,5 s) — scène `FRM1-`
  créée et détruite par le fichier, deux `request.post` avec le MÊME `id` capturé sur le
  formulaire rendu : la première crée (303 vers `/interventions/{id}`), la seconde rend LA MÊME
  redirection sans rien créer, et `intervention.count({ where: { description: "FRM1-panne" } })`
  vaut exactement `1` après les deux.

Non mesuré : le comportement sous une VRAIE course (deux requêtes strictement concurrentes,
envoyées en parallèle plutôt que l'une après l'autre). Voir « ce qui reste à faire ».

## Ce que j'ai tranché et pourquoi

- **La lecture d'existence est scindée de l'écriture**, plutôt que de laisser `creerIntervention`
  intercepter elle-même une violation d'unicité pour redevenir idempotente. Le territoire du
  ticket limite `lib/interventions/depot.ts` à « lecture d'existence seulement » : je n'ai donc
  pas touché à `creerIntervention`. La route fait le pont — elle lit avant d'écrire, et attrape
  l'exception SEULEMENT pour le cas résiduel qu'une lecture cloisonnée ne peut par construction
  pas éliminer (un `id` d'une autre société).
- **`P2002` se traduit en `intervention.refus.erreur_serveur`**, une clé déjà présente et déjà
  écrite pour « une panne technique, réessayez, rien n'a été modifié ». Je n'ai pas créé de
  nouvelle clé pour ce cas : le message est vrai (rien n'est écrit), générique (il ne nomme ni ne
  laisse deviner l'existence d'une intervention d'une autre société), et c'est exactement le
  registre auquel ce genre de refus appartient déjà dans ce dictionnaire.
- **Le filet visuel (bouton désactivé) est un `useState` posé au `onClick`, pas `useFormStatus`.**
  Ce formulaire est un POST natif (`<form action="..." method="post">`), pas une action serveur
  React : `useFormStatus` ne détecterait jamais son état `pending`. Un état local posé au clic
  suffit et ne bloque pas la navigation déclenchée par ce même clic.
- **L'épreuve d'isolation appelle le dépôt directement**, pas la route HTTP — même convention que
  tout `tests/isolation/*.test.ts` existant (`creation-client-inactif.test.ts` en tête). Elle
  réutilise `INTERVENTION_B1`, une fixture DÉJÀ posée par le harnais global
  (`tests/isolation/setup/global.ts`) dans la société B : aucune ligne ajoutée par ce fichier.

## Ce que je n'ai PAS fait

- Aucune migration, aucune ligne de semis (interdit par le ticket).
- Aucune règle de création changée — capacité `creer_demande`, champs obligatoires, tout est
  identique à avant ce lot.
- Aucune valeur conservée sur erreur de formulaire, aucune alerte « non enregistré » — hors
  périmètre nommé par le ticket.
- Les routes `affecter`/`annuler`/`clôturer` n'ont pas été touchées.
- `depot/` et `11-FILE.sh` n'ont pas été touchés.
- Pas de nouvelle clé de dictionnaire : `intervention.refus.erreur_serveur`, déjà écrite, a
  suffi.

## Les pièges pour la session suivante

- **La lecture d'existence et l'écriture ne sont pas dans la MÊME transaction.** Entre
  `interventionDejaCreee` (qui ne trouve rien) et `creerIntervention` (qui écrit), une fenêtre
  existe : deux requêtes strictement CONCURRENTES portant le même `id`, dans la MÊME société,
  peuvent toutes les deux passer la lecture avant que l'une n'écrive. La seconde heurte alors la
  contrainte d'unicité et tombe dans le même filet `P2002` que le cas « autre société » — un
  refus générique, jamais un crash, jamais une intervention en double — mais l'utilisateur voit
  un refus au lieu d'être mené vers la fiche que l'autre onglet vient de créer. Le ticket décrit
  un « double clic » ou deux `request.post` **séquentiels** ; l'épreuve écrite le mesure ainsi,
  pas sous une vraie course. Corriger ça proprement demanderait de toucher `creerIntervention`
  (hors territoire de ce lot) pour qu'elle-même attrape `P2002` et relise la fiche existante
  avant de refuser.
- **`z.string().uuid()` accepte un UUID v7** dans la version de zod utilisée ici — vérifié
  empiriquement (les interventions de démonstration et tous les scénarios existants naissent
  déjà avec des `uuidv7()` validés par `schemaCreation`). Ne pas supposer l'inverse en touchant à
  la validation d'`id`.
- Le décompte de l'épreuve e2e est bien filtré sur `description: "FRM1-panne"` — ne JAMAIS
  compter `intervention.count()` sans ce filtre dans ce fichier : `fullyParallel` fait tourner
  d'autres scénarios qui créent des interventions au même instant.

## Ce qui reste à faire

- Rendre `creerIntervention` elle-même idempotente sous P2002 (relire, puis rediriger vers la
  fiche existante au lieu de refuser) pour fermer la fenêtre de course décrite ci-dessus — hors
  territoire de ce lot (dépôt restreint à « lecture d'existence seulement »).
- Les valeurs du formulaire ne sont pas conservées après un refus (« panne manquante », « lieu
  inconnu », etc.) — explicitement hors périmètre de ce ticket, déjà signalé au chapitre 8 en
  attente d'un futur lot dédié à l'ergonomie des refus de formulaire.
- Aucune alerte visible « non enregistré » au-delà du texte déjà affiché par `motif=` — également
  hors périmètre nommé.
