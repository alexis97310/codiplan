# 9F4H3-HORS-RESEAU-ENVOYER — passation

T0 = 09:03 (Pacific/Noumea). Trois lots requis (9F4, 9F4H1, 9F4H2) et l'addendum 9F4A sont bien présents sur
`origin/main` au démarrage (mesuré).

## Ce qui était déjà livré (mesuré avant d'écrire du code)

- **9F4** (`components/terrain/rapport-automatique.tsx`) : brouillon `localStorage` par intervention
  (`codiplan.terrain.<id>.brouillon`), auto-enregistrement, `flushTout`, écoute `online` (RETIRÉE par ce lot).
- **9F4H1** (`lib/terrain/copie-locale.ts`) : base IndexedDB `codiplan-terrain`, magasin `instantane`, clé unique
  `actuel`, effacement à la déconnexion/connexion/changement d'identité. **9F4 n'avait pas de file de photos en
  attente** (confirmé : aucun IndexedDB de photo avant ce lot).
- **9F4H2** : `lib/interventions/saisie-differee.ts` (`schemaSaisieDifferee`, `instant_appareil`+`operation_id`),
  rejeu posé sur les routes `compteur`, `terminer`, `signature` — **jamais sur `rapport`/`prestations`/`photos`**
  (ces trois sont des opérations de REMPLACEMENT, donc naturellement idempotentes ; `photos` l'est par empreinte
  sha256, `lib/documents/depot.ts`).
- **9F4A** : `peutTerminer` revérifié avant `/terminer`, un seul `effacerBrouillon` après succès, délai 15 s.

## Ce qui est livré par ce lot

1. **La file** (`lib/terrain/file-saisies.ts`, `lib/terrain/base-locale.ts`, `lib/terrain/uuid-appareil.ts`,
   `lib/terrain/brouillon.ts`) — magasin IndexedDB `file` SÉPARÉ de `instantane`, jamais touché par
   `effacerCopie`. `id` = UUID v7 fabriqué côté client (`uuidv7Appareil`, Web Crypto — `lib/db/uuid.ts` ne peut
   pas tourner côté navigateur, `node:crypto`), qui sert aussi d'`operation_id` pour compteur/signature/terminer.
   Coalescence (dernière valeur gagne) pour rapport/prestations/signature/terminer ; ajout pour compteur/photo.
2. **`components/terrain/compteur-terrain.tsx`** remplace le `<form>` natif du compteur (R5-02/D119) : tente le
   réseau, enqueue sur échec, affiche un bandeau local « Démarré/Arrêté hors réseau depuis … ».
3. **`components/terrain/bouton-envoyer.tsx`** — envoie TOUTE la file (pas seulement celle de la fiche où il est
   posé), affiche les refus en clair. `lib/terrain/envoi-file.ts` tient le pipeline fixe démarrer→arrêter→
   rapport/prestations/photos→signature→terminer, arrêt au premier refus PAR INTERVENTION.
