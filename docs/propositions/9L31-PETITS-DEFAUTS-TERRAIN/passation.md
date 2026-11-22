# 9L31-PETITS-DEFAUTS-TERRAIN — passation

Quatre petits défauts relevés par le pilote sur les captures des lots de la semaine (demande d'Alexis du 22/11/2026
~20:05, « oui » sur la section « Petits défauts relevés » de la Feuille de route).

## Point 1 — barre fixe du terrain, libellé coupé à 375 px (9L04G)

**Mesuré** : `components/terrain/barre-action-terrain.tsx` pose un conteneur `flex gap-2` pour « Suspendre » et
« Terminer l'intervention ». Le bouton « Terminer » porte `flex-1` (`components/terrain/rapport-automatique.tsx`),
mais la classe de base du composant `Button` (`components/ui/button.tsx`) porte `whitespace-nowrap`. Un enfant
flexible dont le texte ne peut jamais revenir à la ligne garde, par l'algorithme standard de dimensionnement
minimal des flexbox, une largeur minimale ÉGALE à la largeur de son texte entier — `flex-1` ne peut alors QUE
grandir, jamais rétrécir sous cette largeur. À 375 px, « Suspendre » + le texte entier de « Terminer
l'intervention » dépassent la largeur disponible : le libellé déborde du bouton (visuellement « coupé » au bord
de l'écran, le conteneur n'ayant pas de défilement horizontal).

**Corrigé** : `min-w-0` sur le bouton lève ce plancher implicite ; `whitespace-normal` autorise alors le texte à
revenir à la ligne plutôt que déborder. Le libellé reste ENTIER (« Terminer l'intervention », jamais raccourci —
aucune décision écrite n'autorise un libellé court) ; la hauteur passe de `h-14` (fixe) à `min-h-14` pour pouvoir
grandir sur deux lignes sans rogner le texte, et le conteneur du bouton s'étire avec lui (`align-items: stretch`,
déjà le comportement par défaut de `barre-action-terrain.tsx`, inchangé). Vérifié qu'à 375 PX le libellé tient sur
une seule ligne (mesure réelle) ; à 320 px, il peut passer sur deux lignes — jamais tronqué, jamais hors écran.

**Épreuve** : `tests/e2e/9l04g-terrain-barre-fixe-terminer.spec.ts`, assertion ajoutée — `scrollWidth <=
clientWidth` du bouton, à 375 PUIS à 320 px.

## Point 2 — feuille « Terminer l'intervention ? », grand vide (9K27)

**Mesuré** : la feuille de confirmation (`rapport-automatique.tsx`) et son fond étaient LA MÊME boîte `fixed
inset-0` — toujours la hauteur du viewport entier. Le bloc des boutons portait `mt-auto`, qui le poussait
systématiquement tout en bas de cette boîte. Avec une liste de manques courte (3 lignes, par exemple), le
contenu n'occupait qu'une fraction de l'écran, et `mt-auto` creusait le vide entre lui et les boutons.

**Corrigé** : la feuille est maintenant une boîte À PART (`role="dialog"`) à l'intérieur d'un fond `fixed inset-0`
(`justify-end`, pour l'ancrer en bas). La boîte prend la hauteur de SON contenu, plafonnée à `max-h-[85dvh]` ; sa
zone qui peut grandir (titre, liste des trois informations, bloc des manques) défile en interne
(`overflow-y-auto`, `min-h-0`, `flex-1`) ; le bloc des boutons, hors de cette zone, n'a plus de `mt-auto` et reste
toujours visible, juste après le contenu. Un fond visible (diffusion `bg-app-encre/40`) subsiste désormais
AU-DESSUS de la feuille quand elle est courte — c'est la preuve visuelle qu'elle épouse son contenu.

**Épreuve** : `tests/e2e/9k27-terrain-terminer-ce-qui-manque.spec.ts`, assertion ajoutée sur le scénario « trois
manques » (le plus court) — la boîte `role="dialog"` a une position `y` nettement sous le haut de l'écran (fond
visible au-dessus), et « Confirmer la fin » reste dans le viewport sans défiler la page.

## Point 3 — checklist, points chiffrés mal alignés (9L08F)

