# 9F4H4BB-REPRISE-9F4H4B — passation

T0 = 02:34 (Pacific/Noumea, 20/10/2026). Arrêt immédiat, avant toute mesure et avant
toute correction, au titre de la condition d'arrêt écrite dans le contrat du ticket.

## Constat

`git fetch origin` puis `git log origin/main --oneline` contiennent déjà, en tête de
`origin/main`, les cinq commits de `9F4H4BA-REPRISE-9F4H4B` :

```
e71c8247 9F4H4BA-REPRISE-9F4H4B — passation : écart documenté sur la consigne « commits sur main local »
1723fdec 9F4H4BA-REPRISE-9F4H4B — passation : fin de lot, verify + épreuves voisines vertes
c1423dcc 9F4H4BA-REPRISE-9F4H4B — correctif : l'assertion des boutons ne dépend plus de l'état précis d'une intervention
e57c1459 9F4H4BA-REPRISE-9F4H4B — correctif : le libellé natif du sélecteur de fichier n'est pas une chaîne en dur
981d8324 9F4H4BA-REPRISE-9F4H4B — garde rejouée sur origin/main, épreuve 9f4h1 adaptée à la fiche de travail
```

Le contrat du ticket est explicite : « **ARRÊT IMMÉDIAT SI** `git log origin/main
--oneline` contient DÉJÀ `9F4H4BA-REPRISE-9F4H4B` (publié) : écris-le en passation et
rends la main. » C'est exactement l'état observé — `origin/main` a déjà intégré la
reprise précédente, publiée par la file entre le départ de `9F4H4BA` et le début de ce
lot.

Le worktree `codiplan-voie1` était au départ en HEAD détaché, strictement à la pointe
d'`origin/main` (`e71c8247`), arbre propre. `main` local est extrait ailleurs
(`/home/aplou/codiplan`, sur `ca348d20`, une autre pointe — hors de portée de ce
worktree). Pour respecter « un lot sans commit est perdu » tout en respectant la
consigne « main extrait ailleurs → branche dédiée + le dire en passation », cette
passation est commitée sur la branche dédiée `9F4H4BB-REPRISE-9F4H4B`, partant
d'`origin/main` (`e71c8247`).

## Ce qui n'a PAS été fait, et pourquoi

Aucune mesure de `9f4h3a-file-sans-perte.spec.ts`, aucune lecture de ce qui est servi
hors ligne à `/terrain/profil`, aucune correction : la consigne d'arrêt immédiat prime
sur les étapes 1 à 5 du contrat, qui ne sont pas engagées. Le diagnostic de l'échec
« confirmation de déconnexion absente, file non vide » (décrit dans le contrat, mesuré
par la vérification indépendante du lot précédent le 20/10 à 00:34-01:34) reste donc
entier, non confirmé ni infirmé par ce lot : il appartient à la prochaine reprise, à
lancer sur une base d'`origin/main` qui ne contient pas encore de reprise en cours.

## État de sortie

Aucun fichier de code touché, aucun test modifié. Seul ce fichier de passation est
ajouté, sur la branche `9F4H4BB-REPRISE-9F4H4B` partant d'`origin/main` (`e71c8247`).
`git status --porcelain` vide après commit. Pas de `pnpm verify` requis par le contrat
pour un arrêt immédiat ; l'arbre n'ayant reçu aucune modification de code, l'état de
vérification reste celui d'`origin/main` au moment du fetch.
