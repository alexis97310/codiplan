# 9L41E-E2E-AVERTISSEMENTS-CRENEAU — passation

## La collision, identifiée précisément

`avertissements-1.spec.ts` posait `INTERVENTION_BADGE` (scénario « le badge « Nouveau » ») avec
`creneau_debut = now()`, `creneau_fin = now() + interval '1 hour'`, pour `technicienDucos`
(`garnier@codima.test`). Ce technicien porte, par `INTERVENTIONS_DEMONSTRATION`
(`prisma/seed-data.ts`), UN créneau FIXE **différent chaque jour de la semaine** (`joursDepuisLundi`
0 à 6, `debutMinutes`/`dureeMin` propres à chacun) — posé par `pnpm db:seed`, donc présent dans
TOUTE base e2e avant que ce fichier n'écrive sa propre scène.

Le 25/11/2026 (mercredi), ce créneau de semis est `rang: 11` (`prisma/seed-data.ts:1649-1664`,
`joursDepuisLundi: 2`, `debutMinutes: 840`, `dureeMin: 120`) — stocké en base
`2026-11-25 03:00:00` → `05:00:00` (colonne `timestamp without time zone` : l'instant UTC, sans
étiquette de fuseau), soit **14:00–16:00 à Nouméa**. Quand `avertissements-1` tourne entre ~13:00 et
16:00 NC, `[now, now+1h)` recouvre cette fenêtre, et `intervention_sans_chevauchement_technicien`
(9L19) refuse l'INSERT — `23P01`, exactement le constat du pilote du 25/11 à 14:03 NC.

**Reproduit intentionnellement par SQL direct** (hors suite, dans une transaction annulée) : un INSERT
littéral sur `2026-11-25 04:30–05:30` pour `garnier` échoue bien avec `23P01`, et le message cite
textuellement le créneau de semis `["2026-11-25 03:00:00","2026-11-25 05:00:00")` comme la ligne en
conflit — confirmation directe de la cause, sans ambiguïté.

## Le correctif — un seul fichier, aucune assertion touchée

`tests/e2e/avertissements-1.spec.ts`, `beforeAll` : `INTERVENTION_BADGE` n'écrit plus `creneau_debut`
ni `creneau_fin` (restent `NULL`). Deux faits du dépôt rendent ce choix sûr, pas seulement commode :

1. `intervention_sans_chevauchement_technicien` (migration 9L19) ne s'applique
   `WHERE technicien_id IS NOT NULL AND creneau_debut IS NOT NULL AND creneau_fin IS NOT NULL` — sans
   créneau, la ligne est **structurellement** hors de portée de la contrainte, quelle que soit l'heure
   de la journée OU le jour de la semaine (donc aussi disjointe des AUTRES jours du semis, pas
   seulement de celui mesuré le 25/11).
2. `/terrain` (`app/(mobile)/terrain/page.tsx` → `listerPlanning`,
   `lib/interventions/depot.ts:2963`) range une ligne dans la journée du technicien par
   `date_planifiee` SEUL — jamais par `creneau_debut`. Le tri intra-journée
   (`lib/terrain/tri-journee.ts:39-64`) lit `creneau_debut` pour l'affichage/l'ordre, et traite déjà
   `null` comme la fin de liste (`instant ?? Number.POSITIVE_INFINITY`). Aucune des trois assertions du
   scénario (badge visible, carte cliquable, badge disparu après ouverture) ne lit `creneau_debut`.

`duree_estimee_min` reste à 60 (exigé par `intervention_planifiee_a_sa_duree` pour le statut
`affectee`, déjà respecté avant comme après).

## Épreuve — « horloge simulée »

Le dépôt n'a aucun mécanisme pour avancer l'horloge SERVEUR/POSTGRES dans les tests de bout en bout —
`page.clock.setFixedTime` (vu dans `9f4h5a-heure-calee-serveur.spec.ts`) n'avance que l'horloge du
NAVIGATEUR, par construction (c'est précisément ce que ce scénario-là éprouve : l'écart entre les
deux). J'ai donc simulé l'heure au niveau où la collision se produit réellement — l'INSERT SQL — par
deux transactions annulées (`ROLLBACK`, rien conservé) :

