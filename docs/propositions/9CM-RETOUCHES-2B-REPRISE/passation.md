# 9CM-RETOUCHES-2B-REPRISE — passation

Reprise de 9CH (resté sans commit le 30/09, voir sa branche de sauvegarde
`9CH-RETOUCHES-2B-COMPOSANTS-inacheve`, non réutilisée). Constat remesuré sur
`5127b1b` (main au départ de ce lot). Sept commits de code, puis les captures
et cette passation.

## Ce que j'ai changé (et ce que ça change pour l'exploitation)

1. **Points 12-13 — tuiles et lien doublon** (`cb95b19`). Les quatre tuiles
   « Dossiers bloqués », « En retard » (tableau de bord), « En cours »,
   « En attente » (registre) étaient cliquables (D140) ET portaient en plus
   un second lien texte au même `href`, juste en dessous — un doublon. Ce
   lien est retiré pour les quatre ; la tuile elle-même reste le seul chemin.
   « En retard » n'ouvre plus rien quand elle affiche « 0 » (`lienEnRetard`,
   `app/(back-office)/tableau-de-bord/presentation.ts`) — amende D140 pour ce
   seul cas, comme la maquette du 28/09. Pour un exploitant : un geste de
   clic en moins à ignorer sur ces quatre tuiles, et plus de zone cliquable
   fantôme sous « En retard » quand il n'y a rien à voir. D144 (décisions du
   30/09, points 12-15) consigne ces quatre décisions dans
   `docs/arbitrages.md`.
