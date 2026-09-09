# Lire le classeur — la comparaison instruite, la décision NON prise

*Nuit du 11 septembre 2026. L'exploitation avait rendu un arbitrage
CONDITIONNEL et demandé que la condition soit mesurée en lisant un vrai
fichier, pas de la documentation. Elle l'est. **La condition ne tranche pas
nettement, et ce document dit exactement pourquoi** — comme l'exploitation l'a
demandé dans ce cas : s'arrêter, l'inscrire, passer au reste.*

*Rien n'a été installé dans le dépôt. `package.json` est inchangé, aucune
dépendance n'est ajoutée, `lib/excel/` ne porte toujours aucune liaison.*

---

## 1. La condition, telle qu'elle a été posée

> **SI** une bibliothèque **maintenue sur npm** sait rendre, pour chaque type
> de cellule dont D31 a besoin, **le texte brut ET le numéro de série d'une
> date** — **ALORS** c'est elle.
> **SINON** — aucune ne sait le faire, ou aucune n'est maintenue — **ALORS**
> SheetJS depuis la distribution de l'éditeur, avec empreinte d'intégrité
> épinglée.

Et son motif, écrit dans la même demande : lire le **sérial** plutôt qu'un
objet `Date` de la bibliothèque, *« qui décalerait le jour d'un cran à
UTC+11 »*.

## 2. Comment la condition a été mesurée

**En lisant deux vrais fichiers**, jamais de la documentation.

1. `cas-d31.xlsx` — **écrit à la main en OOXML brut** (zip + trois parties XML),
   pour contrôler exactement ce que le fichier contient. Il porte les cas de
   D31 : marqueur en `A1`, en-têtes en ligne 2, une date en **texte**
   `31/12/2026`, la **même** date en **sérial** `46387` sous un format de date,
   `1234,56` en texte, `1234.56` en nombre, `1 234,56` avec **espace
   insécable**, une cellule **présente et vide**, une cellule **absente du
   XML**, un sérial **fractionnaire** `46387.5`, un booléen, une colonne
   inconnue, des accents.
2. `reel-openpyxl.xlsx` — **le même contenu écrit par openpyxl**, un
   sérialiseur indépendant et mainstream. *Un fichier fabriqué prouve que le
   lecteur sait mordre ; seul un fichier produit ailleurs prouve qu'il mord là
   où les fichiers naissent* (§9, 21/08). **Les quatre voies rendent la même
   chose sur les deux fichiers.**
3. `bornes.xlsx` — les sérials `0, 1, 59, 60, 61, 62`, c'est-à-dire le **bogue
   bissextile de 1900** que `lireDate` refuse.
4. `hostile.xlsx` — une **bombe d'entités** XML dans `sharedStrings`.
5. `bombe-zip.xlsx` — 300 Mo compressés en **308 Ko**.

*LibreOffice est présent sur la machine et a refusé de charger les deux
classeurs (« source file could not be loaded ») ; openpyxl a servi de
sérialiseur indépendant à sa place. C'est une limite de la mesure, écrite plutôt
que tue : aucun fichier produit par Excel lui-même n'a été lu.*

## 3. L'ÉTAT DE MAINTENANCE — et une lecture fausse corrigée en chemin

**`time.modified` de npm n'est PAS la date de la dernière publication** : il
bouge pour une simple retouche de métadonnées. Ma première lecture rangeait
`xlsx-populate` en « septembre 2025 » ; la vraie date de publication de sa
dernière version est **mars 2020**. *Un champ observé qui ne dit pas ce qu'on
croit qu'il dit* — c'est le tableau `time` complet qui a été lu ensuite.

| Paquet | Dernière version | **Publiée le** | Versions | Avis de sécurité (`npm audit`) |
|---|---|---|---|---|
| **read-excel-file** | 9.3.10 | **2026-08-10** — un mois | 155 | aucun |
| **@zurmokeeper/exceljs** | 4.4.9 | 2025-02-26 — 18 mois | 10 | **modéré** (via `uuid`), sans correctif |
| **exceljs** | 4.4.0 | 2023-10-19 — ~3 ans | 166 | **modéré** (via `uuid`) |
| **xlsx-populate** | 1.21.0 | **2020-03-01 — six ans et demi** | 48 | aucun |
| **xlsx** (SheetJS sur npm) | 0.18.5 | 2022-03-24 | 171 | **2 HAUTS sans correctif atteignable** |

