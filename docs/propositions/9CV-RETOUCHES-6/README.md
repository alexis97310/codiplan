# 9CV-RETOUCHES-6

Aucun écran touché ni créé : ce lot ne porte que sur des tests unitaires, un outil de test
partagé (`tests/unit/outils/fichiers-source.ts`) et deux scripts de connexion à la base
hébergée (`scripts/lib/delai-connexion.ts`, `scripts/controle-cloisonnement.mts`). Il n'y a
donc **aucune capture d'écran** — rien à photographier.

Voir `passation.md` pour le détail, et ci-dessous la sortie des épreuves — ROUGE avant
correction (baseline `main` à `e785ae5`, les six fichiers de ce lot remis à leur état
d'origine par `git stash`), VERT après.

## ROUGE (baseline, avant correction)

```
$ pnpm vitest run tests/unit/outils/fichiers-source.test.ts \
    tests/unit/ui/priorite-une-correspondance.test.ts \
    tests/unit/theme/focus-barre-sombre.test.ts \
    tests/unit/ci/delai-connexion.test.ts \
    tests/unit/ci/controle-attend-le-reveil.test.ts

 Test Files  5 passed (5)
      Tests  50 passed (50)
```

Vert en apparence : les CINQ fichiers passent, parce que les épreuves NEUVES des points 1
à 5 n'existaient pas encore dans cette version. La preuve du ROUGE est donc apportée
différemment pour chaque point — en rejouant la fonction D'ORIGINE contre l'épreuve
NEUVE, mesure par mesure (détail et verdicts exacts dans `passation.md`, section « Ce que
j'ai mesuré ») :

- point 1 — `appelleTonDePriorite` (ancienne) sur une fonction LOCALE `tonDePriorite(`
  sans import : rend `true` (attendu `false`) ;
- point 2 — `regleFocusChrome` (ancienne, `exec` sans `g`) sur un CSS à deux blocs dont le
  second repose `var(--ring)` : rend le premier bloc, non `null` (attendu `null`) ;
- point 3 — `sansCommentaires` (ancienne) sur `"a ? b :// note"` : rend la chaîne
  inchangée, commentaire conservé (attendu `"a ? b :"`) ; sur
  `"<a>https://x</a>; // vrai"` : rend la chaîne inchangée, `vrai` non retiré ;
- point 4 — `avecDelaiDeConnexion` (ancienne) sur
  `"postgresql://u:p@h:5432/b?options=-c%20x"` : rend `…options=-c+x&connect_timeout=30`
  (ré-encodé, attendu l'octet `%20` intact) ;
- point 5 — `connecterAvecReessai` : n'existait pas dans `scripts/lib/delai-connexion.ts`
  (import impossible).

## VERT (après correction, fichiers de ce lot restaurés)

```
$ pnpm vitest run tests/unit/outils/fichiers-source.test.ts \
    tests/unit/ui/priorite-une-correspondance.test.ts \
    tests/unit/theme/focus-barre-sombre.test.ts \
    tests/unit/ci/delai-connexion.test.ts \
    tests/unit/ci/controle-attend-le-reveil.test.ts

 Test Files  5 passed (5)
      Tests  60 passed (60)
```

Dix épreuves de plus (50 → 60), toutes vertes — le détail par point est dans
`passation.md`.
