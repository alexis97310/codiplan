# 9L21-DOCS-CHAPITRE-10-MATRICE — passation

Budget : T0 04:22 (Pacific/Noumea), limite 90 min. Ticket documentaire — aucun écran touché, aucune capture.

## Point 1 — chapitre 10, matrice §5.2, invariants, arbitrages (D224, D228, D173, D151, D153, D199, arbitrage 3.8, D160, numérotation annuelle)

- **RG-TAR-05** (`docs/cahier-des-charges.md`) décrit désormais le palier réglable par société (D224, confirmée par Alexis le 10/11/2026) : première heure due, puis paliers de 30 min à partir de 5 min, l'ancienne règle (quart d'heure, plancher d'une heure) restant disponible comme réglage. *(amendée par D57, D83, D89, D224)*.
- **RG-INT-01** dit désormais « au plus une machine » (D228, PARCOURS-1 du 23/09/2026, validée par Alexis le 10/11/2026) — contrainte déjà posée en base depuis le 23/09/2026, que le chapitre 10 ne disait pas encore.
- **RG-INT-04** nomme le geste « Terminer » (D8), distinct de la clôture, avec les trois issues et le responsable SAV (D173).
- **Matrice §5.2** : « Saisir un rapport » (technicien restreint, D151 ; direction au complet, D199) ; cinq lignes où la direction rejoint l'administrateur de société (D199) ; deux lignes ajoutées — « Consulter les clients et les sites », « Régler les trajets » (D153) ; « Voir les montants de vente » refuse désormais le client (`—`, arbitrage 3.8, au lieu du `○` périmé).
- **`docs/arbitrages.md`** : chacune des décisions D136, D152, D153, D161 à D170, D175, D176, D193, D224, D228 porte sa ligne « Validée par Alexis le 10/11/2026 » et sa déclaration « Règles amendées » (la plupart « aucune », avec motif — ce sont des décisions d'ergonomie ou de droits applicatifs, pas des règles chiffrées du chapitre 10).
- **I5** (`docs/constitution/invariants.md`) : `CLOTUREE` est désormais terminale au sens plein (D160, 04/10/2026) — l'ancienne préséance d'`ANNULEE` au-dessus de `CLOTUREE` est refermée.
- **I10** et **RG-SOC-05** : la numérotation repart à 1 chaque année civile, `(société, année, numéro)` (ticket 9H2-NUMEROTATION-INTERVENTIONS, 23/10/2026, `docs/decisions/2026-10-23-numerotation-annuelle.md`). Ce n'est **pas** un arbitrage `Dxx` — aucune mention « amendée par » n'a donc été ajoutée, pour ne pas fausser `tests/unit/docs/cablage-arbitrages.test.ts`.
- `tests/unit/docs/cablage-arbitrages.test.ts` : trois paires ajoutées à `CABLAGE_ATTENDU` (D224↔RG-TAR-05, D228↔RG-INT-01, D173↔RG-INT-04). Vert.

**Anomalie mesurée en passant, non corrigée (hors territoire de ce ticket) : la décision « D135 » est citée deux fois pour deux faits différents.** `lib/interventions/numerotation.ts` et `docs/decisions/2026-10-23-numerotation-annuelle.md` citent « D135 » pour la décision d'Alexis du 21/10/2026 sur la numérotation annuelle — mais `docs/arbitrages.md` porte déjà un `## D135` pour un fait entièrement différent (« UNE INTERVENTION PLANIFIÉE GARDE UNE HEURE », QG-4, 27/09/2026). Les deux décisions sont réelles et non contradictoires entre elles ; c'est le NUMÉRO qui a été réutilisé par erreur dans le code/la note technique. Rien n'a été renuméroté ici — c'est un arbitrage de registre, pas une correction de texte.

## Point 2 — textes techniques périmés sur l'arrondi au quart d'heure

Corrigés sans changer aucun comportement : le docblock de `lib/tarification/valorisation.ts`, des renvois dans `lib/interventions/compteur.ts`, `lib/interventions/depot.ts`, `lib/calendar/recurrence.ts`, `lib/calendar/ouverture.ts` (deux endroits), et trois passages du `README.md` (dont la préséance I5/D160, également en retard).

**Non touché, et pourquoi** : `prisma/migrations/20260908190000_forfaits_l1_06/migration.sql` (ligne 88-89) porte un commentaire SQL qui mentionne l'arrondi au quart d'heure (D57) pour justifier le type `INTEGER` de `heures_incluses_minutes`. C'est une migration déjà appliquée — la règle du protocole l'interdit. Le fait documenté par le commentaire (minutes en entier) reste de toute façon vrai, seul le motif historique cité (D57 seul) est devenu partiel.

## Point 3 — L2-13 et le gardien de cohérence du backlog

`docs/backlog.md`, L2-13 : marqueur passé de `BLOQUÉ` à `LIVRÉ` (05/11/2026). **Mesuré avant de marquer** : l'invitation portail (9J02-PORTAIL-INVITATION-LIEN et sa reprise 9J02A) existe et fonctionne (e2e `captures-9j21-finitions-invitation.spec.ts`, `captures-9k01-portail-invitation-revocation.spec.ts`, `captures-9k14-portail-copier-nouveau-lien.spec.ts`), mais **par une voie qui contourne Q9 plutôt que de la trancher** : aucune table distincte, aucune quatorzième forme de politique — l'invitation ouvre directement une identité `utilisateur`/`utilisateur_client`, sous `administrer_utilisateurs` (D230). La contradiction interne à D96 décrite par le ticket reste donc un fait NON résolu pour toute vraie table à lien à usage unique, non relisible — annoté à la fois sur le ticket et dans `docs/boucle/journal.md` (J5, 13/09/2026).

Modifier le chapitre 10 et les arbitrages a fait rougir `tests/unit/docs/coherence-backlog.test.ts` sur **six** tickets qui citent les sources changées (empreinte périmée). Relus contre le texte courant, un par un :

| Ticket | Sources citées changées | Verdict de la relecture |
|---|---|---|
| L1-03 | RG-INT-04, RG-INT-05 | Rien n'a cessé d'être vrai — `signataire` reste un rôle de l'ensemble, indépendamment du nom du geste. Empreinte rafraîchie. |
| L1-03b | RG-INT-04 | Idem. Empreinte rafraîchie. |
| L1-06 | D23, D4, D56, D57, D63, D83, D89, RG-TAR-05, RG-TAR-06 | Rien n'a cessé d'être vrai — les citations portent sur la maille (par intervention) et sur « le plancher ne vise pas les forfaits », deux faits que D224 laisse inchangés. Empreinte rafraîchie. |
| L2-07 | D108, D120, D240, D242, D8, RG-DRO-01/02, RG-INT-01 à 11 | Rien n'a cessé d'être vrai — le ticket porte le cycle de vie et ses huit statuts, jamais le nombre de machines ni le moment de la signature. Empreinte rafraîchie. |
| **L2-08a** | D103, D120, D16, **D228**, RG-INT-01 | **Une phrase avait cessé d'être vraie, sans que rien ne le dise.** « Ce que le rattachement multi-machines apporte ne bouge pas d'une ligne — une visite en couvre plusieurs » contredit D228 depuis le 23/09/2026 (la migration PARCOURS-1 pose `UNIQUE(intervention_id)` douze jours après ce ticket). Corrigée, barrée et non effacée, avec le fait actuel (une machine au plus). |
| L2-13 | D10, D230, D35, D58, D79, D92, D96 | Déjà repris au point 3 ci-dessus (passage à LIVRÉ). |

Toutes les empreintes sont datées du 19/11/2026 (date du dépôt à ce jour). `tests/unit/docs/coherence-backlog.test.ts` et `tests/unit/docs/cablage-arbitrages.test.ts` : verts.

## Point 4 — « décision n° 83 » et « décision n° 94 » : citées dans le code sans inscription au registre

Trouvées par recherche dans le code et l'historique. **Non inscrites dans `docs/arbitrages.md` — Alexis doit les valider avant toute inscription.**

**Décision n° 83 d'Alexis, 13/10/2026** (`lib/i18n/fr.ts:2585`, ticket 9EU-SOLDE-FICHE-PLANNING) : le texte exact de la clé `intervention.annulation.consequence`, affiché SOUS le titre du dialogue d'annulation, AVANT le motif — « L'intervention restera tracée comme annulée et ne pourra pas être reprise. » Distinct de `confirmation_apres`. La passation de 9EU (`docs/propositions/9EU-SOLDE-FICHE-PLANNING/passation.md:8`) l'appelle familièrement « D83 » — une confusion de numérotation avec le VRAI D83 de `docs/arbitrages.md` (l'arrondi et le plancher de RG-TAR-05), qui est un fait totalement différent. Les deux numéros (le numéro personnel d'Alexis pour ses décisions verbales, et le numéro `Dxx` du recueil d'arbitrages) ne sont pas le même espace de numérotation, et ce ticket a mesuré au moins deux endroits où cette confusion s'est glissée dans la prose (ici, et le « D135 » du point 1 ci-dessus).

**Décision n° 94 d'Alexis, 13/10/2026** (`docs/propositions/9EWA-RENDU-VISUEL-1/passation.md`, `docs/propositions/9EWC-AUDIT-VISUEL-ECRAN/rapport.md`) : six défauts de rendu visuel constatés par Alexis en production — entre autres, les titres de menu illisibles (cause racine : `tailwind-merge` rangeait l'échelle typographique maison dans le groupe couleur plutôt que taille, à cause d'une configuration absente de `extendTailwindMerge`) et un encadré bleu entourant toute la page (cause : une règle de focus visuel trop large). Les six points sont corrigés et livrés ; leur texte complet n'a jamais été transcrit dans `docs/arbitrages.md`.

**Trouvé en passant, même famille, non traité ici non plus** : `lib/i18n/fr.ts` cite aussi une « décision n° 107 d'Alexis, 14/10/2026 » (ticket 9F4H2-HORS-RESEAU-HEURE-ET-REJEU) sans inscription au registre.

## Ce qui reste strictement hors de ce ticket

Aucun changement de code fonctionnel, aucune migration, aucun écran. `pnpm verify` rejoué en entier en premier plan : `format:check`, `typecheck`, `lint`, `test` (5986 passés), `test:isolation` (2319 passés), `build` — tous verts. `verify:full` est laissé à la file, conformément à la consigne.
