# 9L04M-CHECKLIST-RETRAIT-REPONSE — passation

Mesuré par 9L04D (passation, § « Le retrait d'une réponse déjà écrite côté serveur N'EXISTE PAS ») :
le rôle applicatif n'avait aucun `DELETE` sur `checklist_reponse` ; un second appui sur la pastille
choisie ne retirait la réponse que LOCALEMENT, avant son envoi — une réponse déjà synchronisée
revenait après rechargement. Ce lot pose le vrai retrait, demandé par Alexis (D257).

## MIGRATION À JOUER PAR ALEXIS

`20261115020000_checklist_reponse_retrait_9l04m` — une seule, neuve, appliquée par `pnpm db:deploy`
(staging, puis la cible visée). Elle accorde `GRANT DELETE ON "checklist_reponse" TO "codiplan_app"`
et met à jour le commentaire de la table. **Aucune politique RLS neuve** : la politique
`cloisonnement_filiation` posée par 9K08 ne porte aucune clause `FOR` — elle s'appliquait déjà à
toute commande, `DELETE` compris (même forme qu'`intervention_piece_remplacee`, qui accorde `DELETE`
sans politique neuve pour la même raison, vérifié avant d'écrire la migration). Le verrou d'écriture
portail sur `checklist_reponse` (`verrou_ecriture_portail_suppression`, posé par 9K16) couvrait déjà
`FOR DELETE` — aucun compte portail ne gagne quoi que ce soit par cette migration.

## Ce qui a été fait

1. **`lib/checklists/depot.ts` (`enregistrerReponses`).** Une entrée `{ checklistPointId, valeur:
   null }` de la différence est désormais séparée AVANT `validerReponsePoint` (jamais une sixième
   forme de saisie) et traitée comme un retrait. TOUT ou RIEN (I6) : si au moins une des réponses
   visées par un retrait porte une photo (`checklist_reponse_photo`, réutilise le helper
   `photosParReponse` déjà écrit pour 9K28), la DIFFÉRENCE ENTIÈRE est refusée, nommément
   (`checklist.refus.reponse_porte_photos`), avant qu'aucune ligne ne soit écrite — l'immutabilité
   du lien photo n'est jamais desserrée. Retirer un point jamais répondu est silencieux. La suite
   et le commentaire d'un point non conforme (9L04I) partent avec la ligne, sans code séparé —
   c'est la MÊME ligne qui disparaît. Une réponse retirée annule la validation du rapport
   (RG-INT-03, D135), au même titre qu'une réponse modifiée (`validees.length > 0 ||
   pointIdsARetirer.length > 0`).
2. **Aucun changement côté terrain** (`components/terrain/checklist-terrain.tsx`,
   `lib/terrain/file-saisies.ts`). Mesuré avant d'écrire : le second appui posait déjà `valeur:
   null` dans l'état React ET dans la différence envoyée à `ajouterSaisie` depuis 9L04D — c'est le
   SERVEUR SEUL qui en changeait le sens (refus plutôt que suppression). Le geste entre donc déjà
   dans la file comme n'importe quelle saisie checklist, en ligne comme hors réseau, et un retrait
   d'une réponse ENCORE en file (jamais envoyée) s'en retire déjà sans appel réseau (coalescence,
   `TYPES_COALESCABLES`) — comportement gardé, inchangé.
3. **`lib/i18n/fr.ts`** — une clé neuve, `checklist.refus.reponse_porte_photos` : « Cette réponse
   porte des photos ; elle ne peut pas être retirée. » Surface automatiquement par le mécanisme
   générique déjà en place (`LigneRefus`, `components/terrain/bouton-envoyer.tsx`) : aucun
   câblage neuf, le motif de refus est déjà lu et traduit pour toute saisie restée en file.
4. **`docs/arbitrages.md`** — D257 (numéro suivant libre sur `origin/main` au moment du rebase).

## Épreuves

- **`tests/isolation/checklist-domaine.test.ts`** — le describe « un RETRAIT (`valeur: null`) »
  est RÉOUVERT : l'ancien témoin (« refuse nommément, pas encore possible ») est remplacé par sept
  scénarios sur le chemin de production réel (`enregistrerReponses`) : retrait réel (la ligne
  disparaît, relue en base) ; retrait silencieux d'un point jamais répondu ; un point OBLIGATOIRE
  retiré redevient manquant pour « Terminer » (`checklistDeLIntervention`) ; une réponse retirée
  annule la validation du rapport ; refus nommé sur une réponse qui porte une photo (insérée par
  SQL direct, `document` + `checklist_reponse_photo`, puis nettoyée AVANT que
  `surUneInterventionJetable` ne tente de supprimer l'intervention — `document.intervention_id` est
  `ON DELETE RESTRICT`, sinon le nettoyage de la scène suivante échoue en cascade, ce que j'ai vu en
  le mesurant : trois fichiers d'isolation indépendants ont rougi par ce seul oubli avant la
  correction) ; refus nommé sur une intervention FIGÉE (même refus que l'écriture) ; un technicien
  d'une AUTRE société ne retire rien (même refus que l'intervention invisible, D35/D50).
- **`tests/isolation/checklists.test.ts`** — un scénario JUMEAU (D257) : `has_table_privilege`
  prouve le `GRANT DELETE`, puis un `DELETE` brut sous `clientApp()` affiche 0 ligne affectée sous
  la société B et 1 sous la société A, SUR LA MÊME LIGNE — le privilège et la politique
  travaillent ensemble, jamais l'un sans l'autre. Assertion par COMPTE affecté, jamais par
  relecture sous le propriétaire (gardien `tests/unit/db/observation-proprietaire.test.ts`, qui a
  mordu une première fois avant correction).
- **`tests/e2e/9l04m-checklist-retrait-reponse.spec.ts`** (créé, 375 px) : en ligne (répondre,
  recharger, retirer, recharger — la réponse ne revient pas) ; refus nommé à l'écran sur une
  réponse qui porte une photo (photo déposée par le vrai composant `PhotosTerrain`, même patron que
  9l04i) ; hors réseau (répondre en ligne, couper le réseau, retirer, rétablir le réseau, envoyer —
  sans perte).
- `pnpm test`, `pnpm test:isolation`, `pnpm exec playwright test tests/e2e/9l04m-checklist-retrait-
  reponse.spec.ts`, `CI=1 pnpm verify` : tous verts.

## Captures

`docs/propositions/9L04M-CHECKLIST-RETRAIT-REPONSE/captures/` (375 px, prises par le spec e2e
ci-dessus) : avant toute réponse ; après retrait et rechargement (la pastille n'est plus pressée) ;
avant le retrait d'une réponse qui porte une photo ; le refus nommé en file ; le retrait hors réseau
avant l'envoi.

**`docs/captures/` (la galerie repo-wide) n'a PAS été rafraîchie** — même motif que les passations
de 9K27, 9L04D, 9L04G et 9L04I : la procédure de `docs/captures/README.md` (base jetable, build de
production, amorçage d'un compte neuf par lien de premier accès) exige des secrets choisis en
direct, hors budget de ce lot. Second motif, propre à CE lot : AUCUN écran n'a changé visuellement
— le second appui sur une pastille rendait déjà `aria-pressed="false"` avant ce lot (9L04D), et le
rend à l'identique après ; la seule différence est SERVEUR (la ligne disparaît réellement). Une
régénération n'aurait produit que des images visuellement identiques à celles déjà commitées, pour
le coût complet de la procédure — je l'ai signalé plutôt que de la sauter en silence.

## Points ouverts, pour Alexis

- **Une réponse qui porte une photo ne se retire jamais par ce geste.** Le ticket le demandait
  explicitement (refus nommé) ; je n'ai pas cherché à lever cette limite — c'est la condition de
  réouverture de D257 : lever ce refus suppose de décider, pour la première fois, ce qu'il advient
  du lien `checklist_reponse_photo` et de la photo elle-même (orpheline ? effacée ? rattachée
  ailleurs ?), une question que ce lot n'ouvre pas.

## Branche

Ce worktree était détaché sur `origin/main` au début de la session (`HEAD detached from
origin/main`). J'ai créé la branche `9L04M-CHECKLIST-RETRAIT-REPONSE` à partir de ce point et j'y ai
posé les commits de ce lot (aucun `push`).