*Le nombre de téléchargements hebdomadaires n'a pas pu être mesuré :
`api.npmjs.org` est refusé par le mandataire sortant de cet environnement
(403). Il est cité nulle part ci-dessous.*

## 4. CE QUE CHAQUE VOIE REND, sur les deux vrais fichiers

Ce que la liaison doit produire est le type `Cellule` de `lib/excel/format.ts` :
`{ texte? , nombre? , serie? }`.

| Cellule du fichier | read-excel-file | exceljs | xlsx-populate | **sans dépendance** |
|---|---|---|---|---|
| texte `31/12/2026` | `"31/12/2026"` | idem | idem | idem |
| texte `1234,56` | `"1234,56"` | idem | idem | idem |
| texte `1 234,56` (insécable) | conservé | conservé | conservé | conservé |
| nombre `1234.56` | `1234.56` ; le **texte brut** `"1234.56"` via le crochet `parseNumber` | `1234.56` | `1234.56` | `1234.56` |
| **date, sérial 46387** | **`Date(2026-12-31T00:00:00Z)`** | **`Date(…)`** | **`46387`** | **`{serie: 46387}`** |
| **sérial fractionnaire 46387.5** | `Date(2026-12-31T12:00:00Z)` | idem | `46387.5` | `{serie: 46387.5}` |
| cellule présente et vide | `null` | `null` | `undefined` | absente |
| cellule absente du XML | `null` | `null` | `undefined` | absente |
| texte `"  espaces  "` | **élagué** par défaut (`trim:false` le rend) | conservé | conservé | conservé |

**Deux des quatre rendent le sérial. Aucune des deux n'est maintenue** —
`xlsx-populate` a six ans et demi, et « sans dépendance » n'est pas un paquet.

## 5. LE POINT QUI FAIT QUE LA CONDITION NE TRANCHE PAS

Le motif du sérial était : *jamais un `Date` de la bibliothèque, qui décalerait
le jour d'un cran à UTC+11*. **Mesuré, ce décalage n'existe pas** pour les deux
bibliothèques qui rendent un `Date` :

| `TZ` du processus | read-excel-file | exceljs |
|---|---|---|
| `UTC` | `2026-12-31T00:00:00.000Z` | idem |
| `Pacific/Noumea` (UTC+11) | **`2026-12-31T00:00:00.000Z`** | idem |
| `America/Los_Angeles` (UTC−7) | **`2026-12-31T00:00:00.000Z`** | idem |

Et mieux : leur conversion est **exactement celle de notre propre `lireDate`**
— `Date.UTC(1899, 11, 30) + sérial × 86 400 000`. Mesuré sur les bornes du
bogue bissextile :

| sérial | read-excel-file & exceljs | ce que `lireDate` en ferait |
|---|---|---|
| 59 | `1900-02-27Z` | refusé (`< 61`) → refusable aussi sur la date : `< 1900-03-01` |
| **60** *(le 29 février 1900 fantôme)* | `1900-02-28Z` — **le même jour que 59** | refusé des deux façons |
| 61 | `1900-03-01Z` | accepté |

**Les deux refus que `lireDate` fonde sur le sérial restent exprimables sur un
`Date` UTC** : le fractionnaire devient « l'heure n'est pas `00:00:00.000Z` »,
la plage devient « antérieur au 1ᵉʳ mars 1900 ». *Le sérial était le proxy d'un
critère — « le jour ne bouge pas » — que l'on sait maintenant mesurer
directement.* C'est la situation du §9 du 01/09 : **une borne posée faute de
savoir mesurer, quand la mesure existe, n'est plus une garantie.**

**Donc :** à la LETTRE, la condition dit « aucune maintenue ne rend le
sérial » → branche SINON → SheetJS. À son MOTIF, elle dit qu'une bibliothèque
maintenue fait exactement ce qu'on voulait. *Les deux lectures ne donnent pas
la même réponse, et je ne choisis pas laquelle des deux vous vouliez.*

## 6. CE QUE LA BRANCHE « SINON » COÛTE VRAIMENT — mesuré, et ce n'est pas un risque, c'est une certitude

L'exploitation demandait d'écrire *« que se passe-t-il si l'hôte est
injoignable un matin de CI »*. La mesure va plus loin que la question :

> **`https://cdn.sheetjs.com` est REFUSÉ par le mandataire sortant des sessions
> de développement** — `CONNECT tunnel failed, response 403`. La liste des
> hôtes autorisés est nominative et ne contient que des registres de paquets
> (`registry.npmjs.org`, `pypi.org`, `index.crates.io`, `jsr.io`,
> `proxy.golang.org`).

