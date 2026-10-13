# 9EWC-AUDIT-VISUEL-ECRAN — passation

## Ce qui a été couvert

68 écrans du catalogue de la maquette (`docs/propositions/ergonomie-2026-09-28/
maquette-toutes-pages.html`, `CATALOGUE`). 66 ont une route réelle tentée côté site ; 10
sont absentes (`[MANQUE]`, presque toutes marquées « Nouvelle » dans la maquette — pas
une surprise) ; 9 n'ont pas pu être capturées faute de données correspondantes dans la
scène ou le semis de l'épreuve (demande, import appliqué, intervention « en cours » du
bon technicien, compte multi-société) — distingué dans le rapport d'un défaut du site.
66 captures de SITE + 68 de MAQUETTE, chacune à 1280 et 375 px, JPEG q70 demi-résolution
(toutes < 150 Ko, 240 fichiers, 6,5 Mo au total). Mesures automatiques (défilement
parasite, débordement horizontal, contraste, troncature, contrôles natifs, images
cassées, erreurs console) pour les 66 captures de site, dans `mesures.json`.

**4 défauts numérotés** (DÉF-1 à DÉF-4), classés `[BUG]`/`[MAQ]`/`[MANQUE]`, chacun avec
fichier/ligne quand trouvé, correctif en une phrase, et une proposition de lot ou de
point d'arrêt selon le cas — voir `rapport.md`.

## Ce qui n'a pas été couvert, et pourquoi

- **« Choisir la société » (`/arrivee`), portail client** : hors budget de construire une
  deuxième société ou une identité portail sans toucher `tests/e2e/setup/` (territoire du
  lot).
- **Qualifier une demande, imports appliqués** : le semis et la scène ne posent aucune
  `Demande` ni aucun `ImportLot` au statut `applique` — rien à montrer tant qu'aucune
  fixture ne les écrit.
- **Fiche intervention « rapport à valider » vs « prête à clôturer »** : un seul repère
  `terminee` trouvé dans le temps imparti, partagé par les deux lignes du rapport — à
  affiner si un lot futur a besoin de les distinguer.
- **Terrain · rapport / signature** : pas de route dédiée (`/terrain/[id]` est une page
  unique, ces étapes s'atteignent par une action à l'écran) — capture de la fiche de
  base seulement.
- **Terrain · intervention en cours** : l'intervention résolue appartenait à un autre
  technicien que celui de la scène ; `/terrain/[id]` a refusé à bon droit (404). Pas
  rejoué faute de temps pour composer un repère plus précis.
- **Fiche machine · « Corriger »** : capturée mais pas inspectée à l'œil (budget).
- **Mesures automatiques sur les captures de MAQUETTE** : seulement sur le site, comme
  demandé par le point 4 du ticket.

## Défaut trouvé dans l'outil lui-même, et corrigé avant la prise de vue finale

Voir la « Note de méthode » en tête de `rapport.md` : un clic de mesure du halo de focus
qui naviguait par erreur (sept pages recapturées), deux collisions de clés de fichier qui
écrasaient des captures (`/planning` vs `/planning?vue=jour`, `/premier-acces` vs son
état expiré, `/terrain` bureau vs technicien), et deux mesures automatiques peu fiables
(contraste sur élément composé, triangle de `<details>` sous Chromium headless) corrigées
ou retirées. **Trois prises de vue complètes ont été nécessaires** avant que les captures
soient fiables — la première et la deuxième sont écrasées, seule la troisième est commise.

## Rejouer l'audit

```bash
E2E_DATABASE_URL=postgresql://postgres@127.0.0.1:5441/codiplan_test pnpm audit:visuel
```

Base jetable locale (jamais l'hébergée, trois refus dans `tests/e2e/setup/base.ts`),
reconstruite à chaque exécution (globalSetup partagé avec `pnpm test:e2e`). Un seul
worker (écriture d'un seul `mesures.json`). ~4,3 minutes pour les 72 tests (68 écrans +
4 captures spéciales d'accès). Sortie : `docs/propositions/9EWC-AUDIT-VISUEL-ECRAN/
captures/` et `mesures.json`, écrasés à chaque exécution.

## Vérification

`CI=1 pnpm verify` — dernières lignes ci-dessous. Aucun fichier de `app/`, `lib/`,
`components/` ni des épreuves existantes n'a été touché : seuls `playwright.audit.config.ts`,
`tests/audit-visuel/`, le script `audit:visuel` de `package.json`, et
`docs/propositions/9EWC-AUDIT-VISUEL-ECRAN/` ont changé.
