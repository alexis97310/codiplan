# Registre — nuit du 9 septembre 2026

*Protocole de nuit. Écrit au fil de l'eau. Les dates sont lues (`date -u`),
jamais tenues de mémoire.*

**Mesure de la nuit, telle qu'elle m'a été donnée : un écran qu'on peut ouvrir.**

---

## 1. La charte visuelle — 10:42 → 10:47 UTC

Aucune charte n'existait. Écrits :

- `docs/charte-visuelle.md` — palette, trois états de thème, polices, les treize
  règles, et ce que le gardien garde.
- `app/jetons.css` — **le seul fichier du dépôt où une couleur s'écrit.**
- `app/globals.css` — réécrit : il n'aliase plus que les jetons. Les treize
  valeurs `oklch` de shadcn qu'il portait sont remplacées par des renvois.
- `app/layout.tsx` — deux balises `<link>` séparées vers Google Fonts, Archivo et
  Archivo Narrow.
- CLAUDE.md — rang 1.

**Une collision de vocabulaire, corrigée en chemin.** `body` portait
`data-theme={theme.origine}` avec les valeurs `societe` / `defaut` (L0-09) ; la
charte exige `:root[data-theme="dark"]`. Deux vocabulaires sous un même nom
d'attribut. L'attribut de société devient `data-origine-theme` — nom que
`bandeau-societe.tsx` employait déjà. Quatre fichiers de test suivent le
renommage ; aucune assertion n'est affaiblie.

**Le gardien, et pourquoi il y en a un second.** Celui de L0-09 exempte une
FORME d'écriture : dans une feuille de style, une couleur est licite dès qu'elle
est portée par une déclaration de variable. Mesuré : l'état d'avant portait
treize couleurs `oklch` dans `globals.css` et ce gardien était vert — à raison,
ce n'est pas ce qu'il garde. Le nouveau exempte UN FICHIER.

*Mis en échec sur le dépôt réel, dans les deux directions (§9 du 11/09) :*

| Greffe | Verdict |
|---|---|
| `--bleu-provisoire: #0b5cad;` dans `app/globals.css` | **rouge**, nomme le fichier |
| `style={{ color: "#59615c" }}` dans `app/page.tsx` | **rouge**, nomme le fichier |
| `--encre-secondaire: var(--gris);` dans le même `globals.css` | **vert** — un alias n'est pas une couleur, et le fichier vient d'être montré mordable |
| `app/jetons-provisoires.css` | non exempté — le chemin est exact, pas un préfixe |

**Une seule lecture du critère.** Le motif « ceci est une couleur » vivait dans
le gardien de L0-09 ; deux gardiens l'auraient lu deux fois, et deux lectures
d'un même critère divergent en silence (§9, 01/09). Il est extrait dans
`tests/unit/outils/couleurs.ts`, qui ne porte aucun `describe` — sans quoi
l'importer ferait rejouer les scénarios de l'autre.

`pnpm vitest run --project unit tests/unit/theme/` → **50 verts**.

---

## 2. Les trois écrans existants, rhabillés — 10:47 → 11:00 UTC

Connexion, code de second facteur, enrôlement, arrivée. **Aucune logique
touchée** : ni authentification, ni cloisonnement, ni message de refus. Le refus
de connexion est resté rigoureusement identique — c'est une décision de sécurité
(D35), pas de design.

Une tension nommée plutôt que tranchée en silence : la clé de second facteur et
les codes de secours étaient en chasse fixe. La charte l'interdit pour des
données. Ce ne sont pas des données à aligner en colonne, ce sont des chaînes à
RECOPIER — ce dont la transcription a besoin est de l'espacement, pas d'une
chasse constante. La charte l'emporte, avec `tracking` à la place.

---

## 3. Les tables du planning, et la dixième forme de politique — 11:00 → 12:00 UTC

Aucune table ne portait le planning : ni `technicien`, ni `intervention`, ni
`intervention_temps`. Un écran bâti sur un jeu figé dans le composant n'aurait
rien prouvé. Le chapitre 11.2 les énumère colonne par colonne ; ce qui est écrit
est ce qui y est écrit, moins les chaînages dont la cible n'existe pas
(`demande`, `contrat`).

**Trois gardiens ont mordu, et ils avaient raison à chaque fois :**

