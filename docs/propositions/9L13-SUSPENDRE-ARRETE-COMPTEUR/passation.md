# 9L13-SUSPENDRE-ARRETE-COMPTEUR — passation

Démarré le 18/11/2026 à 08:00 (Nouméa), budget 90 min.

## La règle tenue

Décision d'Alexis du 10/11/2026 (« OK ») : suspendre une intervention ferme
désormais le segment de compteur ouvert, dans la même transaction que le
changement de statut. Avant ce lot, `cloturerIntervention` et
`annulerIntervention` REFUSAIENT déjà quand un compteur tournait (D160,
QT-4) — `suspendreIntervention` seule laissait courir le compteur pendant
une attente de pièce, et le temps mesuré pré-remplissait le temps validé
d'une durée qui n'était pas du travail.

## Ce qui est livré

### Point 1 — la suspension ferme le segment, en base

`lib/interventions/depot.ts` (`suspendreIntervention`) :

- avant d'écrire `statut = 'suspendue'`, cherche le segment OUVERT sur
  CETTE intervention (`fin IS NULL`) — celui d'un renfort compris, jamais
  seulement celui de l'auteur de la suspension (un renfort peut encore
  travailler quand le bureau suspend) ;
- s'il en existe un, le ferme (`fin = instant`, l'heure de l'agence, comme
  le reste de la fonction) PUIS relit tous les segments de l'intervention et
  réécrit `temps_mesure_min` comme leur somme — même ordre et même calcul que
  `arreterLeCompteur` (`depot-compteur.ts`) : le déclencheur
  `intervention_temps_mesure_est_celui_du_compteur` exige que cette colonne
  soit exactement cette somme, et il faut donc fermer le segment AVANT de
  l'écrire ;
- aucun segment ouvert (l'intervention n'a jamais démarré de compteur, ou
  l'a déjà arrêté) : rien de plus ne s'écrit, `temps_mesure_min` reste ce
  qu'il était.

`reprendreIntervention` n'était déjà touché par aucun geste sur
`segment_travail` — vérifié, la reprise n'ouvre toujours aucun segment,
seul un geste explicite sur le compteur (« Démarrer »/« Reprendre le
compteur ») en rouvre un.

### Point 2 — la file hors réseau

Vérifié dans `lib/terrain/envoi-file.ts` (`ORDRE_PIPELINE`) : `compteur`
(rang 0) part déjà avant `suspendre` (rang 3) — rien à changer là. Et avec
le point 1, l'ordre importe désormais moins qu'avant : la seule entrée
`suspendre`, envoyée seule, suffit à faire fermer le segment côté serveur
— aucun geste `compteur: arrêter` n'est jamais mis en file par
`BoutonSuspendreTerrain` (vérifié dans le composant), et il n'en a plus
besoin.

### Point 3 — épreuves et captures

- `tests/isolation/suspension.test.ts` — cinq scénarios nouveaux : aucun
  segment ouvert après suspension ; le temps mesuré est figé (n'augmente
  pas avec l'horloge) ; la reprise n'ouvre rien ; une suspension sans
  compteur en cours ne touche à rien ; le segment d'un RENFORT se ferme
  aussi quand ce n'est pas lui qui suspend.
- `tests/e2e/9l13-suspendre-arrete-compteur.spec.ts` (nouveau) — en ligne et
  en mode avion, à 375 et 1280 px : le bandeau « Le compteur tourne
  depuis » disparaît après « J'attends une pièce », remplacé par le refus
  de redémarrage (`compteur.refus.suspendue`) ; en mode avion, seule la
  suspension part en file (jamais un arrêt explicite), et le segment est
  pourtant bien fermé une fois « Envoyer » pressé — la preuve que le point
  1 couvre ce cas sans aide du client.
- Captures dans `docs/propositions/9L13-SUSPENDRE-ARRETE-COMPTEUR/captures/`
  (avant/après, 375 et 1280 px) pour le scénario en ligne.
- `docs/arbitrages.md` — D270.

## Ce qui n'a pas été livré, et pourquoi

Aucune migration : rien ne manquait en base pour ce geste (`segment_travail`
et son unicité « un seul segment ouvert par personne » existaient déjà).

## Note sur l'environnement de ce poste

`pnpm build` (donc `CI=1 pnpm verify`, dernière étape) a échoué par manque
de mémoire sur la passe « Linting and checking validity of types » de
`next build`, à la limite `--max-old-space-size=6144` fixée dans
`package.json` — alors que `pnpm typecheck` et `pnpm lint`, joués juste
avant dans la MÊME exécution de `pnpm verify`, passent sans alerte à cette
même limite. Rejoué isolément avec `--max-old-space-size=9216`, `next
build` passe sans erreur. Mesuré : ce n'est pas une régression de ce lot —
aucun fichier de ce lot n'ajoute une surface significative au typage de
l'application, et le même échec se reproduit à l'identique sur une
exécution de `pnpm build` seul, sans rapport avec `suspendreIntervention`.
Rien n'a été changé dans `package.json` pour contourner ceci : une
augmentation de la limite committée serait une décision distincte, hors de
ce ticket.

## Reprise 9L13A-REPRISE-MEMOIRE-BUILD (18/11/2026, 09:51-10:05 Nouméa)

Reporté (cherry-pick, sans modification) les trois commits de
`9L13-SUSPENDRE-ARRETE-COMPTEUR-garde` (`12badd6c6`, `5b049974e`,
`3f0d3f0e7`) sur une branche partant d'`origin/main` (`6edb6dd52`, tip au
moment du rebase — aucun commit `9L13-SUSPENDRE-ARRETE-COMPTEUR` n'y était
déjà entré). Cherry-pick sans conflit.

### Mesures (`/usr/bin/time -v`, Maximum resident set size), à froid

Cache vidé avant CHAQUE mesure (`rm -rf .next`, et `rm -f
tsconfig.tsbuildinfo` pour `typecheck` — un premier essai a montré que ce
fichier, non suivi par git, survit à un `git checkout` et fait tomber
`pnpm typecheck` à 11 s / 1,7 Go au lieu d'une passe complète : écarté de
toutes les mesures retenues ci-dessous).

| État | Commande | Pic RSS | Résultat |
|---|---|---|---|
| `origin/main` seul (`6edb6dd52`) | `pnpm typecheck` | 6 253 128 Ko puis 6 311 656 Ko (deux essais) | VERT |
| `origin/main` seul (`6edb6dd52`) | `pnpm build` | 6 473 516 Ko puis 6 481 556 Ko (deux essais) | **ROUGE (OOM)** |
| + 3 commits 9L13 | `pnpm typecheck` | 6 347 644 Ko | VERT |
| + 3 commits 9L13 | `pnpm build` | 6 464 856 Ko | **ROUGE (OOM)** |

### Constat

**`pnpm build` déborde déjà sur `origin/main` seul, sans aucun commit de
9L13, de façon reproductible (deux essais consécutifs, à cache vidé).** Le
pic mesuré avec les trois commits de 9L13 appliqués (6 464 856 Ko) n'est
pas plus haut que celui mesuré sur `origin/main` seul (6 473 516 /
6 481 556 Ko) — dans la marge de bruit d'une mesure à l'autre. Le diff de
9L13 n'ajoute donc pas de poids mesurable à ce débordement.

Ceci contredit la lecture du mandat (« 9L12, publié à 08:00 sur la même
base, a passé `pnpm build` au même plafond » / « le diff de 9L13 fait
franchir la marge ») : au moment de cette mesure (09:51-10:03), la marge
de `pnpm build` sur `origin/main` seul est déjà nulle, voire légèrement
négative. Le passage vert de 9L12 à 08:00 ne peut s'expliquer que par la
nature du plafond lui-même : si proche de la limite, l'issue (« Ineffective
mark-compacts near heap limit ») dépend de l'ordre d'allocation et du
moment des passes de ramasse-miettes, pas seulement du volume de types à
vérifier — à quelques dizaines de Mo de la limite, deux exécutions
identiques peuvent conclure différemment. Ce n'est pas un biais de cette
mesure : refait deux fois de suite sur `origin/main` seul, le résultat est
chaque fois rouge.

