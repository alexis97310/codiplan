# Captures d'écran — ce que l'application affiche aujourd'hui

**Ces images montrent que les écrans s'affichent. Elles ne prouvent pas qu'ils fonctionnent.** Elles sont désormais prises par une COMMANDE — `pnpm exec tsx scripts/captures.mts` — et non à la main : une prise de vue manuelle ne se rejoue pas, et vieillit sans le dire.

| | |
|---|---|
| **Commit photographié** | `d5ec9654758eb8b218573b584fabee1066137bb3` (`d5ec965`) — lu dans `git rev-parse HEAD` au moment de la prise, jamais de mémoire |
| **Date de la prise** | 2026-09-15 09:19 UTC — lue à l'horloge, jamais déduite |
| **Base** | un PostgreSQL 16 local et jetable, rempli par `pnpm db:seed` — aucune donnée réelle (I9) |
| **Compte** | l'identité de démonstration du seed |

## Comment la rejouer

**Le script ne prépare ni la base ni le compte** : cela demande une base jetable, un semis, et un mot de passe qui n'existe nulle part tant qu'une personne n'en a pas choisi un. *Le script annonçait cette procédure « dans le README qu'il écrit » — et le README ne la portait pas. Elle y est.*

```bash
# 1. Une base LOCALE ET JETABLE — jamais la base hébergée (I9).
scripts/postgres-jetable.sh

# DEUX RÔLES, ET LES CONFONDRE COÛTE UNE HEURE (mesuré le 10/09/2026).
#   le PROPRIÉTAIRE migre et sème ; l'APPLICATIF sert les pages, et c'est
#   la seule forme sous laquelle les politiques de cloisonnement mordent.
PROPRIETAIRE='postgresql://postgres@127.0.0.1:5433/codiplan_test'
APPLICATIF='postgresql://codiplan_app@127.0.0.1:5433/codiplan_test'
export BETTER_AUTH_SECRET='…au moins 32 octets…'
export BETTER_AUTH_URL='http://127.0.0.1:3100'
DATABASE_URL="$PROPRIETAIRE" pnpm db:deploy
DATABASE_URL="$PROPRIETAIRE" pnpm db:seed

# 2. Le serveur. Serveur et prise de vue tiennent dans UNE SEULE commande.
#    ET ON VÉRIFIE QU'AUCUN SERVEUR N'OCCUPE DÉJÀ LE PORT : un serveur
#    laissé par une commande précédente répond encore aux pages statiques
#    tout en ayant perdu sa base, le nouveau serveur échoue alors sur
#    EADDRINUSE — dans son journal, que personne ne lit —, et la prise de
#    vue photographie le mort. Mesuré le 10/09/2026.
DATABASE_URL="$PROPRIETAIRE" pnpm build
DATABASE_URL="$APPLICATIF" pnpm start -p 3100 &

# 3. LE MOT DE PASSE N'EXISTE PAS ENCORE. Le semis pose une ligne de
#    `compte` à `mot_de_passe NULL` — l'état exact que l'amorçage laisse —,
#    et la seule porte est le lien de premier accès.
AMORCAGE_PREMIER_COMPTE_CONFIRME=oui pnpm exec tsx \
  scripts/amorcage-premier-compte.mts --reemettre \
  --societe <uuid> --email <courriel> --base http://127.0.0.1:3100
#    → suivre l'URL imprimée, choisir un mot de passe. Il n'entre dans
#      aucun fichier du dépôt (I9).

# 4. La prise de vue.
BASE=http://127.0.0.1:3100 COURRIEL=… MOT_DE_PASSE=… \
  COURRIEL_PORTAIL=… MOT_DE_PASSE_PORTAIL=… \
  pnpm exec tsx scripts/captures.mts
```

