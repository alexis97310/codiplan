# 9I7B1-PIECES-REMPLACEES-PREUVES — passation

## Rien à faire : la reprise 9I7B0 a déjà livré ces preuves

Condition d'arrêt du ticket : « `git log --oneline origin/main` contient des
commits `9I7B0-REPRISE-9I7B` : la reprise a déjà fait ces preuves (e2e, hors
réseau, captures) — vérifie qu'elles existent (fichiers d'épreuves et
captures), écris-le en passation et rends la main SANS rien refaire. »

`origin/main` porte bien les quatre commits `9I7B0-REPRISE-9I7B` :

```
4a9740ffa 9I7B0-REPRISE-9I7B — verify-final.txt : trace de CI=1 pnpm verify:full, coupée à 60 min en plein ré-amorçage de test:e2e
02c8cb4ed 9I7B0-REPRISE-9I7B — passation : mesure du bouton en trop, ce qui a changé, épreuves rejouées
7fa794f5a 9I7B0-REPRISE-9I7B — épreuves : saisie 375 px, hors réseau, lecture (bon client/interne, fiche), captures
f311d35f0 9I7B0-REPRISE-9I7B — bouton en trop : la coquille hors réseau porte déjà la saisie du rapport, « Ajouter une pièce » a sa place dans la liste close
```

### Vérification faite — les fichiers existent

- **Épreuve e2e** : `tests/e2e/9i7b-pieces-remplacees.spec.ts` (3 tests, scène
  dédiée `9I7B client`/`9I7B site` sur Ducos, créée en `beforeAll`, supprimée
  en `afterAll`). Couvre exactement les points 2, 3, 4 de ce ticket :
  - saisie 375 px : présente sur curatif, absente sur préventif, ajout de
    deux lignes, retrait d'une, rechargement (une seule fois, lue serveur),
    désignation vide et quantité < 1 refusées (vérifié à l'écran et par
    lecture directe en base) ;
  - hors réseau : `context.setOffline(true)`, mise en file
    (`terrain.auto.hors_ligne`), retour réseau, rejeu par le bouton global
    (`terrain.file.tout_envoye`), ligne présente une seule fois en base ET
    sur la fiche bureau (déconnexion du technicien puis connexion ADV avant
    de lire la fiche) ;
  - lecture : tuile « Pièces remplacées » sur le bon (version client ET
    `?version=interne`) et sur la fiche, sans aucun montant dans la tuile,
    absente quand la liste est vide (intervention curative dédiée sans
    ligne, bon ET fiche).
  - Déjà rejouée par 9I7B0 : `CI=1 --workers=1 --repeat-each=2`, 6/6 vert
    (passation 9I7B0, section « Les preuves manquantes de 9I7B »).
- **Captures**, dans
  `docs/propositions/9I7B-PIECES-REMPLACEES-SAISIE-LIBRE/captures/`
  (dossier visé par le point 5 de ce ticket) :
  - `saisie-pieces-vide-375.png` (44 675 octets)
  - `saisie-pieces-deux-lignes-375.png` (46 256 octets)
  - `bon-curatif-pieces-1280.png` (79 676 octets)
  - `bon-curatif-pieces-impression-1280.png` (77 251 octets, rendu impression)
  - `fiche-pieces-1280.png` (98 159 octets)

  Les cinq couvrent le point 5 du ticket à l'identique : saisie terrain 375 px
  (vide, deux lignes), bon curatif en 1280 et en rendu impression, fiche
  bureau en 1280.
- **Défaut corrigé** (point 6 de ce ticket, déjà traité par 9I7B0) : le
  sixième bouton révélé par
  `tests/e2e/offline/9f4h1-consultation.spec.ts` (« Ajouter une pièce » sur la
  coquille hors réseau, qui porte déjà la saisie du rapport depuis 9F4H4B) —
  corrigé en élargissant la liste close `nomsBoutonsAttendus`, pas en
  affaiblissant l'épreuve. Détail : passation 9I7B0, section « Le bouton en
  trop ».

### Ce qui restait ouvert chez 9I7B0, non repris ici

9I7B0 signale que son `CI=1 pnpm verify:full` a été coupé à 60 minutes en
plein ré-amorçage de la suite `test:e2e` complète (~1758 épreuves), après que
les huit premières étapes (format, typecheck, lint, test, test:isolation,
build, feries:horizon, audit:partitions) ont toutes été vertes. Les épreuves
TOUCHÉES par 9I7B/9I7B0 (`9i7b-pieces-remplacees.spec.ts` et
`offline/9f4h1-consultation.spec.ts`) ont, elles, été rejouées séparément et
intégralement, vertes. Rejouer la suite `test:e2e` complète de bout en bout
n'est pas dans le territoire de ce ticket (qui ne demandait que les preuves
ci-dessus, déjà livrées) : laissé à une éventuelle session ultérieure, avec un
budget couvrant les plus de 70 minutes mesurées pour `test:e2e` seul sous
`CI=1`.

## Conclusion

Aucune ligne de code, aucune épreuve, aucune capture n'a été écrite par ce
ticket : tout ce qu'il demandait existait déjà, vérifié ci-dessus fichier par
fichier. `pnpm verify`/`pnpm verify:full` n'ont pas été rejoués ici, faute de
changement à vérifier.
