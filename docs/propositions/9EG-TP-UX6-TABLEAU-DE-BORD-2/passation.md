# 9EG-TP-UX6-TABLEAU-DE-BORD-2 — passation

Mesuré sur main 9a692366 au départ ; sept commits livrés, le dernier 4c2de564.
`CI=1 pnpm verify:full` rejoué EN ENTIER après le dernier commit : vert (format, typecheck,
lint, 4585 tests unitaires, 1524 tests d'isolation contre une vraie base PostgreSQL, build de
production, horizon des fériés, audit des partitions, 1190 épreuves de bout en bout passées —
48 volontairement ignorées, 0 échec).

## Ce que j'ai changé, et ce que ça change pour l'exploitation

- **Direction** a désormais son propre tableau de bord : tuiles « Clôturé en \<mois\> »
  (décompte, aucun montant), « En retard », « Parc suivi » ; un bloc « \<Mois Année\>, au
  JJ/MM » (créées, clôturées, clôturées par nature) ; les Priorités réduites à
  Urgences/Retards/Pièces ; la Charge des 4 prochaines semaines ; un décompte de bande
  « P1 à planifier ». Avant ce lot, la direction voyait l'écran de l'ADV.
- **Administrateur de société** a désormais son propre tableau de bord : tuiles « Accès à
  ouvrir », « Données à compléter », « Import en contrôle », « Parc suivi » ; une bande avec
  habilitations expirées et à renouveler (60 j) ; un bloc « Accès à ouvrir » qui permet
  d'envoyer ou de renvoyer un lien d'accès SANS quitter le tableau de bord ; un bloc
  « Données à compléter » ; un bloc « Mise en route » — huit étapes qui disent à
  l'administrateur ce qu'il reste à paramétrer avant que la société soit opérationnelle,
  chacune cliquable vers son écran. Aucune carte Priorités pour ce rôle.
- **Les deux** partagent un bloc « Journal d'aujourd'hui » (les 5 dernières écritures d'audit
  du jour, puis un compte), visible seulement si le rôle a la capacité
  `consulter_journal_audit` (ADMS, DIR) — c'est la PREMIÈRE lecture du journal d'audit
  depuis n'importe où dans l'application ; avant ce lot, `journal_audit` était protégé par
  sa politique RLS mais jamais lu par aucun écran.
- `/parametres/equipe` accepte deux nouveaux paramètres de lecture, `?acces=a-ouvrir` et
  `?echeance=expiree|j60`, qui filtrent la liste déjà affichée — aucun droit, aucune route
  d'écriture changée.
- Trois icônes neuves (`key`, `database`, `coins`), transcrites de la même planche que les
  icônes existantes.

## Ce que j'ai mesuré

- **Unitaire** (52 tests neufs, `tests/unit/tableau-de-bord/presentation.test.ts`) : les
  tuiles par composition, les huit étapes de « Mise en route » (chaque critère seul
  manquant laisse SEULEMENT son étape non faite, prouvé un par un), la jauge « N sur 8 »,
  le libellé « Clôturé en \<mois\> », les barres « par nature », le détail « Accès à
  ouvrir », la bande de l'administrateur, le journal (entité connue/inconnue, action,
  lien de fiche, compte).
- **Isolation** (4 tests neufs, `tests/isolation/9eg2-tableau-de-bord.test.ts`, contre un
  vrai PostgreSQL) : une société VIERGE montre `1 sur 8` pour « Mise en route » (l'identité
  seule) ; la société B ne lit ni les techniciens ni les comptes de la société A (RLS +
  `societe_id` explicite) ; une écriture de journal fraîche est INVISIBLE sous ADV
  (0 lignes, 0 compte — la politique RLS refuse) et VISIBLE sous direction, pour la MÊME
  ligne (comparée par son `id` propre, lue sans politique côté témoin).
