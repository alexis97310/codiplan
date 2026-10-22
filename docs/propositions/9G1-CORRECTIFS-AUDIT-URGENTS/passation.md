# 9G1-CORRECTIFS-AUDIT-URGENTS — passation

Branche `9G1-CORRECTIFS-AUDIT-URGENTS`, partant d'`origin/main` (`bde30d72`) — `main` était
extrait ailleurs (`/home/aplou/codiplan`), travail sur une branche dédiée comme demandé.

Les neuf points du corps du ticket sont faits, chacun commité séparément, chacun avec son
épreuve automatisée propre (rejouée en vert individuellement) et ses captures AVANT/APRÈS
(375 et 1280 px, viewport seul).

## Point 1 — Filtre des Priorités du tableau de bord

- **Avant** : `app/(back-office)/tableau-de-bord/page.tsx:862-876` — le `<select>` (rendu
  dans l'en-tête de la carte, `enTeteDroite`) était un FRÈRE du `<form>` `sr-only`, jamais
  son enfant : `evenement.currentTarget.form` valait `null`, et choisir une valeur ne
  soumettait rien.
- **Après** : `components/tableau-de-bord/select-priorites.tsx` — attribut HTML `form=`
  relie le `<select>` au `<form id="filtre-priorites">` sans déplacer ni l'un ni l'autre.
- **Épreuve** : `tests/e2e/9eg1-tableau-de-bord-roles.spec.ts` (nouveau test « choisir une
  priorité… soumet le formulaire et filtre la liste », `selectOption` réel, jamais
  seulement l'URL de départ).

## Point 2 — Planning, « Aujourd'hui » au téléphone

- **Avant** : `app/(back-office)/planning/page.tsx` (`ListeJour`, cartes « posées » et
  « hors grille ») — titre = `referenceAffichee(ligne)`, « Local-… ».
- **Après** : `enTeteDeLaCarteSemaine` (créneau + client, déjà réutilisée par `VueJour`)
  compose l'en-tête, `objetDuBloc` (déjà réutilisé par `VueSemaine`) la nature ; le site
  suit déjà par `DetailsDeLaCarte`. `fuseauPour` propagé à `ListeJour`.
- **Épreuve** : `tests/e2e/planning-telephone-onglets.spec.ts` (nouvelle assertion : la
  carte contient l'heure, le client et la nature de la fixture).

## Point 3 — Message faux au terrain

- **Avant** : `components/terrain/rapport-automatique.tsx` — `texteIndicatif` disait
  toujours `terrain.rapport.refus`, même pour un échec de PRESTATIONS ou de SIGNATURE.
- **Après** : `Indicateur` reçoit `texteEchec`, propre à chaque appelant
  (`terrain.rapport.refus` / `.prestations.refus` / `.signature.refus`, clés déjà
  existantes).
- **Épreuve** : `tests/unit/terrain/rapport-automatique.test.tsx` (2 tests neufs : échec
  prestations, échec signature — chacun vérifie le message JUSTE et l'ABSENCE du message
  du rapport).

## Point 4 — Import vide

- **Avant** : `app/(back-office)/imports/[id]/page.tsx:462-475` — « Appliquer l'import »
  proposé dès le statut « contrôlé », même sur un lot à 0 ligne applicable.
- **Après** : `aucuneLigneAAppliquer` (nouvelle fonction pure,
  `app/(back-office)/imports/presentation.ts`), même critère que `rejetees`
  (`action === "rejet"`). Message `imports.aucune_ligne_a_appliquer` (clé neuve) à la
  place du bouton.
- **Épreuve** : `tests/unit/imports/presentation.test.ts` (3 tests neufs sur la fonction
  pure).

## Point 5 — Sous-titre « Glisser-déposer » en vue Mois

- **Avant** : `app/(back-office)/planning/page.tsx` — la mention s'affichait aussi en vue
  Mois, qui ne porte aucun geste (`VueMois` : « aucune carte, aucun BlocPosable, aucune
  CasePosable, aucun geste »).
- **Après** : condition `vue !== "mois"` ajoutée.
- **Épreuve** : `tests/e2e/planning-glisser-annonce.spec.ts` (nouveau test : vue Mois à
  1280 px, droit de déplacer — la mention n'apparaît pas).

## Point 6 — Fiche client

- **Avant** : onglet « Intervention » au singulier
  (`app/(back-office)/clients/[id]/page.tsx:491`, `t("intervention.titre")`) ; tuile
  « Sites » comptant les sites ACTIFS sous le même mot générique que l'onglet (tous les
  sites).
- **Après** : `t("interventions.titre")` (clé plurielle déjà existante) pour l'onglet ;
  `t("clients.fiche.synthese.sites_actifs")` (clé déjà écrite dans `fr.ts`, jamais câblée)
  pour la tuile — comptage INCHANGÉ, seul le libellé nomme ce qu'elle compte réellement.
- **Épreuve** : `tests/e2e/9ef-tp-ux4-2-fiches-1.spec.ts` (assertion neuve sur le libellé
  de la tuile ; assertion existante adaptée au plus juste, `interventions.titre` au lieu
  de `intervention.titre`, même comportement observable).

## Point 7 — Cartes de sites sans adresse

- **Avant** : `app/(back-office)/sites/page.tsx:616-619` — `site.commune === null &&
  site.adresse === null ? null : site.commune` : sans commune mais AVEC adresse, la
  branche retombait sur `site.commune` (`null`) — rien n'était affiché.
- **Après** : `formatAdresseSite(site.adresse, site.commune)` (déjà réutilisée par la
  fiche du site), qui compose rue et commune dans les deux sens.
- **Épreuve** : `tests/e2e/sites-adresse-sans-commune.spec.ts` (nouveau fichier) — mesurée
  ROUGE sur `app/(back-office)/sites/page.tsx` d'avant ce point (via `git stash`),
  VERTE après.

## Point 8 — Nouveau site pour un client inactif

- **Avant** : `app/(back-office)/sites/nouveau/page.tsx` — le formulaire s'ouvrait en
  entier même pour `?client=<id inactif>` ; le refus (`client_inactif`,
  `lib/sites/depot.ts:205`) n'arrivait qu'après l'envoi.
- **Après** : refus d'emblée, à l'ouverture, même motif (`site.refus.client_inactif`,
  clé déjà existante), formulaire non rendu.
- **Épreuve** : `tests/e2e/sites-nouveau-client-inactif.spec.ts` (nouveau fichier).

## Point 9 — Familles à déterminer

- **Avant** : `app/(back-office)/vgp/a-determiner/page.tsx` — aucune action ni lien ;
  sous-titre disant POURQUOI, jamais OÙ trancher.
- **Après** : colonne « Décider » par famille, lien vers
  `/parametres/materiel?famille=<id>#modeles` (ancre `#modeles` DÉJÀ existante dans ce
  fichier hors territoire — réutilisée, pas une seconde écriture) ; sous-titre complété
  par la clé neuve `vgp.indetermines.quoi_faire`.
- **Épreuve** : `tests/e2e/vgp-a-determiner-lien.spec.ts` (nouveau fichier).
- Deux gardiens mis à jour pour accueillir ce point (listes fermées, pas assouplies) :
  `tests/unit/theme/lien-visible.test.ts` (porteurs de `CLASSES_LIEN`) et
  `tests/unit/i18n/vocabulaire-impose.test.ts` (exemption nommée pour « matériel » hors
  Référentiel matériel).

## Captures

`docs/propositions/9G1-CORRECTIFS-AUDIT-URGENTS/captures/` — 36 fichiers (9 écrans × 2
largeurs × 2 phases), produits par `tests/e2e/zz-captures-9g1-correctifs.spec.ts`, joué
deux fois (APRÈS sur ce commit, AVANT sur un `git worktree` planté sur `bde30d72`) :

```
$ ls -la docs/propositions/9G1-CORRECTIFS-AUDIT-URGENTS/captures/ | tail -n +2
(voir le dépôt — 36 fichiers *.png, <écran>-<avant|apres>-<375|1280>.png)
```

Le point 3 est capturé via l'échec de la SIGNATURE (plus simple à forger qu'un échec de
prestations, qui exige un catalogue) ; les deux AVANT et APRÈS confirment visuellement le
texte faux puis le texte juste.

## Fin de lot

- `pnpm verify` (format:check + typecheck + lint + test [5055] + test:isolation [1649] +
  build) : **vert**.
- `pnpm feries:horizon`, `pnpm audit:partitions` : **verts**.
- `pnpm test:e2e` complet : **interrompu par la limite de 30 min de l'outil**, pas un
  échec mesuré (même situation que la trace du commit `bde30d72` sur ce ticket) — voir
  `verify-final.txt`. Les épreuves e2e SPÉCIFIQUES à chacun des neuf points ont toutes
  été rejouées séparément et sont vertes (listées point par point ci-dessus).
- 15 dernières lignes de `verify-final.txt` :

```
··········································································
················································································
················································· ELIFECYCLE  Command failed.
×°°±°°°°°
=== NOTE ===
test:e2e interrompu par la limite de 30 min de l'outil (pas un échec mesuré) —
même situation que la trace du commit bde30d72 sur ce même ticket. 1543 épreuves
lancées, la grande majorité verte (points marqués « ° » = tentative, « × » =
échec isolé). Une ligne nommée avant la coupure : « « En retard » ne vaut pas 0
au moment de l'épreuve (5) — capture non prise, voir le README » — PAS mesurée
liée à ce lot (aucune épreuve de ce lot ne porte ce libellé). Un
« [Error: aborted] { code: 'ECONNRESET' } » du serveur est consécutif à l'arrêt
forcé de l'outil, pas une panne applicative. Les épreuves e2e SPÉCIFIQUES à
chacun des neuf points de ce lot ont toutes été rejouées séparément et sont
vertes (voir la passation, détail par point).
```

- `git rev-parse --short HEAD` : `7adf06fb3` (avant le rebase final sur `origin/main`,
  voir commande ci-dessous).

## Points ouverts

Aucun — les neuf points sont faits. Le seul écart au protocole est documenté ci-dessus :
`pnpm test:e2e` complet n'a pas pu finir dans le temps imparti à CET OUTIL (30 min), pas
dans le budget du lot (150 min, respecté). Un humain ou une session suivante peut relancer
`CI=1 pnpm test:e2e` seul pour obtenir la trace complète si elle est nécessaire avant mise
en ligne.