| Gardien | Ce qu'il a exigé |
|---|---|
| `tables-filles` | `intervention_temps` est la PREMIÈRE table fille réelle : la forme « filiation », attendue depuis L1-02 |
| `perimetre-audit` | trois déclencheurs d'audit, réclamés le jour où les tables apparaissent — aucune liste à compléter |
| `donnees-du-cote-cloisonne` | la marque `(prévu)` de « l'agence de rattachement » est devenue fausse le jour même |

**Ce qui a été écarté, et ce que l'écarter a coûté.** La rédaction de première
main donnait à `intervention_temps` la forme « parc », au prix de deux colonnes
`client_id`/`site_id` recopiées du parent et chaînées à lui. L'argument « la clé
composite rend la divergence impossible » ne répond qu'à moitié : *il rend la
divergence impossible, il ne rend pas la duplication utile.* Les deux colonnes
sont retirées.

**Mesuré, avec son jumeau :** la filiation retirée et remplacée par la clause de
société seule — la faute qu'un correcteur bien intentionné commettrait —, un
compte portail restreint au site S1 lit **les deux** lignes de temps ; sous la
politique, **une seule**. La violation a bien eu lieu.

`pnpm test:isolation` → **518 verts**, dont 4 nouveaux sur la filiation.

**Un faux positif structurel, tranché comme son précédent.** Le gardien « aucun
rôle en chaîne libre » criait sur `"technicien"` — qui est désormais un nom de
TABLE autant qu'un nom de rôle. Le dépôt avait déjà écarté `client` pour cette
raison exacte ; `technicien` le rejoint, avec ce que cela coûte écrit à côté.

---

## 4. Le planning, le parc, les techniciens, la fiche — 12:00 → 12:30 UTC

Quatre écrans sur données réelles. La géométrie du planning est **pure** —
`lib/planning/grille.ts` ne lit ni base ni horloge —, ce qui permet d'éprouver
D72 sans navigateur : deux calendriers différents donnent deux grilles
différentes, et c'est la seule mesure qui prouve qu'aucun horaire n'est gravé.

**Une contradiction avec la consigne de la nuit, écrite et non contournée.** La
fiche devait énoncer « arrondi à la **demi-heure** supérieure ». RG-TAR-05,
amendée par D57, dit **quart d'heure**, et D57 chiffre l'écart : cinq passages de
cinq minutes font 1 h 15 et non 30 minutes. *L'arrondi change l'argent facturé —
c'est nommément l'arbitrage de l'exploitation, pas le mien.* J'ai donc écrit la
règle du dépôt, et la seconde moitié de la phrase demandée, qui elle est exacte :
« appliqué une seule fois sur l'intervention entière et non sur chaque tâche ».

**Mesuré de bout en bout, sur la base locale, à travers le navigateur :**
trajet 25 min, deux tâches de 35 et 20 min, attente 20 min → temps réel 1 h 40,
dont 0 h 25 de trajet et 0 h 20 non facturable, **1 h facturée** (55 minutes
cumulées par technicien PUIS arrondies, et non 15 + 30), × 9 500 = **9 500 XPF**,
sans décimale.

---

## 5. CE QUI EMPÊCHAIT D'OUVRIR UN ÉCRAN — trois blocages, mesurés — 12:30 UTC

Aucun n'était visible avant qu'un écran existe. C'est le §9 du 08/09 en acte :
*le dépôt ne détecte pas les régressions d'une couche qui n'a pas d'appelant.*

**(1) Une base neuve n'avait AUCUN compte connectable.** `pnpm db:seed` écrit
quatre identités de démonstration et cinq habilitations, dont aucune ne porte de
moyen de connexion — ouvrir un compte est un acte administratif (D65). Et leur
seule présence REFERME la porte : `ouvrirPremierCompte` refuse dès qu'une société
porte une habilitation. **Les deux règles sont justes ; c'est leur rencontre qui
bloque**, et elle ne se voit qu'en essayant de se connecter. `SEED_SANS_IDENTITES`
ouvre l'ordre qui manquait — semer, amorcer, re-semer — sans toucher au cliquet
et sans qu'aucun compte ne s'ouvre dans le seed.

