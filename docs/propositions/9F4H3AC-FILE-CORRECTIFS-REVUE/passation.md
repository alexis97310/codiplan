# 9F4H3AC-FILE-CORRECTIFS-REVUE — passation

T0 = 16:25 (Pacific/Noumea). `9F4H3AB-REPRISE-9F4H3A` est bien présent sur `origin/main` au démarrage (mesuré,
`git log origin/main --oneline`).

## Ce qui a été livré, point par point

1. **Coalescence cloisonnée par identité** (`lib/terrain/file-saisies.ts#ajouterSaisie`). La recherche de
   l'entrée coalescable précédente (rapport/prestations/signature/terminer) ne regardait que `interventionId` +
   le type du geste — sur un téléphone PARTAGÉ, la saisie d'un second compte effaçait en silence celle du
   premier. `utilisateurId` et `societeId` entrent désormais dans la clé. Unitaires : saisie de A puis de B
   (même intervention, même type) → les deux restent, chacune dans la file de son identité ; A puis A →
   inchangé, une seule entrée (fichier:ligne `lib/terrain/file-saisies.ts:220-228`).

2. **`retirerSaisieCoalescable` ne retire plus une valeur écrite PENDANT l'envoi**
   (`lib/terrain/file-saisies.ts#retirerSaisieCoalescable`). Avant : `pasApresInstant = new Date()` était lu
   APRÈS la réponse réseau — une entrée écrite par un second geste PENDANT l'aller-retour (instant antérieur à
   cette lecture tardive, mais postérieur au DÉPART de la requête) était retirée à tort, alors qu'elle n'avait
   jamais été envoyée. `pasApresInstant` est maintenant un paramètre FACULTATIF ; les trois appelants
   (`envoyerRapport`, `envoyerPrestations`, `tenterEnvoiSignature` dans `components/terrain/
   rapport-automatique.tsx`) le relèvent AVANT `fetch` — `instantAvantEnvoi()` (nouvelle export, même exemption
   L0-08 que `nouvelleOperation`) pour les deux premiers, l'`operation.instantAppareil` déjà capturé pour la
   signature (aucun second repère). Sans paramètre fourni, le comportement d'origine (lu ici) est conservé —
   aucun appelant existant à casser. Unitaires : une entrée écrite entre le repère et la réponse reste ; une
   entrée antérieure ou égale au repère part (`tests/unit/terrain/file-saisies.test.ts`, describe
   `retirerSaisieCoalescable`).

3. **« Terminer » hors réseau n'est plus refusé à tort quand le compteur a été démarré EN LIGNE**
   (`components/terrain/rapport-automatique.tsx#mesureCompteurDeLaFile`,
   `app/(mobile)/terrain/[id]/page.tsx`). Le verdict local ne connaissait que la file : un segment ouvert EN
   LIGNE (jamais passé par `ajouterSaisie`) y était invisible, et le refus « temps manquant » tombait sur le
   cas le plus ordinaire — démarrer en ligne, perdre le réseau, finir. La fiche transmet maintenant une prop
   neuve, `segmentOuvertConnu: { debut: string } | null`, dérivée de `mesure.ouvert` (déjà rendu par `mesurer`,
   aucune requête neuve) ; `mesureCompteurDeLaFile` l'utilise comme valeur initiale de `debut`, exactement
   comme le ferait un « démarrer » de la file — le même repli « au moins 1 » (9F4H3AA) s'applique, et un
   « arrêter » seul en file peut désormais refermer CE segment serveur. `peutTerminer` reste importé tel quel,
   non modifié. Unitaires (a)/(b)/(c) exactement comme demandés par le ticket
   (`tests/unit/terrain/rapport-automatique.test.tsx`, describe « un compteur démarré EN LIGNE »). e2e :
   `tests/e2e/offline/9f4h3ac-correctifs-revue.spec.ts`, test « point 3 ».

