# Registre — file de nuit du 11 septembre 2026

*Une entrée par unité de travail, écrite à chaud. La mesure d'abord, la prose
ensuite. Chaque unité est fusionnée avant que la suivante commence : un arrêt
faute de budget ne doit rien coûter.*

*Horloge du conteneur au départ : `2026-09-11 06:38 UTC` (`date -u`).*
*Point de départ : `main` = `a5c63f6`, arbre propre.*

---

## 0 — Les deux règles au protocole de session

`docs/protocole-session.md` gagne deux sections. Elles ne sont pas de moi : ce
sont deux consignes d'exploitation, chacune adossée à un coût de la journée.

**§11 — la porte de MAIN est `verify:full`, pas `verify`.** Un vert mesuré à un
endroit et annoncé pour un autre est un vert inventé. Le rapport nomme donc la
commande réellement jouée ; si la porte forte n'a pas pu tourner, il l'écrit
avec ce qui a empêché.

**§12 — le code se déploie seul, les données non.** Vercel reconstruit à chaque
fusion sur `main` ; rien ne reporte un semis ni une migration sur la base
hébergée. Tout travail touchant `prisma/seed.ts` ou `prisma/migrations/`
termine son compte rendu par un **geste nommé** — quel flux, quelle cible,
quelles cases —, dans une liste d'actions et non dans une note.

*Ce qu'aucun gardien ne tient, et qui est écrit dans les deux sections : un
compte rendu n'est pas un artefact du dépôt, rien ne peut le relire.*

Commit `3bdf1a0`.

---

## 1 — R2-16 : la barre de navigation ne coiffe plus les écrans sans session

**Ce qui était mesuré :** la barre était du chrome de mise en page RACINE, donc
elle s'affichait sur `/connexion`, `/premier-acces`, `/enrolement`, `/sante` et
`/` — onze entrées dont dix inertes au-dessus d'un formulaire de connexion,
avec une pastille d'identité vide par construction.

**Ce qui a été fait.** La barre est rendue par le SEGMENT. Trois groupes de
routes, et chaque page en habite exactement un :

| Groupe | Pages | Barre |
|---|---|---|
| `(sans-session)` | `/`, `/sante`, `/connexion`, `/connexion/code`, `/enrolement`, `/premier-acces` | non |
| `(back-office)` | `/arrivee`, `/planning*`, `/parametres/*` | oui |
| `(portail)` | `/portail` | oui |

*Ce qui décide n'est pas une liste de chemins, c'est le RÉPERTOIRE où le fichier
est écrit.* Une liste oublierait le prochain écran d'authentification ; un
répertoire se choisit au moment où l'on crée le fichier.

**Trois effets de bord, tous mesurés en chemin.**

1. La largeur utile était posée par la racine — une barre pleine largeur ne se
   rend pas dans un conteneur centré. Elle est passée dans
   `components/mise-en-page/largeur-utile.tsx`, rendu par les trois mises en
   page : une seule écriture des valeurs, comme avant.
2. Deux mises en page ont maintenant besoin d'une même session — la racine pour
   la charte, le segment pour la pastille — et une mise en page ne transmet
   rien à celles qu'elle englobe. `lib/navigation/chrome.ts` porte la lecture,
   mémoïsée par `cache()` de React : **une lecture par rendu**, comme avant.
3. Le gardien de « la mise en page racine ne lève jamais » regardait UN fichier.
   Il y a désormais quatre mises en page et trois lisent une session : sa
   population vient du répertoire `app/`. *C'est le §9 du 09/09 en acte — la
   garantie était énoncée pour un fichier, un second appelant l'aurait
   traversée sans la rencontrer.*

**Les gardiens, et leurs mises en échec sur des fautes RÉELLES.**

`tests/unit/app/barre-par-segment.test.ts` remonte, pour chaque `page.tsx` de
`app/`, la chaîne de ses mises en page — ce que Next empile à l'exécution — et
constate si l'une rend la barre.

| Faute réellement écrite puis retirée | Verdict |
|---|---|
| barre remise dans `app/layout.tsx` | rouge — 3 assertions, dont les 6 pages en écart nommées |
| `app/orpheline/page.tsx`, hors des trois groupes | rouge — la page est nommée |
| `(back-office)/layout.tsx` appelant `obtenirSession` | rouge sur le gardien de chrome |
| état sain | vert, 6 tests |

Et la **paire des deux directions** (§9, 11/09) : `/connexion` ne porte pas la
barre **et** `/arrivee` la porte. Sans la seconde moitié, une remontée de chaîne
qui rendrait toujours « pas de barre » passerait tout le reste.

`tests/e2e/barre-sans-session.spec.ts` regarde le HTML réellement servi par une
compilation de production, sur les cinq écrans. Il porte son témoin : le corps
a bien un `data-apparence`, sans quoi une 404 passerait pour une absence de
barre.

**Ce qui n'a PAS été fait, et pourquoi.** Le portail continue d'afficher les
onze entrées d'une barre de back-office. Ce n'est pas une fuite — aucune entrée
ne mène à une route servie —, mais cela touche **ce qu'un client voit**, donc
c'est un arbitrage d'Alexis (§1 du protocole). Porté en **R2-17**, marqué
`BLOQUÉ` avec trois issues chiffrées.
