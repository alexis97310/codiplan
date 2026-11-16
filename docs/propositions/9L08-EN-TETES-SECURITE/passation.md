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

## Reprise 9L08AA (17/11/2026)

9L08A était RECALÉ deux fois sur la MÊME cause : la CSP posée (`img-src 'self' blob:`) ne portait
pas `data:`, et la relecture de la signature levait une violation CSP — pas un défaut de l'épreuve,
un effet réel de la politique. Cause du second recalage (atteignabilité à 5493 ms) mesurée comme
non reproductible (voir plus bas).

### Mesure, avant correction

Toutes les sources réellement utilisées par l'application et le terrain hors réseau ont été
mesurées (grep + lecture de code, aucune supposition) :

- **`img-src`** : la signature du bon est stockée et relue en `data:image/png;base64,...`
  (`lib/interventions/depot-rapport-terrain.ts`), affichée telle quelle sur trois écrans (bon
  bureau, fiche, bon portail) — un chemin normal de l'application, pas un artefact de test.
  `blob:` reste nécessaire (aperçu photo avant envoi, `URL.createObjectURL`). Aucun hôte d'image
  externe (pas de S3 configuré — `lib/documents/stockage.ts` lit un fichier local).
- **`connect-src`, `font-src`, `script-src`, `style-src`, `media-src`** : rien à ouvrir. Tous les
  `fetch` du navigateur visent des chemins relatifs ; `next/font/local` seul pour les polices ;
  aucun `<script src>` ni analytics externe ; le flux caméra du scanner QR passe par `getUserMedia`
  (pas une URL) ; le service worker ne met en cache que des routes same-origin.

### Correction

1. **`next.config.ts`** — `img-src` porte désormais aussi `data:`, avec la justification mesurée
   ci-dessus ajoutée au commentaire de tête.
2. **`tests/e2e/9l08aa-sans-violation-csp.spec.ts` (créé)** — écoute `securitypolicyviolation` DANS
   la page (pas seulement les en-têtes attendus) sur le parcours signature + photo du terrain, puis
   sur le bon et sur la fiche bureau. Révèle au passage une violation `script-src (eval)`
   PRÉEXISTANTE et SANS RAPPORT avec ce lot (reproduite aussi sur `/planning`, qui ne touche ni la
   signature ni la photo) : Zod compile un analyseur rapide par `Function(...)`
   (`$ZodObjectJIT`, `r.cr.jitless`, identifié dans le paquet construit), CSP la refuse, et Zod
   BASCULE DE LUI-MÊME sur son propre analyseur interprété — le même mécanisme qui lui permet de
   tourner sur Cloudflare Workers. Rien ne casse (confirmé par toute la rejoue de régression
   ci-dessous) ; ajouter `'unsafe-eval'` pour faire taire cette violation serait l'assouplissement
   que ce ticket interdit explicitement, pour une famille que ce lot ne change pas. L'épreuve filtre
   donc ses assertions sur `img-src` — la seule famille changée — et laisse ce constat écrit ici
   pour qu'Alexis décide s'il justifie un ticket séparé.

### Rejoue de régression (premier plan, `CI=1`, `--workers=1`)

- `tests/e2e/rapport-signature-epaisseur-trait.spec.ts` : 3 passées (c'est cette épreuve qui avait
  mesuré le premier recalage — relecture d'une signature par `new Image()` + `toDataURL()`).
- `tests/e2e/9l08aa-sans-violation-csp.spec.ts` : 3 passées.
- Toutes les `*signature*`, `*photo*`, `*bon*` de `tests/e2e/` (9de, 9i7, 9i7c, 9k24, 9k28a, 9l04e,
  9l04h, bon-3/4/5, bon-intervention, interventions-fiche-action-collee-bon, les captures
  correspondantes, zz-captures-9i2) : 49 passées.
- `tests/e2e/offline/*` + `tests/e2e/9l08-en-tetes-securite.spec.ts` +
  `tests/e2e/captures-9l08a-en-tetes-securite.spec.ts` : 39 passées.
- `tests/e2e/tous-les-ecrans-rendent.spec.ts` : 61 passées, 4 ignorées (préexistant, sans rapport).
- `tests/unit/navigation/atteignabilite-ecrans.test.ts` : 5 passages consécutifs, 14-16 ms chacun
  (voir « Cause du second recalage » ci-dessous).
- `pnpm test:isolation` : 247 fichiers, 2274 épreuves, toutes passées.
- `CI=1 pnpm verify` : vert (format, typecheck, lint, test, test:isolation, build).

### Cause du second recalage — mesurée, pas corrigée

`tests/unit/navigation/atteignabilite-ecrans.test.ts` avait dépassé 5 s lors du second passage de
9L08A. Rejoué 5 fois de suite sur cette branche : 14-16 ms chaque fois. Rejoué sur `origin/main`
(même commit de départ) : 16 ms. Aucun écart entre la garde et `main` — c'était une instabilité de
charge transitoire (déjà vue sur 9L07, non reproduite par 9L07A), pas un ralentissement introduit
par ce lot. Rien à corriger dans le test ni dans le code qu'il éprouve.

### Localisateurs (point 3 du ticket)

Aucun libellé ni bouton n'a été ajouté ou renommé par ce lot — `img-src` est un en-tête HTTP,
invisible à l'écran. La recherche de localisateurs non précis dans `tests/e2e/**` ne s'applique
donc pas ici ; elle reste pertinente pour un lot qui change un texte ou un composant visible.

### Captures

Aucun écran n'a changé visuellement (`img-src` ne se voit pas) : les captures de 9L08A-EN-TETES-
SECURITE restent la référence, sans regénération.
