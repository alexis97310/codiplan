# 9G8E-NAV-TECHNICIEN-SANS-ENTREES-BUREAU — passation (25/10/2026)

## Décision rejouée (point 1)

Rejoué l'épreuve de 9G8D sur `origin/main` : connecté en technicien
(`garnier@codima.test`), `/absences?declarer=1` (exempté), clic sur « Planning »
dans la colonne → tableau complet atteint, sans redirection. **Confirmé rouge**,
exactement comme 9G8D l'avait mesuré. Capture AVANT dans `captures/` —
`absences-declarer-technicien-1280-avant.png` montre la colonne complète
(Planning, Demandes, Absences, Parc machines, VGP, App technicien) pour ce rôle.

## Ce qui est livré

Décision d'Alexis (25/10, ~15h20) : ne plus afficher au technicien les entrées
bureau qu'il ne peut pas ouvrir. Plutôt que de continuer à chasser le cache du
routeur (piste non refermée par 9G8D), ce lot retire les LIENS eux-mêmes —
« sans lien, rien à précharger ».

- **`lib/navigation/redirection-technicien.ts`** — nouvelle fonction
  `fermeAuTechnicienParD221(chemin, recherche?)`, extraite de la condition que
  `template.tsx` portait en toutes lettres. Seule et unique écriture de cette
  condition ; relue par le template, la barre, le menu « + Créer » et la page
  `/absences`.
- **`app/(back-office)/template.tsx`** — relit cette fonction au lieu de la
  recopier (comportement inchangé).
- **`lib/navigation/entrees.ts`** — `entreesAffichables` et `entreeVisible`
  retirent désormais, pour le SEUL rôle technicien, toute destination dont le
  chemin est fermé par D221 (en plus du filtre de capacité existant, D132).
  Résultat mesuré : les quatorze destinations du back-office disparaissent
  TOUTES pour ce rôle (y compris « Planning » et « Absences », qui survivaient
  au filtre de capacité seul — le `○` sur `consulter_planning` leur suffisait
  avant ce lot, alors que D221 fermait déjà leur route depuis le 21/10). La
  colonne bascule alors sur `BarreHorizontaleVide` (déjà le rendu du terrain
  quand `entrees` est vide, R5-01) — jamais un nouveau composant.
- **`app/(back-office)/layout.tsx`** — la marque pointe vers `/terrain` pour un
  technicien (`/planning` pour tous les autres rôles).
- **`components/navigation/menu-creer.tsx`** — le menu « + Créer » applique le
  même filtre : « Intervention » (`/interventions/nouvelle`) et « Machine »
  (`/parc/nouvelle`) disparaissent pour un technicien, malgré des capacités qui
  restent vraies pour lui (`creer_demande`, `gerer_machine`) — seule
  « Absence » (`/absences?declarer=1`) survit, exactement l'entrée que le
  ticket demandait de garder.
- **`app/(back-office)/absences/page.tsx`** — **un second filet, mesuré
  nécessaire** (voir plus bas) : redirige aussi vers `/terrain` quand un
  technicien atteint `/absences` sans `declarer=1`, par la MÊME fonction que le
  template relit (`declarationAbsenceOuverteAuTechnicien`).
- **`tests/e2e/9g8d-garde-navigation-douce.spec.ts` renommé en
  `9g8d-garde-navigation-dure.spec.ts`** (revue demandée par le ticket — ce
  fichier ne faisait que des `page.goto`, jamais un clic).

## Le chemin qui restait, mesuré et fermé (point 3d)

**Mesuré ROUGE avant correction** : fermer le volet de déclaration
(`components/ui/volet.tsx`, `<Link href="/absences">`, clic réel — pas un
`page.goto`) ne change QUE la recherche (`/absences?declarer=1` → `/absences`),
jamais le chemin. Instrumentation réseau : la requête RSC du clic atteint bien
le serveur (confirmé — pas un prefetch, pas un cache local), mais le technicien
restait sur `/absences`, jamais redirigé. Diagnostic : `template.tsx` N'EST PAS
réexécuté pour une navigation où seul le paramètre de recherche change (le
SEGMENT de route, lui, reste `/absences` → `__PAGE__`) — Next.js réutilise le
rendu déjà fait des ancêtres (layout, template) et ne rejoue que la page.
`/absences` est la SEULE route de D221 dont l'ouverture dépend de la recherche
plutôt que du seul chemin ; toutes les autres fermetures ne changent jamais
quand on change seulement la recherche, et un changement de CHEMIN, lui,
recrée bien le template (9G8D, et nos tests `9g8d-garde-navigation-dure`).
D'où le second filet posé directement dans `absences/page.tsx`, qui tranche
lui-même sur `searchParams` à chaque exécution de la page (qui, elle, s'exécute
bien à chaque navigation, contrairement à ses ancêtres).

