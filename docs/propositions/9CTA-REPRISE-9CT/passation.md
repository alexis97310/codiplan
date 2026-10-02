# Passation — 9CTA-REPRISE-9CT

Dépôt `alexis97310/codiplan`, `main` local. Reprise de 9CT-RETOUCHES-5, recalée une fois
(02/10 ~23:05 NC) sur un seul rouge. Les six commits de la branche `9CT-RETOUCHES-5-garde`
ont été reportés sur `main` par `git cherry-pick`, SANS conflit, puis un septième commit
résout le point resté ouvert. **Rien poussé.**

```
0890980 9CTA-REPRISE-9CT — la liste des laissées sous la grille
1d80437 9CT-RETOUCHES-5 — passation
c2a39ec 9CT-RETOUCHES-5 — captures AVANT/APRÈS (décision 7)
5ef7ec6 9CT-RETOUCHES-5 — D141, paragraphe RETOUCHES-5 (décisions 6 et 7)
a6ca4f0 9CT-RETOUCHES-5 — Transmettre toutes les planifiées prêtes exclut les passées (décision 7)
8386a02 9CT-RETOUCHES-5 — une Affectée remise dans la file prévient le technicien (décision 6)
255665a 9CT-RETOUCHES-5 — les courriels partent après la transaction
```

---

## 1. Ce que j'ai changé, et ce que ça change pour l'exploitation

**Le bloc « Laissées, à compléter » (`app/(back-office)/planning/page.tsx`) se rend
désormais APRÈS la grille de la vue courante**, au lieu d'au-dessus — un seul
déplacement dans le JSX, contenu, clés i18n, et ordre des lignes strictement
inchangés. **Pour l'exploitation** : sur la vue Jour, à 1280×800, la légende (« N
techniciens · N créneaux libres · … ») et la grille elle-même redeviennent visibles
sans défiler, quel que soit le nombre de lignes « Date passée » que porte la liste des
laissées (grossie depuis la décision 7 de 9CT-RETOUCHES-5). Le bouton « Transmettre
toutes les planifiées prêtes » et son dialogue de confirmation restent à leur place, au-
dessus de la grille — seule la liste permanente des laissées descend.

---

## 2. Ce que j'ai mesuré (comptes AVANT/APRÈS)

**`tests/e2e/planning-jour-en-tete.spec.ts`** — ROUGE, mesuré deux fois sur
`main`+cherry-pick avant ce commit (« viewport ratio 0 » à 1280×800, identique aux deux
passages de la session recalée) ; VERT après ce commit, rejoué isolément
(`pnpm playwright test tests/e2e/planning-jour-en-tete.spec.ts
tests/e2e/planning-laissees-sous-la-grille.spec.ts` → 3 passed) et dans
`CI=1 pnpm verify:full` complet.

**`CI=1 pnpm verify:full`, résultat complet, mesuré sur HEAD** :
- `format:check`, `typecheck`, `lint` : verts.
- `pnpm test` : **3746 passés / 3746** (dont les 9 ajoutés par 9CT-RETOUCHES-5, déjà
  comptés dans sa propre passation, plus aucun test unitaire neuf dans ce commit).
- `pnpm test:isolation` : **1317 passés / 1317**, inchangé (aucune table touchée).
- `pnpm run build` : vert.
- `feries:horizon`, `audit:partitions` : verts.
- `pnpm test:e2e` : **770 passés, 7 skipped, 0 échoué** — contre 767 passés / 7 skipped /
  1 did not run / 1 ÉCHOUÉ mesuré par la session recalée. Le seul rouge nommé par le
  ticket est résolu ; aucun autre test n'a changé de verdict.

**`CI=1 pnpm verify:full` est donc ENTIÈREMENT VERT** à la fin de cette session.

**Captures AVANT/APRÈS** (`docs/propositions/9CTA-REPRISE-9CT/captures/`, `/planning?vue=jour`,
scène de démonstration, commit `1d80437` vs `0890980`) : AVANT, la liste des laissées (13
lignes « Date passée » mesurées) repousse la légende et la grille hors du cadre à
1280×800 ; APRÈS, légende et grille sont visibles immédiatement sous la bannière, la
liste des laissées apparaît plus bas, inchangée dans son contenu.