- **Bout en bout** (16 tests neufs, `tests/e2e/9eg2-tableau-de-bord-direction-admin.spec.ts`,
  fixture propre préfixée `9EG2-`, jamais `SCENE.*`) : chaque tuile et chaque bloc comparés
  au contenu RÉEL de la liste que son lien ouvre — la tuile « Clôturé en \<mois\> » ouvre le
  registre et y trouve la fiche clôturée du jour ; la tuile « Accès à ouvrir » ouvre
  `/parametres/equipe?acces=a-ouvrir` et y trouve exactement le technicien de l'épreuve ; la
  tuile « Import en contrôle » ouvre `/imports?vue=a-appliquer` et y trouve le lot de
  l'épreuve ; la bande habilitations ouvre `?echeance=expiree` puis `?echeance=j60` et nomme
  le même technicien dans les deux cas (deux habilitations distinctes, l'une expirée, l'autre
  à J+30) ; « Mise en route » montre `5 sur 8` sur la société de démonstration (8 liens
  cliquables) ; le bouton « Envoyer le lien » est bien scopé à la ligne du technicien visé
  (quatre lignes dans le bloc, dont trois « Renvoyer le lien » déjà posées par le semis). Les
  14 épreuves du lot -1 (`9eg1-tableau-de-bord-roles.spec.ts`,
  `tableau-de-bord-liens-tuiles.spec.ts`) et les épreuves `equipe.spec.ts` restent vertes.
  Captures APRÈS SEULEMENT (quatre écrans, 1280 et 375 px,
  `docs/propositions/9EG-TP-UX6-TABLEAU-DE-BORD-2/captures/`, README à l'intérieur) — pas
  d'« avant » comparable, ces deux écrans sont neufs.

## Ce que j'ai tranché, et pourquoi

- **Catégorie « Équipe » des Priorités (RM, habilitations) — NON FAITE.** `ElementPriorite.
  href` est un champ requis dans tout le module, et D153 demande que le responsable matériel
  n'ait NI lien NI action sur ces lignes. Aucune des deux solutions qui s'offraient
  (rendre `href` optionnel partout, ou poser un lien inerte) n'était faisable sans trancher
  une question de conception hors du périmètre mesuré de ce lot — un lien inerte aurait de
  plus heurté le gardien « plus de zones inertes ». Nommé en D189, jamais bricolé.
- **Le lien de la bande « P1 à planifier » reste `/planning?priorite=p1&statut=a_planifier`**
  (tel que le ticket le demande), bien que l'épreuve ait RÉVÉLÉ que ces deux paramètres ne
  filtrent pas la file « à planifier » du planning (`cartesFile` = `attenteParZone`, filtrée
  par zone/recherche seulement — `app/(back-office)/planning/page.tsx:1124-1152`). Je n'ai
  pas touché `lib/interventions`/`app/(back-office)/planning` pour corriger ce décompte :
  c'est une règle de gestion du planning, hors périmètre de ce lot (« aucune regle de
  gestion ne change »). Nommé en D189 et dans l'épreuve elle-même.
- **Dictionnaire des entités du journal partiel** (dix entités nommées : intervention,
  demande, client, machine, utilisateur, technicien, habilitation, import, absence,
  contact) — le périmètre d'audit (I8) est INVERSÉ et donc ouvert ; énumérer les ~37 tables
  qu'il couvre aurait dépassé la portée mesurée, et le filet (nom de table brut) est prévu
  par le ticket lui-même.
- **« Agence »/« Site » absents du dictionnaire des entités du journal**, délibérément : les
  y écrire aurait rouvert le gardien du vocabulaire imposé (D5/D47) sur une valeur de
  dictionnaire, pour un gain cosmétique seul — ces deux entités tombent donc sur le filet
  (nom de table brut : `agence`, `site`).
- **Accord de genre des libellés d'action du journal** (« créée »/« modifiée »/« supprimée »)
  — féminin fixe, fautif pour une entité masculine (Import, Contact, Utilisateur,
  Technicien). Aucun gardien ne le voit ; corriger aurait demandé une table de genre par
  entité, non mesurée.
- **`Jauge` est un composant neuf et minimal** (`components/tableau-de-bord/jauge.tsx`) :
  D185 n'en posait aucun. L'étiquette dit toujours « N sur 8 », jamais un pourcentage seul
  (D56, R2-13).
