# 9L54A-TERRAIN-PRECHARGE-FRAME-SELF — passation

## Ce qui a été fait

### Point 1 — reproduction

`tests/e2e/offline/9l54a-terrain-precharge-frame-self.spec.ts` (nouveau) : connexion
technicien (monte `/terrain`, donc `CopieLocaleTerrain` → `PrechargementCoquille`), puis
vérifie qu'aucune frame n'atterrit sur `chrome-error:` et que la console ne porte aucune
violation CSP « frame-ancestors ». Vérifié ROUGE sur le code d'avant ce lot (en remettant
temporairement `frame-ancestors 'none'` / `X-Frame-Options: DENY` dans `next.config.ts`,
sans committer ce retour en arrière) : l'échec reproduit EXACTEMENT ce que 9L54 avait
mesuré isolément —

```
- Expected  - 1
+ Received  + 3
+ Array [
+   "chrome-error://chromewebdata/",
+ ]
```

Vert avec le correctif du point 2.

### Point 2 — le correctif

`next.config.ts` : `frame-ancestors 'none'` → `frame-ancestors 'self'`,
`X-Frame-Options: DENY` → `X-Frame-Options: SAMEORIGIN`. Aucune autre directive de la
politique de contenu touchée. L'encadrement par un AUTRE site reste refusé (protection
anti-détournement de clic de 9L08 intacte) ; seul l'encadrement SAME-ORIGIN, celui que
`components/terrain/copie-locale.tsx` demande pour préchauffer `/terrain-hors-reseau`,
redevient possible.

Commentaire de tête de `next.config.ts` mis à jour (pourquoi `'self'`, et pas `'none'`
ni `*`).

`tests/unit/entetes-http.test.ts` (nouveau) : importe `next.config.ts` et vérifie
directement la valeur produite par `headers()` — `frame-ancestors 'self'`, jamais
`'none'` ni `*` ; `X-Frame-Options: SAMEORIGIN`. Vérifié qu'il rougit bien si on
reremet `'none'`/`DENY` (fait à la main pendant ce lot, puis annulé).

### Point 3 — les épreuves existantes

`tests/e2e/9l08-en-tetes-securite.spec.ts` mis à jour : `ENTETES_COMMUNES` attendait
`DENY` / `frame-ancestors 'none'` — corrigé en `SAMEORIGIN` / `frame-ancestors 'self'`,
avec une assertion supplémentaire `not.toContain("frame-ancestors *")`. Ce n'est pas un
assouplissement : l'épreuve prouve toujours la même règle (les en-têtes de 9L08 sont
posés partout, identiques entre bureau/terrain/API/`/premier-acces`), seule la valeur
attendue change parce que la règle elle-même change (D286).

Rejoué, avec la nouvelle épreuve : `tests/e2e/9l08-en-tetes-securite.spec.ts`,
`tests/e2e/offline/9f4h1-consultation.spec.ts`, `tests/e2e/offline/
9f4h4-ouverture-a-froid.spec.ts`, `tests/e2e/offline/socle-pwa.spec.ts`,
`tests/e2e/9i1-scanner-hors-reseau.spec.ts`, `tests/e2e/9k28a-point-photo-hors-reseau.
spec.ts`. Tous verts en isolation (`--workers=1`). Un run groupé à 4 workers a d'abord
fait échouer `9f4h1-consultation` et `9f4h4-ouverture-a-froid` par interférence de
workers parallèles sur le même compte technicien (décomptes de boutons faux) — rejoué
chacun seul, les deux passent ; ce n'est pas une régression de ce lot (cohérent avec
[[e2e-semis-partage-parallele]] en mémoire).

### Point 4 — l'à-côté signalé par 9L54

`scripts/captures.mts` : l'exemple de commande du README généré (fonction
`redigerReadme`) et le `refusConnu` de l'écran `arrivee-sans-societe` montraient
`COURRIEL_MULTI=direction@codima.test`. Depuis 9L04L (14/11/2026), l'identité correcte
pour `COURRIEL_MULTI` est `admin.societe@codima.test` (habilitée sur une seule société
par défaut (`prisma/seed-data.ts`), à qui il faut ajouter EN SQL une seconde
habilitation — sur la seule base jetable de la prise, jamais dans `prisma/seed-data.ts`
— pour la rendre multi-société) ; `COURRIEL` reste `direction@codima.test`, déjà
multi-société par construction du seed. Trois occurrences corrigées (le littéral de
l'exemple, la phrase qui l'explique, le `refusConnu` de l'écran). Texte seul — aucun
changement de logique.

### Point 5 — vérification

`pnpm test` : 543 fichiers, 6113 tests, vert. `pnpm test:isolation` : 269 fichiers, 2587
tests, vert. `CI=1 pnpm verify` (format + typecheck + lint + test + test:isolation +
build) : vert — une première passe a rougi sur `format:check` (prettier) pour les deux
specs e2e touchées ; corrigé par `prettier --write`, commit séparé, `verify` rejoué
intégralement vert. Aucune capture régénérée (aucun écran ne change) ; les PNG de
`docs/propositions/9F4H4B-OUVERTURE-A-FROID/`, `9I1-SCANNER-HORS-RESEAU/` et
`9K28-CHECKLIST-REPONSE-PHOTO/` touchés en cours de route par les epreuves rejouées
localement ont été restaurés à l'identique (effet de bord des specs qui photographient,
pas un changement d'écran).

## `docs/arbitrages.md`

D286 ajouté : `frame-ancestors 'self'` plutôt que `'none'`, condition de réouverture
écrite (si `copie-locale.tsx` cesse un jour d'encadrer `/terrain-hors-reseau`, relire
`tests/e2e/offline/9l54a-terrain-precharge-frame-self.spec.ts` avant de resserrer la
politique, pas la supprimer en même temps que le composant).

## Pas de migration

Aucune migration dans ce lot.

## Rien d'autre ouvert

Le reste des `erreurs console` relevées par 9L54 (`terrain-intervention`, 0 → 2) n'a pas
été creusé ici : la note de 9L54 identifiait la MÊME cause (`frame-ancestors`) pour les
deux écrans — `/terrain` ET `/terrain/[id]` montent tous deux `CopieLocaleTerrain` — et
ce lot corrige la cause commune. Si une régénération future de la galerie montre encore
une erreur sur l'un de ces deux écrans après ce correctif, c'est une cause DIFFÉRENTE et
non celle que ce ticket visait.