4. **« Terminer » hors réseau ne ment plus sur ce qu'il a gardé**
   (`components/terrain/rapport-automatique.tsx#onClickTerminer`). La branche hors réseau appelait
   `ajouterSaisie({geste:{type:"terminer"}})` et annonçait « en attente d'envoi » sans jamais relire le verdict
   de `flushTout` (rapport/prestations/signature) calculé juste avant — un échec de garde sur l'un des trois
   (IndexedDB en panne) pouvait donc se solder par une fausse promesse d'envoi. Un contrôle neuf, posé entre le
   verdict local et la mise en file de « terminer », bloque désormais le geste et réutilise la clé existante
   `terrain.file.echec_gardee` si `verdict.rapport`, `.prestations` ou `.signature` est à l'état `"echec"`.
   Unitaire : signature en échec de garde SEULE (rapport et prestations inchangés, donc jamais testés par
   IndexedDB), « terminer » qui aurait réussi s'il avait été tenté → jamais « en attente d'envoi », rien en
   file. Pour isoler l'échec à UN SEUL type de geste (le double IndexedDB global
   `installerIndexedDBFactice({enPanne:true})` aurait aussi fait échouer « terminer », ne distinguant pas « pas
   tenté » de « tenté et aussi cassé »), le test mocke `ajouterSaisie` par type de geste
   (`tests/unit/terrain/rapport-automatique.test.tsx`, `controleAjout`, variable `vi.hoisted`) — passthrough
   vers le module réel sauf pour le type ciblé.

5. **Transaction IndexedDB abandonnée traitée comme un échec, jamais un silence**
   (`lib/terrain/file-saisies.ts#ajouterSaisie`). `onabort` n'était pas écouté (la promesse serait restée
   pendante indéfiniment sur un abandon réel — quota dépassé après que les requêtes de la transaction ont
   individuellement réussi) et `base.close()` était omis sur le chemin d'échec (`catch` ne fermait jamais la
   connexion ouverte par `magasin()`). Les deux sont corrigés : `onabort` rejette la promesse (→
   `{gardee:false}`), et `base?.close()` est dans un `finally`, donc appelé sur TOUS les chemins. Le double
   `tests/unit/terrain/aide-indexeddb-factice.ts` gagne une option `enAbandon` (chaque transaction appelle
   `onabort` plutôt que `oncomplete`) pour pouvoir l'éprouver sans navigateur réel. Unitaire : `gardee:false`
   sur une transaction qui s'abandonne — la simple terminaison du test (pas de timeout) prouve déjà qu'`onabort`
   est écouté, une promesse non résolue aurait fait échouer le test par délai.

## Points ouverts (recopiés, et un nouveau)

- **« Terminer » en ligne échoué avec `navigator.onLine` vrai jette son `operation_id`** (C7 non tenu en
  lie-fi) — un bloc qui échoue alors que l'appareil se CROIT en ligne reste le refus d'origine (9F4A), rejouable
  par un second clic ; ce second clic fabrique un NOUVEL `operation_id` via `nouvelleOperation()` plutôt que de
  réutiliser celui du premier essai. Si le premier essai avait en réalité atteint le serveur (réponse perdue,
  lie-fi), le second clic est un geste DIFFÉRENT aux yeux du serveur. Non touché par ce lot (hors des cinq
  points demandés).
- **Deux onglets qui envoient rapport/prestations en même temps (pas de verrou)** — la coalescence cloisonnée
  par identité (point 1) protège contre un AUTRE COMPTE, pas contre deux onglets du MÊME compte qui liraient et
  écriraient la file sans se coordonner. Non mesuré, non traité : aucun verrou inter-onglets n'existe dans ce
  dépôt (`BroadcastChannel`, `navigator.locks`, …).
- **Onglet périmé après changement de compte** — un onglet resté ouvert sous une session devenue invalide
  (déconnexion menée depuis un AUTRE onglet) enverrait sous le cookie courant ; MESURÉ : non reproduit en e2e
  dans ce lot (hors territoire, routes `app/api/**` non touchées) — à vérifier si le pilote le juge probable.
