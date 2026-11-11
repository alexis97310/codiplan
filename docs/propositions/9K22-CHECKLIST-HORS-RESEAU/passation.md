# 9K22-CHECKLIST-HORS-RESEAU — passation

**Garde levée : un gabarit peut désormais être créé en production.** La garde
de mise en production posée par 9K21 (« aucun gabarit créé en production
avant que la saisie hors réseau soit publiée ») est tenue : CK6 porte le
gabarit et les réponses dans l'instantané, et la coquille `/terrain-hors-
reseau` affiche et saisit la même tuile checklist qu'en ligne.

## Ce que CK6 ajoute à l'instantané (`app/api/terrain/instantane/route.ts`)

`FicheJSON` gagne `checklist` — `{ disponible: false }`, exactement comme
`ChecklistDeLIntervention.disponible` (`lib/checklists/depot.ts`), ou
`{ disponible: true, checklistVersionId, reponses }` où `reponses` est un
`Record<checklistPointId, valeur>` **par point RÉPONDU seulement** (absent =
pas encore répondu, jamais `null` en valeur — IndexedDB/`JSON.stringify` ne
porte que des objets simples, même discipline que `GesteChecklist.difference`,
9K21).

**Les POINTS ne voyagent PAS par fiche.** `InstantaneJSON` gagne
`checklistModeles: Record<checklistVersionId, { libelle, points }>` — une
version RÉSOLUE par plusieurs fiches de la journée (un modèle générique, ou
plusieurs interventions sur la même machine) n'y figure qu'une fois, même
discipline que `catalogue` pour les prestations. *Mesuré* : répéter les points
par fiche aurait multiplié une structure de taille non négligeable (jusqu'à
quelques dizaines de points) par le nombre d'interventions de la journée pour
un gain nul — la clé de dédoublonnage (`checklistVersionId`) existe déjà et
coûte une ligne de `Record`.

`valeurChecklistAffichee` (composait la réponse serveur en valeur affichable,
une seule colonne non nulle par réponse, I1 §3) était définie EN PRIVÉ dans
`app/(mobile)/terrain/[id]/page.tsx` — 9K21 ne l'avait pas partagée faute
d'un second appelant. CK6 en a un : extraite vers `lib/checklists/
presentation.ts`, importée par les deux (§9, 01/09 — deux lectures de la même
réponse qui pourraient diverger).

## Ce que CK6 N'ajoute PAS à `lib/terrain/copie-locale.ts`

**Rien.** `ecrireCopie`/`lireCopie` écrivent/lisent l'objet JSON REÇU tel
quel, sans schéma ni validation de forme (voir l'en-tête du fichier) — le
gabarit et les réponses voyagent donc dans l'instantané SANS AUCUN changement
à ce fichier, exactement comme `catalogue` ou `prestationsRealiseesIds`
avant eux (9F4H6).

## La coquille — `components/terrain/consultation-hors-reseau.tsx`

**LA MÊME TUILE que 9K21, réutilisée, jamais recopiée** : `ChecklistTerrain`
ne fait jamais de `fetch` (voir son en-tête) — chaque réponse rejoint la file
hors réseau de CET appareil par `ajouterSaisie`, qu'il y ait ou non une
session. Aucune adaptation du composant n'était due ; seule sa COMPOSITION
(quelles props, depuis quelle donnée) est neuve ici, posée au même
emplacement que `/terrain/[id]` (après la panne signalée, avant le rapport).

`pointsChecklistDeLaFiche` (local à `consultation-hors-reseau.tsx`, même
idiome que `pointsChecklist` dans `page.tsx`) compose les points du modèle
résolu (`checklistModeles[checklist.checklistVersionId]`) avec la réponse
déjà connue (`checklist.reponses[point.id] ?? null`) — si le modèle référencé
est absent de la copie (jamais vu, ou copie corrompue), la tuile ne se rend
pas du tout : le même repli qu'une intervention sans gabarit résolu.

### Tolérance à l'ancienne copie (`lib/terrain/copie-validee.ts`)

Une copie écrite par un appareil AVANT ce lot ne porte ni `fiche.checklist`
ni `copie.checklistModeles` — deux nouvelles fonctions, même discipline que
`catalogueDeLaCopie`/`prestationsRealiseesDeLaFiche` (9F4H6A) :
`checklistDeLaFiche` (absent/mal formé → `{ disponible: false }`, la tuile ne
se rend pas) et `checklistModelesDeLaCopie` (absent → `{}`, un MODÈLE mal
formé ou introuvable est écarté sans faire lever tout l'objet, un POINT mal
formé à l'intérieur d'un modèle valide est écarté sans écarter tout le
modèle).

## L'épreuve mode avion — `tests/e2e/9k22-checklist-hors-reseau.spec.ts`

**Deux APPAREILS de la MÊME identité, jamais deux comptes.** L'écriture
d'une réponse checklist (`enregistrerReponses`, `lib/checklists/depot.ts`)
juge `accesSurCetteIntervention(..., "saisir_rapport", intervention.
technicien_id)` — restreint au SEUL technicien affecté (D151, « le renfort
pointe, il n'écrit pas le rapport d'autrui » :
`tests/isolation/9dc-renfort-saisir-rapport.test.ts`). Deux COMPTES
différents auraient donné au second un refus D'ACCÈS, jamais `checklist.
refus.point_hors_version` — le motif que ce ticket demande d'éprouver
explicitement. La seule façon d'obtenir CE refus précis en gardant l'accès
valide est que les deux appareils portent la MÊME identité : deux sessions
indépendantes du même compte (deux contextes Playwright, chacun son
IndexedDB), exactement ce qu'un technicien avec un téléphone ET une tablette
ferait.

Scénario : l'appareil A synchronise sa copie (`/terrain/<id>` en ligne)
pendant que la V1 (un point) est la seule version publiée du modèle
GÉNÉRIQUE de l'épreuve, puis passe hors réseau et répond à SON point.
L'atelier republie ensuite une V2 (un AUTRE point — `checklistPoint` ne
partage jamais sa ligne entre deux versions, I1 §3) ; l'appareil B
synchronise APRÈS cette republication, passe hors réseau à son tour et
répond au point de V2. Au retour du réseau pour les deux : B envoie («
Envoyer » sur `/terrain`, générique, 9F4H3) sans accroc et fige V2
(`enregistrerReponses` résout toujours la DERNIÈRE version publiée tant
qu'aucun pin n'existe, quelle que soit la copie locale de l'appareil qui
écrit) ; A est refusé EN CLAIR — `checklist.refus.point_hors_version`
visible via `LigneRefus`/`BoutonEnvoyer`, sa saisie reste dans sa file
(bouton « Retirer cette saisie », jamais retiré automatiquement), encore
visible après un rechargement de la page (I5 : le travail du technicien
n'est jamais perdu en silence). Vérifié en base : une seule
`checklistReponse` (celle du point de V2), `intervention.
checklist_version_id` = V2.

L'intervention de la scène est créée `date_planifiee: null` (« file
d'attente ») plutôt qu'à une date fixe comme `9k21-checklist-terrain-
saisie.spec.ts` : cette dernière lit la fiche DIRECTEMENT
(`lireFicheIntervention`, aucune fenêtre de date), quand CK6 dépend en plus
de `/api/terrain/instantane` pour peupler la copie hors réseau, et
`listerPlanning` ne retient les lignes DATÉES que dans une fenêtre
[aujourd'hui, +8 jours[ — une date fixe y tombe hors champ un jour sur sept.

Captures 375/1280 : la tuile dépliée hors réseau (avant l'envoi), et le refus
affiché en clair (après l'envoi d'A) — aucune capture AVANT, cet écran
n'existait pas avant ce lot.

## Vérification

`CI=1 pnpm verify` : format, typecheck, lint, test (5703 passés), test:isolation,
build — tous verts. `pnpm chemins` : 0 écart. `tests/e2e/tous-les-ecrans-
rendent.spec.ts` : vert (61 passés, 4 ignorés comme avant ce lot).
`pnpm vitest run tests/e2e/9k22-checklist-hors-reseau.spec.ts` (hors
`verify`, joué manuellement ici via `playwright test`) : 1 passé.
`verify:full` est laissé à la file de nuit.

## Ce qui reste dû

CK7 (le blocage de « Terminer » sur un point obligatoire manquant, lira
`EtatCompletude.obligatoiresManquants`) ; CK9. Rien n'est dû à `lib/terrain/
copie-locale.ts` ni à `lib/terrain/file-saisies.ts` — tous deux déjà prêts
depuis 9K21.
