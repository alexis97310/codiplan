# 9F4H4B-OUVERTURE-A-FROID — passation

T0 = 18:57 (Pacific/Noumea). `9F4H3-HORS-RESEAU-ENVOYER` (`fe2bbf42`) et `9F4H3AB-REPRISE-9F4H3A`
(`c39b6332`) sont bien présents sur `origin/main` au démarrage (mesuré) ; `HEAD` local était déjà plus loin
(`9F4H3AC-FILE-CORRECTIFS-REVUE`, `040d632b`), ce qui ne contredit pas la garde.

## Ce qui a été mesuré en premier (avant d'écrire du code)

- `FicheJSON`/`InstantaneJSON` (`app/api/terrain/instantane/route.ts`) : le catalogue des prestations N'Y EST
  PAS — seulement `prestationsRealisees: readonly string[]` (des LIBELLÉS, sans `id`). Ni `minutesConnues`
  (minutes déjà mesurées côté serveur) ni `segmentOuvertConnu` (un segment déjà ouvert sur un AUTRE appareil
  de la même personne) n'y sont non plus. Cette route est hors territoire de ce lot (`app/api/**` exclu) —
  impossible de les y ajouter ici.
- `lib/terrain/file-saisies.ts` (9F4H3) : la file est déjà cloisonnée par IDENTITÉ
  (`utilisateurId`+`societeId`), jamais par session — exactement ce dont une fiche SANS session a besoin.
- Mesuré en écrivant le point 0 : `compteur-terrain.tsx` et `rapport-automatique.tsx` envoient déjà
  `operation_id`+`instant_appareil` dès le TOUT PREMIER essai EN LIGNE (9F4H2, pour le rejeu lie-fi) — les
  routes `compteur`/`terminer` traitaient alors systématiquement cette paire comme une saisie DIFFÉRÉE,
  marquant `saisi_hors_reseau` et refusant un téléphone en avance de plus de 5 min même EN LIGNE. Confirmé par
  l'addendum du pilote, corrigé au point 0.
- Mesuré en écrivant le point 4 : démarrer puis terminer en quelques secondes, sans antidater, donne une durée
  réelle quasi nulle une fois la file réellement envoyée — `peutTerminer` refuse alors `temps_manquant` côté
  SERVEUR, même si le verdict LOCAL (qui traite un segment encore ouvert comme « au moins une minute ») avait
  laissé passer la mise en file. Même antidatation de 90 min que `9f4h3-mode-avion.spec.ts`.

## Ce qui est livré, point par point

**Point 0 (addendum n°1)** — `depuis_file` (`lib/interventions/saisie-differee.ts`, optionnel, vrai par
défaut pour garder l'ancien contrat des épreuves d'isolation de 9F4H2 qui appellent le dépôt directement),
posé UNIQUEMENT par `lib/terrain/envoi-file.ts`. Les routes `compteur`/`terminer` le lisent du formulaire ;
les dépôts (`lib/interventions/depot-compteur.ts`, `lib/interventions/depot-rapport-terrain.ts`) ne marquent
`saisi_hors_reseau` et n'utilisent l'heure de l'appareil QUE si `depuisFile` est vrai — le rejeu par
`operation_id`, lui, reste valable dans tous les cas (inchangé). Épreuve d'isolation neuve :
`tests/isolation/9f4h4b-depuis-file.test.ts` (5 cas).