**Mesuré** : un point chiffré (`valeur_mesuree`) ne rejoignait le régime « sur sa propre ligne, champ en dessous »
(`components/terrain/checklist-terrain.tsx`, `surSaPropreLigne`) que par un EFFET DE BORD : quand la ligne
« Dernier relevé » (longue) laissait trop peu de place sur la même ligne que le champ, le retour à la ligne
automatique (`flex-wrap`) poussait visuellement le champ en dessous. Un point chiffré SANS dernier relevé
(libellé court) gardait, lui, son champ à droite — même type de point, deux mises en page différentes selon le
hasard du texte affiché, et donc une incohérence visuelle quand les deux coexistent dans la même rubrique.

**Corrigé** : `valeur_mesuree` rejoint explicitement `surSaPropreLigne`, au même titre que les listes de choix et
les points non conformes. Le champ est maintenant TOUJOURS sous le libellé, qu'il porte un dernier relevé ou non
— la ligne « Dernier relevé » s'ajoute sans déplacer le champ. Cible tactile inchangée (`h-12` = 48 px ≥ 44 px),
texte inchangé (16 px).

**Épreuve** : `tests/e2e/9l08f-checklist-dernier-releve.spec.ts`, nouveau test — même position horizontale du
champ (même bord gauche que le libellé) et champ strictement sous le libellé, pour les DEUX points de la même
rubrique (avec et sans dernier relevé), à 375 px.

## Point 4 — « D135 » employé pour trois décisions, pas deux