Six lots ont touché `prisma/schema.prisma` depuis le correctif de
9L04A-MEMOIRE-BUILD-CAUSE (`6e403d7e0`, 13/11) : `12a9f7afb` (9L04),
`fc5b7b7bc` (9L03C), `38025f272` (9L04I), `d325c80f7` (9L04E), `196be2dee`
et `8d9e6f7da` (9L04J), `be40a8991` (9L07). La marge que 9L04A avait créée
en posant 34 `@ignore` sur des réciproques Prisma jamais navigées s'est
vraisemblablement érodée lot après lot depuis, chacun ajoutant une relation
ou un champ sans dépasser individuellement le seuil visible — exactement le
risque que 9L04A nommait déjà comme ouvert (« rien n'empêche une future
réciproque non ignorée de refaire déborder »).

### Suite de ce lot

Conformément au point 4 du mandat (« si, sur `origin/main` seul, le pic est
déjà au plafond, marge nulle, ARRÊTE-toi ») : ce lot s'arrête ici. Rendre le
diff de 9L13 moins coûteux à typer n'aurait aucun effet mesurable sur la
cause du débordement, puisque celui-ci existe et se reproduit sans ce
diff. Retoucher `depot.ts` aurait été un geste cosmétique sans rapport
avec la cause mesurée.

Pistes chiffrables pour une décision d'Alexis (aucune appliquée ici) :

1. **Auditer `prisma/schema.prisma` pour de nouvelles réciproques non
   `@ignore`** apparues dans les six commits listés ci-dessus, à la
   manière de 9L04A — candidat le plus direct, puisque c'est le registre où
   9L04A avait trouvé le poids dominant.
