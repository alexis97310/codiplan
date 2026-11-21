# 9L30-FEUILLE-DE-ROUTE-22-11 — passation

Branche `9L30-FEUILLE-DE-ROUTE-22-11`, partant d'`origin/main` (`1cd61d5b0`). Jamais poussée. `main` est
extrait ailleurs (`/home/aplou/codiplan`) — travail sur cette branche dédiée, comme demandé. Arbre
propre, 3 commits.

## Ce qui a été demandé

« Mets à jour la feuille de route. » Remettre `lib/feuille-de-route/contenu.ts` à l'état du 22/11/2026,
rien d'autre (ni droits d'accès de la page, ni menu, ni migration).

## Mesure — comment chaque ligne a été comptée

Jamais de mémoire, jamais deviné :

- `git log --first-parent --format='%h %ad %s' --date=short 37ba71f8d..HEAD` (585 commits, 37ba71f8d
  étant le commit qui avait posé la date « 03/11/2026 » dans `contenu.ts`).
- Les titres `grep -n '^## D2[0-9][0-9]' docs/arbitrages.md` (D229 à D276).
- Les en-têtes `docs/propositions/*/passation.md` correspondants (`git log … | grep -i passation`).
- Un agent Explore dédié a vérifié, point par point et avec preuve (commit ou absence de preuve), les
  items ambigus de l'ancien contenu : bug des pièces, page Matériel deuxième passe, import Excel année
  de fabrication, les neuf points de l'audit technicien du 10/11, les quatre réserves de revue, l'état
  réel du hors-ligne, la cause et le statut du bouton « Reprendre », et les trois anciennes « décisions
  en attente ».

## Point 1 — contenu remis à l'état du 22/11 (`b8fc21846`)

**Déplacé vers « Livré depuis le 31/10 » (preuve) :**
- 9ID (performances), 9J01 (D228, PARCOURS-1) — déjà « prêt », livrés depuis.
- Portail client en entier : invitation, contacts, demande, fiche machine, état des interventions, bon
  téléchargeable (9J03 à 9J07) ; historique des états, notifications internes, suites à donner, barème
  sans montant (9J08A, 9J08B, 9J09 à 9J11, 9J17 à 9J20) ; sécurité de l'invitation et verrou applicatif
  (9K01, 9K14 à 9K16, D233, D237, D247-D251).
- Checklists par type et sous-type, modèles par table de liaison, dernier relevé, réponse photo, retrait
  d'une réponse (9K08, 9K17 à 9K30, D235, D238-D240, D243, D245, D246, D256, D257, D265) — ce qui
  répond aussi à l'ancien item « État des lieux complet + atelier bon par type » : l'audit du 10/11
  (9K25A) qui l'a produit est déjà dans le contenu depuis le 11/11.
- Prestations par type et par famille de matériel (9K29, 9L04J).
- Fiche terrain « épurée » complète (9L04C à 9L04M) ; B1/M1 et B2/M3 de l'audit du 10/11 (D241, D242,
  9K26, 9K27) ; m10a du même audit (zone de signature agrandie, nom prérempli — 9L04H, mesuré par
  l'agent : commit `fcaec575f`, n'était pas reflété dans l'ancien contenu).
- Figement à la clôture (D276, 9L14) ; saisie uniquement après démarrage (D262, 9L08B) ; minute
  commencée, suspension, temps validé (9L06, 9L13, 9L15) ; majoration et plancher (9L12, 9L27) ;
  valorisation figée du bon (9L17) ; mot de passe et en-têtes (9L07, 9L08A) ; sessions fermées à la
  réinitialisation (9L09) ; retrait/réactivation d'accès (9L03A, 9L04K) ; création directe qualifiée
  (9L10) ; statut machine (9I8F) ; chevauchement technicien (9L02) ; déplacement de machine (9L20) ; CI
  durcie (9L22).

**Resté en l'état (preuve d'absence, mesurée par l'agent) :**
- Bug des pièces — non trouvé.
- Page Matériel : famille présélectionnée livrée (9K17A, `4d040ccdb`) ; état actif/inactif en clair et
  saisie gardée après refus — non livrés (9K18A le dit explicitement : « hors du budget de ce lot »).
  Texte de l'item réduit à ces deux points restants.
- Import Excel (année de fabrication) — mécanisme existant déjà avant le 03/11 (9I8C, `ffbdedf4e`,
  31/10), rien depuis le 04/11 ; laissé en l'état par prudence (l'agent n'a pas pu confirmer que c'est le
  même bug).
- Équipement de prêt — aucune trace.
- Six points de l'audit du 10/11 (M2, M8, M9, P6, m8/m10b/m13, m11/m12) — non livrés.
- Réserves des revues (sécurité 2F, statut machine, 9I8C/9I8F1, finitions) — aucune livrée.
- Resend — toujours vrai (`lib/courriel/resend.ts` inchangé).

**Remplacé en entier (consigne explicite du pilote, état au 22/11) :** la section « Décisions en
attente » — les sept items donnés dans le ticket, verbatim.