- **Nouveau — `segmentOuvertConnu` est une photographie au rendu, jamais rafraîchie sans `router.refresh()`.**
  Si un AUTRE technicien ferme le segment de l'intervention (renfort) PENDANT que la page reste ouverte hors
  réseau, `segmentOuvertConnu` continue de pointer vers un segment qui n'est plus réellement ouvert côté
  serveur. Sans conséquence pratique mesurée (la mesure finale reste celle du serveur à l'envoi réel, jamais
  celle du client), mais signalé pour mémoire — même famille que le point C5 déjà connu (« un verdict local
  favorable n'empêche jamais un refus serveur ultérieur »).

## Captures

`docs/propositions/9F4H3AC-FILE-CORRECTIFS-REVUE/captures/`, 375 et 1280 px, en viewport sans `fullPage` :

- `fiche-hors-reseau-terminee-demarre-en-ligne` (point 3) — la section « Terminer » avec le bandeau orange
  « Intervention terminée sur ce téléphone : en attente d'envoi. », obtenue avec un compteur démarré EN LIGNE
  (statut déjà « en cours » au moment du clic), jamais passé par la file. Aux deux largeurs, le défilement cible
  explicitement ce bandeau après le redimensionnement — un défilement posé une seule fois, avant le
  redimensionnement, plaçait l'élément hors cadre à 375 px (la mise en page plus étroite est aussi plus haute).
- `echec-de-garde-au-clic-terminer` (point 4) — le même bandeau, orange devenu message rouge : « Ce téléphone
  n'a pas pu garder la saisie : gardez cette page ouverte et réessayez quand le réseau revient. », sous le
  bouton « Terminer l'intervention » resté VISIBLE (rien n'a été accepté à tort, le geste reste retentable).
  Obtenue en cassant `window.indexedDB` juste avant la coupure réseau.

## Vérification finale

Épreuves voisines rejouées en SÉRIE (`--workers=1`) après un échec sous parallélisme complet (5 fichiers rouges,
tous des timeouts/éléments introuvables — contamination de scène partagée sous `fullyParallel`, même famille que
mesurée par 9F5A-REPRISE-9F5) :

```
28 passed (2.2m)  — tests/e2e/offline/*, captures-9f4h2a-fin-avant-debut, 9de-terminer-signature,
                     rapport-terrain, 9f4-terrain-enregistrement-auto
```

`pnpm test` : 457 fichiers, 4892 tests, vert. `pnpm test:isolation` : 184 fichiers, 1631 tests, vert.
`pnpm typecheck` / `pnpm lint` / `pnpm format` : verts, aucun avertissement.

`CI=1 pnpm verify:full` lancé en UN appel, au premier plan, SANS finir dans le temps imparti (tué par le
gabarit à 55 min, journal complet dans `verify-final.txt`, ce même dossier) — **à dire explicitement, comme le
gabarit le demande** :

- `format:check`, `typecheck`, `lint`, `test` (457 fichiers, 4897 tests), `test:isolation` (184 fichiers, 1631
  tests) et `build` (« Compiled successfully ») : TOUS VERTS, dans cet ordre, avant `test:e2e`.
- `feries:horizon` et `audit:partitions` : VERTS.
- `test:e2e` (1467 tests, `--workers=1` sous ce flux) a ÉTÉ LANCÉ ensuite, et n'a pas pu finir : tué à 55
  minutes, après environ 1264 tests passés et 16 ignorés (`·`/`°` du rapporteur, comptés dans le journal),
  **aucun `F` (échec) observé** dans la portion jouée. Non concluant sur le dernier tiers, dont les épreuves
  `9f4h3ac-correctifs-revue` (point 3/4 de ce lot) et les épreuves voisines nommément demandées par le ticket —
  TOUTES rejouées séparément en série ci-dessus, et TOUTES vertes.
- Relancer `test:e2e` en entier dépasserait le budget de ce lot (150 min, T0=16:25) sans marge pour conclure
  proprement ; non relancé. Point à reprendre si le pilote veut un `verify:full` intégralement vert en un seul
  appel (déjà obtenu par une session précédente, 9F5A-REPRISE-9F5, ce qui suggère que ce lot l'aurait aussi
  obtenu, mais ce n'est pas une preuve).

`CI=1 pnpm verify` rejoué en UN appel après le rebase (`git fetch origin` : `origin/main` inchangé à
`4e5d997c`, rebase sans effet) — vert, build compilé, arbre propre avant comme après.

Commit final : `d00b6168`.
