# 9L27-PLANCHER-JAMAIS-ZERO — passation

## Fait, dans l'ordre du brief

**Point 1 — le plancher n'est jamais 0** (décision d'Alexis du 10/11/2026, « Non, jamais 0 »).

- `schemaRegleArrondi.plancherMinutes` (`lib/tarification/valorisation.ts`) exige désormais
  `min(1)` au lieu de `min(0)`. La route (`app/api/parametres/tarifs/regle-facturation/
  route.ts`) coerce un champ vide ou absent à `0` AVANT d'appeler ce schéma
  (`Number(formulaire.get("plancher_min"))`) : une seule borne couvre donc à la fois « 0 » et
  « vide », aucun chemin de validation séparé n'était nécessaire.
- `FormulaireRegleFacturation` : le champ passe de `min={0}` à `min={1}`, et l'exemple en
  direct (`minutesFactureesExemple`) refuse désormais un plancher sous 1 (au lieu de sous 0).
- Migration **`20261120113000_plancher_facturation_jamais_zero_9l27`** (une seule, neuve) :
  resserre la contrainte existante `societe_facturation_plancher_borne` de `BETWEEN 0 AND 240`
  à `BETWEEN 1 AND 240`. Pas de `NOT VALID` — la règle vaut pour toute société, sans exception ;
  le défaut de la colonne (`60`) ne change pas, et aucune donnée n'est réécrite. Vérifié avant
  d'écrire la migration : aucune société de la base de test n'est à 0 (le seul chemin
  d'écriture, le formulaire, part de `REGLE_PAR_DEFAUT` ou d'un réglage déjà valide). Requête de
  contrôle pour la production, à jouer AVANT la migration :

  ```sql
  SELECT id, code, raison_sociale, facturation_plancher_min
  FROM societe
  WHERE facturation_plancher_min < 1;
  ```

  Si cette requête rend une ligne, la migration échouera (le `CHECK` refuse la donnée en
  place) : corriger la société concernée (reposer son plancher à `60`, le défaut) avant de
  jouer la migration.

**Point 2 — épreuves.**

- Unitaires (`tests/unit/tarification/valorisation.test.ts`) : `schemaRegleArrondi` refuse
  `0`, un champ vide et un champ absent coercés comme le fait la route (`Number("")`,
  `Number(null)`), et accepte `1` et `60`.
- Isolation (`tests/isolation/regle-arrondi-societe.test.ts`) : écriture directe de
  `facturation_plancher_min: 0` refusée EN BASE (`societe_facturation_plancher_borne`), et son
  jumeau — la contrainte retirée, la même écriture passe, puis la contrainte et la valeur sont
  rétablies.
- Capture e2e (`tests/e2e/captures-9l27-plancher-jamais-zero.spec.ts`) : un plancher à `0` saisi
  en contournant les contraintes client (`min`, bouton désactivé) est refusé par la route — pas
  seulement par le navigateur. Captures 375/1280 px dans
  `docs/propositions/9L27-PLANCHER-JAMAIS-ZERO/captures/` (`apres-tarifs-plancher-refuse-*`).

**Point 3 — registre.** `docs/arbitrages.md` — **D275** (le prochain numéro libre après D274).

## Ce qui n'a PAS changé

Le calcul des paliers (`arrondirSelonRegle`) reste compté depuis `0`, pas depuis le plancher —
identique tant que le plancher est un multiple du palier, comme le brief le demandait. Aucun
montant inventé.

## MIGRATION À JOUER par Alexis

`20261120113000_plancher_facturation_jamais_zero_9l27` — staging puis `DB migrate & seed`,
puis Vercel. Jouer d'abord la requête de contrôle ci-dessus sur la base ciblée.