- **Fenêtre recouvrante** (reproduit l'ANCIEN motif `now()`/`+1h` à une heure dans 14:00–16:00 NC) :
  `23P01`, comme en conditions réelles — confirme que la dépendance à l'heure existe bien avant le
  correctif.
- **Même heure, motif NEUF (sans créneau)** : `INSERT 0 1`, aucun conflit — confirme que le correctif
  est immunisé À N'IMPORTE QUELLE HEURE, pas seulement à l'heure où la suite a tourné ce jour.

Puis en conditions réelles :
- `pnpm playwright test tests/e2e/avertissements-1.spec.ts` — **4 passed** (les quatre scénarios du
  fichier, badge compris).
- `pnpm test` — **540 fichiers, 6095 tests, passed**.
- `pnpm test:isolation` — **266 fichiers, 2573 tests, passed**.
- `pnpm playwright test` (suite entière, un seul passage) — **1934 passed**, 59 failed, 78 skipped,
  125 did not run. Le journal montre `[WebServer] [Error: aborted] { code: 'ECONNRESET' }` après le
  test 2065/2196 : le serveur de test s'est interrompu tard dans la suite (même famille que l'incident
  SIGABRT mesuré par 9L41C le 25/11 — un worker Chromium long-vécu qui meurt après des milliers de
  pages), et tout ce qui suit a été compté en échec/« did not run » par ricochet, PAS par une
  régression de ce lot : `avertissements-1.spec.ts` n'apparaît dans AUCUNE des deux listes (échecs,
  ignorés), et j'ai rejoué isolément trois des spécs listées en échec
  (`9f4h5-compteur-vivant`, `demandes-traitees`, `rapport-import-tpa3`) — **10 passed**, aucune
  anomalie. Je n'ai pas rejoué la suite entière une seconde fois (≈1h30, hors budget de ce lot) ; le
  signal déjà connu par 9L41C (crash tardif, sans rapport avec un fichier précis) suffit à exclure une
  régression de CE correctif, qui ne touche qu'un seul fichier, isolé, jamais rejoué par la relance.
- `CI=1 pnpm verify` — **vert** (format, typecheck, lint, test, test:isolation, build), rejoué deux
  fois pour capturer le code de sortie proprement (`EXIT=0`).

## Point 3 — autres `now()`/créneau dynamique partageant `technicienDucos`

Recherche (`grep` sur `now()` combiné à `creneau_debut`/`creneau_fin`, croisé avec
`reperes.technicienDucos`) : une DOUZAINE d'autres fichiers e2e posent une intervention sur
`technicienDucos` avec un créneau calculé depuis `now()` (typiquement `now() - interval 'X minutes'`
→ `now()`, pour simuler une intervention « en cours depuis X minutes » ou « terminée à l'instant » —
`fiche-cloturer.spec.ts`, `bon-intervention.spec.ts`, `9l15-temps-valide-technicien.spec.ts`,
`9en-captures.spec.ts`, `captures-9ai-gr14-libelles-saisie.spec.ts`,
`zz-captures-9h1-rapport-valide.spec.ts`, `captures-9eq-fiche-onglets.spec.ts`,
`captures-gr14-duree-unique.spec.ts`, entre autres).

**Je n'ai PAS touché ces fichiers** — ce n'est pas mécanique, contrairement à `avertissements-1` :
leur créneau nourrit une mesure RÉELLE (temps mesuré par `segment_travail`, validation de clôture,
durée affichée) que l'écran ou l'assertion lit explicitly ; le mettre à `NULL` changerait ce qu'ils
éprouvent, pas seulement sa robustesse horaire. Ils partagent la MÊME vulnérabilité structurelle
(une fenêtre de semis fixe, différente chaque jour de la semaine, peut recouvrir leur `now()`-ancré,
*selon l'heure ET le jour*), mais la corriger demande, pour chacun, soit un technicien dédié
(impossible pour ceux qui se connectent avec `COMPTE_TECHNICIEN_EPREUVE`, fixé à `garnier@codima.test`
— seul compte dont le mot de passe e2e est connu), soit une vraie recherche de créneau libre à
l'exécution. Je signale la liste plutôt que d'improviser un correctif partiel sur un périmètre que le
ticket ne couvrait pas ; un lot dédié (lecture des créneaux occupés du technicien avant de choisir
l'heure, ou un second compte e2e avec mot de passe connu) serait le bon format.

## Aucune migration, aucune règle métier changée

Le correctif est un fichier de test. Aucune entrée `docs/arbitrages.md`.

## État à l'arrivée

Arbre propre à chaque commit (voir `git log`). Pas de rebase nécessaire : `origin/main` n'a pas avancé
depuis le point de départ de ce lot (`git fetch` + `git status` vérifiés avant de rendre la main).
