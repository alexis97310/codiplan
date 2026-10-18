# 9F4H4-HORS-RESEAU-OUVERTURE-A-FROID — passation

## ARRÊT IMMÉDIAT — condition de garde non remplie

Vérifié à T0 (18/10 17:59, `TZ=Pacific/Noumea date +%H:%M`) :

```
git log origin/main --oneline | grep -E "9F4H3-HORS-RESEAU-ENVOYER|9F4H3A-FILE-SANS-PERTE"
```

`origin/main` (HEAD mesuré : `e9cf1c7f`) contient bien **`9F4H3-HORS-RESEAU-ENVOYER`** (huit commits, de
`c5007faf` à `fe2bbf42`). Il ne contient **PAS** **`9F4H3A-FILE-SANS-PERTE`** : aucun commit, sur
aucune branche locale ni sur `origin/main`, ne porte ce préfixe — `git log origin/main --oneline | grep -i 9F4H3A`
est vide, et `git log origin/main --oneline | grep -i 9F4H` ne montre que des lots `9F4H1`, `9F4H2`,
`9F4H2A` et `9F4H3`.

**Ce qui manque : `9F4H3A-FILE-SANS-PERTE`.**

Point notable (sans valeur de contournement, seulement pour que la prochaine session ne reparte pas de
zéro) : le commit `c5007faf` de `9F4H3-HORS-RESEAU-ENVOYER` porte déjà le message « points 1 à 3 : la
file des saisies hors réseau, le bouton « Envoyer », rien ne se perd » — titre très proche de
« FILE-SANS-PERTE ». Il est possible que le lot `9F4H3A` attendu ait été absorbé dans `9F4H3`, ou qu'il
s'agisse d'un nom de ticket pas encore écrit/exécuté. Dans les deux cas, la consigne de garde est
explicite et littérale : elle demande le préfixe exact `9F4H3A-FILE-SANS-PERTE` dans l'historique de
`origin/main`, qu'il n'y a pas. Je m'arrête donc sans ouvrir aucun des points du lot, sans toucher à
`public/sw.js`, sans migration, sans code.

## État du dépôt

- `HEAD` détaché sur `origin/main` (`e9cf1c7f`), arbre propre avant intervention.
- Seul changement fait dans cette session : création de ce répertoire et de ce fichier de passation
  (aucun autre fichier touché, aucun commit créé — rien à committer qui relève du territoire du lot).

## Points ouverts

- Confirmer avec Alexis si `9F4H3A-FILE-SANS-PERTE` est un lot distinct à lancer avant `9F4H4`, ou si la
  garde doit être mise à jour parce que son contenu est déjà dans `9F4H3-HORS-RESEAU-ENVOYER`.
- Aucun point du corps du lot (0 à 6) n'a été commencé.