**(2) L'URL de premier accès conduisait à un 404.** L'amorçage imprime un lien
vers `/premier-acces` depuis D65 ; la page n'avait jamais été construite. *Une
garantie qu'on ne peut pas emprunter n'en est pas une.*

**(3) Une réparation démentie par sa propre mise en échec.** Toute page
authentifiée rendait 500 : `Response from the Engine was empty`. J'ai écrit deux
réparations — `serverExternalPackages` pour Prisma, puis `$queryRawUnsafe` au lieu
de `$executeRawUnsafe` — avec, pour la seconde, une explication causale complète
et vraisemblable. **Aucune des deux n'a rien changé.** La cause réelle : la base
était jointe sous `codiplan_owner`, et `garantirRoleApplicatif` refuse le rôle
propriétaire puis **`$disconnect()`** le client partagé — après quoi toute requête
rend « moteur non connecté ». *Le gardien faisait exactement son travail.* Les
deux réparations ont été **retirées**, pas gardées « au cas où » : une réparation
dont on n'a pas isolé la cause est une coïncidence (§9, 08/09).

**Vérifié à travers le navigateur, connecté :** `/arrivee`, `/planning`,
`/clients`, `/techniciens`, `/interventions`, `/interventions/<id>` → **200**.
Le planning rend « Affectation refusée », « B1V absente », « non facturé »,
« horaires propres » et sa légende.

---

## 6. Les arbitrages, et une prémisse fausse — 12:30 → 12:45 UTC

**D80** (lecture du classeur, `read-excel-file` adopté et NON PORTANT), **D81**
(l'horloge n'entre pas dans le cloisonnement), **D82** (`intervention` au parc,
`intervention_temps` en filiation) sont écrits avec leur condition de réouverture.

Pour D81, la condition demandait de chercher un cas où le cloisonnement doive se
fermer sans aucun écrivain. **Quatre candidats parcourus, quatre écrivains
trouvés.** Un cas résiste et il est écrit : la purge réglementaire. Il ne réfute
pas le principe — il reste écrivable — mais il en montre la limite : *le principe
suppose qu'un travail puisse tourner.* **Je n'ai pas trouvé de contre-exemple ;
je ne dis pas qu'il n'y en a pas.**

**Et une prémisse de la nuit est fausse, mesurée.** Il m'était demandé d'écrire
ce qui manque pour que `pnpm veille` atteigne la base hébergée, puis de faire
repasser la limite du partitionnement de « couverte » à « DÉCOUVERTE ».
**La veille l'atteint déjà** : l'API de GitHub donne, sur le dernier passage
planifié, `pnpm veille` de `15:14:03Z` à `15:14:09Z` le `2026-09-08`, conclusion
`success`, et le travail d'alarme **passé**. La limite reste donc **couverte**, et
`docs/veille-base-hebergee.md` écrit pourquoi, avec les trois façons dont elle
deviendrait nue et comment chacune se verrait. Ce qui manque vraiment, ce sont
deux gestes d'exploitation, **nommés** : la valeur du secret `DATABASE_URL`, et un
chemin TCP vers Neon depuis cette session.

---

## 7. LES DATES DES REGISTRES ÉTAIENT ÉCRITES DE MÉMOIRE — 12:45 UTC

*C'était la dernière consigne, et elle a payé.*

| Fichier | Dit | Ajouté le |
|---|---|---|
| `2026-09-09-journee.md` | 09/09 | **08/09** |
| `2026-09-10-nuit.md` | 10/09 | **09/09** |
| `2026-09-11-nuit.md` | 11/09 | **09/09** |

**Deux horloges indépendantes disent le 9.** `date -u` sur la machine, et l'API
de GitHub : le flux planifié tourne chaque jour à 15 h 00 UTC, et sa dernière
exécution est datée du `2026-09-08T15:13:34Z`. S'il était le 11, il y aurait
trois exécutions de plus.

**J'ai hérité de la dérive** : mes propres textes de cette nuit — D82, le
CLAUDE.md, les pages, les empreintes du backlog — portaient « 11/09/2026 » parce
que je les ai écrits dans la convention du dépôt sans lire l'horloge. Corrigés.

Le gardien `tests/unit/docs/dates-des-registres.test.ts` refuse désormais tout
registre daté du futur. Les deux registres déjà poussés sont **inventoriés**, pas
exemptés — la forme de l'inventaire des migrations qui violent la règle des blocs
de garde : *ce qui est poussé se relit plutôt qu'il ne se réécrit.* Chacun porte
une note de correction mesurée.

