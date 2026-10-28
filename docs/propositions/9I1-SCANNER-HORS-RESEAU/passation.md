# 9I1-SCANNER-HORS-RESEAU — passation

Décision A d'Alexis (28/10/2026, question 4 de l'audit du 28/10) : « rien de plus qu'une
page honnête ». Aucune capacité hors réseau nouvelle (pas de caméra hors ligne, pas de
résolution locale des QR, rien en IndexedDB).

## Le point 1 côté mesure

Épreuve jouée en direct, AVANT d'écrire `estRepliScanner` (sw.js reverté temporairement
via `git stash`, rebuild, `pnpm exec playwright test`) : technicien connecté, service
worker actif, réseau coupé (`context.setOffline(true)`) depuis `/terrain`, clic sur le
lien `href="/scanner"`.

**Mesuré** : `page.url()` devient `chrome-error://chromewebdata/`, le corps de la page est
vide. `public/sw.js` ne reconnaissait `/scanner` dans aucune de ses trois catégories
(statique, coquille, repli) ; son gestionnaire `fetch` rendait la main sans appeler
`respondWith`, et c'est le navigateur qui a ensuite tenté — et échoué — la navigation
lui-même. Rouge sur `origin/main`, confirmé.

## Une limite mesurée en cours de route, qui a changé la forme des points 1 et 4

Une fois `estRepliScanner` écrit (point 3) et `/scanner` donc intercepté par
`respondWith(fetch(requete)…)`, la même mesure (offline + clic) a cessé de donner
`chrome-error://` — mais pas en servant la coquille : **elle a rendu la VRAIE page du
scanner** (« Scanner un QR code », « Aucune caméra détectée sur cet appareil. »). Vérifié
aussi avec `context.route("**/scanner", route => route.abort())` à la place de
`setOffline` : même résultat, la vraie page s'affiche.

C'est très exactement la limite que `tests/e2e/offline/9f4h1-consultation.spec.ts`
documente déjà pour `/terrain` : un `fetch()` qu'un service worker exécute lui-même à
l'intérieur de son `respondWith` n'est affecté ni par `context.setOffline`, ni par
`context.route` (Playwright/Chromium ne les y invoque jamais) — il aboutit contre le vrai
serveur de l'épreuve, qui tourne réellement et répond normalement. Il est donc impossible,
par ce harnais, de forcer la branche `.catch()` qui sert `/scanner-hors-reseau` en repli.

**Ce que l'épreuve commise mesure à la place**, sans dépendre de ce blocage (même
discipline que 9F4H1) :

1. Le fait qui a changé reste mesurable et reste l'assertion : la navigation hors réseau
   depuis `/terrain` (clic) et vers `/parc/scanner` (navigation directe) n'atterrit plus
   JAMAIS sur l'écran d'erreur du navigateur — avant, c'était systématique.
2. Le contenu de la coquille elle-même, par navigation DIRECTE vers `/scanner-hors-reseau`
   (sans émulation réseau, donc sans dépendre de la limite ci-dessus) : titre, message de
   la décision d'Alexis, lien de retour vers `/terrain`.
3. La présence de `/scanner-hors-reseau` dans la COQUILLE préchargée à l'installation —
   `tests/e2e/offline/socle-pwa.spec.ts`, assertion de la liste close mise à jour.

Le repli lui-même (la branche `.catch()` de `public/sw.js`) reste donc vu par LECTURE,
comme celui de `/terrain` — c'est le même code, la même structure, la même limite de
harnais, pas une zone non couverte par choix.

## Ce qui a été fait

| Point | Fait | Preuve |
|---|---|---|
| 1. Mesure | Épreuve rouge constatée sur `origin/main` (ci-dessus) | Ce document ; `tests/e2e/9i1-scanner-hors-reseau.spec.ts` |
| 2. La page | `app/(sans-session)/scanner-hors-reseau/page.tsx` — sans session, sans donnée, clés `scanner.hors_reseau.titre`/`.message` neuves, lien `terrain.retour` (existante) vers `/terrain` | Capture ci-dessous |
| 3. Le repli | `REPLI_SCANNER`/`estRepliScanner` dans `public/sw.js`, même modèle que `REPLI_TERRAIN`/`estRepliTerrain` ; `/scanner` et `/parc/scanner` jamais mis en cache ; `/scanner-hors-reseau` ajoutée à `COQUILLE` ; cache `codiplan-coquille-v3` | `public/sw.js` ; `tests/e2e/offline/socle-pwa.spec.ts` mis à jour (nom de cache + liste des documents préchargés) |
| 4. Épreuve verte | `tests/e2e/9i1-scanner-hors-reseau.spec.ts`, 3 scénarios, vert `--repeat-each=2` | Rejoué localement, 6/6 vert |
| 5. Captures | 375 et 1280 px, viewport | Voir ci-dessous |
| 6. Passation | Ce fichier | — |

## Captures — 375 et 1280 px

```
-rw-r--r-- 16557  scanner-hors-reseau-1280.png
-rw-r--r-- 13999  scanner-hors-reseau-375.png
```

## Vérification finale

Voir `verify-final.txt` dans ce même dossier pour la sortie complète de `pnpm verify:full`.