**Mesuré** (plus que ce que demandait le ticket, et c'est important) : le ticket nommait deux faits portant
« D135 » — la règle « une réponse modifiée annule sa validation » (RG-INT-03, ticket 9H1-RAPPORT-VALIDE-AVANT-
CLOTURE, 22/10/2026, cité en commentaire de code) et la numérotation annuelle des interventions (ticket
9H2-NUMEROTATION-INTERVENTIONS, 23/10/2026, `docs/decisions/2026-10-23-numerotation-annuelle.md`). **En ouvrant
`docs/arbitrages.md`, un TROISIÈME fait porte déjà, et LÉGITIMEMENT, « D135 » : « UNE INTERVENTION PLANIFIÉE GARDE
UNE HEURE » (QG-4), rendu le 27/09/2026 et commité dans le registre le 29/09/2026 — donc ANTÉRIEUR aux deux
autres.** Ni 9H1 ni 9H2 n'a de section dans `docs/arbitrages.md` : les deux ont simplement cité « D135 » en
commentaire ou en tête de document SANS VÉRIFIER le registre, 9H2 reprenant apparemment la même erreur que 9H1 le
lendemain. 9L21 (ticket antérieur) avait déjà repéré en passant la collision 9H1/9H2, sans la corriger — hors de
son périmètre à l'époque
(`docs/propositions/9L21-DOCS-CHAPITRE-10-MATRICE/passation.md`) — et n'avait pas vu que D135 était en réalité
DÉJÀ pris par QG-4.

**Décidé** : D135 reste à QG-4, inchangée (c'est elle qui l'a reçu EN PREMIER). Entre les deux usurpations, RG-INT-
03/9H1 (22/10) est antérieure à 9H2 (23/10) : elle devient **D278**, et 9H2-NUMEROTATION-INTERVENTIONS devient
**D279** — le prochain numéro libre après D277. Deux nouvelles sections dans `docs/arbitrages.md`, suivant le
patron déjà établi par D218/D219/D220/D221 (« Note de numérotation : … ce numéro est déjà pris … enregistrée ici
sous DNNN »), chacune avec sa propre « Note de numérotation » expliquant la collision à trois. La D279 renvoie
vers `docs/decisions/2026-10-23-numerotation-annuelle.md` plutôt que de recopier son contenu intégral (seule
l'étiquette était fausse).

**Tous les renvois vivants mis à jour** : code (`lib/`, `app/`), tests (`tests/`), chapitre 10
(`docs/cahier-des-charges.md`), le document de décision lui-même. **Non touché, volontairement** : les passations
HISTORIQUES (`docs/propositions/**/passation.md`) qui citaient déjà « D135 » à l'époque — elles décrivent un état
passé, pas une référence vivante ; 9L21 note même explicitement « rien n'a été renuméroté ici », ce qui reste
vrai et cohérent avec ce lot.

**Gardien vérifié** : `tests/unit/docs/citations-decisions-code.test.ts` (toute référence `Dxx` nue doit résoudre
vers une décision écrite) et `tests/unit/docs/cablage-arbitrages.test.ts` / `amendements-arbitrages.test.ts`
passent sur les deux nouvelles sections — la ligne `**Règles amendées :**` de D279 ne porte pas de liste de
règles (ni D278, dont la ligne suit directement un sous-titre `###`, ce qui l'exempte déjà du même contrôle par
construction du registre).

**Feuille de route** : la ligne « Numéro d'arbitrage D135 employé pour deux décisions différentes » retirée de la
section « Petits défauts relevés » (`lib/feuille-de-route/contenu.ts`) ; les trois autres petits défauts passent
en « Livré » avec la référence 9L31 ; la section « Petits défauts relevés », désormais vide, est retirée (une
carte vide n'aurait rien montré).

## Épreuves jouées, au premier plan

- `pnpm test` — 537 fichiers, 6027 tests, VERT.
- `pnpm test:isolation` — 262/263 fichiers verts ; **un échec, 100 % hors périmètre de ce lot** (voir ci-dessous).
- `npx playwright test` ciblé sur `9l04g-terrain-barre-fixe-terminer.spec.ts`, `9k27-terrain-terminer-ce-qui-
  manque.spec.ts`, `9l08e-non-conforme-suite-obligatoire.spec.ts`, `9l08f-checklist-dernier-releve.spec.ts`,
  `tous-les-ecrans-rendent.spec.ts` — TOUT VERT (4 skip pré-existants, non liés).
- `CI=1 pnpm verify` — `format:check`, `typecheck`, `lint`, `test` VERTS ; `test:isolation` bloque sur l'échec
  décrit ci-dessous ; `pnpm build` rejoué séparément à la main, VERT.

### Un échec DÉCOUVERT, hors du périmètre de ce ticket — à signaler à Alexis

`tests/isolation/absence.test.ts > … > LEVER LE BLOCAGE NE REND PAS LES CRÉNEAUX, et c'est écrit — LA TRACE
SURVIT` échoue depuis le passage de minuit RÉEL, dimanche 22/11 → **lundi** 23/11/2026, PENDANT ce lot (T0 à
23:37 le 22, ce constat à 00:xx le 23). Le test calcule `LUNDI_A_VENIR_JOUR`/`VENDREDI_A_VENIR_JOUR` au chargement
du fichier, à partir de la date RÉELLE au moment de l'exécution — exactement le défaut que CLAUDE.md désigne
(« aucune date en dur comparée à l'heure courante »), mais ici c'est le TEST lui-même qui porte le défaut, pas le
code applicatif. **Vérifié, n'a AUCUN rapport avec ce lot** : reproduit à l'identique (même assertion, même
« expected [uuid] / received [] ») en revenant au commit de départ `3090a5c30` (avant toute modification de ce
lot), sur le working tree temporairement, puis restauré sans rien perdre (`git checkout HEAD -- .`). Aucun
fichier de ce lot n'est importé par `tests/isolation/absence.test.ts` ou par ce qu'il teste
(`lib/absences`/calendrier). Je n'ai PAS touché ce test ni le code qu'il éprouve — interdit absolu de ce lot et
de toute session. **À signaler et à rouvrir séparément** : le lundi est un jour particulier pour un calcul de
« lundi à venir », et mérite sa propre enquête.

## Captures

AVANT/APRÈS demandées en préambule — **seules les captures APRÈS ont été prises** (`docs/propositions/9L31-
PETITS-DEFAUTS-TERRAIN/captures/`, 375 px) : le correctif a été écrit avant la pause « mesure d'abord » prévue au
point 0, un oubli de processus de ma part. Les trois écrans touchés sont correctement photographiés dans leur
état CORRIGÉ (réutilisation des captures produites par les épreuves e2e existantes, qui couvrent exactement les
mêmes écrans). La régression est de toute façon gardée par les assertions ajoutées (scrollWidth, position du
fond, position du champ), pas seulement par la capture. **`scripts/captures.mts` (le rafraîchissement global de
`docs/captures/`) n'a pas été rejoué** dans ce lot, par manque de temps dans le budget de 90 minutes (base
jetable + build + serveur + 65+ écrans) — à faire à la prochaine occasion si quelqu'un veut `docs/captures/` à
jour avec ces trois écrans.

## Ce qui n'a pas été touché

Aucune migration. Aucune règle métier changée (contenu de la checklist, blocages de « Terminer » inchangés).
Bouton « Reprendre » (en enquête, 9L08C/9L08CA/9L29) non touché. `depot/` et les scripts de file non touchés.
