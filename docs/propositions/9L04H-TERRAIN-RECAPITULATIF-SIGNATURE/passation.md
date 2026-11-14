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