**Un `next dev` laissé vivant CORROMPT la prise de vue**, sans rien dire non plus : les deux serveurs partagent `.next`, et celui de développement y réécrit ce que le build de production y avait mis. *Mesuré le 10/09/2026 : `TypeError: a[d] is not a function` et « Could not find files for /_error » sur toutes les pages, le formulaire de connexion jamais rendu, 36 images retirées.* Avant une prise : plus aucun serveur vivant, puis `rm -rf .next && pnpm build`.

**La sonde qui attend le serveur touche la BASE, jamais seulement le port.** `curl /` réussit sur un serveur dont la base est inatteignable ; `curl /sante | grep installation` échoue. *Une sonde qui ne touche pas ce dont on a besoin valide un serveur qui ne peut pas servir* — et la prise de vue qui suit photographie des pages d'erreur sous le nom des écrans.

**Si `DATABASE_URL` porte le rôle propriétaire, le serveur de production ne le dit PAS.** `garantirRoleApplicatif` refuse — à bon droit — et ferme le client dans la foulée, pour que le refus soit un vrai refus de se connecter. Le message juste est émis **une fois**, puis noyé sous des dizaines d'`Engine is not yet connected` qui n'ont plus rien à voir avec la cause. *Mesuré le 10/09/2026 : 48 de ces lignes pour un seul refus lisible, et la conclusion qu'on en tire spontanément est que l'hébergeur réclame le moteur Prisma.* En `next dev`, le même refus s'affiche en clair : **quand le serveur de production devient incompréhensible, le relancer en développement coûte deux minutes et nomme la cause.**

`COURRIEL_PORTAIL` désigne une **seconde identité**, et elle est nécessaire plutôt que commode : un compte portail n'a aucune ligne dans `utilisateur_societe` (D10), donc aucun compte interne n'atteint `/portail`. Sans elle, les quatre images du portail sont refusées et le refus le dit.

## Comment savoir si un écran a changé depuis cette prise

**Une commande, et elle rend un ÉTAT — jamais un silence :**

```bash
pnpm captures:etat
```

Elle compare `d5ec965` à `HEAD` sur les chemins ci-dessous et rend l'un de **trois** verdicts. Le troisième est celui qu'on oublie : dans un clone tronqué (`--depth`), l'empreinte photographiée n'existe pas, et *« je ne sais pas » se lirait « rien n'a changé »* — le silence qui a exactement la forme du succès. Elle sort en **1** dans ce cas, et en **0** dès que la question est répondue, quelle que soit la réponse : *un écran qui change entre deux prises est le cours ordinaire du travail, pas une faute, et rougir là-dessus ferait un contrôle qu'on apprend à ne plus lire.*

| Chemin | | Pourquoi un changement ici change l'image |
|---|---|---|
| `app/` | déduite | les écrans eux-mêmes — chaque page, chaque mise en page, et le groupe de routes qui décide qu'un écran porte ou non la barre (R2-16) |
| `components/` | déduite | ce que les écrans assemblent — un tableau, une grille, une pastille de statut : un composant change l'image sans que la page bouge d'une ligne |
| `lib/i18n/` | déclarée | CHAQUE MOT qu'un humain lit en se servant de l'application (§5 de CLAUDE.md). Aucun fichier n'y porte de marque de rendu — il ne rend rien — et une prise de vue y survivrait à un changement de tous les libellés |
| `lib/theme/` | déclarée | la charte de la société active et les couleurs des huit statuts (D51) — un code de lecture partagé, pas une préférence : une image prise avant un changement de statut montre une autre couleur |
| `app/globals.css` | déclarée | la SEULE forme sous laquelle une palette se déclare (D95) — `lib/theme/apparence.ts` n'écrit aucune couleur, il nomme des rôles. Nommé au fichier et non au répertoire : `app/` le couvre déjà, et cette entrée existe pour que le motif soit LU |

