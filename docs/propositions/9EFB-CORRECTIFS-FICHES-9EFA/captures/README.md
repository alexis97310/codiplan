# Captures — 9EFB-CORRECTIFS-FICHES-9EFA, point B (preuve Y19)

Prises APRÈS le correctif `min-w-0` de 9EFA (commit `aa430a57`), sur une scène
À SOI, préfixée `9EFBY19-`, créée et supprimée par
`tests/e2e/9efa-reprise-y19-debordement.spec.ts` :

```
CAPTURES_9EFB_Y19=1 CI=1 pnpm exec playwright test tests/e2e/9efa-reprise-y19-debordement.spec.ts
```

Commit mesuré au moment de la prise : `60efe31f` (11/10/2026). Compte `adv`.
Client avec un site portant deux machines et deux interventions, de façon que
les tableaux larges soient effectivement rendus (voir la mise en scène du
fichier de l'épreuve) : `BlocMachines` (720 px) et `BlocInterventions`
(640 px) sur la fiche site, et le tableau de l'onglet « Sites » (520 px) de la
fiche client.

**Ne remplace pas les captures de 9EF-TP-UX4-2-FICHES-1** (dossier distinct) :
celles-là datent d'avant le correctif et restent la preuve du débordement
mesuré par le pilote (1330 px et 742/380 px, voir leur propre README).

| Écran | Fichier | Largeur mesurée (IHDR) | Ce qu'il prouve |
|---|---|---|---|
| Fiche site, lecture | `fiche-site-lecture-1280.png` | 1280 × 1202 | À 1280 px, plus de défilement horizontal (AVANT : 1330 px mesuré par le pilote) |
| Fiche site, lecture | `fiche-site-lecture-375.png` | 375 × 2285 | À 375 px, plus de défilement horizontal (AVANT : 742 px mesuré par le pilote) |
| Fiche client, Aperçu | `fiche-client-apercu-375.png` | 375 × 2438 | À 375 px, la grille des sites de l'Aperçu ne force plus 380 px (AVANT : 380 px mesuré par le pilote) |

`fiche-client-apercu-1280.png` n'a pas été demandé par ce lot (aucun
débordement mesuré à 1280 px sur cette fiche) : non capturé.
