# 9L04H-TERRAIN-RECAPITULATIF-SIGNATURE — passation

Constat de la revue du 13/11/2026 : le technicien ne voit jamais le bon
(`/interventions/<id>/bon` le renvoie sur la fiche, D221) et le client signait
sans avoir sous les yeux ce qu'il signe. D'où un récapitulatif avant la
signature, puis la signature elle-même « épurée » (décision d'Alexis du
13/11/2026) : signataire prérempli, qualité en segments.

## Point 0 — mesure

- La zone de signature actuelle (`rapport-automatique.tsx`, section « Signature ») : trois
  boutons d'issue (Signée / Client absent / Refus de signer), puis nom + qualité en **texte
  libre** + canevas pour « Signée », un motif texte pour les deux autres.
- `signataire_qualite` (`prisma/schema.prisma`) est une colonne **texte libre, nullable**, sans
  enum ni liste fermée — `lib/interventions/depot-rapport-terrain.ts` ne valide qu'un
  `z.string().trim().max(80)`. Aucune valeur réelle en seed ; seules des fixtures de test portent
  une qualité (« Chef d'atelier », « Responsable technique »).
- `/interventions/<id>/bon` : fermé au technicien par un garde de SEGMENT entier
  (`app/(back-office)/template.tsx`, `fermeAuTechnicienParD221`), qui redirige tout chemin de
  `(back-office)` (sauf `/arrivee` et la déclaration d'absence) vers `/terrain`. C'est la cause
  exacte nommée par la revue.
- Le contact sur place EST déjà transporté en ligne (`fiche.contact`, via `contactAffiche`) **et**
  hors réseau (`FicheJSON.contact`, `InstantaneJSON`) — rien à ajouter pour le prérempli.
- Les conditions de facturation **ne voyagent PAS dans l'instantané hors réseau**
  (9I8B-CONDITIONS-DE-FACTURATION-SANS-MONTANT, gap déjà mesuré et documenté dans
  `consultation-hors-reseau.tsx` avant ce lot) : la rubrique FACTURATION du récapitulatif reste
  donc vide hors réseau, exactement comme la section existante au-dessus de la signature. Pas une
  régression de ce lot, et toujours hors de son budget.

## Point 1-2 — le récapitulatif

Un bouton « Voir le récapitulatif », en tête de la rubrique Signature (ouvert DEPUIS cette
rubrique, comme demandé), ouvre une feuille plein écran — même patron que celle de « Terminer »
(`z-[60] fixed inset-0`, `role="dialog"`) :

- **CLIENT** : client, site, matériel (déjà avec son n° de série, `libelleMaterielComplet`) —
  « Aucune machine rattachée. » si la fiche n'en porte aucune (jamais « matériel », synonyme fermé
  de Machine au glossaire, §8/D172 — vu rouge une fois, corrigé).
- **INTERVENTION** : nature, créneau, durée (même composition vivante que la feuille « Terminer » —
  `CompteurVivant` si un segment tourne encore).
- **CONTRÔLES** : seulement si la checklist porte au moins un point `conforme_non_conforme_sans_
  objet` RÉPONDU — le résumé (`resumeChecklistBon`, déplacé) puis chaque non-conformité nommée
  (`libelleDuPoint`). Lu depuis `checklistPourTerminer` + la file hors réseau
  (`valeursChecklistDepuisFile`, même patron que les points manquants de « Terminer ») : à jour
  sans attendre un rechargement, y compris une réponse changée PENDANT que la feuille est ouverte.
- **TRAVAUX** : prestations cochées + suite à donner — lues depuis l'état COURANT du composant
  (`prestationsChoisies`, `suite`), jamais une seconde source qui pourrait diverger.
- **FACTURATION** : le même texte que la section déjà affichée au-dessus de la signature,
  REPRIS ici (pas déplacé — la section d'origine reste, voir « écart nommé » plus bas). Jamais de
  montant (I3).

Rien n'y est éditable — « Fermer » revient à la fiche.

## Point 2-3 — la signature « épurée »

- **Nom du signataire** préremplit avec le contact sur place (`recapitulatif.contactSurPlaceNom`),
  reste modifiable, et un brouillon déjà écrit prend toujours le pas au montage (même règle que
  tout le reste du brouillon local).
- **Qualité en segments** (Gérant / Resp. atelier / Mécanicien / Autre, `SegmentsChoix`, réutilisé
  depuis `checklist-terrain.tsx` plutôt que récrit) — **aucune migration** : `signataire_qualite`
  reste le même champ texte libre, les trois segments ne sont que des raccourcis de saisie qui y
  écrivent leur libellé. « Autre » ouvre la MÊME saisie libre qu'avant ce ticket (même libellé,
  `terrain.signature.qualite_libelle`, pour ne rien casser des épreuves qui la ciblaient déjà).
- **Les valeurs de qualité existantes restent lisibles** (point 3 du ticket, vérifié) : une
  qualité restaurée (brouillon, ou une intervention antérieure à ce lot) qui ne correspond à AUCUN
  des trois segments arme automatiquement `qualiteAutreOuverte` au montage — elle s'affiche dans le
  champ libre, jamais masquée. Aucune valeur absente des segments n'a donc été rencontrée, et ce
  lot n'avait donc rien à arrêter ni à écrire comme migration.
- **Canevas** : 190 px, fond `app-terrain-champ-fond` (#F1F3F6), sans bordure — le jeton de la
  fiche épurée, déjà posé dans `app/globals.css` sous `[data-zone="terrain"]` (utilisé jusqu'ici
  par `checklist-terrain.tsx` seul).
- **« Valider la signature »** : un bouton explicite à côté d'« Effacer », qui rappelle
  `tenterEnvoiSignature()` — l'enregistrement automatique (D212) reste en place (sur `onBlur`/
  `onPointerUp`), ce bouton n'est qu'une confirmation visible et immédiate en plus.

## Écart nommé — les trois boutons d'issue restent à leur place

Le ticket décrit la signature « dessous » le récapitulatif, dans la MÊME feuille. Ce lot a choisi
de garder les trois boutons d'issue (Signée / Client absent / Refus de signer) et les champs
nom/qualité/canevas/motif **à leur emplacement actuel, sur la fiche**, et de faire du récapitulatif
une feuille SÉPARÉE, ouverte depuis la rubrique Signature plutôt qu'enfermant tout le geste de
signature.

**Pourquoi** : une douzaine d'épreuves e2e existantes (`9de-terminer-signature`, `bon-4`,
`rapport-terrain`, `rapport-signature-epaisseur-trait`, `9l04g-terrain-barre-fixe-terminer`,
`9k27-terrain-terminer-ce-qui-manque`, les captures `9i2`/`9ic`/`9g5`, les scènes hors réseau
`9f4h1`/`9f4h3`/`9f4h4`…) ciblent ces boutons et ces champs à leur place ACTUELLE. Les déplacer dans
une feuille modale aurait changé le parcours que ces épreuves prouvent, et les rejouer toutes avec
certitude dans le budget de ce lot n'était pas raisonnable. Mesuré et choisi plutôt que deviné :
voir aussi 9L04G, qui avait laissé un écart comparable (le bouton retour de l'en-tête) consigné
ici plutôt que tranché une seconde fois.

**Ce qui EST fait, malgré cet écart** : le récapitulatif s'ouvre bien DEPUIS la rubrique Signature
(la lettre du point 1-2), et la signature elle-même porte bien les quatre changements demandés du
point 3 (prérempli, segments, 190 px/fond clair, « Valider »). Seule la DISPOSITION — une feuille
unique plutôt que deux temps — diffère de la description littérale. À trancher par Alexis si
l'unification complète est requise malgré le coût de réécriture des épreuves.

## Épreuves

- **Unitaires** (`tests/unit/terrain/rapport-automatique.test.tsx`) : le récapitulatif s'ouvre et
  montre client/site/matériel/nature/créneau ; travaux cochés + suite à donner, rubrique
  Facturation absente si rien n'est posé ; résumé des contrôles + non-conformité nommée ; **aucun
  montant** même avec des conditions de facturation posées (regex XPF/FCFP/€/chiffre-devise) ;
  qualité en segments, « Autre » ouvre la saisie libre ; nom prérempli et modifiable.
  `lib/checklists/presentation.ts` gagne `resumeChecklistBon` (déplacé de `bon-tuiles.tsx`, sans
  dépendance Prisma — un composant CLIENT ne peut pas importer un module qui en tire un).
- **e2e** (`tests/e2e/9l04h-terrain-recapitulatif-signature.spec.ts`, scène écrite en base) : le
  parcours complet à 375 px — récapitulatif ouvert, sans montant (vérifié dans le DOM réel),
  fermé ; nom prérempli avec le contact ; qualité « Resp. atelier » ; signature tracée et
  « Validée » ; vérifiée en base (`signataire_nom`, `signataire_qualite`).
- `tests/e2e/bon-4.spec.ts` corrigé : la qualité ne se remplit plus directement, elle passe par le
  segment « Autre ».
- Gardiens de population recalculés (`tests/unit/ui/composants-base.test.tsx`,
  `tests/unit/ui/retouches-2a.test.ts`) : 21 → 24 `<Button>` du terrain (+3 : « Voir le
  récapitulatif », « Fermer », « Valider la signature »).
- `pnpm test` (525 fichiers, 5818 tests), `pnpm test:isolation` (243 fichiers, 2211 tests),
  `CI=1 pnpm verify` (format, typecheck, lint, test, test:isolation, build) : tous verts.

## i18n

`terrain.recapitulatif.*` (titre, sous-titre, ouvrir, fermer, les cinq rubriques, les deux
messages d'état vide). `terrain.signature.qualite.{gerant,resp_atelier,mecanicien,autre}`,
`terrain.signature.valider`. Fixtures d'épreuve `9l04h.e2e.*` (L0-11 : le texte attendu par un
test de rendu passe par le dictionnaire comme tout texte visible, y compris une donnée de
fixture — mesuré rouge une première fois, corrigé).

## Captures (375 px)

`docs/propositions/9L04H-TERRAIN-RECAPITULATIF-SIGNATURE/captures/` : fiche avant ouverture du
récapitulatif, récapitulatif ouvert, qualité en segments, signature validée — APRÈS ce lot
seulement, prises par l'épreuve e2e elle-même (base jetable).

**Pas de capture AVANT ce lot, et `docs/captures/` (la galerie repo-wide) n'a PAS été
rafraîchie** — même motif que les passations de 9K27 et 9L04G : la procédure de
`docs/captures/README.md` (base jetable, build de production, amorçage d'un compte neuf par lien
de premier accès, identités portail/multi-société) n'entre pas dans le budget de ce lot et exige
des secrets (mots de passe à choisir en direct) que cette session ne détient pas.

## Ce qui n'est pas touché

Aucune migration — `signataire_qualite` reste le champ texte libre d'avant ce ticket. Aucune
entrée neuve dans `docs/arbitrages.md` : rien n'a été TRANCHÉ par ce lot, l'écart ci-dessus reste
une question pour Alexis, pas une décision. D173/D212/D242/D-S5 inchangés (trois issues, un seul
bouton « Terminer », les mêmes manques bloquants).

## Reprise 9L04HA

9L04H est resté RECALÉ sur `origin/main` : deux scènes e2e, écrites avant ce lot, suivaient encore
l'ancienne disposition de la signature (qualité en texte libre, pas de récapitulatif). Reprise par
cherry-pick des six commits de `9L04H-TERRAIN-RECAPITULATIF-SIGNATURE-garde` sur `origin/main` à
jour (qui porte désormais aussi 9L04F/9L04FA-TERRAIN-RAPPORT-PHRASES-TYPES, publiés après que 9L04H
a été mesuré recalé) — rien n'a été retiré ni affaibli des deux côtés, voir « Ce qui a été résolu »
ci-dessous.

### Conflits de fusion — ce qui a été recomposé, jamais choisi

`lib/checklists/presentation.ts` et `components/interventions/bon-tuiles.tsx` : deux imports
ajoutés en parallèle par 9L04H (préparation) et par du code publié depuis (`DetailNonConforme`,
`libelleSuiteNonConformite`) — les deux gardés, aucun n'écrivait sur la même ligne que l'autre.

`components/terrain/rapport-automatique.tsx` : six zones où 9L04H et 9L04F/9L04FA ajoutaient
chacun leur propre fonction, leur propre état (`useState`) ou leur propre effet au MÊME point du
fichier — `nonConformesDepuisFile`/`phrasesTypesOuvertes` (9L04F) à côté de
`valeursChecklistDepuisFile`/`resumeEtNonConformitesChecklist`/`CLES_QUALITE_SEGMENTS` (9L04H),
jamais l'un à la place de l'autre. Recomposé en gardant les DEUX blocs complets, l'un après
l'autre ; un marqueur de fusion orphelin (`>>>>>>>` isolé après `estQualitePreset`) nettoyé.

`tests/unit/ui/composants-base.test.tsx` et `tests/unit/ui/retouches-2a.test.ts` : les gardiens de
population du nombre de `<Button>` du terrain divergeaient (29 côté 9L04F/9L04FA publié, 24 côté
9L04H sur son ANCIENNE base à 21) — recalculé sur la bonne chaîne : 29 (après 9L04E, 9L04F) + 3
(9L04H : « Voir le récapitulatif », « Fermer » du récapitulatif, « Valider la signature ») = **32**,
vérifié en relançant les deux épreuves après résolution.

`tests/unit/terrain/rapport-automatique.test.tsx` : deux `describe` neufs insérés au même point
(`mesureCompteurDeLaFile — tronqué…`, D256, publié depuis ; et « le récapitulatif avant signature »,
9L04H) — remis l'un à la suite de l'autre, chacun avec sa propre fermeture.

### Ce qui a été résolu (point 2 du mandat)

- **`bon-4.spec.ts`** : la cause mesurée n'était pas seulement « deux boutons de plus » — une fois
  « Autre » choisi, `getByLabel(fr["terrain.signature.qualite_libelle"])` résout TOUJOURS deux
  éléments, parce que le groupe de segments (`SegmentsChoix`, `role="radiogroup"`) garde le MÊME
  `aria-label` que la saisie libre qu'il ouvre — voulu (même libellé, passation du 14/11). La scène
  choisissait déjà « Autre » par `getByRole("radio", …)` (repris de la garde), mais remplissait
  ensuite le texte par `getByLabel` seul : changé en `getByRole("textbox", { name: … })`, même
  patron de désambiguïsation que le test unitaire (`tests/unit/terrain/rapport-automatique.test.tsx`,
  « la qualité du signataire se choisit en segments »). Rejoué seul : vert.
- **`tests/e2e/offline/9f4h1-consultation.spec.ts`** : `fr["terrain.recapitulatif.ouvrir"]` ajouté
  à `nomsBoutonsAttendus` (toujours affiché, en tête de la rubrique Signature, geste qui ne dépend
  d'aucun réseau). Ajouté aussi la PREUVE qu'il fonctionne hors réseau, demandée par le mandat : le
  récapitulatif s'ouvre depuis la copie locale (`page.getByRole("dialog", { name: … titre })`),
  montre son sous-titre, puis se referme par son propre bouton « Fermer » (scopé au dialogue — un
  autre « Fermer », celui des phrases types, existe ailleurs sur la même fiche, jamais ouvert en
  même temps).

### Point 3 — recherche des autres localisateurs de la même famille

Cherché dans `tests/e2e/**` tout `getByLabel`/`getByRole` ciblant `terrain.signature.*` ou tout
comptage de boutons qui pourrait croiser la Signature ou le récapitulatif :
- Les neuf autres fichiers qui utilisent `terrain.signature.nom_libelle` ou `.motif_libelle`
  (`9de-terminer-signature`, `9k27`, `9l06`, `captures-9f4h2a`, `offline/9f4h3`, `rapport-signature-
  epaisseur-trait`, `offline/9f4h3ac`, `zz-captures-9ic`, `zz-captures-9i2`, `rapport-terrain`,
  `offline/9f4h4`, `offline/9f4h6`, `offline/9f4h6d`) n'interrogent JAMAIS `qualite_libelle` —
  aucun n'est concerné par la désambiguïsation ci-dessus.
- Seuls deux fichiers faisaient un comptage exhaustif de boutons sur une fiche terrain
  (`nomsBoutonsAttendus`/`comptesNommes`) : `9f4h1-consultation.spec.ts` (corrigé ci-dessus) et
  `offline/9f4h4-ouverture-a-froid.spec.ts`, dont le seul `toHaveCount` de ce type vise un ÉTAT
  VIDE (« sans instantané », zéro bouton) — hors de portée de ce ticket, non touché.
- `9l04g-terrain-barre-fixe-terminer.spec.ts` cible `heading(signature.titre).locator("..")` pour
  le focus de section — relation parent direct du titre, inchangée par l'ajout d'un bouton DANS la
  section ; pas de correctif nécessaire.
- Aucune scène `getByText`/`getByRole` sans `exact` ne risquait de confondre « Fermer » (récapitulatif)
  avec un autre « Fermer » de la même fiche : toutes les occurrences existantes scopent déjà sur un
  rôle précis (`button` nommé) ou un conteneur (`within(dialogue)` dans le test unitaire).

### Épreuves rejouées (point 4)

Au premier plan, `CI=1 --workers=1` : `bon-4`, `9l04h-terrain-recapitulatif-signature`,
`9de-terminer-signature`, `rapport-signature-epaisseur-trait`, `9l04g-terrain-barre-fixe-terminer`,
`9k27-terrain-terminer-ce-qui-manque`, `rapport-terrain`, `9l04f-terrain-rapport-phrases-types`,
`zz-captures-9i2`, `zz-captures-9ic`, `zz-captures-9g1`, tout `offline/`, `tous-les-ecrans-rendent`
— **143 tests, 139 passés, 4 ignorés** (vert, bon-4 compris après son correctif). Puis `pnpm test`
(529 fichiers, 5892 tests), `pnpm test:isolation` (246 fichiers, 2255 tests), `CI=1 pnpm verify`
(format, typecheck, lint, test, test:isolation, build) : tous verts.

### Captures

Les quatre captures 375 px de 9L04H rafraîchies (section « Captures » ci-dessus) — rejouées par sa
propre épreuve e2e depuis l'état fusionné, qui montre pour la première fois « Phrases types » et
« Voir le récapitulatif » ensemble sur la même fiche. Faire tourner la suite e2e complète régénère
aussi, en effet de bord, les captures d'une quarantaine d'autres tickets (même `capturer()`, même
dossier `docs/propositions/**/captures`) — écartées (`git checkout --`) : hors du périmètre de ce
lot, et leur contenu ne change d'aucune règle qu'elles prouvent.