**La moitié « déduite » ne s'écrit nulle part, et c'est ce qui la rend sûre.** Un fichier qui rend du JSX, exporte les `metadata` de Next.js ou interroge l'écran **est** de la surface, par le fait ; un gardien exige que chacun tombe sous l'un de ces chemins (`tests/unit/captures/surface-decran.test.ts`). *Une page écrite demain dans un répertoire que personne n'a prévu fait rougir le jour même* — la liste est une déclaration confrontée à une source qu'elle ne contrôle pas, jamais une énumération tenue à la main.

**Et ce que cette commande NE dit PAS est écrit plutôt que tu.** Elle répond « aucun fichier de RESTITUTION n'a changé », jamais « les écrans sont identiques » : ce qu'un écran affiche dépend aussi de ce que le métier CALCULE — `lib/interventions/statistiques.ts` décide du taux que le planning montre, et il n'est pas dans cette liste. *La frontière n'est pas « ce qui influence un écran » — ce serait le dépôt entier — mais « ce qui RESTITUE » : ce qui rend, ce qui nomme, ce qui colore.*

## Ce que le script REFUSE de photographier

Chaque écran porte un **témoin** : un texte qui doit s'y trouver. Si la page ne le porte pas — parce que la connexion a échoué, parce que l'écran a été renommé, parce qu'une redirection a mené ailleurs — **la capture est refusée et l'absence est écrite ici**. *Une capture d'un écran de connexion rangée sous le nom « planning » est pire qu'une capture absente : elle se relit comme une preuve.*

### Refusées à cette prise

- `portail--clair--1280.png : Error: session absente — Error: aucun COURRIEL_PORTAIL / MOT_DE_PASSE_PORTAIL fourni : un compte portail n'a AUCUNE ligne dans `utilisateur_societe` (D10), donc aucun compte interne ne peut atteindre cet écran.
  Cet écran demande un compte PORTAIL, distinct du compte interne qui sert au reste de la prise de vue : `COURRIEL_PORTAIL` et `MOT_DE_PASSE_PORTAIL`. Sans eux, le refus dit qu'il manque une identité, jamais que l'écran est cassé. ET AUCUN COMPTE PORTAIL NE PEUT EN RECEVOIR AUJOURD'HUI (mesuré le 10/09/2026) : le seul émetteur d'un lien de premier accès est le geste d'amorçage, qui EXIGE une habilitation dans `utilisateur_societe` — et un compte portail n'en a aucune, par D10. Refus littéral : « L'identité portail@example.test n'est pas habilitée sur la société … ». La chaîne d'ENTRÉE du portail est donc murée un cran au-dessus de ce que D92 a ouvert : D92 a rendu le rattachement LISIBLE, rien ne rend le compte CONNECTABLE. C'est un arbitrage, pas un ticket.`
- `portail--clair--390.png : Error: session absente — Error: aucun COURRIEL_PORTAIL / MOT_DE_PASSE_PORTAIL fourni : un compte portail n'a AUCUNE ligne dans `utilisateur_societe` (D10), donc aucun compte interne ne peut atteindre cet écran.
  Cet écran demande un compte PORTAIL, distinct du compte interne qui sert au reste de la prise de vue : `COURRIEL_PORTAIL` et `MOT_DE_PASSE_PORTAIL`. Sans eux, le refus dit qu'il manque une identité, jamais que l'écran est cassé. ET AUCUN COMPTE PORTAIL NE PEUT EN RECEVOIR AUJOURD'HUI (mesuré le 10/09/2026) : le seul émetteur d'un lien de premier accès est le geste d'amorçage, qui EXIGE une habilitation dans `utilisateur_societe` — et un compte portail n'en a aucune, par D10. Refus littéral : « L'identité portail@example.test n'est pas habilitée sur la société … ». La chaîne d'ENTRÉE du portail est donc murée un cran au-dessus de ce que D92 a ouvert : D92 a rendu le rattachement LISIBLE, rien ne rend le compte CONNECTABLE. C'est un arbitrage, pas un ticket.`

## Les images

