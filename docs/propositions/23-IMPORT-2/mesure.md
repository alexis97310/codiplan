# Mesure IMPORT-2 — délai d'application d'un lot d'import

Mesuré le 2026-09-22T17:33:29.394Z, sur `Linux Alexis 6.18.33.2-microsoft-standard-WSL2 #1 SMP PREEMPT_DYNAMIC Thu Jun 18 21:54:43 UTC 2026 x86_64 GNU/Linux`, Node v22.23.2, psql (PostgreSQL) 18.6 (Ubuntu 18.6-0ubuntu0.26.04.1).

Chemin mesuré : `appliquerLeLotDeClients` (lib/imports/application.ts), sous le rôle applicatif restreint `codiplan_app`, sur une base PostgreSQL locale jetable (jamais Neon). Seule la transaction d'application est chronométrée — pas le contrôle préalable ni l'enregistrement du lot, qui ne comptent pas dans `DUREE_MAXIMALE_MS`.

| régime | lignes retenues | durée mesurée (ms) | marge sous DUREE_MAXIMALE_MS |
|---|---|---|---|
| creation | 100 | 254.1 | 749746 ms |
| creation | 300 | 321.8 | 749678 ms |
| creation | 600 | 458.9 | 749541 ms |
| creation | 1000 | 686.1 | 749314 ms |
| creation | 2000 | 1140.3 | 748860 ms |
| creation | 4000 | 2050.5 | 747950 ms |
| creation | 8000 | 3850.8 | 746149 ms |
| modification | 100 | 297.4 | 749703 ms |
| modification | 300 | 487.9 | 749512 ms |
| modification | 600 | 748.9 | 749251 ms |
| modification | 1000 | 1099.4 | 748901 ms |
| modification | 2000 | 2008.8 | 747991 ms |
| modification | 4000 | 3746.6 | 746253 ms |
| modification | 8000 | 7453.2 | 742547 ms |

## Pente mesurée, et extrapolation — PAS une mesure directe

- créations : 0.4553 ms/ligne, socle 208.6 ms. casserait DUREE_MAXIMALE_MS vers 1 646 881 lignes (extrapolé, jamais atteint par cette mesure).
- modifications : 0.9058 ms/ligne, socle 206.8 ms. casserait DUREE_MAXIMALE_MS vers 827 770 lignes (extrapolé, jamais atteint par cette mesure).

Pour comparaison, ce que le BUDGET théorique de `allersRetoursApplication` (lib/imports/delais.ts) prévoit, sous `LATENCE_PESSIMISTE_MS` = 500 ms : casse au-delà de 746 lignes retenues (`allersRetoursApplication(n) × LATENCE_PESSIMISTE_MS ≤ DUREE_MAXIMALE_MS`).

## Ce que cette mesure NE dit PAS

- **Mesuré en LOCAL, sur un PostgreSQL du poste, pas sur la base hébergée.** La production tourne sur Neon (`ap-southeast-2`), avec une latence réseau et une mise en veille que `LATENCE_PESSIMISTE_MS` (500 ms) majore — cette mesure locale ne l'éprouve PAS : le rapport entre les deux (probablement un facteur de plusieurs centaines, la latence locale se mesurant en fractions de milliseconde) n'est pas mesuré par ce lot.
- **Entité mesurée : « clients », pas « historique » / « VGP » / « VGP observations » — les imports RÉELS d'Alexis.** Ces trois-là ne savent que créer ; le régime « création » ci-dessus traverse le MÊME moteur générique (`appliquerLesLignes`) et transfère donc directement. Le coût SPÉCIFIQUE de leurs validations (rapprochement de machine par rang, résolution client/site/agence) n'est PAS mesuré ici.
- **Pas de rapprochement de fiche complexe.** Les lignes synthétiques ne portent que deux colonnes (code externe, raison sociale) ; un fichier réel en porte davantage, sans que cela change le nombre d'allers-retours (la lecture et l'écriture restent groupées par lot, jamais par colonne).
- **Aucune concurrence.** Une seule transaction à la fois ; la production peut voir plusieurs lots s'appliquer en même temps sur la même base.