2. **Point 15 — icônes « Portail client » et « Votre parc »** (`b5ff2a4`).
   `globe` (back-office) et `machine` (portail) — choix du PILOTE, À
   CONFIRMER par Alexis sur les captures (`docs/propositions/9CM-RETOUCHES-2B-REPRISE/captures/apres/barre-portail-parc-1280.png`
   pour la seconde ; la première n'a pas de capture, voir plus bas). Aucun
   compte de back-office ne voit aujourd'hui l'entrée « Portail client »
   (`consulter_parc_propre` n'est accordée qu'au rôle `CLI` dans
   `lib/auth/habilitations.ts`) — ce n'est pas un défaut de ce ticket, c'est
   une situation antérieure, mesurée en passant.
3. **Anneau de focus de la barre sombre** (`6b2ff5b`, « laissé au pilote »).
   L'anneau général (`--ring`/`--ring-focus`, déclaré à `:root`) ne suivait
   pas le thème de la colonne (posé par `data-apparence` sur `<body>`) : sur
   fond marine (`--app-chrome-fond`), le contraste tombait à ≈1,40:1 (50 %
   d'opacité) voire ≈2,07:1 à 100 % — sous le 3:1 WCOG AA exigé par la spec
   §3.9. La colonne (`data-chrome` sur l'`<aside>`) reçoit sa propre règle,
   avec `--app-chrome-lien` — déjà un jeton existant, ≥3:1 dans les deux
   thèmes déclarés. Aucune couleur nouvelle.
4. **État vide et hauteurs de bouton** (`ccbc923`, « laissé au pilote »).
   `EtatVide` : 12 px gras → 14 px/400 (le corps de `.empty` dans la
   maquette du 28/09, et le texte courant de la spec §3.2) ; **aucun écran**
   ne l'utilise aujourd'hui (voir plus bas). `Button` : l'échelle devient
   32/40/48 px (`default` 36→40, `lg` 40→48, `icon` 36→40 ; `sm` inchangé à
   32), suivant la spec §3.4 et la maquette. Les six boutons du terrain
   passent `size="lg"` pour atteindre la cible tactile de 44 px (CDC §13.4) —
   avant ce ticket, ils tenaient 32 ou 36 px, sous la cible. 56 px (`.xl` de
   la maquette) n'est PAS repris, hors des deux cibles déjà en vigueur
   (32 bureau, 44 terrain).
5. **La spécification suit GR5 pour la puce de priorité** (`829a465`, point
   14). Aucun code ne change : `tonDePriorite` (P1 rouge, P2 orange, P3/P4
   gris) était déjà la seule correspondance employée par les six écrans
   concernés. Seule la spécification du 28/09 (§3.4 :257, « P1 rouge plein,
   P2 orange clair, P3/P4 en contour ») contredisait encore GR5 ; elle est
   réécrite pour s'aligner.
6. **Captures et tests** (`3005e43`, `52582f5`) — voir plus bas.

## Ce que j'ai mesuré (comptes AVANT/APRÈS)

- **Lien doublon** : `tests/unit/ui/tuiles-sans-doublon.test.ts` (nouveau) —
  témoin ROUGE constaté avant le commit `cb95b19` (les quatre clés
  `interventions.lien_kpi_en_cours`/`en_attente`,
  `tableau_de_bord.lien_dossiers_bloques`/`lien_en_retard` présentes dans les
  deux pages), VERT après.
- **Icônes** : `tests/unit/navigation/icones-du-menu.test.tsx` — `EXCEPTIONS`
  passait de `["nav.portail_client"]` à `[]` ; ROUGE constaté avant
  `b5ff2a4` sur le cas « `nav.portail_parc` porte une icône » (inversé) et
  sur le cas neuf « aucune icône n'est partagée par deux entrées », VERT
  après.
- **Contraste du focus** : `tests/unit/theme/focus-barre-sombre.test.ts`
  (nouveau) — ÉPREUVE `--app-marque` contre `--app-chrome-fond` : **2,06:1**
  (calculé par le gardien, cohérent avec le ≈2,07:1 mesuré à la main dans le
  constat) ; `--app-chrome-lien` contre `--app-chrome-fond`/`--app-chrome-actif` :
  **10,58:1** / **3,91:1** (thème maquette), **8,40:1** / **5,44:1** (thème
  « tableau », jamais sélectionnable à l'exécution). Les trois
  AU-DESSUS de 3:1 ; le premier SOUS 3:1 — exactement l'écart que la règle
  neuve corrige.
- **Boutons** : avant ce ticket, les six boutons du terrain tenaient 32 px
  (`size="sm"`, cinq occurrences) ou 36 px (`default`, une occurrence),
  SOUS la cible de 44 px ; après, `size="lg"` = 48 px, AU-DESSUS. Mesuré par
  lecture directe du code (`buttonVariants`), pas par capture d'écran du
  terrain (voir « ce que je n'ai pas fait »).
- **État vide** : `tests/unit/ui/composants-base.test.tsx` — `text-[12px]` →
  `text-14`, ROUGE constaté avant `ccbc923` sur les deux cas (sans/avec
  `titre`), VERT après. `EtatVide` n'a toujours aucun appelant dans `app/`
  (`grep -rn EtatVide app components` : ses seuls appelants restent ses
  propres tests).
- **Priorité** : `tests/unit/ui/priorite-une-correspondance.test.ts`
  (nouveau) — témoin de non-vacuité, exactement les six fichiers attendus
  (`interventions/[id]`, `interventions`, `demandes/[id]`, `demandes`,
  `planning`, `ui/priorite`), tous important `tonDePriorite` ; aucun fichier
  hors `lib/theme/priorites.ts` n'associe `p1`…`p4` à un ton (épreuvé sur un
  extrait fabriqué, et sur les trois faux positifs potentiels nommément
  écartés : `planning/page.tsx:1968`, `tableau-de-bord/presentation.ts`,
  `lib/interventions/depot.ts`, qui portent un FILTRE ou un RANG, jamais un
  ton).
- **Suite complète** : `CI=1 pnpm verify:full` intégral, un seul appel —
  format, typecheck, lint, 3635 tests unitaires, 1296 tests d'isolation,
  build, échéance des fériés, partitions d'audit, puis 744 tests e2e passés
  (7 ignorés, structurels, sans rapport avec ce ticket) en ~29,6 minutes.
  Aucun échec.

## Ce que j'ai tranché et pourquoi

- **D144** (`docs/arbitrages.md`) regroupe les quatre décisions du 30/09
  appliquées ici (points 12 à 15) sous un seul numéro, à la suite de D143 (le
  numéro D144 était libre, vérifié au départ — D141 réservé à PG-G14, D142 à
  D147 déjà pris). Elle amende D140 sur un seul point (« En retard » à zéro).
- **Icônes `globe`/`machine`** : transcrites ÉLÉMENT POUR ÉLÉMENT depuis
  `ICONS` de la maquette (`globe` :1722 ; `machine` existait déjà). Aucune
  forme neuve hors de cette planche — cela aurait rouvert le gardien
  `icone.test.tsx`, hors territoire de ce ticket.
- **`/portail` sert deux entrées, un seul chemin** : la table
  `ICONE_PAR_CHEMIN` (par chemin) ne peut pas leur donner deux icônes
  différentes — une seconde table, `ICONE_PORTAIL_PAR_CLE`, lève
  l'ambiguïté PAR `cle`, réservée à ce seul chemin.
- **Le jeton direct, jamais un alias** : la nouvelle règle CSS
  (`[data-chrome] :focus-visible`) lit `var(--app-chrome-lien)` directement,
  jamais une variable déclarée sur `:root` qui retomberait dans le même
  défaut de cascade que celui qui motive ce correctif.
- **56 px non repris** : hors des deux cibles déjà établies (32 px bureau,
  44 px terrain, CDC §13.4) ; 48 px suffit à la cible terrain sans introduire
  une troisième mesure.
- **État vide à 14 px/400, jamais 12 px/700** : c'est la lecture directe de
  `.empty p` de la maquette (sans taille propre → hérite du corps, 14 px/400)
  et de la spec §3.2 (texte courant), pas une décision inventée pour ce
  composant sans appelant.

## Ce que je n'ai PAS fait

- **Pas de balayage complet de `scripts/captures.mts`** (48 écrans, quatre
  identités dont deux avec second facteur) pour les boutons et l'état vide.
  Justification coût/portée : `EtatVide` n'a aucun appelant (rien à
  photographier) ; les boutons du terrain sont couverts par la suite e2e
  existante, intégralement VERTE après le changement de taille
  (`rapport-terrain.spec.ts`, `bon-4.spec.ts`, `terrain-largeur.spec.ts`,
  `coque-375.spec.ts`, `barre-titres-espaces.spec.ts`,
  `planning-telephone-onglets.spec.ts`, `captures-pgd1b-jour-suite.spec.ts` —
  tous rejoués et verts avant le commit du lot) ; un balayage à quatre
  identités pour re-confirmer visuellement ce que ces 20+ tests vérifient
  déjà fonctionnellement n'a pas semblé proportionné au temps qu'il
  coûterait. **À signaler à Alexis** : si une revue visuelle complète du
  terrain est requise malgré ces tests, elle reste à faire séparément.
- **Pas de capture de « Portail client » dans le tiroir de menu** : aucun
  rôle de back-office ne la voit aujourd'hui (`consulter_parc_propre`
  réservée à `CLI`) — rien à photographier sous un compte de l'épreuve.
- **Pas de capture du thème « tableau »** pour l'anneau de focus : ce thème
  n'est pas sélectionnable à l'exécution (`APPARENCE_PAR_DEFAUT` fige
  « maquette » dans `app/layout.tsx`), donc aucune route ni cookie ne permet
  de le visiter en session réelle.
- **Pas de capture « En retard » à zéro** : la scène partagée portait 15
  (puis 16, selon le moment de la prise) interventions en retard — jamais
  zéro pendant toute cette session. La preuve que la tuile n'a plus de lien
  à zéro reste le test unitaire (`lienEnRetard(0)` → `undefined`) et le
  gardien e2e qui force une intervention en retard
  (`tests/e2e/tuiles-cliquables.spec.ts`).

## Les pièges pour la session suivante

- **Aucune icône pour « Portail client » n'est visible nulle part en
  session réelle** (tous rôles de back-office confondus) : si un ticket
  futur change la matrice d'habilitations pour l'autoriser, c'est À CE
  MOMENT qu'une capture devient possible — ne pas supposer un défaut de ce
  ticket si l'icône « manque » à l'écran.
- **Le thème « tableau » est du code mort en exécution** (`APPARENCE_PAR_DEFAUT`
  fige « maquette ») : tout gardien qui prétend l'éprouver « en vrai » (pas
  seulement en lisant les jetons CSS) se heurtera à la même impasse que ce
  ticket a documentée pour les captures.
- **La régénération des migrations/seed dans un `git worktree`** fonctionne
  bien avec `node_modules` lié par symlink (pas de réinstallation) — voir le
  README des captures pour la recette complète, déjà éprouvée par 9CL/GR17
  et reconduite ici sans surprise.

## Ce qui reste à faire

- Confirmation d'Alexis sur les deux icônes choisies (`globe`, `machine`) —
  aucun blocage, choix du pilote en attendant.
- Confirmation d'Alexis que la tuile « En retard » à zéro garde son ton
  rouge (la maquette passe au ton « good » à ce moment précis, non repris
  ici — hors du périmètre des points 12-15).
- Si une revue visuelle complète du terrain est jugée nécessaire malgré la
  suite e2e verte, elle reste à planifier (balayage `scripts/captures.mts`
  avec le compte technicien).