2. **Séparer la vérification de types de `next build`** (ex. :
   `next build` avec `typescript.ignoreBuildErrors` et un `tsc --noEmit`
   distinct en amont dans la CI) — `pnpm typecheck` seul tient à 6,2-6,3 Go
   sans jamais déborder dans ces mesures ; c'est la passe interne de
   `next build` qui ajoute l'écart fatal. Ceci est un changement de
   `next.config.ts` et de la chaîne `verify`, donc un point d'arrêt (§8) et
   non une décision de ce lot.
3. **Relever le plafond** — explicitement écarté par ce mandat, mais à
   nommer : la marge nécessaire semble être de l'ordre de quelques centaines
   de Mo (l'écart typecheck/build mesuré est d'environ 150-250 Mo), pas de
   plusieurs Go.

Rien n'a été modifié dans `lib/interventions/depot.ts`,
`prisma/schema.prisma`, `package.json` ni `next.config.ts`. Aucune épreuve
n'a été rejouée au-delà des mesures ci-dessus : le mandat ne demande les
étapes 5 et 6 (rejouer `verify`, rebase final) qu'après une réduction
effective, qui ne s'applique pas ici.

## Reprise 9L13B-REPRISE-SUSPENDRE-COMPTEUR (18/11/2026, 14:44-15:10 Nouméa)

Troisième et dernier essai de la chaîne 9L13 (règle D23). Les deux essais
précédents ont mesuré, sans y toucher, une cause commune à tous les lots du
18/11 : la marge nulle de `pnpm build` sur `origin/main` seul. Cette cause a
été refermée entre-temps par **9L16A-MEMOIRE-BUILD-MARGE** (publié sur
`origin/main`, 36 réciproques Prisma `@ignore`, marge annoncée ~300 Mo, même
plafond `--max-old-space-size=6144`) : ce lot n'avait donc plus qu'à vérifier
que le diff de 9L13 passe désormais, pas à corriger quoi que ce soit.

Reporté (cherry-pick, sans modification) les quatre commits de
`9L13A-REPRISE-MEMOIRE-BUILD-garde` — les trois commits originaux de 9L13
(`21bd0ecb7`, `b6267e6d3`, `9edd565f9`) plus le commit de mesure de la
reprise A (`91f606ad5`) — sur une branche partant d'`origin/main`
(`3aa6c74bb`, tip au moment du rebase). Cherry-pick sans conflit, dans cet
ordre, sur les quatre commits.

**Numéro d'arbitrage** : D270 était déjà le numéro porté par les commits
reportés. Vérifié sur `origin/main` au moment du rebase (`3aa6c74bb`) :
`docs/arbitrages.md` s'arrête à D269, et aucune autre occurrence de
« D270 » n'existe dans le dépôt — D270 était donc le numéro suivant LIBRE,
sans collision avec la D270 écrite par 9L15 (celle-ci n'est pas encore
entrée sur `origin/main`). Aucune renumérotation nécessaire.

Le diff de ce lot (`3aa6c74bb..`, 9 fichiers, 675 lignes) ne touche ni
`prisma/schema.prisma` ni `lib/i18n/fr.ts` : aucune réciproque Prisma
nouvelle à marquer `@ignore`, aucun libellé neuf ou renommé, donc rien à
balayer dans les localisateurs `getByText`/`getByRole` de `tests/e2e/**`
pour ce lot.

### Mesure du pic de `pnpm build` (`/usr/bin/time -v`, cache vidé)

| État | Commande | Pic RSS | Résultat |
|---|---|---|---|
| Ce lot sur `origin/main` (3aa6c74bb + 4 commits 9L13) | `pnpm build` | 5 994 136 Ko | **VERT** |

Plafond : `--max-old-space-size=6144` → 6 291 456 Ko. Marge mesurée :
**≈ 297 320 Ko (≈ 290 Mo)** — cohérente avec la marge ~300 Mo annoncée par
9L16A. Le débordement mesuré par les deux essais précédents (reprise 9L13 et
reprise 9L13A, pic ≥ 6 464 856 Ko sur `origin/main` d'alors) a disparu avec
le correctif de 9L16A ; ce lot n'a rien ajouté pour l'obtenir.

### Épreuves rejouées au premier plan (`CI=1`, `--workers=1` où applicable)

- `tests/e2e/9l13-suspendre-arrete-compteur.spec.ts`, `tests/e2e/fiche-suspendue-gestes.spec.ts`
  (famille « suspen* »), `tests/e2e/9k13-terrain-attente-piece.spec.ts`,
  `tests/e2e/9l04g-terrain-barre-fixe-terminer.spec.ts`,
  `tests/e2e/tous-les-ecrans-rendent.spec.ts` : 70 passés, 4 ignorés
  (préexistants, non liés à ce lot).
- `pnpm test:isolation` : 250 fichiers, 2299 tests, VERT.
- `CI=1 pnpm verify` (format:check, typecheck, lint, test, test:isolation,
  build) : VERT de bout en bout, aucune étape rouge.

### Captures

Celles de 9L13 (375/1280 px, avant/après) restent la référence : ce lot n'a
touché aucun écran, rien à refaire.

### Conclusion

La chaîne 9L13 se clôt ici, verte. Rien d'autre à committer : `git status`
propre après le rebase final sur `origin/main`.
