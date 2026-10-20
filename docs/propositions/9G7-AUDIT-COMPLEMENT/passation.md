# 9G7-AUDIT-COMPLEMENT — passation

Branche dédiée `9g7-audit-complement`, partie d'`origin/main` à `9bcb542b` : **`main` était
extrait ailleurs** (`/home/aplou/codiplan`, worktree distinct), comme annoncé en tête de ce
lot. Rien n'a été poussé.

**Aucun code applicatif touché** (`app/`, `components/`, `lib/`, `prisma/`) — seulement
`tests/audit-visuel/`, `docs/audits/9F6/`, `docs/propositions/9G7-AUDIT-COMPLEMENT/`.

## Point 1 — l'outil corrigé (commit `97e6bef6`)

| # | Défaut mesuré | Avant | Après |
|---|---|---|---|
| a | Captures « haut » du site décalées | `ecrans.spec.ts` appelait `mesurerLaPage` (qui focus `#contenu`, `mesures.ts:94-101`) AVANT `captureHautEtPleine` — le focus décale le défilement, et la capture « haut » photographiait le h1 sous le bandeau (y=21) | `captureHautEtPleine` (`ecrans.spec.ts:138-169`) prend un paramètre `mesurer`, exécuté ENTRE la capture « haut » et la capture « pleine » — jamais avant. Les 7 sites d'appel mis à jour. |
| b | Bouton « Filtrer » sr-only mesuré comme « premier bouton » | `mesures.ts` : `document.querySelector('main button, ...')` retenait le premier élément du DOM, y compris `sr-only` | `mesures.ts:278-291` : `querySelectorAll` + `.find((el) => !el.classList.contains("sr-only"))` |
| c | `catalogue.ts:524` passait `agenceId` à la route du calendrier | `/parametres/agences/calendrier/[id]` attend un `calendrier_id` (UUID de la table `calendrier`), recevait un UUID d'agence → 404 systématique | `resolution.ts` résout `calendrierId` (déjà lu sur l'agence — `calendrier_id` n'est jamais `null` au semis) ; `catalogue.ts` l'utilise |
| d | Rôle de la maquette non aligné sur le rôle capturé | Tableau de bord, Imports et les 7 « Fiche intervention » utilisaient `Role.adv` comme jeton de maquette alors que le site est capturé en `admin_societe` (`acces: "bureau"`) — `CAN.montants` et `CAN.parametrer` de la maquette EXCLUENT `"admin"`, donc la comparaison mesurait un écart qui ne tenait qu'au rôle choisi | Jeton `"admin"` sur ces 9 entrées (`catalogue.ts`), vérifié en lisant `CAN` dans `docs/propositions/ergonomie-2026-09-28/maquette-toutes-pages.html` (~l.1888-1905) et `lib/auth/habilitations.ts:198` (`voir_montants_vente`) |

## Point 2 — Terrain (commit `3287abb6`)

