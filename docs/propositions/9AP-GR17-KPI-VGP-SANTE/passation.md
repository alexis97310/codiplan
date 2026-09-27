# 9AP-GR17-KPI-VGP-SANTE — passation

## Ce que j'ai changé

Trois finitions, sans migration, sans ligne de semis, sans prix, sans règle de gestion changée
(audit GR du 26/09, constats M8, M9, M17).

1. **M8 — « Non calculé » ne se lit plus comme une mesure.** Le tableau de bord rendait ce texte
   dans le même corps que le grand chiffre des tuiles calculées (`text-[27px] font-extrabold`),
   pour les deux tuiles qui ne savent rien calculer (« Taux d'occupation », toujours ; « VGP à
   prévoir », quand le registre n'a jamais reçu de vérification). Une fonction `nonCalcule()`
   propre à `app/(back-office)/tableau-de-bord/page.tsx` enveloppe désormais ce texte dans un
   `<span data-non-calcule>` qui reprend la taille et la graisse du détail de la tuile
   (`text-[11px] font-normal`, les mêmes jetons que la ligne de détail), rien d'autre.
   **Ce que ça change pour l'exploitation** : un œil qui parcourt le bandeau des quatre tuiles
   distingue immédiatement les deux chiffres réels des deux mentions « non disponible », sans
   avoir à lire le mot lui-même.
2. **M9 — le registre VGP sans retour redondant, le bandeau des indéterminés souligné, « Échéance
   dépassée » une seule fois.** Trois sous-points :
   - Le lien « ‹ Retour au parc » de l'en-tête de `/vgp` est retiré, avec la clé `vgp.retour` —
     la barre de navigation atteint déjà `/parc`, et rien ne justifiait ce second chemin.
   - Le bandeau des familles à déterminer (`/vgp/a-determiner`) porte désormais
     `underline underline-offset-2` en plus de ses jetons orange, et ses deux libellés
     (`vgp.indetermines.lien`, `…lien_une`) se terminent par « → » — les mêmes jetons de lien que
     `CLASSES_LIEN` porte ailleurs, posés en littéral pour garder la couleur orange du bandeau.
   - `libelleEcheance` (`lib/vgp/libelles.ts`) ne préfixe plus la date dépassée par « Échéance
     dépassée — » : la colonne Échéance rend `<date> (<n> jours)`, sans répéter ce que le badge
     d'état, dans la colonne voisine, dit déjà. La clé `vgp.echeance.depassee` est retirée.
   **Ce que ça change pour l'exploitation** : le bandeau orange se reconnaît désormais comme un
   lien au premier coup d'œil (avant, seuls sa couleur et son curseur le trahissaient), et la
   colonne Échéance du registre gagne en largeur pour ce qu'elle est censée montrer — la date —
   plutôt que de répéter un mot déjà affiché deux colonnes plus loin.
3. **M17 — la page Santé ne compte plus ce qu'elle ne montre pas.** `sante.sous_titre` annonçait
   « Quatre questions, quatre réponses » ; la page (`app/(sans-session)/sante/page.tsx`) rend CINQ
   lignes (base, rôle, migrations, sociétés, comptes). Le décompte est retiré du sous-titre, la
   phrase qui reste est inchangée.
   **Ce que ça change pour l'exploitation** : une personne qui consulte `/sante` sans compte ne
   lit plus une annonce fausse dès la première ligne.

## Ce que j'ai mesuré (comptes AVANT/APRÈS)

`pnpm format:check` et `pnpm test` (3019 tests) verts avant chaque commit ; `pnpm typecheck` et
`pnpm lint` vérifiés après chaque point, sans erreur ni avertissement. `CI=1 pnpm verify:full`
rejoué en entier après le dernier commit : format, typecheck, lint, 3019 tests unitaires,
isolation, build, `feries:horizon`, `audit:partitions`, puis 429 tests e2e — 426 passés, 3 ignorés,
zéro échec.

Captures AVANT/APRÈS dans `captures/`, à 1280 et 375 px, prises par
`tests/e2e/captures-9ap-gr17-kpi-vgp-sante.spec.ts` (committé, gardé par la variable
d'environnement `CAPTURES_9AP` — silencieux sous `pnpm test:e2e` ordinaire) : une fois sur le
commit `3d8e4fa` (avant le lot, dans un `git worktree` séparé), une fois sur le code livré
(après les quatre commits de ce lot) :

- `tableau-de-bord-{avant,apres}-{1280,375}.png` — vérifié visuellement : AVANT « Non calculé »
  est au même corps que « 2 » ou « 1 » sur les tuiles voisines ; APRÈS il est visiblement plus
  petit et plus clair, comme la ligne de détail sous chaque tuile.
- `vgp-{avant,apres}-{1280,375}.png` — vérifié visuellement : AVANT l'en-tête porte
  « ‹ Retour au parc », le bandeau orange n'est pas souligné et dit « 1 famille reste à
  déterminer » sans flèche, la ligne `NUS-SPL-2022-0007` dit « Échéance dépassée — 28/01/2026
  (243 jours) » dans la colonne Échéance ; APRÈS le lien de retour a disparu, le bandeau est
  souligné et se termine par « → », la même ligne dit seulement « 28/01/2026 (243 jours) » dans
  cette colonne (le badge « Échéance dépassée » reste dans la colonne État, inchangé).
- `vgp-depassees-{avant,apres}-{1280,375}.png` — `/vgp?etat=depassees` — même écart que
  ci-dessus, sur la vue filtrée.
- `fiche-machine-vgp-depassee-{avant,apres}-{1280,375}.png` — la fiche de `NUS-SPL-2022-0007`
  (`/parc/<id>`) — vérifié visuellement : même écart de préfixe sur la ligne d'échéance de la
  fiche, qui partage `libelleEcheance` avec le registre.
- `sante-{avant,apres}-{1280,375}.png` — vérifié visuellement : AVANT le sous-titre commence par
  « Quatre questions, quatre réponses. » ; APRÈS il commence directement par « Cette page ne
  demande aucun compte ».

## Ce que j'ai tranché et pourquoi

**Le dossier des captures est `docs/propositions/9AP-GR17-KPI-VGP-SANTE/captures/`, pas
`9AP-GR17-TABLEAUX/` comme l'écrivait la consigne.** Les trois tickets GR17 précédents
(`9AM-GR17-DEVISE-MATERIEL`, `9AN-GR17-BARRE-PLANNING-TON`, `9AO-GR17-DEMANDE-CHAMP-NATURE`)
rangent chacun leurs captures sous leur PROPRE identifiant de ticket, jamais sous un dossier
partagé par famille — et ce ticket lui-même s'appelle `9AP-GR17-KPI-VGP-SANTE` partout ailleurs
dans sa propre consigne (le chemin de cette passation en particulier). J'ai suivi le nom du
ticket, cohérent avec le reste de la consigne et avec les trois précédents, plutôt que la seule
ligne qui le contredisait.

**Le bandeau des indéterminés reprend `underline underline-offset-2` en littéral plutôt que
`CLASSES_LIEN`.** `CLASSES_LIEN` (`lib/theme/apparence.ts`) porte aussi une couleur
(`text-app-marque`, bleu) que le bandeau ne doit pas prendre — il garde ses jetons orange
(`border-app-orange-bord bg-app-orange-fond text-app-orange-encre`), posés par un ticket antérieur
et hors du territoire de celui-ci. Composer les deux classes de décoration à la main évite
d'écraser une couleur qui n'est pas en cause.

**La flèche « → » est écrite dans les DEUX valeurs du dictionnaire
(`vgp.indetermines.lien`/`…lien_une`), jamais dans le JSX.** Même règle que le gardien
`sans-chaine-visible-en-dur` applique déjà à `tableau_de_bord.lien_vgp_a_prevoir` et aux autres
liens « Voir X → » du dépôt : un symbole visible à l'écran passe par `fr.ts`, pas par une
concaténation dans le composant.

## Ce que je n'ai PAS fait

Rien du territoire du lot n'a été laissé de côté. Hors territoire, comme prévu : `components/
ui/kpi.tsx` n'a pas changé (seul l'appelant du tableau de bord enveloppe sa valeur) ; le filtre
auto-appliqué de « VGP à prévoir » sur le tableau de bord (mentionné par M8 mais explicitement
hors lot) n'a pas été touché ; `lib/db/sante.ts` (commentaire « Quatre questions » non affiché,
ligne 11) n'a pas été modifié ; M7 et M15 n'ont pas été traités.

## Les pièges pour la session suivante

**`page.locator("header").first()` ne cible pas l'en-tête de `Page`.** Chaque écran du
back-office porte DEUX éléments `<header>` : celui de `components/navigation/bandeau-mobile.tsx`
(masqué à `min-[901px]:hidden`, mais PREMIER dans le DOM) et celui de `components/mise-en-page/
page.tsx` (titre, sous-titre, actions). `vgp-finitions.spec.ts` rougissait sur `toBeVisible()` en
plein 1280 px avant correction. Le sélecteur qui marche :
`page.locator("header").filter({ has: page.getByRole("heading", { level: 1 }) })`.

**Les lignes du prompt qui citent des numéros de ligne précis (`l.297-306`, `l.2097`, …) avaient
dérivé** : le dépôt a bougé depuis l'audit du 26/09, et chaque emplacement a dû être retrouvé par
son contenu (`grep`) plutôt que par son numéro. Rien d'étonnant à ce que la prochaine session
retrouve le même écart.

## Ce qui reste à faire

Rien pour ce lot. M7 et M15, explicitement hors territoire, restent à qualifier dans un futur
ticket GR17 si l'audit du 26/09 les maintient.