- **Captures après seulement**, pas avant/après : les deux écrans sont neufs (avant ce lot,
  direction et administrateur voyaient l'écran de l'ADV, déjà photographié par le lot -1) —
  même choix et même justification que la propre recette de captures du lot -1
  (`captures-9eg1-tableau-de-bord.spec.ts`).

## Ce que je n'ai PAS fait

- La catégorie « Équipe » des Priorités pour le responsable matériel (voir ci-dessus).
- Une page « Journal d'audit » complète — aucune n'existe, et l'addendum du 05/10/2026 qui
  en nommait une est sans effet tant qu'elle n'existe pas (nommé dans D189).
- « À facturer », « site sans trajet connu », « Heures au compteur », tout montant — aucune
  lecture, comme le corps du ticket le prévoyait.
- Correction du décompte de la file « à planifier » de `/planning` pour qu'elle respecte
  `priorite`/`statut` (voir « ce que j'ai tranché »).
- L'accord de genre des libellés du journal.
- Un dictionnaire exhaustif des entités du journal.

## Les pièges pour la session suivante

- **`pnpm sommaires:regenerer` doit parfois tourner DEUX FOIS** : ajouter des lignes au
  sommaire d'un fichier change sa propre longueur, ce qui décale tout ce qui suit — y
  compris le corps que le premier passage vient de recalculer. Un second passage atteint le
  point fixe ; `tests/unit/docs/constitution-indexee.test.ts` le détecte si on s'arrête au
  premier.
- **Les gardiens `roles-sans-chaine-libre` et `sans-chaine-visible-en-dur` scannent AUSSI
  `tests/e2e/`** — un `test.describe("direction", …)` ou un nom de fixture écrit en dur dans
  un `page.getByText(...)` les fait rougir. `pnpm typecheck`/`pnpm lint` ne les voient PAS :
  seul `pnpm test` (ou `CI=1 pnpm verify:full`) les prend. Je les ai manqués une première
  fois en ne lançant que typecheck/lint sur le fichier neuf — `CI=1 pnpm verify:full` joué
  en entier à la fin les a rattrapés.
- **`famillesADeterminer` (`lib/vgp/registre.ts`) n'accepte aucun `client`** : tout code qui
  l'appelle (directement ou via `lib/tableau-de-bord/mise-en-route.ts`/`lectures.ts`) passe
  par le client global de `lib/db/client.ts`, qui exige `DATABASE_URL`. Dans un test
  d'isolation, poser `process.env.DATABASE_URL = urlApp()` AVANT un `await import(...)`
  dynamique du module (modèle `tests/isolation/vgp-client-inactif-machine-sortie.test.ts`),
  jamais un import statique en tête de fichier.
- **La file « à planifier » de `/planning` n'est pas filtrable par `priorite`/`statut`** —
  voir « ce que j'ai tranché ». Une session qui veut corriger ce décompte touche
  `cartesFile`/`attenteParZone`, `app/(back-office)/planning/page.tsx:1124-1152`, et c'est un
  changement de règle de gestion du planning (point d'arrêt §8).
- `equipe-1.spec.ts` est flaky SOUS `fullyParallel` avec `equipe-agence-inactive.spec.ts`
  (les deux manipulent des sites sur la même société en parallèle) — pré-existant, mesuré,
  sans rapport avec ce lot (passe seul à chaque fois).

## Ce qui reste à faire

- Catégorie « Équipe » des Priorités pour le responsable matériel (trancher d'abord la
  question de conception sur `ElementPriorite.href`).
- Page « Journal d'audit » complète, si elle est décidée.
- Dictionnaire exhaustif des entités du journal, et son accord de genre.
- Corriger le décompte de la file « à planifier » du planning pour qu'il respecte
  `priorite`/`statut` — ou documenter que c'est le lien de la bande qui doit changer plutôt
  que le planning (question pour Alexis, §8).
- Les dix points de « Données à compléter » (décision 44 d'Alexis) — ce lot en garde
  quatre, les mêmes que 9DT.
