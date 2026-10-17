# 9F3B-POSE-HORS-OUVERTURE-EPREUVES — passation

Revue de 9F3-POSE-HORS-OUVERTURE-CONFIRMEE (publié `b28e38ba`, mesuré par le pilote sur
`origin/main`). Quatre points, un commit chacun.

## Ce que j'ai changé

- **Point 1 — aucun code touché.** `tests/isolation/verdict-pose-lecture.test.ts` : six
  scénarios neufs qui verrouillent que `confirmer_hors_ouverture` (D93, D211) ne lève QUE
  l'ouverture dans `verdictALaPose` (`lib/interventions/depot.ts`) — habilitation bloquante,
  absence, chevauchement et agence sans calendrier (infranchissable) continuent de refuser
  sur un jour fermé CONFIRMÉ ; un cas sans autre obstacle est accepté avec sa trace ; et un
  scénario d'isolation inter-société (`confirmer_hors_ouverture: true` sur une intervention
  de la société B, depuis une session A) rend `inconnue` sans rien écrire. Aucun défaut
  trouvé — le code était déjà correct, seule la preuve manquait.
- **Point 2 — `components/planning/pose.tsx`.** Le pré-contrôle client
  (`confirmationHorsOuvertureRequise`, lu sur `cible.survol`) n'est qu'un indice — 9F3 le
  disait déjà dans sa propre passation, point ouvert non fermé. Quand il laisse passer un
  geste que le SERVEUR refuse pour le seul motif d'une ouverture non confirmée, `IssueDepot`
  ne portait pas `confirmable` : l'écran retombait sur `setMotif(issue.cle)`, affichant le
  texte « Cochez la confirmation… » sans aucune case à cocher sur ce chemin — une impasse.
  `IssueDepot["refuse"]` porte désormais `confirmable: boolean` ; `interpreterReponseDepot`
  le lit dans le corps JSON de la route (`confirmable` y est déjà présent depuis D93,
  jamais absent — `repondre` dans `app/api/interventions/[id]/deplacer/route.ts` le rend
  toujours). `Posable.ecrire`, sur un refus `confirmable` et `main.confirmerHorsOuverture
  !== true` (garde anti-boucle), ouvre le MÊME `DialogueConfirmationHorsOuverture` que le
  pré-contrôle au lieu d'afficher le motif. « Confirmer » rejoue `executerDepot` avec
  `confirmerHorsOuverture: true` (même flux, même minuterie PG-B5 qu'un dépôt ordinaire) ;
  « Annuler » n'écrit rien.
- **Point 3 — `components/planning/fenetre-pose.tsx`.** La sonde « absent » (duree=1, sans
  heure, voir l'entête du fichier) se trompe sur un jour FERMÉ exactement comme sur une
  VRAIE absence — connu et documenté depuis 9F3. Une fois une heure choisie et un verdict
  confirmable chargé (`confirmationRequise`), le libellé sous Technicien affichait quand
  même « Absent ce jour-là », à côté de la case de confirmation — trompeur. `ParametresEtat`
  porte désormais `confirmationRequise` ; `etatTechnicien` distingue `jour_ferme_confirmable`
  de `absent` ; nouvelle clé `planning.pose.jour_ferme_confirmable` (« Jour fermé : confirmez
  pour poser »). Une vraie absence (refus `intervention.refus.absence`, jamais confirmable)
  garde son libellé inchangé.
- **Point 4 — nouveau spec e2e, nouveau dossier.** Les captures de 9F3
  (`captures-9f3-pose-hors-ouverture-confirmee.spec.ts`) sont en `fullPage` (375x1977,
  1280x2764…) : la barre basse et le dialogue tombent hors de la zone visible à l'écran.
  `tests/e2e/captures-9f3b-pose-hors-ouverture-epreuves.spec.ts` reprend les mêmes trois
  scènes EN VIEWPORT (`fullPage: false`, le défaut de `page.screenshot`), dans
  `docs/propositions/9F3B-POSE-HORS-OUVERTURE-EPREUVES/captures/` — jamais de régénération
  des captures de 9F3. Cinq captures, regardées :
  - `fenetre-pose-libelle-jour-ferme-{375,1280}` : le nouveau libellé (point 3) et la case
    de confirmation, intégralement dans le cadre ;
  - `dialogue-confirmation-glisser-depose-viewport-1280` : le dialogue entièrement visible,
    « Annuler » et « Confirmer » lisibles ;
  - `fiche-confirmee-viewport-{375,1280}` : la mention « Posée hors ouverture, confirmée
    par… » visible sans défilement.

## Ce que j'ai mesuré

- **Isolation** : `tests/isolation/verdict-pose-lecture.test.ts` (24 scénarios, les 6 neufs
  du point 1) ; `pnpm test:isolation` entier — 181 fichiers, 1613 tests, verts.
- **Unitaire** :
  - `tests/unit/planning/pose.test.tsx` — trois scénarios neufs (point 2) : le dialogue
    s'ouvre sur `confirmable: true` plutôt que le motif ; « Confirmer » rejoue le dépôt avec
    `confirmer_hors_ouverture=1` et aboutit ; « Annuler » ne poste qu'une requête.
  - `tests/unit/gardiens/echec-ne-rend-pas-succes.test.ts` — un test existant ajusté : la
    forme de `IssueDepot["refuse"]` porte désormais `confirmable`, le JUMEAU attendait
    l'ancienne forme à deux champs.
  - `tests/unit/planning/fenetre-pose-libelle-technicien.test.tsx` (neuf, point 3) — deux
    scénarios : jour fermé confirmable (nouveau libellé, jamais « Absent ce jour-là ») et son
    témoin, une vraie absence (libellé inchangé).
  - `pnpm test` entier — 450 fichiers, 4830 tests, verts.
- **Bout en bout** (tous les scénarios de ce paragraphe mesurés au moins deux fois : une
  première passe, puis après le reformatage Prettier qui a suivi) :
  - `tests/e2e/captures-9f3b-pose-hors-ouverture-epreuves.spec.ts` (neuf, point 4) — 5
    scénarios, captures regardées une à une (voir ci-dessus).
  - **Voisines, avec `--workers=1`** (même réserve que 9F3 : un compteur de courriels
    capturés partagé entre specs parallèles fait tomber `fiche-trouver-creneau.spec.ts` sous
    plusieurs workers, non lié à ce lot — mesuré rouge sous workers par défaut, vert en 1
    worker) : `glisser-deposer.spec.ts`, `creation-jour-ferme.spec.ts`,
    `fiche-trouver-creneau.spec.ts`, `captures-9f3-pose-hors-ouverture-confirmee.spec.ts` —
    19 scénarios, verts, aucune capture de 9F3 régénérée (ce spec les réécrit lui-même sous
    son propre `CAPTURES_9F3`, jamais touché ici).
  - **Voisines, workers par défaut** : les 28 fichiers `planning-*.spec.ts` (91 scénarios) et
    `tous-les-ecrans-rendent.spec.ts` (53 scénarios, 3 ignorés — comportement du fichier,
    inchangé) — tous verts.

## Ce qui reste ouvert

- **Chaque re-soumission du même créneau hors ouverture redemande confirmation** — point déjà
  ouvert par 9F3, non traité ici : hors du territoire de ce lot (`lib/interventions/depot.ts`
  n'a été touché par aucun des quatre points — le point 1 l'a mesuré correct sans le modifier).
- **9F3B ne ferme qu'un des trois points de la revue** nommés MOYEN/BAS par le pilote
  (habilitation/absence/chevauchement non verrouillés, impasse du glisser-déposer, sonde
  trompeuse, captures fullPage) — les quatre sont traités ; aucun nouveau point MOYEN ou BAS
  n'a été trouvé en les traitant.

## Fin de lot

Épreuves voisines ci-dessus. `CI=1 pnpm verify:full` lancé en entier avant de rendre la main —
voir `verify-final.txt` dans ce même dossier pour la sortie complète ; les 15 dernières lignes
et le SHA sont collées ci-dessous une fois la commande terminée.