`ecrans.spec.ts`, bloc « Terrain · intervention pilotée » (~l.797) : pilote
`reperes.interventionTerrainADemarrer` (la même intervention que « Intervention à
démarrer », déjà capturée par la boucle du catalogue — ce bloc s'enregistre APRÈS, donc
s'exécute après, en mode sériel) :

1. Clique « Démarrer l'intervention » → capture « Intervention en cours » (clé
   `terrain-i-i436`, réécrit l'« absente » de 9F6A) **+ deux captures brutes à 3 s
   d'écart** (`site-*-compteur-t0.jpg` / `-t3.jpg`) pour prouver que le compteur défile.
2. Remplit le rapport (commentaire, suite à donner, une photo) → capture `terrain-i-i436-
   rapport` (9F6A : `route: null`, « non couvert »).
3. Trace une signature (mêmes événements pointeur que `rapport-terrain.spec.ts`) → vérifie
   que « Terminer l'intervention » est visible → capture `terrain-i-i436-signature`.
4. **Coquille hors réseau UTILISABLE** : `context.setOffline(true)` sur la page déjà
   montée (jamais un `goto` hors connexion — même règle que
   `tests/e2e/offline/9f4h3-mode-avion.spec.ts`, lu avant d'écrire ce bloc) ; vérifie que
   compteur, rapport, prestations, photos, section signature et bouton Terminer restent
   tous visibles → capture `terrain-hors-reseau-fiche-utilisable`. Puis retour en ligne
   pour naviguer vers `/terrain`, coupure à nouveau → `terrain-hors-reseau-journee-
   utilisable`.

**Mesuré en écrivant ce bloc** : `peutTerminer` (`lib/interventions/cycle-de-vie.ts:142`)
n'empêche PAS l'affichage du bouton « Terminer » — `afficherTerminer` dans
`app/(mobile)/terrain/[id]/page.tsx:484` ne dépend que du statut `en_cours`, pas de la
signature ; un refus serveur s'affiche APRÈS un clic, jamais en cachant le bouton
d'avance. Le bouton est donc déjà visible dès « en cours », avant même la signature —
l'assertion du ticket (« signature tracée, bouton Terminer actif ») reste vraie au moment
de la capture `terrain-i-i436-signature`, simplement pas pour la raison que j'avais
supposée en écrivant le test.

## Point 3 — Fiches intervention, onglets et montants par rôle (commit `3287abb6`)

`catalogue.ts` (~l.390-450) : quatre entrées `ESansMaquette` pour les onglets Temps,
Rapport, Valorisation, Historique de `r.interventionAvecBon` (cloturee ?? terminee),
capturées en rôle `"admin"` (alignement du point 1).

`ecrans.spec.ts`, bloc « Valorisation et bon interne » (~l.1161) : ouvre les comptes ADV
(`COMPTE_EPREUVE`) et direction (`EMAIL_DIRECTION_AUDIT`), capture l'onglet Valorisation
et `/interventions/{id}/bon?version=interne` pour chacun.

**Limite mesurée, pas contournée** : l'intervention `cloturee` du semis
(`prisma/seed-data.ts:1551`, `temps_valide_min: 12`) ne produit **aucune valorisation
calculée** (`lib/interventions/depot.ts:2892-2930` : `fiche.valorisation` reste `null` si
`tauxEnVigueur` ne trouve aucun taux pour la date de l'intervention) — vérifié en
comparant les captures `interventions-onglet-valorisation` (admin_societe) et
`interventions-onglet-valorisation-adv` : **identiques**, « Forfait de déplacement : — »
dans les deux cas, sans carte Valorisation du tout. La différence de visibilité des
montants par rôle (`CAN.montants` / `voir_montants_vente`) existe bien dans le code,
mais cette intervention précise ne la rend pas observable à l'écran : il faudrait une
intervention `cloturee`/`terminee` dont la date tombe sous un taux horaire en vigueur,
ce que `resolution.ts` ne distingue pas aujourd'hui (il prend la première `cloturee`
trouvée, sans ce critère). **Point ouvert.**

## Point 4 — Fiches actives, VGP, demande à qualifier (commit `3287abb6`)

`resolution.ts` :
- `client`/`site` : ajout de `actif: true` (~l.44-70). Sans lui, l'ordre alphabétique
  retombait sur « Ancien client » / « Ancien chantier »
  (`prisma/seed-data.ts:798-821`, `actif: false`, posés exprès pour le filtre « actifs
  seulement » de la recherche) — vérifié avant/après sur les captures `clients-c14` et
  `parc-m14` (« Océane Véhicules » / « Atelier Ducos », plus « Ancien client »).
- `machine` (~l.72-94) : résout l'assujettissement VGP réel (`vgp_exception` de la
  machine puis, à défaut, `assujettissement_vgp` de sa famille — même règle que
  `lib/vgp/assujettissement.ts:184-202`) plutôt qu'une machine prise au hasard. Vérifié :
  la capture `parc-m14` montre maintenant « Prochaine VGP · Échéance dépassée ».

`ecrans.spec.ts`, `beforeAll` (~l.344-364) : dépose une demande via `/api/demandes/creer`
(même route que `tests/e2e/9edz-nouvelle-demande.spec.ts`) — jamais une ligne SQL à la
main, pour que `agence_id`/`depose_le`/`compteur_accuse_le` restent calculés par
`deposerDemande` (D13). Seulement si `reperes.demandeId === null` (le semis n'en pose
réellement aucune). Vérifié : `demandes-d31` passe d'« absente » à `capturee`.

**Point ouvert, non entrepris** : un import APPLIQUÉ avec rejets. `resolution.ts` ne
trouve toujours aucun `importLot` au statut `applique` (`notes.importApplique`) — en
créer un correctement (dépôt `.xlsx`, contrôle, application, rejets groupés) suppose de
driver tout le parcours d'import avec un fichier réel ; non entrepris faute de temps
après les points 1 à 5 et 2 (le plus coûteux). `imports-L16` reste « absente ».

## Point 5 — Portail et Choisir la société (commit `3287abb6`)

**Portail** — la cause est mesurée, pas réparée (voir le commentaire ajouté à
`comptes.ts:111-130`, au-dessus de `ouvrirSessionPortailDeDemonstration`) :
`reemettreJetonPremierAcces` (`lib/auth/amorcage.ts:452-457`) exige au moins une ligne
`utilisateur_societe`, que D10 ne pose JAMAIS pour un compte portail (son rattachement
réel est `utilisateur_client`, lu par `app/(portail)/portail/page.tsx`).
`envoyerLienDAccesPartage` (`lib/auth/lien-d-acces.ts:102`) n'exige, lui, aucune
habilitation — mais n'a aujourd'hui que DEUX appelants, `lib/auth/acces-bureau.ts` et
`lib/auth/acces-technicien.ts` : **aucun chemin applicatif ne donne l'accès portail à un
contact client aujourd'hui.** Ce n'est donc pas un défaut de l'outil à corriger ici — la
fonctionnalité manque côté application (`app/`, `lib/`, hors territoire de ce lot). Un
ticket produit, pas une correction d'outil.

**Choisir la société** — `comptes.ts:304-399`, `ouvrirCompteMultiSociete` : identité
dédiée habilitée ADV sur CODIMA-NC et CODIMA-EU. Capture `arrivee` passée d'« absente » à
`capturee`.

## Point 6 — non entrepris (budget)

Dialogues de premier niveau (Clôturer, Déplacer, Planifier, Suspendre, Transmettre
demain, Déclarer une absence, menu « Créer », recherche globale) et états d'erreur
(identifiants refusés, code faux, mots de passe différents, champ obligatoire vide) :
**aucun capturé.** Le budget de ce lot (points 1 à 5, chacun plus coûteux que prévu —
le point 2 en particulier a demandé plusieurs itérations de mesure/correction sur le
pilotage du terrain) n'a pas laissé de temps pour ce point avant la limite de code neuf.

## Taille du dossier

**23 Mo** (plafond 40 Mo) — 91 écrans (contre 81 pour 9F6A).

## Fin de lot

- `pnpm audit:visuel` joué une dernière fois en entier avant les commits de dossier :
  **94/94 tests verts, 6.8 min.**
- `tests/unit/audits/9f6-repartition.test.ts` : 6/6 verts.
- `CI=1 pnpm verify:full` **tenté EN ENTIER** une première fois : `format:check`,
  `typecheck`, `lint`, `test` (4965), `test:isolation` (1640), `build`, `feries:horizon`,
  `audit:partitions` tous verts, lus dans le journal avant son interruption à 30 min
  pendant `test:e2e` (aucun `✗` observé jusqu'au point d'arrêt — même limite assumée que
  9F6A, 9F6AA et 9F4H5B-JOURNEE-SANS-MONTANT). **Le fichier journal de cette première
  tentative a été perdu** : le nettoyage des captures régénérées par `test:e2e` sous
  `docs/propositions/**` (`git clean -fd docs/propositions/`) a aussi supprimé le
  répertoire `docs/propositions/9G7-AUDIT-COMPLEMENT/`, alors non suivi par git — leçon
  pour la prochaine session : committer (ou `git add`) le journal AVANT tout `git clean`.
  `verify-final.txt` ici présent vient d'un second passage, `CI=1 pnpm verify` SEUL
  (sans `test:e2e`) : **format:check, typecheck, lint, test (4965), test:isolation
  (1640), build — tous verts**, confirmés une seconde fois.
- 15 dernières lignes de `verify-final.txt` : sortie du `build` (tailles de routes), rien
  d'anormal.
- `git rev-parse --short HEAD` : voir ci-dessous, après le commit de ce fichier.

## Points ouverts (résumé)

- **Point 3** — différence de montants par rôle non démontrable sur l'intervention
  `cloturee` actuelle du semis (aucun taux en vigueur résolu pour sa date).
- **Point 4** — aucun import `applique` avec rejets créé.
- **Point 5** — portail : cause mesurée, fonctionnalité d'octroi d'accès absente côté
  application (hors territoire).
- **Point 6** — entièrement non entrepris (dialogues, recherche globale, états d'erreur).
- `test:e2e` complet non exécuté jusqu'au bout (limite de temps, comme à chaque lot de
  cette série).