Chaque écran est photographié à **1280 px** (poste de travail) et **390 px** (téléphone). Le nom se lit `écran--thème--largeur.png`.
**IL N'Y A PLUS QU'UNE IMAGE PAR ÉCRAN ET PAR LARGEUR, et c'est un RETRAIT, pas une omission.** La prise de vue en faisait deux — « clair » et « sombre » —, et *mesuré le 14/09/2026 par `cmp` sur les 100 images commises : les 50 paires étaient IDENTIQUES, octet pour octet.* `lib/theme/apparence.ts` dit qu'il n'y a **PAS d'apparence sombre** : le viewer basculait un thème qui n'existe pas, et le résultat était rangé sous deux noms. **Une seconde image qui ne peut pas différer de la première a la forme d'une preuve et n'en porte aucune** — le §9 du 06/09, appliqué à un fichier plutôt qu'à une ligne de rapport.
*Le segment `clair` reste dans le nom* : la consigne est retirée **jusqu'à nouvel ordre**, et renommer 50 images couperait leur historique pour le rétablir le jour venu. **Réouverture : le jour où `lib/theme/apparence.ts` déclare une apparence sombre** — `THEMES` reçoit sa seconde entrée, et les paires divergent d'elles-mêmes.

### Ce que ces images montrent DE L'OUTIL et non de l'application

**Les champs de date y affichent `mm/dd/yyyy`, et ce n'est PAS ce que l'application affiche.** Le gabarit d'un `<input type="date">` est rendu par le NAVIGATEUR, dans la langue de son interface — pas dans la locale de la page. *Mesuré le 10/09/2026 : sous `locale: "fr-FR"`, `navigator.language` vaut bien `fr-FR` et `toLocaleDateString()` rend `14/09/2026` ; le gabarit du champ reste `mm/dd/yyyy`, et `--lang=fr-FR` au lancement n'y change rien* — le Chromium de ce conteneur n'embarque pas ses traductions d'interface. Sur un navigateur réglé en français, ces champs affichent `jj/mm/aaaa`.

*C'est écrit ici parce qu'une image se relit comme une preuve : sans cette ligne, elle prouverait un défaut qui n'existe pas.* La distinction est celle du registre du 12/09 — **l'outil, ou l'écran** — et elle se tranche par une mesure, jamais à l'œil.