**Point 1** — `components/terrain/copie-locale.tsx` pose, une fois par montage EN LIGNE, un `<iframe>`
invisible vers `/terrain-hors-reseau` : la vraie navigation de document qu'il déclenche fait suivre ses
`<script src>`, chacun passant par le service worker comme une ressource statique ordinaire
(`public/sw.js` n'a PAS été modifié — inutile, voir le docblock de `PrechargementCoquille`). Jamais
`router.prefetch()` : la charge utile RSC qu'il demanderait écraserait le document HTML complet que le repli
hors réseau sert ensuite. Épreuve : `tests/unit/terrain/prechargement-coquille.test.tsx`.

**Point 2** — `components/terrain/consultation-hors-reseau.tsx` : la fiche réutilise `BoutonCompteurTerrain`,
`RapportTerrainAutomatique` (rapport, signature, « Terminer ») et `PhotosTerrain`, sous l'identité de
l'instantané. `RapportTerrainAutomatique` reçoit un nouveau prop optionnel, `catalogueIndisponibleHorsReseau`
(`false` par défaut, aucun changement en ligne), qui remplace « Aucune prestation n'est définie… » par un
message honnête quand le catalogue n'a simplement pas pu être emporté. Trois valeurs par défaut documentées
dans le docblock de `Fiche` : `minutesConnues=0`, `segmentOuvertConnu=null`, `ici=false` — toutes ne peuvent
produire qu'un refus LOCAL trop prudent, jamais un geste accepté à tort (le serveur reste l'arbitre final à
l'envoi réel, comme D215 le pose déjà). Épreuve : `tests/unit/terrain/fiche-hors-reseau-travail.test.tsx`.

**Point 3** — `LienRetourSelonReseau` (même fichier), même mécanisme online/offline que `BandeauReseau` :
visible seulement quand `navigator.onLine` redevient vrai, mène à `/terrain`. La reprise par la même identité
après une reconnexion est déjà garantie par le cloisonnement par identité de la file — rien de neuf à
construire pour ce sous-point.

**Point 4** — `tests/e2e/offline/9f4h4-ouverture-a-froid.spec.ts`, scène dédiée (préfixe `9F4H4B-`). Parcours
complet : connexion → passage en ligne sur `/terrain` (pose l'instantané et la coquille) → nouvelle page →
hors réseau → navigation directe vers `/terrain-hors-reseau` → fiche → démarrer, rapport, photo, signature,
terminer → RECHARGE hors réseau (tout est encore là, vérifié en IndexedDB ET à l'écran) → réseau rétabli →
`/terrain` → Envoyer → en base : un seul segment `saisi_hors_reseau`, rapport, photo, signature, statut
Terminée. Une deuxième portion de la même épreuve couvre « sans instantané » (message existant de 9F4H1,
aucun bouton), par déconnexion en ligne puis coupure (même technique que `9f4h1-consultation.spec.ts`, pour
garder le service worker déjà posé). **Passe.**

**Point 5** — Trois captures (375/1280), toutes regardées et décrites dans le message du commit du point 5.

**Point 6** — `docs/arbitrages.md` D216 (amende D213) ; précision sous D214 pour le correctif du point 0 ;
`docs/backlog.md` L3-07 et L3-08 mis à jour (empreintes recalculées par le gardien
`tests/unit/docs/coherence-backlog.test.ts`, qui donne lui-même la valeur attendue — aucune devinée) ;
`tests/unit/docs/amendements-arbitrages.test.ts` étendu de l'entrée `["D213", "D216"]` (liste déclarative
close, pas un assouplissement — le gardien continue d'exiger une correspondance EXACTE) ; l'ancienne
passation `9F4H4-HORS-RESEAU-OUVERTURE-A-FROID/passation.md` pointe désormais ici.

## CONTRADICTION MESURÉE, NON RÉSOLUE — à trancher par quelqu'un d'autorisé

`tests/e2e/offline/9f4h1-consultation.spec.ts:151` affirme, depuis D213 : *« AUCUN montant, AUCUNE action —
une lecture, rien de plus »*, et vérifie `expect(page.getByRole("button")).toHaveCount(0)` sur cette même
fiche. Le point 2 de CE ticket la rend explicitement interactive — c'est son objet même. Mesuré après le
point 2 : **5 boutons désormais présents**, l'assertion échoue.

Je n'ai PAS modifié ce test (interdit absolu, CLAUDE.md §5 : « jamais assoupli pour faire passer la
vérification »). Il est rouge comme conséquence DIRECTE et PRÉVUE de ce ticket, pas comme régression
étrangère — mesuré AVANT mon changement (vert sur `origin/main`), rouge APRÈS, par la même commande. Écrit en
entier dans D216 (section « contradiction mesurée »). Deux options, pour qui tranchera :

1. Réécrire `tests/e2e/offline/9f4h1-consultation.spec.ts:151` pour refléter la fiche de travail (retirer
   l'assertion « zéro bouton », ou la réécrire pour viser spécifiquement la JOURNÉE, qui reste lecture seule
   — seule la FICHE devient interactive).
2. Décider que la fiche de la coquille ne doit PAS être interactive quand atteinte par lien direct
   `?id=`, seulement par repli depuis `/terrain/<id>` — ce qui viderait le point 2 de l'essentiel de son sens
   (l'ouverture à froid, par construction, n'a jamais de repli : il n'y a pas eu de visite préalable de
   `/terrain/<id>` à répliquer).

Le pilote tranchera — je n'ai pas eu l'autorité ni le canal pour le faire en session non interactive.

## Deux limites mesurées et acceptées (documentées dans D216, pas des oublis)

- **Le catalogue des prestations n'est pas emporté hors réseau** — rien ne peut être coché sans un `id` réel.
  Message honnête affiché à la place (« La liste des prestations n'a pas pu être emportée sur ce téléphone »).
  Condition de réouverture écrite dans D216 : le jour où `/api/terrain/instantane` est repris pour porter le
  catalogue (hors territoire de ce lot).
- **Le temps déjà mesuré côté serveur et un compteur déjà ouvert sur un AUTRE appareil ne sont pas connus**
  de l'instantané. Le pire effet possible est un refus LOCAL trop prudent ; le serveur reste l'arbitre final.

## Ce que je N'AI PAS fait / limites honnêtes supplémentaires

- Pas de liste read-only séparée des prestations déjà réalisées (labels) dans la fiche de travail : elle
  existait dans l'ancienne version read-only de `Fiche`, et a été retirée au profit du bloc interactif unique
  de `RapportTerrainAutomatique` (qui affiche désormais le message « indisponible » à la place). Si cette
  perte d'information gêne, un lot futur peut réintroduire un bloc read-only séparé au-dessus.
- Le bandeau réseau (`BandeauReseau`, partagé par `/terrain`, `/terrain/[id]` et la coquille) dit toujours
  « … lecture seule » même sur la fiche désormais interactive — observé sur les captures du point 5, pas
  corrigé : c'est un composant PARTAGÉ dont le docblock refuse explicitement une seconde forme du même fait,
  et la JOURNÉE (elle) reste réellement lecture seule. À trancher avec la contradiction ci-dessus plutôt que
  séparément.
- Aucune nouvelle route serveur créée ni modifiée hors des deux routes nommément autorisées par l'addendum
  n°1 pour le point 0 (`compteur`, `terminer`) — territoire respecté partout ailleurs.

## Points ouverts pour un lot futur

- Trancher la contradiction ci-dessus (prioritaire).
- `/api/terrain/instantane` : porter le catalogue des prestations et/ou les minutes déjà mesurées, pour
  retirer les deux limites de D216.
- `L3-07` (parc complet d'un client à 7 jours, RG-DRO-02) reste BLOQUÉ, chaîne inchangée.

## Fin de lot

(section complétée après `CI=1 pnpm verify:full`, voir en bas du fichier)