**Section renommée « Bloqué / en enquête »** (ex-« Bloquants extérieurs ») : Resend conservé ; nouvel
item sur le bouton « Reprendre » (enquêtes 9L08C, 9L08CA, 9L29, cause soupçonnée dans la bibliothèque
d'accès à la base, bouton retiré) ; **« Hors-ligne : non fait. » retiré** — mesuré faux : une file locale
avec bouton « Envoyer » manuel couvre déjà compteur, rapport, prestations, checklist, pièces, signature
et clôture (depuis D215, étendue par 9K13, 9K22, 9L08B).

**Nouvelle section « Petits défauts relevés »** : les quatre items donnés par le pilote, verbatim,
statut `a_ecrire`.

`DATE_ETAT_FEUILLE_DE_ROUTE` → `22/11/2026`.

## Point 2 — épreuve de contenu ajustée (`1a142e494`)

`tests/unit/feuille-de-route/contenu.test.ts` vérifiait les neuf éléments de l'audit du 10/11 mot pour
mot. Trois ont migré vers « Livré » (B1/M1, B2/M3, m10a) : l'épreuve vérifie désormais les **six qui
restent**, toujours mot pour mot et avec leurs statuts — aucune assertion de structure ou de statut
retirée, seulement mise à jour pour suivre le contenu devenu vrai.

Pas d'autre épreuve touchée : `grep` sur les titres de section et sur `SECTIONS_FEUILLE_DE_ROUTE` dans
`tests/`, `app/`, `lib/`, `docs/` ne montre que `tests/e2e/9ic5-feuille-de-route.spec.ts` (qui lit
`SECTIONS_FEUILLE_DE_ROUTE[1].titre` dynamiquement, jamais un texte en dur) et le fichier de contenu
lui-même.

## Point 3 — captures AVANT/APRÈS (`d03b59ae1`)

Nouveau spec `tests/e2e/captures-9l30-feuille-de-route-22-11.spec.ts` (page entière, `fullPage: true`,
1280 et 375 px). AVANT pris dans un worktree temporaire sur `1cd61d5b0` (recette de mémoire
`captures-avant-apres-e2e` : `git worktree add`, lien symbolique vers `node_modules`, copie de `.env`,
spec copié dans le worktree, `CI=1`, jamais `reuseExistingServer`) ; APRÈS pris dans ce worktree-ci, après
le commit du contenu. Les quatre PNG sont dans
`docs/propositions/9L30-FEUILLE-DE-ROUTE-22-11/captures/`.

## `docs/captures/` — NON régénéré, et pourquoi

`pnpm captures:etat` rend 50 fichiers de surface changés depuis la prise du 14/11 (`6d207f0`) —
**aucun n'appartient à ce lot** : `lib/feuille-de-route/contenu.ts` et le nouveau spec de capture ne
sont ni dans `app/`, ni dans `components/`, ni dans `lib/i18n/`, ni dans `lib/theme/`, ni
`app/globals.css`. La dérive des 50 fichiers vient de lots déjà fusionnés avant celui-ci (9L14,
9L08B, 9L04…) qui n'ont pas rejoué la prise de vue générale. La page `/feuille-de-route` elle-même
n'est de toute façon pas dans le tableau des ~100 écrans de `docs/captures/README.md`. Régénérer les
~400 images de ce corpus est hors du périmètre de ce ticket (« Mets à jour la feuille de route. Rien
d'autre. ») et aurait consommé l'essentiel du budget de temps sans rapport avec la demande — **signalé
ici plutôt que fait en silence**, pour que le prochain lot qui touche un écran couvert sache que la
dérive est antérieure et cumulée.

## Épreuves rejouées

- `pnpm exec playwright test tests/e2e/9ic5-feuille-de-route.spec.ts` : 3/3.
- `pnpm exec vitest run tests/unit/navigation/feuille-de-route-entree.test.ts` : 12/12.
- `pnpm exec vitest run tests/unit/feuille-de-route/contenu.test.ts` : 3/3 (après le point 2).
- `pnpm test` : 537 fichiers, 6026 tests, vert.
- `pnpm test:isolation` : 259 fichiers, 2525 tests, vert.
- `CI=1 pnpm verify` : format:check, typecheck, lint, test, test:isolation, build — vert de bout en
  bout.
- Les deux specs `captures-9ic5-feuille-de-route.spec.ts` et `captures-9k25a-feuille-de-route-audit.spec.ts`
  n'ont pas été rejoués : ils ne portent aucune assertion sur le CONTENU (titres de section, comptes),
  seulement sur le titre de page et la présence du lien de menu — rien de cela n'a changé. Les captures
  qu'ils produisent (dans leurs propres dossiers `docs/propositions/9IC5…` et `docs/propositions/9K25A…`)
  datent d'avant ce lot et ne sont donc plus à l'image du contenu actuel ; signalé plutôt que régénéré,
  pour la même raison de périmètre que `docs/captures/`.

## Ce qui reste ouvert, honnêtement

- `verify:full` n'a pas été rejoué (réservé à la file de nuit, par consigne).
- Les captures des deux anciens specs 9IC5/9K25A sont datées et montrent l'ancien contenu — à
  rafraîchir par le prochain lot qui touche cette page, ou par un geste dédié si Alexis le demande.