`tests/e2e/9g8e-garde-navigation-douce.spec.ts` — deux épreuves, vertes :
1. fermer le volet (recherche seule) renvoie à `/terrain` ;
2. `/arrivee` (l'exemption elle-même) ne mène jamais au bureau. **Précision
   mesurée** : `COMPTE_TECHNICIEN_EPREUVE` n'a qu'une société (99A-ARRIVEE) —
   `/arrivee` y redirige donc AVANT toute peinture, avant et après ce lot ;
   il n'existe aucun DOM à cliquer sur cette page pour ce compte (ni « + Créer »,
   ni « Entrer »). L'épreuve « depuis `/arrivee`, + Créer > Absence » envisagée
   au point 3d n'est donc PAS exécutable avec le fixture actuel — elle
   exigerait un technicien multi-société, absent de `tests/e2e/setup/scene.ts`,
   et créer ce fixture était hors du budget de ce lot. Documenté plutôt que
   simulé.

## Épreuves (point 3)

- (a) `tests/e2e/9g8-redirection-technicien.spec.ts` — inchangé, toujours vert.
- (b) `tests/unit/navigation/barre-par-role.test.tsx` — nouvelle forme
  générale : pour le technicien, l'ENSEMBLE des liens rendus par la barre est
  confronté à `fermeAuTechnicienParD221`, pas un échantillon choisi à la main
  (`/terrain`, la marque, excepté — hors du périmètre que D221 garde).
- (c) Les mêmes fichiers couvrent ADV/responsables — inchangés (nouvelles
  assertions ajoutées, aucune retirée).
- (d) Voir ci-dessus. `tests/unit/navigation/barre-basse-bureau.test.tsx` et
  `tests/unit/navigation/menu-creer.test.tsx` mis à jour/créés pour la même
  raison (la capacité seule ne prédit plus ce qui est rendu à un technicien).

## Captures (point 4)

`captures/absences-declarer-technicien-{375,1280}-{avant,apres}.png` — la
colonne complète devient `BarreHorizontaleVide` (bandeau nu, marque + société +
déconnexion). `captures/arrivee-technicien-{375,1280}-{avant,apres}.png` —
octet pour octet identiques avant/après (voir ci-dessus : cette page ne rend
rien pour ce compte, donc rien n'y a changé).

## Vérification finale (point 5) — INCOMPLÈTE, et c'est écrit plutôt que caché

`CI=1 pnpm verify:full` a été lancé EN ENTIER, au premier plan, en un seul
appel, comme demandé. **Il n'a pas fini** : après la compilation et le semis,
il entre dans `pnpm test:e2e` (1629 tests, un seul worker sous `CI=1`) et le
run a été interrompu après 30 minutes par la limite de l'outil, toujours en
cours d'exécution (aucune anomalie visible dans la sortie partielle, sinon un
couple de marques `×°` — un test relancé par Playwright, réussi à la reprise —
et un `T` de timeout isolé, sans qu'on sache LEQUEL faute d'avoir atteint le
rapport final). La sortie partielle est conservée dans `verify-final.txt` tel
quel, sans reconstruction après coup.

**Effet de bord repéré et nettoyé avant de rendre la main** : ce run complet a
régénéré des centaines de captures PNG d'AUTRES tickets (`docs/propositions/*/
captures/*.png`, hors territoire de ce lot) — les diffs d'octets d'images déjà
établies, sans rapport avec ce lot. Restaurées par `git checkout --` avant le
commit ; les deux nouveaux fichiers d'un autre ticket (`47-AVERTISSEMENTS-1`)
supprimés. Aucune de ces captures n'a été commise par cette session.

**Ce qui EST vérifié, vert, en un seul appel** : `CI=1 pnpm verify`
(format:check + typecheck + lint + test [5120 tests unitaires] + test:isolation
+ build) — exit code 0.

**À reprendre dans un prochain lot (ou directement par Alexis)** : rejouer
`CI=1 pnpm verify:full` jusqu'au bout, avec un budget de temps dédié (plus de
30 min) — probablement en CI plutôt qu'en session interactive.

## Hors territoire, non touché

`prisma/`, `lib/auth/**` (lecture seule), `next.config.*`, `public/sw.js`,
aucune clé i18n existante modifiée, aucune dépendance nouvelle.
