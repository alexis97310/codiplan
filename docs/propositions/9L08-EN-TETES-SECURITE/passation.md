# 9L08-EN-TETES-SECURITE — passation

Décision d'Alexis du 10/11/2026 : les en-têtes de sécurité HTTP se posent une seule fois, dans
`next.config.ts`. Mesuré sur `81894e0` : ni `next.config.ts`, ni `vercel.json`, ni `middleware.ts`
n'en posait aucun. Arbitrage : D261.

## AUCUNE MIGRATION

Ce lot ne touche ni au schéma ni à une migration — la portée reste la couche de configuration de
l'application.

## Ce qui a été fait

1. **`next.config.ts`** — un bloc `headers()` : `Content-Security-Policy` (sources mesurées sur un
   build de production — `'unsafe-inline'` pour `script-src`/`style-src` car le routeur
   d'applications sert ses données de flux sans jeton substituable et des composants posent un
   style en ligne calculé ; `blob:` pour `img-src`, l'aperçu d'une photo réduite côté terrain ;
   `frame-ancestors 'none'`, `object-src 'none'` ; `connect-src`/`font-src` à `'self'` seul, aucune
   police ni aucun appel ne venant d'un domaine tiers), `X-Frame-Options: DENY`,
   `X-Content-Type-Options: nosniff`, `Referrer-Policy: strict-origin-when-cross-origin` par
   défaut, et `Permissions-Policy: camera=(self), microphone=(), geolocation=()` (seul le lecteur
   de QR code ouvre `getUserMedia` ; la photo terrain passe par `<input capture>`, hors de cette
   politique). `/premier-acces` reçoit en plus un `Referrer-Policy: no-referrer` propre : le jeton
   de premier accès vit dans son URL et ne doit fuiter par aucun en-tête `Referer`.
2. **`tests/e2e/9l08-en-tetes-securite.spec.ts`** — une épreuve par famille de réponse (une page du
   bureau, une page du terrain, une réponse d'API, `/premier-acces`) qui lit les en-têtes d'une
   vraie réponse de production.
3. **`tests/e2e/captures-9l08a-en-tetes-securite.spec.ts` (créé)** — trois écrans capturés APRÈS, en
   375 et 1280 px (bureau, coquille terrain hors réseau, accueil du portail), pour prouver
   l'ABSENCE de régression visuelle plutôt qu'un changement — aucun en-tête HTTP ne se voit à
   l'écran.

## Épreuves

- `tests/e2e/9l08-en-tetes-securite.spec.ts` : les quatre familles portent les mêmes en-têtes
  communs, et seul `/premier-acces` porte `Referrer-Policy: no-referrer`.
- `tests/e2e/captures-9l08a-en-tetes-securite.spec.ts` : capture et vérifie (en-têtes de section
  attendus visibles) les trois écrans cités, sans régression.
- Rejoué sans régression, contre le code livré : `tests/e2e/offline/socle-pwa.spec.ts`,
  `tests/e2e/offline/9f4h3-mode-avion.spec.ts`, `tests/e2e/9g10-scanner-qr.spec.ts`,
  `tests/e2e/9i1-scanner-hors-reseau.spec.ts`, `tests/e2e/9l04e-terrain-photos-epurees.spec.ts`,
  `tests/e2e/9k28a-point-photo-hors-reseau.spec.ts`, `tests/e2e/9k02-portail-menu-accueil.spec.ts`,
  `tests/e2e/tous-les-ecrans-rendent.spec.ts` — 97 passées, 4 ignorées (préexistant, sans rapport
  avec ce lot).

## Reprise (16/11/2026)

Le lot était parti le 15/11 à 19:50 et s'est arrêté net (extinction du poste) après deux commits
(`09d2c3f7d`, `24243ce81`, conservés intacts sur `9L08-EN-TETES-SECURITE-garde`), sans jamais
atteindre la vérification ni les captures. Les deux commits ont été repris par cherry-pick,
sans modification, sur une branche `9L08A-EN-TETES-SECURITE` partant d'`origin/main` à jour ; ce
lot a ajouté la rejoue de régression, les captures APRÈS et cette passation.

`pnpm typecheck` et `pnpm lint` passent sans erreur ni avertissement.