---

## 3. Ce que j'ai tranché et pourquoi

**Le point d'insertion choisi est la fermeture de la grille à deux colonnes**
(immédiatement après le `</div>` qui ferme `grid items-start gap-4 …`), avant le panneau
« Charge par technicien », plutôt qu'à l'intérieur de chacune des branches `vue === "jour"
? … : vue === "mois" ? … : …`. C'est le seul endroit commun aux quatre vues (jour,
semaine, deux semaines, mois) ET à la mise en page réduite du téléphone (qui est la même
arborescence, sous des classes responsives `max-[900px]:hidden`, pas une branche
séparée) — dupliquer le bloc dans chaque branche de vue aurait réécrit la même liste
quatre fois pour un seul déplacement.

**Le bloc reste À L'INTÉRIEUR de `<Posable>`**, dans la même position relative au
panneau de charge qu'avant ce lot (juste au-dessus) : `Posable` ne fait que fournir le
contexte de glisser-déposer aux boutons `BoutonPoser`, qu'aucune ligne de la liste des
laissées n'utilise — la sortir de `Posable` n'aurait rien changé à l'écran, et l'y garder
évite une restructuration de plus hors du mandat de ce ticket.

**Le garde-fou e2e neuf forge sa propre scène** (préfixe `9CTA-`, une Planifiée complète
mais datée d'il y a 5 jours) plutôt que de compter les lignes « Date passée » du jeu de
démonstration : le piège connu de 9CT-RETOUCHES-5 (ce compte dérive avec le temps) rendait
tout seuil fixe faux dès le lendemain. La ligne forgée est repérée par son lien
`a[href="/interventions/<id>"]`, jamais par un texte affiché — un texte littéral dans la
requête d'écran (essayé d'abord avec la raison sociale du client forgé) est refusé par le
gardien `tests/unit/i18n/sans-chaine-visible-en-dur.test.ts` dès qu'il est porté par une
constante du fichier, littérale ou non (forme 3, « deux temps »).

---

## 4. Ce que je n'ai PAS fait

- Je n'ai touché ni au contenu, ni aux clés i18n, ni à l'ordre des lignes de la liste des
  laissées — seul son emplacement dans le JSX a changé, conformément au mandat.
- Je n'ai pas plafonné, rendu défilable, ni restreint à une vue la liste des laissées
  (les deux options que la session précédente avait proposées sans trancher) : le
  déplacement sous la grille réglait la seule collision mesurée, sans qu'aucune des deux
  décisions d'ergonomie nouvelles soit nécessaire.
- Je n'ai modifié aucune assertion de `tests/e2e/planning-jour-en-tete.spec.ts` ni
  d'aucun autre test existant.
- Aucune migration, aucune ligne de semis.

---

## 5. Les pièges pour la session suivante

- **Le compte de lignes « Date passée » dérive avec le temps** (même piège que
  9CT-RETOUCHES-5) : les captures de ce lot montrent 13 lignes, mesurées le 03/10/2026 —
  ne pas les figer dans un futur test.
- **Le point d'insertion est un `</div>` de fermeture sans attribut distinctif** (fin de
  la grille à deux colonnes, juste avant le commentaire « LE DÉTAIL DE CHARGE SE POSE
  SOUS LE PLANNING ») : un futur ajout de panneau entre la grille et le panneau de charge
  devra décider de sa place par rapport à ce bloc, pas juste l'un après l'autre sans y
  penser.
- Les deux worktrees de captures (`/tmp/9cta-avant`, cherché sur le commit `1d80437`) ont
  été supprimés en fin de lot (`git worktree remove --force`) ; `git worktree list` ne
  montre que le dépôt principal à la fin de cette session.

---

## 6. Ce qui reste à faire

Rien de connu : le seul point resté ouvert par 9CT-RETOUCHES-5
(`tests/e2e/planning-jour-en-tete.spec.ts:102`) est résolu, et `CI=1 pnpm verify:full` est
entièrement vert.
