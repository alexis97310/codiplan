# 9L37-CASES-26PX-TERRAIN — passation

Décision d'Alexis du 23/11/2026 (séance de décisions, point 9 : « m11/m12 : seulement les cases de 26 px, couleurs
inchangées »). Ferme le point « m11 et m12 » de la feuille de route, laissé « à trancher » depuis l'audit technicien
du 10/11/2026. **Aucune migration** (aucune colonne touchée).

## Ce qui a été livré

1. **La règle des 26 px, partagée** — `CLASSE_CASE_TERRAIN_26PX` (`components/ui/case-a-cocher.tsx`), exportée une
   fois et consommée par les deux composants touchés, plutôt que recopiée.
2. **`CaseACocher`** (`components/ui/case-a-cocher.tsx`) — nouveau drapeau `caseTerrain26px` (défaut `false`) qui
   pose `size-[26px]` sur l'`<input>` lui-même. **Réservé au terrain** : les huit écrans de paramétrage qui
   partagent ce composant (CG8) ne passent pas le drapeau et gardent leur rendu actuel, intact. Seul
   `components/terrain/rapport-automatique.tsx` (prestations réalisées) le pose.
3. **`CocheRonde`** (`components/terrain/checklist-terrain.tsx`, la coche « fait » de la checklist) — restructurée
   en deux éléments : le `<button role="checkbox">` garde `size-11` (44 px, la cible tactile, INCHANGÉE), un
   `<span>` intérieur neuf porte désormais `CLASSE_CASE_TERRAIN_26PX` et les couleurs (vert plein / filet gris),
   inchangées elles aussi.
4. **Hors périmètre, nommément** — `PastillesConformite` (conforme/non-conforme/sans-objet), `SegmentsSuite` et
   `SegmentsChoix` (boutons `role="radio"` pleine largeur, checklist et qualité du signataire) : ce sont des
   boutons qui portent leur propre texte (« Réglé sur place », etc.), aucun glyphe séparé de case ou de radio à
   redimensionner — la décision parle de « cases », pas de ces segments. Confirmé par une recherche exhaustive :
   `components/terrain/checklist-terrain.tsx` et `components/terrain/rapport-automatique.tsx` sont les SEULS
   fichiers de la zone terrain (`app/(mobile)/terrain/**`, `app/(sans-session)/terrain-hors-reseau`) qui portent
   une case à cocher (`role="checkbox"` ou `type="checkbox"`).
5. **La coquille hors réseau n'a rien de spécifique** — `ConsultationHorsReseau` importe directement
   `ChecklistTerrain` et `RapportTerrainAutomatique` : les deux composants touchés y sont donc déjà couverts, sans
   seconde écriture. Vérifié par une épreuve dédiée (point suivant), pas supposé.

## Épreuves

- **`tests/e2e/9l37-cases-26px-terrain.spec.ts`** (nouveau) — fiche jetable PROPRE (client, site, intervention
  `en_cours`, une prestation générale, un modèle de checklist générique à un point `case_faite`), mesure
  géométrique à 375 px : la case de prestation et le cercle visuel de la coche ronde mesurent chacun entre 25 et
  27 px (tolérance ±1, même gabarit que `cases-parametrage-44.spec.ts`), leur cible (le `<label>`, le `<button>`)
  reste ≥44 px. Rejoué EN LIGNE puis HORS RÉSEAU (`context.setOffline(true)`, mêmes éléments du DOM). Repérage par
  sélecteur CSS (`input[type="checkbox"]`, `button[role="checkbox"]`) plutôt que par libellé ou nom accessible : une
  valeur de fixture n'est pas une clé du dictionnaire (gardien L0-11) — révélé par un premier essai rouge, corrigé
  avant ce commit.
- **`tests/unit/ui/case-a-cocher.test.tsx`**, **`tests/unit/terrain/checklist-terrain.test.tsx`** — rejoués,
  inchangés, toujours verts (le comportement par défaut, sans le drapeau, est identique à l'ancien).
- **`tests/unit/feuille-de-route/contenu.test.ts`** — mis à jour : trois éléments restent dans la section audit
  (l'entrée combinée « m11 et m12 » a migré, scindée, vers « Livré depuis le 31/10 » et « Décisions prises »).
- **`tests/e2e/tous-les-ecrans-rendent.spec.ts`** — rejoué en entier, vert (61 passés, 4 ignorés, inchangé).

`pnpm test` (6066 tests), `pnpm test:isolation` (2564 tests) et `CI=1 pnpm verify` (format, typecheck, lint, test,
test:isolation, build) passent tous, rejoués en avant-plan pendant ce lot. `pnpm test:e2e` en entier n'a PAS été
rejoué (budget du lot, et le mémo du poste le déconseille : plus de 30 minutes à un worker) ; la file de nuit joue
`verify:full` après ce lot.

## Captures

`docs/propositions/9L37-CASES-26PX-TERRAIN/captures/avant-375.png` (ancien code) et `apres-375.png` (code à
26 px), même fiche jetable, même scène, prises par un script temporaire (non committé) qui revient à l'état du
commit parent (`81fac70ab`) pour l'« avant » puis restaure l'état livré pour l'« après » — jamais une mesure avec
assertions assouplies ou retirées.

**`docs/captures/` (la prise de vue complète de l'application) n'a PAS été rejouée** — même limite que 9L36 :
`docs/captures/README.md` exige un geste humain irréductible (choisir un mot de passe via un lien de premier accès
émis, suivi dans un navigateur) qu'une session non interactive ne peut pas accomplir.

## Feuille de route

L'élément combiné « m11 et m12 » (« à trancher ») de la section « Application technicien — audit du 10/11/2026 »
est retiré de cette section et scindé en deux, tranchés séparément le 23/11/2026 :
- **m12** (cases à 26 px) migre, statut `livre`, vers « Livré depuis le 31/10 », référencé 9L37.
- **m11** (bleu actif / rouge erreur sur les cases) migre, statut `tranche`, vers « Décisions prises » : **non
  retenu**, les couleurs natives restent inchangées.
