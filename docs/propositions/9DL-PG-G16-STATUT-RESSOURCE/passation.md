# 9DL-PG-G16-STATUT-RESSOURCE — passation

## Ce que j'ai changé, et ce que ça change pour l'exploitation

- **Migration** (`20261005100000_pg_g16_statut_ressource`) : énumération `StatutRessource` (`salarie`, `patente`) et colonne `technicien.statut_ressource`, **nullable, sans défaut**. Aucun technicien existant ne porte une valeur inventée — ils restent « non renseigné » jusqu'à ce qu'une fiche la pose. Point d'arrêt RELEASE-1 : c'est Alexis qui lancera `pnpm db:deploy` en production.
- **Saisie** (`lib/techniciens/saisie.ts`) : à la **création**, `statut_ressource` est obligatoire, sans valeur choisie d'avance (le menu porte un placeholder désactivé, comme le rattachement à une agence). À la **modification**, « non renseigné » reste posable tant que la question n'a jamais été tranchée pour cette fiche, mais le dépôt (`modifierTechnicien`) refuse de le RE-choisir une fois un statut posé (motif `statut_deja_pose`) — le changement vers l'autre valeur, ou son maintien, reste toujours accepté.
- **Écran Équipe** : colonne « Statut » (badge Salarié / Patente / Non renseigné en gris, sur le modèle du badge Actif/Inactif), champ dans les deux formulaires. Le menu de modification retire lui-même l'option « non renseigné » dès qu'un statut est posé — l'exploitant ne peut pas se tromper par l'écran, et le refus serveur tient la porte pour une requête postée directement.
- **Planning** : un badge court « Patente », et lui seul — rien pour un salarié ni pour un statut non renseigné (choix du pilote : la majorité n'a pas à être marquée). Posé À CÔTÉ du nom, jamais dessous (D111), aux cinq endroits où ce nom se rend (grille et liste de la Semaine, liste et grille du Jour, grille du Mois).
- **Décision** : `docs/arbitrages.md` porte désormais D163, qui consigne QG-9 et les précisions du pilote, et nomme explicitement ce qui reste à trancher (le filtre).
- **Addendum (relecture de 9D3A, hors du périmètre PG-G16 mais demandé dans ce même lot)** : `tests/e2e/planning-technicien-actions-refusees.spec.ts` prenait le même jour ET le même technicien que `planning-jour-en-tete.spec.ts` (`MARDI+112`) — décalé à 119 (libre, vérifié par `grep`) ; ses captures écrivaient `technicien-*`/`adv-*` au lieu de `apres-*` (les six fichiers committés) ; l'épreuve « un TECHNICIEN est refusé » de `deplacer-refus-saisie.test.ts` vivait hors de tout `describe` ; les trois fichiers de porte (`deplacer-refus-saisie`, `transmettre-compte-rendu-route`, `transmettre-trace-erreur`) laissaient un `mockResolvedValueOnce` sur `exigerCapacite` jamais consommé.

## Les captures

`docs/propositions/9DL-PG-G16-STATUT-RESSOURCE/captures/` porte les paires AVANT/APRÈS demandées : Équipe à 1280 et 375 px (liste à 1280, fiche de modification aux deux tailles) et planning Semaine/Jour à 1280 px. L'AVANT a été repris en checkout séparé (`git worktree`) sur le commit précédant ce lot, serveur de production sur un port distinct, contre la même base locale — jamais une capture approchée. **Un trou assumé** : `apres-equipe-liste-375.png` (la liste, colonne Statut comprise, à 375 px) n'a pas été repris — la colonne existe et se lit à 1280 px (`apres-equipe-liste-1280.png`), et le champ se lit à 375 px dans la fiche (`apres-equipe-fiche-375.png`), mais la combinaison des deux n'a pas sa propre capture. Si elle est demandée, elle se reprend en rejouant `tests/e2e/pg-g16-statut-ressource.spec.ts` seul avec `CAPTURES_PG_G16` posé — attention, cela réécrit aussi les AVANT du même nom avec la vue APRÈS : sauvegarder les six fichiers `avant-*` avant de rejouer, ou les reprendre à nouveau depuis le commit précédent.

## Ce que j'ai mesuré

- `pnpm verify` (format:check, typecheck, lint, test, test:isolation, build) **vert en entier**, après rebase sur `origin/main` : 376 fichiers / 4013 tests unitaires, 156 fichiers / 1425 tests d'isolation, build de production sans erreur.
- e2e, joués contre une base locale (`E2E_DATABASE_URL` → `codiplan_test`, port 5433) : les 2 épreuves neuves (`pg-g16-statut-ressource.spec.ts`), les 15 épreuves existantes touchées par ce lot (formulaire de création d'Équipe : `equipe.spec.ts` ×4, `acces-technicien.spec.ts`, `captures-9dja-acces-technicien.spec.ts`, `equipe-agence-inactive.spec.ts`, `equipe-1.spec.ts` ×2) et les épreuves de planning qui rendent le nom aux cinq endroits (`planning-jour-en-tete.spec.ts` ×2, `planning-mois-charge.spec.ts` ×4, `planning-cibles-375.spec.ts` ×2, `planning-charge-technicien.spec.ts` ×6, `planning-jour-frise.spec.ts` ×3, `planning-deux-semaines.spec.ts` ×4, `planning-technicien-actions-refusees.spec.ts` ×2) — **tout vert**, aucune reprise.
- Comptes AVANT/APRÈS : pas de compte chiffré comparable ici (pas de tuile ni de KPI touché par ce lot) — la mesure porte sur le passage de rouge à vert des épreuves listées ci-dessus, chacune rejouée après le changement.
- Vérifié qu'aucune ligne de semis (`prisma/seed.ts`) ni fixture `SCENE.*` partagée n'est touchée par les tests neufs (`tests/isolation/techniciens-statut-ressource.test.ts`, `tests/e2e/pg-g16-statut-ressource.spec.ts`) : scènes propres, préfixées `PGG16-`, créées et retirées par le test lui-même.

## Ce que j'ai tranché, et pourquoi

- **Domaine d'épreuve `@codiplan.test`, jamais `@codima.test`** pour la fixture e2e (`equipe.e2e.courriel_pg_g16`) : le gardien `sans-nom-de-societe.test.ts` ferme son exclusion à `equipe.e2e.courriel` seul, et une seconde adresse « codima » l'aurait fait rougir (mesuré). `@codiplan.test` suit le précédent déjà posé par `planning-4.spec.ts`.
- **Tons de badge Équipe** (bleu = Salarié, vert = Patente, gris = Non renseigné) et **ton du badge planning** (gris) : non spécifiés par le pilote ni par Alexis — choisis pour rester cohérents avec l'emploi existant des cinq tons (`components/ui/badge.tsx`), sans inventer de sixième sens. À ajuster librement si Alexis en décide autrement en validant D163.
- **Vérification de « non renseigné » par relecture de la fiche dans la même transaction que l'écriture** (`modifierTechnicien`), plutôt qu'une contrainte base : même précédent exact que le contrôle d'agence inactive (AA-3), pour la même raison — la fenêtre entre lecture et écriture doit être fermée par la transaction, pas par une seconde lecture séparée.
- **`vi.clearAllMocks()` ne suffit PAS** à vider la file d'un `mockResolvedValueOnce` jamais consommé (mesuré empiriquement : un mock cleared puis rappelé rend encore la valeur « once » laissée en attente) — j'ai remplacé la suggestion du ticket par `mockReset()` suivi de la ré-application explicite du contexte ADV par défaut, dans un `afterEach` scopé à la description concernée.

## Ce que je n'ai PAS fait

- **Le filtre du planning par statut de ressource** — explicitement hors du périmètre de ce lot (voir le commentaire de `app/(back-office)/planning/page.tsx` cité dans D163) ; la question reste posée à Alexis.
- **Aucune valeur n'est reconstituée** pour les techniciens déjà en base — ils restent « non renseigné ».
- **Aucune autre colonne** de la fiche technicien n'a été ajoutée ou touchée.
- **Aucune politique RLS** n'a été levée ni posée — la colonne suit le cloisonnement déjà tenu par `cloisonnement_societe` sur `technicien`.
- **Le cahier des charges (chapitre 11)** n'a pas été modifié : le gardien `scripts/lib/modele-de-donnees.ts` n'exige que le NOM de la table (déjà présent), jamais la liste de ses colonnes — aucune mise à jour n'était due.
- **`prisma/seed.ts`** n'a pas été touché : aucune ligne de semis pour ce lot.

## Les pièges pour la session suivante

- **`getByText(NOM, { exact: true })` sur la page `/planning` remonte aussi l'OPTION (invisible) du filtre « technicien » de la barre d'outils**, qui porte le même nom que celui rendu dans la grille — `page.locator("td, th, p, li").filter({ hasText: NOM })` est le contournement utilisé ici ; sans lui, `.first()` pointe souvent sur l'élément invisible et `toBeVisible()` échoue.
- **La VueSemaine (et la VueJour) rendent LA GRILLE ET LA LISTE MOBILE SIMULTANÉMENT dans le DOM**, quel que soit le viewport — seules des classes `lg:hidden` / `hidden lg:block` les masquent en CSS. Un `getByText(...).first()` sans restriction de type d'élément peut donc pointer sur l'élément masqué si son ordre DOM précède le visible.
- **`vi.clearAllMocks()` ne vide pas la file d'un `mockResolvedValueOnce` posé mais jamais appelé** — mesuré dans ce lot. Si une future épreuve pose un mock « once » sur une fonction qu'une route pourrait ne JAMAIS appeler (cas de régression hypothétique testé), prévoir `mockReset()` + ré-application du défaut dans un `afterEach`, jamais `clearAllMocks()` seul.
- **Les captures AVANT/APRÈS non gardées par un `CAPTURES_*` env var se régénèrent à CHAQUE exécution de la suite e2e** (`planning-technicien-actions-refusees.spec.ts` notamment) — elles changent de contenu (octets) à chaque run parce que la scène dépend de la date du jour. Ne pas s'alarmer d'un `git status` qui les montre modifiées après un simple test local ; les committer seulement quand le changement est VOULU (ici : le décalage de jour de l'addendum), jamais après une relance incidentelle.
- **D163 est RÉSERVÉ** pour ce lot (pilote, 04/10) — si un futur lot cherche « le prochain numéro libre », il doit savoir que D163 est pris.

## Ce qui reste à faire

- **Le filtre du planning par statut de ressource** (voir D163, "CE QUE ÇA NE TOUCHE PAS") — attend la décision d'Alexis.
- **D163 reste à valider par Alexis**, comme les autres décisions issues des précisions du pilote du 03/10/2026 — notamment l'irréversibilité de « non renseigné » une fois un statut posé, et le choix de ne marquer que « Patente » au planning.
- **RELEASE-1** : la migration `20261005100000_pg_g16_statut_ressource` attend `pnpm db:deploy` en production, par Alexis.