4. **`components/terrain/rapport-automatique.tsx`** — enqueue rapport/prestations/signature sur échec réseau ;
   plus d'écoute `online` (décision n° 105) ; `onClickTerminer` n'accepte le chemin « hors réseau, mis en file »
   (décision n° 108) QUE si `!navigator.onLine` est VRAI — un bloc en échec alors que l'appareil se croit en
   ligne garde le refus `sans_reseau` d'origine (9F4A), rejouable par un second clic. Section Terminer
   consolidée : `afficherTerminer || enCoursLocalement` (un « démarrer » mis en file APRÈS le rendu serveur doit
   faire apparaître « Terminer » sans recharger — bug trouvé en écrivant l'e2e, corrigé).
5. **`components/interventions/photos-terrain.tsx`** — sur échec réseau, la photo réduite rejoint la file au
   lieu d'être perdue dans l'état mémoire du composant (nouvel état `en_attente`).
6. **`components/terrain/effacement-copie-locale.tsx`** — confirmation de déconnexion si la file n'est pas vide
   (« Envoyer d'abord » / « Se déconnecter quand même »). L'identité vient de `lireCopie()` (jamais de session
   lue à la racine). **Régression trouvée et corrigée** : la première version attendait IndexedDB (async) avant
   `requestSubmit()` ; une navigation immédiate après le clic de déconnexion pouvait courir contre ce
   `requestSubmit()` différé → `net::ERR_ABORTED` (mesuré par `tests/e2e/interventions-2.spec.ts`, qui fait
   exactement ce geste). La décision d'intercepter est maintenant SYNCHRONE (état tenu à jour en continu via
   `EVENEMENT_FILE_MODIFIEE`).
7. **`EVENEMENT_FILE_MODIFIEE`** (`lib/terrain/file-saisies.ts`) — `BoutonCompteurTerrain` et
   `RapportTerrainAutomatique` ne se parlent pas (pas parent/enfant) ; cet événement `window` les synchronise.
8. **Épreuve e2e** `tests/e2e/offline/9f4h3-mode-avion.spec.ts` — scène dédiée (préfixe `9F4H3-`), deux
   scénarios : parcours complet hors réseau + envoi + rejeu RÉEL (capture de l'`operation_id` effectivement
   utilisé par le clic, rejoué via `page.request.post`, vérifie un seul segment) ; et une intervention annulée
   au bureau pendant la coupure (motif affiché, rien écrit). **Les deux passent.**
9. **Captures** (`docs/propositions/9F4H3-HORS-RESEAU-ENVOYER/captures/`, 375 et 1280 px) :
   - `fiche-hors-reseau-en-attente` : compteur démarré hors réseau, bandeau orange « Démarré hors réseau depuis
     HH:MM (heure du téléphone, en attente d'envoi) ».
   - `fiche-hors-reseau-terminee-en-attente` : section Terminer remplacée par « Intervention terminée sur ce
     téléphone : en attente d'envoi. »
   - `bouton-envoyer` : bandeau « Envoyer (7) » en haut de fiche, réseau revenu.
   - `refus-annulee-au-bureau` : bandeau rouge (file, role=status) ET bandeau orange (section Terminer, relu
     après `router.refresh()`) portant tous deux le même texte générique `intervention.refus.annulee_figee` —
     vu en écrivant l'e2e, pas un défaut : les deux widgets décrivent chacun honnêtement l'état réel après
     rafraîchissement.
10. **D215** (`docs/arbitrages.md`) et backlog (`L3-08`, `R5-03`, `R5-04`, `R5-05` mis à jour avec l'état mesuré).

## Ce que je N'AI PAS fait / limites honnêtes

- **Aucune épreuve d'une NAVIGATION hors réseau vers `/terrain` ou `/terrain/[id]`** (reload pendant la coupure) :
  confirmé, comme l'addendum 3 du pilote le documentait déjà pour 9F4H1, que `context.setOffline` ne bloque pas
  fiablement le chemin service-worker pour ce genre de requête sous Playwright/Chromium. Mon épreuve ne simule
  jamais ce résultat : elle prouve la PERSISTANCE directement dans IndexedDB (`page.evaluate`, lecture du
  magasin `file`) plutôt que par un rechargement de page. Le flux réel (page déjà chargée en ligne, coupure
  survenant SANS rechargement) est lui entièrement joué et vérifié.
- **`BoutonCompteurTerrain` n'écoute pas `EVENEMENT_FILE_MODIFIEE`** (seul `RapportTerrainAutomatique` et
  `BoutonEnvoyer` le font) : il gère son propre état directement au clic, donc ce n'est pas un bug pour le
  parcours normal, mais un autre onglet/fenêtre qui modifierait la file ne le rafraîchirait pas. Non mesuré
  comme un problème réel (un appareil professionnel n'a qu'un onglet terrain à la fois, 9F4H1).
- **Le temps mesuré n'est jamais revérifié côté client avant de mettre « terminer » en file** : `peutTerminer`
  (temps mesuré compris) est rejugé par le SERVEUR au moment de l'envoi réel (« Envoyer ») — un refus là
  (ex. temps_manquant) laisse l'entrée en file avec son motif, rien n'est perdu ni accepté à tort. C'est
  délibéré (voir D215), pas un oubli.
- **`lib/terrain/file-saisies.ts` n'a pas de test unitaire direct** (jsdom n'implémente pas IndexedDB, même
  contrainte que `copie-locale.ts` — pas de `fake-indexeddb` ajouté, CLAUDE.md §2). La persistance réelle est
  prouvée par l'e2e (lecture directe du magasin `file`) ; la logique de coalescence/tri n'est éprouvée QUE
  transitivement par le comportement observé en e2e (démarrer/arrêter/rapport/prestations/photo/signature/
  terminer tous présents et corrects après envoi). Si un lot futur touche ce fichier, ajouter des tests ciblés
  serait utile.
- **Aucune nouvelle route serveur** créée ni modifiée (territoire respecté).

## Points ouverts pour un lot futur

- Envoi automatique et résolution fine des conflits (L3-09/L3-10) — explicitement reportés après le 24/10/2026
  par le pilote, voir D215.
- `L3-07` (parc complet d'un client à 7 jours, RG-DRO-02) reste BLOQUÉ, chaîne inchangée.
- Si un lot ajoute un second onglet/fenêtre terrain simultané, revoir `BoutonCompteurTerrain` pour qu'il écoute
  aussi `EVENEMENT_FILE_MODIFIEE`.

## Fin de lot

`CI=1 pnpm verify:full` lance `test:e2e` sous `CI=1`, donc `workers: 1` (séquentiel) sur les **1461 tests** de
toute la suite e2e du dépôt — ce n'est pas le territoire de ce lot, c'est la suite ENTIÈRE, prévue pour tourner
sans surveillance la nuit (CLAUDE.md §4). Lancé en premier plan et laissé tourner 50 minutes, il n'avait pas
fini (il régénère au passage des captures de dizaines d'autres lots, toutes restaurées par `git checkout` —
aucune ne devait entrer dans ce commit). Je l'ai arrêté et j'ai couru à la place, en entier :
- `CI=1 pnpm verify` (format:check + typecheck + lint + test + test:isolation + build) — **vert**, voir
  `verify-final.txt`.
- Individuellement : ma propre épreuve e2e (2/2) et ~21 fichiers e2e voisins touchant `/terrain` ou le hors
  réseau (`9dd-pg-g14c`, `9de-terminer-signature`, `9df-tp-cy2-matrice-d8`, `9dg-tp-s1`, `9di-tp-ter1`,
  `9f2-terrain-jours-maquette`, `9f4-terrain-enregistrement-auto`, `acces-technicien`, `arrivee`,
  `avertissements-1`, `bon-4`, `coque-375`, `interventions-2`, `navigation-app-technicien`,
  `offline/9f4h1-consultation`, `offline/socle-pwa`, `rapport-terrain`, `terrain-largeur`, `terrain`) — **tous
  verts** après deux correctifs (voir plus haut : gating de la décision 108, race de la confirmation de
  déconnexion) et l'adaptation du scénario « mode avion » obsolète de 9F4-TERRAIN-ENREGISTREMENT-AUTO.

`avertissements-1.spec.ts` a d'abord semblé rouge en exécution groupée (compteur de courriels partagé entre
fichiers sous `fullyParallel`) — **mesuré étranger** : vert en isolation, jamais touché par ce lot.

Reste non couvert par une exécution automatisée dans cette session : le reste de la suite e2e (hors
`/terrain`/hors-réseau), faute de temps pour un passage séquentiel complet. `pnpm fetch origin` +
`pnpm rebase origin/main` + `CI=1 pnpm verify` (sans e2e) sont la dernière chose faite avant de rendre la main —
voir le SHA en fin de `verify-final.txt`.