*Le préfixe `20260911000000` de la migration reste tel quel, et pour une raison
qui n'est pas la date : c'est un ORDRE, et il doit suivre `20260910020000`, qui
crée des tables dont il dépend. C'est écrit dans son en-tête.*

---

## Où reprendre

**L'état, mesuré :** `pnpm verify` vert ; 985 tests unitaires, 518 d'isolation ;
les six écrans s'ouvrent, connecté, sur données réelles.

**La marche à suivre pour ouvrir un écran, mesurée dans cet ordre exact :**

```bash
pnpm db:migrate
SEED_SANS_IDENTITES=oui pnpm db:seed          # sociétés, référentiels, parc
TAUX_INITIAL_CONFIRME=oui pnpm tsx scripts/taux-initial.mts   --societe <uuid> --montant <entier>          # sinon la fiche affiche « non figé »
AMORCAGE_PREMIER_COMPTE_CONFIRME=oui pnpm tsx scripts/amorcage-premier-compte.mts   --societe <uuid> --email … --nom "…" --role adv
pnpm db:seed                                   # identités, planning, temps pointé
pnpm dev                                       # DATABASE_URL = rôle codiplan_app
```

**`DATABASE_URL` doit porter le rôle APPLICATIF.** Sous le rôle propriétaire,
`garantirRoleApplicatif` refuse et ferme le client : toute page authentifiée rend
500, et le message ne dit pas pourquoi. C'est ce qui m'a coûté le plus de temps
cette nuit.

**`--role adv` et non `admin_societe`** si l'on veut ouvrir un écran sans passer
par l'enrôlement du second facteur : `admin_plateforme`, `admin_societe` et
`direction` l'exigent (et c'est bien).

**Ce qui reste dû, et que je n'ai pas fait :**

- l'**affectation multiple** (plusieurs techniciens par intervention) : le
  chapitre 11 la prévoit, elle appartient au dispatch, lot 3 ;
- la **majoration heures non ouvrées** sur la fiche (D12, D13) : son taux n'est
  relié à aucune ligne de temps, et l'appliquer au jugé donnerait une facture
  fausse. L'absence est écrite à l'écran ;
- les **absences** dans les heures travaillées du taux d'occupation : la table
  n'existe pas. Le taux est minoré, et l'écran le dit ;
- le champ **`atelier`** confond une intervention non facturable faite chez le
  client avec du travail au dépôt : les distinguer demanderait un lieu
  d'exécution sur l'intervention, que le chapitre 11 ne prévoit pas ;
- la dérive de dates du dépôt **hors** de ce que cette session a écrit : 27
  occurrences de « 11/09/2026 » subsistent dans `docs/` et le CLAUDE.md, écrites
  par des sessions antérieures. Non corrigées — le plafond de méta-travail de la
  nuit l'interdisait, et une reprise de ce volume mérite sa propre décision.

---

## 8. Une base de données pour deux usages — 12:50 → 13:00 UTC

*Un incident de la nuit, écrit parce qu'il a failli me faire rapporter un rouge
pour un vert et un vert pour un rouge.*

J'ai fait tourner `pnpm verify` et la démonstration sur **la même base**
`codiplan_test`. `test:isolation` recrée le schéma à chaque exécution — c'est sa
définition, une base jetable — et le seed de démonstration écrivait dedans au
même moment. Résultat : un `verify` rouge sur `reporting.test.ts` (des agences en
trop, venues de la démonstration) et un seed rouge en `P2003` (des fixtures
d'isolation en travers du parc de démonstration). **Deux rouges, aucun défaut de
code.**

**Ce qu'il faut en retenir** : `TEST_DATABASE_URL` et le `DATABASE_URL` de
l'application ne désignent jamais la même base. Le README le disait déjà pour
Neon ; il le dit maintenant pour deux bases locales. La démonstration a été
rejouée sur `codiplan_demo`, et les six écrans s'y ouvrent.

*Parenté : c'est la divergence comme instrument (§9, 07/09), prise à l'envers —
deux chemins qui ne devaient PAS se ressembler partageaient une ressource, et
chacun rendait l'autre faux.*