| Fichier | Ce qu'on y voit |
|---|---|
| `enrolement--clair--1280.png` | L'activation du second facteur, où atterrit un rôle sensible avant tout le reste. — thème clair, poste de travail. |
| `enrolement--clair--390.png` | L'activation du second facteur, où atterrit un rôle sensible avant tout le reste. — thème clair, téléphone. |
| `arrivee-sans-societe--clair--1280.png` | L'arrivée d'un compte habilité sur PLUSIEURS sociétés, avant d'en avoir choisi une : le sélecteur, et aucune société active. — thème clair, poste de travail. |
| `arrivee-sans-societe--clair--390.png` | L'arrivée d'un compte habilité sur PLUSIEURS sociétés, avant d'en avoir choisi une : le sélecteur, et aucune société active. — thème clair, téléphone. |
| `terrain--clair--1280.png` | La journée du technicien — SES interventions, à lui, aujourd'hui. Aucun montant, aucune grille, aucun collègue. — thème clair, poste de travail. |
| `terrain--clair--390.png` | La journée du technicien — SES interventions, à lui, aujourd'hui. Aucun montant, aucune grille, aucun collègue. — thème clair, téléphone. |
| `connexion-code--clair--1280.png` | Le défi du second facteur, entre le mot de passe et la session. — thème clair, poste de travail. |
| `connexion-code--clair--390.png` | Le défi du second facteur, entre le mot de passe et la session. — thème clair, téléphone. |
| `accueil--clair--1280.png` | La page d'accueil. — thème clair, poste de travail. |
| `accueil--clair--390.png` | La page d'accueil. — thème clair, téléphone. |
| `connexion--clair--1280.png` | La page de connexion. — thème clair, poste de travail. |
| `connexion--clair--390.png` | La page de connexion. — thème clair, téléphone. |
| `premier-acces--clair--1280.png` | Le choix du premier mot de passe — **la seule porte d'une base neuve**. Le jeton de l'URL est factice : l'écran rend son formulaire sans le valider. — thème clair, poste de travail. |
| `premier-acces--clair--390.png` | Le choix du premier mot de passe — **la seule porte d'une base neuve**. Le jeton de l'URL est factice : l'écran rend son formulaire sans le valider. — thème clair, téléphone. |
| `sante--clair--1280.png` | L'état de l'installation, **sans compte**. — thème clair, poste de travail. |
| `sante--clair--390.png` | L'état de l'installation, **sans compte**. — thème clair, téléphone. |
| `arrivee--clair--1280.png` | La page d'arrivée — qui vous êtes, pour quelle société. — thème clair, poste de travail. |
| `arrivee--clair--390.png` | La page d'arrivée — qui vous êtes, pour quelle société. — thème clair, téléphone. |
| `planning--clair--1280.png` | Le planning : la charge par technicien, la file d'attente et les interventions posées. — thème clair, poste de travail. |
| `planning--clair--390.png` | Le planning : la charge par technicien, la file d'attente et les interventions posées. — thème clair, téléphone. |
| `planning-jour--clair--1280.png` | La vue JOUR du planning : une colonne par technicien ACTIF, occupé ou non — c'est l'écran qui montre les trous. — thème clair, poste de travail. |
| `planning-jour--clair--390.png` | La vue JOUR du planning : une colonne par technicien ACTIF, occupé ou non — c'est l'écran qui montre les trous. — thème clair, téléphone. |
| `imports-rapport--clair--1280.png` | Le rapport de contrôle d'un import : ce qui sera créé, ce qui sera modifié, ce qui est rejeté et pourquoi — AVANT toute écriture (I6). — thème clair, poste de travail. |
| `imports-rapport--clair--390.png` | Le rapport de contrôle d'un import : ce qui sera créé, ce qui sera modifié, ce qui est rejeté et pourquoi — AVANT toute écriture (I6). — thème clair, téléphone. |
| `imports--clair--1280.png` | Les imports Excel : le dépôt d'un classeur, ce qu'on sait appliquer et ce qu'on ne sait que contrôler, et le journal des chargements. — thème clair, poste de travail. |
| `imports--clair--390.png` | Les imports Excel : le dépôt d'un classeur, ce qu'on sait appliquer et ce qu'on ne sait que contrôler, et le journal des chargements. — thème clair, téléphone. |
| `intervention-creation--clair--1280.png` | La création d'une intervention depuis le planning. — thème clair, poste de travail. |
| `intervention-creation--clair--390.png` | La création d'une intervention depuis le planning. — thème clair, téléphone. |
| `intervention-detail--clair--1280.png` | Le détail d'une intervention, et les actions que son statut autorise. — thème clair, poste de travail. |
| `intervention-detail--clair--390.png` | Le détail d'une intervention, et les actions que son statut autorise. — thème clair, téléphone. |
| `parc--clair--1280.png` | Le parc machines — le résumé compté SUR LES LIGNES RENDUES, jamais par une seconde requête. — thème clair, poste de travail. |
| `parc--clair--390.png` | Le parc machines — le résumé compté SUR LES LIGNES RENDUES, jamais par une seconde requête. — thème clair, téléphone. |
| `clients--clair--1280.png` | Le référentiel client — UN SEUL compteur, celui qui nomme un geste (RG-IMP-05, D29). — thème clair, poste de travail. |
| `clients--clair--390.png` | Le référentiel client — UN SEUL compteur, celui qui nomme un geste (RG-IMP-05, D29). — thème clair, téléphone. |
| `client-creation--clair--1280.png` | La création d'une fiche — la société vient de la session, jamais d'une saisie. — thème clair, poste de travail. |
| `client-creation--clair--390.png` | La création d'une fiche — la société vient de la session, jamais d'une saisie. — thème clair, téléphone. |
| `client-detail--clair--1280.png` | La fiche d'un client — ses lieux, ses dernières interventions, et le bloc Contacts qui NOMME son absence (D88). — thème clair, poste de travail. |
| `client-detail--clair--390.png` | La fiche d'un client — ses lieux, ses dernières interventions, et le bloc Contacts qui NOMME son absence (D88). — thème clair, téléphone. |
| `absences--clair--1280.png` | Les blocages d'agenda — une personne, une période, et RIEN d'autre (R3-14). Aucun créneau n'est proposé (D106). — thème clair, poste de travail. |
| `absences--clair--390.png` | Les blocages d'agenda — une personne, une période, et RIEN d'autre (R3-14). Aucun créneau n'est proposé (D106). — thème clair, téléphone. |
| `sites--clair--1280.png` | Les lieux d'intervention, avec leur RATTACHEMENT à côté du temps de trajet (D56). — thème clair, poste de travail. |
| `sites--clair--390.png` | Les lieux d'intervention, avec leur RATTACHEMENT à côté du temps de trajet (D56). — thème clair, téléphone. |
| `parametres-trajets--clair--1280.png` | Les temps de trajet par zone — des DÉFAUTS qui se règlent, et la cascade rend son ORIGINE (D107). — thème clair, poste de travail. |
| `parametres-trajets--clair--390.png` | Les temps de trajet par zone — des DÉFAUTS qui se règlent, et la cascade rend son ORIGINE (D107). — thème clair, téléphone. |
| `parametres--clair--1280.png` | La porte des écrans de paramétrage (R3-08) — elle ne lit aucune base et ne compte rien. — thème clair, poste de travail. |
| `parametres--clair--390.png` | La porte des écrans de paramétrage (R3-08) — elle ne lit aucune base et ne compte rien. — thème clair, téléphone. |
| `vgp--clair--1280.png` | Le registre des vérifications périodiques. CODIPLAN n'affirme JAMAIS la conformité : il dit ce qu'on lui a dit (D88). — thème clair, poste de travail. |
| `vgp--clair--390.png` | Le registre des vérifications périodiques. CODIPLAN n'affirme JAMAIS la conformité : il dit ce qu'on lui a dit (D88). — thème clair, téléphone. |
| `vgp-a-determiner--clair--1280.png` | Les familles dont l'assujettissement n'a pas été tranché — une case décochée serait indiscernable d'une famille jamais examinée. — thème clair, poste de travail. |
| `vgp-a-determiner--clair--390.png` | Les familles dont l'assujettissement n'a pas été tranché — une case décochée serait indiscernable d'une famille jamais examinée. — thème clair, téléphone. |
| `parametres-agences--clair--1280.png` | Les horaires d'ouverture, réglés **par agence** — I7, jamais un calendrier global. — thème clair, poste de travail. |
| `parametres-agences--clair--390.png` | Les horaires d'ouverture, réglés **par agence** — I7, jamais un calendrier global. — thème clair, téléphone. |
| `parametres-forfaits--clair--1280.png` | Le catalogue des forfaits et leur RANG (D86). Il naît vide : les valeurs sont à l'exploitation. — thème clair, poste de travail. |
| `parametres-forfaits--clair--390.png` | Le catalogue des forfaits et leur RANG (D86). Il naît vide : les valeurs sont à l'exploitation. — thème clair, téléphone. |
| `parametres-prestations--clair--1280.png` | Le catalogue des prestations (R3-15) — une durée, jamais un taux (D109, D113). Il naît vide : les valeurs sont à l'exploitation. — thème clair, poste de travail. |
| `parametres-prestations--clair--390.png` | Le catalogue des prestations (R3-15) — une durée, jamais un taux (D109, D113). Il naît vide : les valeurs sont à l'exploitation. — thème clair, téléphone. |