Conséquence, et elle n'est pas conditionnelle : **une dépendance tirée de
`cdn.sheetjs.com` rendrait `pnpm install` impossible dans l'environnement où ce
dépôt se développe**, à chaque session neuve. Le risque d'indisponibilité un
matin de CI est le cas favorable ; le cas réel est l'indisponibilité
permanente côté développement. *Cette mesure n'était pas dans les mains de
l'exploitation quand elle a écrit la branche SINON.*

## 7. LA TROISIÈME VOIE, que la condition ne prévoyait pas

Le §2 du CLAUDE.md dit : *« En cas de doute, écrire les 30 lignes plutôt
qu'ajouter 200 Ko. »* Un `.xlsx` est un ZIP de trois parties XML, et Node porte
déjà `zlib.inflateRawSync`. **Écrit et mesuré : 94 lignes, aucune dépendance.**

| | Résultat mesuré |
|---|---|
| lit les deux vrais fichiers | **identique aux trois bibliothèques**, sérial compris |
| rend directement le type `Cellule` | oui — `{texte}`, `{nombre}`, `{serie}`, sans adaptateur |
| bombe d'entités XML | **ignorée** — aucun DTD n'est traité |
| bombe zip (300 Mo en 308 Ko) | **48 Mo de mémoire** : la partie inutile n'est jamais décompressée |
| 300 lignes (le cas d'acceptation de L1-08b) | 78 ms, démarrage de Node compris |

**Et ses faiblesses, qui sont réelles et doivent peser autant :** il **balaie**
le XML par expressions régulières au lieu de le parser — les préfixes de
namespace (`<x:row>`), les sections `CDATA` et les formes qu'Excel écrit et
qu'openpyxl n'écrit pas ne sont **pas éprouvées** ; il ne gère pas ZIP64 ; et
il n'a pas de garde-fou de décompression pour les parties qu'il lit
réellement. *Aucun fichier produit par Excel n'a pu être lu dans cet
environnement*, et c'est exactement l'épreuve qui manque avant de lui faire
confiance.

## 8. LES QUATRE VOIES, sur une ligne chacune

| | Maintenue | Rend le sérial | Ajoute | Empreinte d'intégrité | Ce qui l'empêche |
|---|---|---|---|---|---|
| **read-excel-file** | **oui, un mois** | non — un `Date` **UTC**, sans décalage mesuré | 4 dépendances | oui, `pnpm-lock.yaml` | la LETTRE de la condition |
| **exceljs** | non, ~3 ans | non — même `Date` UTC | 8 dépendances, dont un avis modéré | oui | non maintenue |
| **xlsx-populate** | **non, 6 ans ½** | **oui** | 4 dépendances, dont `cfb` (SheetJS) | oui | non maintenue |
| **SheetJS depuis l'éditeur** | oui, hors npm | oui | 0 | à épingler à la main | **hôte refusé par le mandataire** — `pnpm install` casse |
| **sans dépendance, 94 lignes** | *nous* | **oui** | **rien** | sans objet | **jamais éprouvée sur un fichier d'Excel** |

## 9. CE QUI EST DEMANDÉ À L'EXPLOITATION

Un mot, et un seul, parmi :

1. **« read-excel-file »** — la lettre de la condition cède devant son motif :
   la date ne décale pas, et les deux refus de `lireDate` restent exprimables.
   La liaison se construit dans la nuit qui suit, et L1-08b avec elle.
2. **« les 94 lignes »** — aucune dépendance, le sérial rendu tel quel, et
   l'épreuve sur un fichier d'Excel devient une exigence du ticket plutôt
   qu'un pari.
3. **« SheetJS quand même »** — alors il faut d'abord ouvrir
   `cdn.sheetjs.com` dans la politique de sortie des sessions, faute de quoi le
   dépôt ne s'installe plus.

*Ma lecture, si elle vous est utile, et ce n'est qu'une lecture :* **(1)**,
parce que c'est la seule voie qui soit à la fois maintenue par quelqu'un
d'autre que nous et éprouvée sur un fichier écrit par un tiers ; **(2)** si
vous préférez ne dépendre de personne, sachant que l'épreuve sur un fichier
d'Excel reste alors à payer.

*Le détail de la voie sans dépendance — le code exact qui a été mesuré — est
dans `2026-09-11-lecture-du-classeur-annexe-sans-dependance.md`. Il n'est
PAS dans `lib/` : l'y mettre serait choisir.*
