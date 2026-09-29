# Captures d'écran — ce que l'application affiche aujourd'hui

**Ces images montrent que les écrans s'affichent. Elles ne prouvent pas qu'ils fonctionnent.** Elles sont désormais prises par une COMMANDE — `pnpm exec tsx scripts/captures.mts` — et non à la main : une prise de vue manuelle ne se rejoue pas, et vieillit sans le dire.

| | |
|---|---|
| **Commit photographié** | `8fcc37d8454334dbe8ee2e023e039d1a1bd11a97` (`8fcc37d`) — lu dans `git rev-parse HEAD` au moment de la prise, jamais de mémoire |
| **Date de la prise** | 2026-09-29 21:27 UTC — lue à l'horloge, jamais déduite |
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
  COURRIEL_MULTI=direction@codima.test MOT_DE_PASSE_MULTI=… \
  pnpm exec tsx scripts/captures.mts
```

**Un `next dev` laissé vivant CORROMPT la prise de vue**, sans rien dire non plus : les deux serveurs partagent `.next`, et celui de développement y réécrit ce que le build de production y avait mis. *Mesuré le 10/09/2026 : `TypeError: a[d] is not a function` et « Could not find files for /_error » sur toutes les pages, le formulaire de connexion jamais rendu, 36 images retirées.* Avant une prise : plus aucun serveur vivant, puis `rm -rf .next && pnpm build`.

**La sonde qui attend le serveur touche la BASE, jamais seulement le port.** `curl /` réussit sur un serveur dont la base est inatteignable ; `curl /sante | grep installation` échoue. *Une sonde qui ne touche pas ce dont on a besoin valide un serveur qui ne peut pas servir* — et la prise de vue qui suit photographie des pages d'erreur sous le nom des écrans.

**Si `DATABASE_URL` porte le rôle propriétaire, le serveur de production ne le dit PAS.** `garantirRoleApplicatif` refuse — à bon droit — et ferme le client dans la foulée, pour que le refus soit un vrai refus de se connecter. Le message juste est émis **une fois**, puis noyé sous des dizaines d'`Engine is not yet connected` qui n'ont plus rien à voir avec la cause. *Mesuré le 10/09/2026 : 48 de ces lignes pour un seul refus lisible, et la conclusion qu'on en tire spontanément est que l'hébergeur réclame le moteur Prisma.* En `next dev`, le même refus s'affiche en clair : **quand le serveur de production devient incompréhensible, le relancer en développement coûte deux minutes et nomme la cause.**

`COURRIEL_PORTAIL` désigne une **seconde identité**, et elle est nécessaire plutôt que commode : un compte portail n'a aucune ligne dans `utilisateur_societe` (D10), donc aucun compte interne n'atteint `/portail`. Sans elle, les quatre images du portail sont refusées et le refus le dit.

`COURRIEL_MULTI` désigne une **troisième identité, habilitée sur AU MOINS DEUX sociétés** — sur la base jetable de démonstration, `direction@codima.test`, dont le mot de passe se pose comme celui de `COURRIEL` (étape 3, `scripts/amorcage-premier-compte.mts --reemettre`). Elle sert à la SEULE image « aucune société active » : rien ne garantit que `COURRIEL`, choisi pour le reste de la prise, soit multi-société, et les confondre a déjà produit deux images identiques à l'octet près (99O, constat C-A2). Sans elle, cette seule image est refusée et le refus le dit — jamais un repli silencieux sur `COURRIEL`.

## Comment savoir si un écran a changé depuis cette prise

**Une commande, et elle rend un ÉTAT — jamais un silence :**

```bash
pnpm captures:etat
```

Elle compare `8fcc37d` à `HEAD` sur les chemins ci-dessous et rend l'un de **trois** verdicts. Le troisième est celui qu'on oublie : dans un clone tronqué (`--depth`), l'empreinte photographiée n'existe pas, et *« je ne sais pas » se lirait « rien n'a changé »* — le silence qui a exactement la forme du succès. Elle sort en **1** dans ce cas, et en **0** dès que la question est répondue, quelle que soit la réponse : *un écran qui change entre deux prises est le cours ordinaire du travail, pas une faute, et rougir là-dessus ferait un contrôle qu'on apprend à ne plus lire.*

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

- `arrivee-sans-societe--clair--1280.png : Error: session absente — Error: La connexion n'a pas abouti pour direction@codima.test : la page est restée sur http://127.0.0.1:3100/connexion/code. Le compte porte DÉJÀ un second facteur et la clé n'est pas connue de cette prise de vue : repasser `SECRET_TOTP`, ou repartir d'une base fraîchement semée. Aucune capture authentifiée ne sera prise — mieux vaut aucune image qu'une page de connexion r
  Cette image exige un compte habilité sur AU MOINS DEUX sociétés — sur la démonstration, `direction@codima.test` — et se connecte sous `COURRIEL_MULTI` / `MOT_DE_PASSE_MULTI`, une identité DÉDIÉE et distincte de `COURRIEL` (99O, constat C-A2) : les confondre a déjà produit deux images identiques à l'octet près, l'écran « aucune société active » montrant en réalité une société active. Sans ces deux variables, le refus le dit. Avec un compte mono-société, la connexion active la seule habilitation (D35) et le sélecteur ne s'affiche jamais : le refus est alors juste, et il dit que COURRIEL_MULTI désigne le mauvais compte.`
- `arrivee-sans-societe--clair--1024.png : Error: session absente — Error: La connexion n'a pas abouti pour direction@codima.test : la page est restée sur http://127.0.0.1:3100/connexion/code. Le compte porte DÉJÀ un second facteur et la clé n'est pas connue de cette prise de vue : repasser `SECRET_TOTP`, ou repartir d'une base fraîchement semée. Aucune capture authentifiée ne sera prise — mieux vaut aucune image qu'une page de connexion r
  Cette image exige un compte habilité sur AU MOINS DEUX sociétés — sur la démonstration, `direction@codima.test` — et se connecte sous `COURRIEL_MULTI` / `MOT_DE_PASSE_MULTI`, une identité DÉDIÉE et distincte de `COURRIEL` (99O, constat C-A2) : les confondre a déjà produit deux images identiques à l'octet près, l'écran « aucune société active » montrant en réalité une société active. Sans ces deux variables, le refus le dit. Avec un compte mono-société, la connexion active la seule habilitation (D35) et le sélecteur ne s'affiche jamais : le refus est alors juste, et il dit que COURRIEL_MULTI désigne le mauvais compte.`
- `arrivee-sans-societe--clair--375.png : Error: session absente — Error: La connexion n'a pas abouti pour direction@codima.test : la page est restée sur http://127.0.0.1:3100/connexion/code. Le compte porte DÉJÀ un second facteur et la clé n'est pas connue de cette prise de vue : repasser `SECRET_TOTP`, ou repartir d'une base fraîchement semée. Aucune capture authentifiée ne sera prise — mieux vaut aucune image qu'une page de connexion r
  Cette image exige un compte habilité sur AU MOINS DEUX sociétés — sur la démonstration, `direction@codima.test` — et se connecte sous `COURRIEL_MULTI` / `MOT_DE_PASSE_MULTI`, une identité DÉDIÉE et distincte de `COURRIEL` (99O, constat C-A2) : les confondre a déjà produit deux images identiques à l'octet près, l'écran « aucune société active » montrant en réalité une société active. Sans ces deux variables, le refus le dit. Avec un compte mono-société, la connexion active la seule habilitation (D35) et le sélecteur ne s'affiche jamais : le refus est alors juste, et il dit que COURRIEL_MULTI désigne le mauvais compte.`
- `portail--clair--1280.png : Error: session absente — Error: aucun COURRIEL_PORTAIL / MOT_DE_PASSE_PORTAIL fourni : un compte portail n'a AUCUNE ligne dans `utilisateur_societe` (D10), donc aucun compte interne ne peut atteindre cet écran.
  Cet écran demande un compte PORTAIL, distinct du compte interne qui sert au reste de la prise de vue : `COURRIEL_PORTAIL` et `MOT_DE_PASSE_PORTAIL`. Sans eux, le refus dit qu'il manque une identité, jamais que l'écran est cassé. ET AUCUN COMPTE PORTAIL NE PEUT EN RECEVOIR AUJOURD'HUI (mesuré le 10/09/2026) : le seul émetteur d'un lien de premier accès est le geste d'amorçage, qui EXIGE une habilitation dans `utilisateur_societe` — et un compte portail n'en a aucune, par D10. Refus littéral : « L'identité portail@example.test n'est pas habilitée sur la société … ». La chaîne d'ENTRÉE du portail est donc murée un cran au-dessus de ce que D92 a ouvert : D92 a rendu le rattachement LISIBLE, rien ne rend le compte CONNECTABLE. C'est un arbitrage, pas un ticket.`
- `portail--clair--1024.png : Error: session absente — Error: aucun COURRIEL_PORTAIL / MOT_DE_PASSE_PORTAIL fourni : un compte portail n'a AUCUNE ligne dans `utilisateur_societe` (D10), donc aucun compte interne ne peut atteindre cet écran.
  Cet écran demande un compte PORTAIL, distinct du compte interne qui sert au reste de la prise de vue : `COURRIEL_PORTAIL` et `MOT_DE_PASSE_PORTAIL`. Sans eux, le refus dit qu'il manque une identité, jamais que l'écran est cassé. ET AUCUN COMPTE PORTAIL NE PEUT EN RECEVOIR AUJOURD'HUI (mesuré le 10/09/2026) : le seul émetteur d'un lien de premier accès est le geste d'amorçage, qui EXIGE une habilitation dans `utilisateur_societe` — et un compte portail n'en a aucune, par D10. Refus littéral : « L'identité portail@example.test n'est pas habilitée sur la société … ». La chaîne d'ENTRÉE du portail est donc murée un cran au-dessus de ce que D92 a ouvert : D92 a rendu le rattachement LISIBLE, rien ne rend le compte CONNECTABLE. C'est un arbitrage, pas un ticket.`
- `portail--clair--375.png : Error: session absente — Error: aucun COURRIEL_PORTAIL / MOT_DE_PASSE_PORTAIL fourni : un compte portail n'a AUCUNE ligne dans `utilisateur_societe` (D10), donc aucun compte interne ne peut atteindre cet écran.
  Cet écran demande un compte PORTAIL, distinct du compte interne qui sert au reste de la prise de vue : `COURRIEL_PORTAIL` et `MOT_DE_PASSE_PORTAIL`. Sans eux, le refus dit qu'il manque une identité, jamais que l'écran est cassé. ET AUCUN COMPTE PORTAIL NE PEUT EN RECEVOIR AUJOURD'HUI (mesuré le 10/09/2026) : le seul émetteur d'un lien de premier accès est le geste d'amorçage, qui EXIGE une habilitation dans `utilisateur_societe` — et un compte portail n'en a aucune, par D10. Refus littéral : « L'identité portail@example.test n'est pas habilitée sur la société … ». La chaîne d'ENTRÉE du portail est donc murée un cran au-dessus de ce que D92 a ouvert : D92 a rendu le rattachement LISIBLE, rien ne rend le compte CONNECTABLE. C'est un arbitrage, pas un ticket.`
- `intervention-detail--clair--1280.png : Error: le planning ne porte aucun lien d'intervention : il n'y a rien à détailler, et la capture est refusée plutôt que prise sur une page d'erreur.
  Cet écran n'existe que si le planning porte au moins une intervention. Sur une base sans semis de démonstration, le refus est LÉGITIME et dit exactement cela — il ne se confond pas avec un écran cassé.`
- `intervention-detail--clair--1024.png : Error: le planning ne porte aucun lien d'intervention : il n'y a rien à détailler, et la capture est refusée plutôt que prise sur une page d'erreur.
  Cet écran n'existe que si le planning porte au moins une intervention. Sur une base sans semis de démonstration, le refus est LÉGITIME et dit exactement cela — il ne se confond pas avec un écran cassé.`
- `intervention-detail--clair--375.png : Error: le planning ne porte aucun lien d'intervention : il n'y a rien à détailler, et la capture est refusée plutôt que prise sur une page d'erreur.
  Cet écran n'existe que si le planning porte au moins une intervention. Sur une base sans semis de démonstration, le refus est LÉGITIME et dit exactement cela — il ne se confond pas avec un écran cassé.`
- `client-detail--clair--1280.png : Error: « client-detail » ne porte pas son témoin « Dernières interventions » : ce n'est pas l'écran attendu, et la capture est refusée. Atteint : /clients/0192f0a0-1000-7000-8000-000000000001 — vu : « Aller au contenu CODIPLAN SAV EXPLOITATION Tableau de bord Planning Demandes Interventions Absences CLIENTS & PARC Clien »
  Cet écran n'existe que si le référentiel porte au moins un client. Sur une base sans semis de démonstration, le refus est LÉGITIME et dit exactement cela — il ne se confond pas avec un écran cassé.`
- `client-detail--clair--1024.png : Error: « client-detail » ne porte pas son témoin « Dernières interventions » : ce n'est pas l'écran attendu, et la capture est refusée. Atteint : /clients/0192f0a0-1000-7000-8000-000000000001 — vu : « Aller au contenu CODIPLAN SAV EXPLOITATION Tableau de bord Planning Demandes Interventions Absences CLIENTS & PARC Clien »
  Cet écran n'existe que si le référentiel porte au moins un client. Sur une base sans semis de démonstration, le refus est LÉGITIME et dit exactement cela — il ne se confond pas avec un écran cassé.`
- `client-detail--clair--375.png : Error: « client-detail » ne porte pas son témoin « Dernières interventions » : ce n'est pas l'écran attendu, et la capture est refusée. Atteint : /clients/0192f0a0-1000-7000-8000-000000000001 — vu : « Aller au contenu Atelier Ducos Clients › Atelier Ducos CLIENTS & PARC Atelier Ducos DEMO-001 + Site + Intervention ← Tou »
  Cet écran n'existe que si le référentiel porte au moins un client. Sur une base sans semis de démonstration, le refus est LÉGITIME et dit exactement cela — il ne se confond pas avec un écran cassé.`

## Les images

Chaque écran est photographié à **1280 px** (poste de travail), **1024 px** (poste de travail), **375 px** (téléphone). Le nom se lit `écran--thème--largeur.png`.
**IL N'Y A PLUS QU'UNE IMAGE PAR ÉCRAN ET PAR LARGEUR, et c'est un RETRAIT, pas une omission.** La prise de vue en faisait deux — « clair » et « sombre » —, et *mesuré le 14/09/2026 par `cmp` sur les 100 images commises : les 50 paires étaient IDENTIQUES, octet pour octet.* `lib/theme/apparence.ts` dit qu'il n'y a **PAS d'apparence sombre** : le viewer basculait un thème qui n'existe pas, et le résultat était rangé sous deux noms. **Une seconde image qui ne peut pas différer de la première a la forme d'une preuve et n'en porte aucune** — le §9 du 06/09, appliqué à un fichier plutôt qu'à une ligne de rapport.
*Le segment `clair` reste dans le nom* : la consigne est retirée **jusqu'à nouvel ordre**, et renommer 50 images couperait leur historique pour le rétablir le jour venu. **Réouverture : le jour où `lib/theme/apparence.ts` déclare une apparence sombre** — `THEMES` reçoit sa seconde entrée, et les paires divergent d'elles-mêmes.

### Ce que ces images montrent DE L'OUTIL et non de l'application

**Les champs de date y affichent `mm/dd/yyyy`, et ce n'est PAS ce que l'application affiche.** Le gabarit d'un `<input type="date">` est rendu par le NAVIGATEUR, dans la langue de son interface — pas dans la locale de la page. *Mesuré le 10/09/2026 : sous `locale: "fr-FR"`, `navigator.language` vaut bien `fr-FR` et `toLocaleDateString()` rend `14/09/2026` ; le gabarit du champ reste `mm/dd/yyyy`, et `--lang=fr-FR` au lancement n'y change rien* — le Chromium de ce conteneur n'embarque pas ses traductions d'interface. Sur un navigateur réglé en français, ces champs affichent `jj/mm/aaaa`.

*C'est écrit ici parce qu'une image se relit comme une preuve : sans cette ligne, elle prouverait un défaut qui n'existe pas.* La distinction est celle du registre du 12/09 — **l'outil, ou l'écran** — et elle se tranche par une mesure, jamais à l'œil.

| Fichier | Ce qu'on y voit |
|---|---|
| `enrolement--clair--1280.png` | L'activation du second facteur, où atterrit un rôle sensible avant tout le reste. — thème clair, poste de travail. |
| `enrolement--clair--1024.png` | L'activation du second facteur, où atterrit un rôle sensible avant tout le reste. — thème clair, poste de travail. |
| `enrolement--clair--375.png` | L'activation du second facteur, où atterrit un rôle sensible avant tout le reste. — thème clair, téléphone. |
| `terrain--clair--1280.png` | La journée du technicien — SES interventions, à lui, aujourd'hui. Aucun montant, aucune grille, aucun collègue. — thème clair, poste de travail. |
| `terrain--clair--1024.png` | La journée du technicien — SES interventions, à lui, aujourd'hui. Aucun montant, aucune grille, aucun collègue. — thème clair, poste de travail. |
| `terrain--clair--375.png` | La journée du technicien — SES interventions, à lui, aujourd'hui. Aucun montant, aucune grille, aucun collègue. — thème clair, téléphone. |
| `terrain-intervention--clair--1280.png` | Une intervention vue du terrain, et son compteur — le temps mesuré, et un seul bouton : démarrer, ou mettre en pause. — thème clair, poste de travail. |
| `terrain-intervention--clair--1024.png` | Une intervention vue du terrain, et son compteur — le temps mesuré, et un seul bouton : démarrer, ou mettre en pause. — thème clair, poste de travail. |
| `terrain-intervention--clair--375.png` | Une intervention vue du terrain, et son compteur — le temps mesuré, et un seul bouton : démarrer, ou mettre en pause. — thème clair, téléphone. |
| `connexion-code--clair--1280.png` | Le défi du second facteur, entre le mot de passe et la session. — thème clair, poste de travail. |
| `connexion-code--clair--1024.png` | Le défi du second facteur, entre le mot de passe et la session. — thème clair, poste de travail. |
| `connexion-code--clair--375.png` | Le défi du second facteur, entre le mot de passe et la session. — thème clair, téléphone. |
| `accueil--clair--1280.png` | La page d'accueil. — thème clair, poste de travail. |
| `accueil--clair--1024.png` | La page d'accueil. — thème clair, poste de travail. |
| `accueil--clair--375.png` | La page d'accueil. — thème clair, téléphone. |
| `connexion--clair--1280.png` | La page de connexion. — thème clair, poste de travail. |
| `connexion--clair--1024.png` | La page de connexion. — thème clair, poste de travail. |
| `connexion--clair--375.png` | La page de connexion. — thème clair, téléphone. |
| `premier-acces--clair--1280.png` | Le choix du premier mot de passe — **la seule porte d'une base neuve**. Le jeton de l'URL est factice : l'écran rend son formulaire sans le valider. — thème clair, poste de travail. |
| `premier-acces--clair--1024.png` | Le choix du premier mot de passe — **la seule porte d'une base neuve**. Le jeton de l'URL est factice : l'écran rend son formulaire sans le valider. — thème clair, poste de travail. |
| `premier-acces--clair--375.png` | Le choix du premier mot de passe — **la seule porte d'une base neuve**. Le jeton de l'URL est factice : l'écran rend son formulaire sans le valider. — thème clair, téléphone. |
| `sante--clair--1280.png` | L'état de l'installation, **sans compte**. — thème clair, poste de travail. |
| `sante--clair--1024.png` | L'état de l'installation, **sans compte**. — thème clair, poste de travail. |
| `sante--clair--375.png` | L'état de l'installation, **sans compte**. — thème clair, téléphone. |
| `arrivee--clair--1280.png` | La page d'arrivée — qui vous êtes, pour quelle société. — thème clair, poste de travail. |
| `arrivee--clair--1024.png` | La page d'arrivée — qui vous êtes, pour quelle société. — thème clair, poste de travail. |
| `arrivee--clair--375.png` | La page d'arrivée — qui vous êtes, pour quelle société. — thème clair, téléphone. |
| `planning--clair--1280.png` | Le planning : la charge par technicien, la file d'attente et les interventions posées. — thème clair, poste de travail. |
| `planning--clair--1024.png` | Le planning : la charge par technicien, la file d'attente et les interventions posées. — thème clair, poste de travail. |
| `planning--clair--375.png` | Le planning : la charge par technicien, la file d'attente et les interventions posées. — thème clair, téléphone. |
| `planning-jour--clair--1280.png` | La vue JOUR du planning : une colonne par technicien ACTIF, occupé ou non — c'est l'écran qui montre les trous. — thème clair, poste de travail. |
| `planning-jour--clair--1024.png` | La vue JOUR du planning : une colonne par technicien ACTIF, occupé ou non — c'est l'écran qui montre les trous. — thème clair, poste de travail. |
| `planning-jour--clair--375.png` | La vue JOUR du planning : une colonne par technicien ACTIF, occupé ou non — c'est l'écran qui montre les trous. — thème clair, téléphone. |
| `tableau-de-bord--clair--1280.png` | Le tableau de bord : les décisions et alertes du jour, sans remplacer le planning. — thème clair, poste de travail. |
| `tableau-de-bord--clair--1024.png` | Le tableau de bord : les décisions et alertes du jour, sans remplacer le planning. — thème clair, poste de travail. |
| `tableau-de-bord--clair--375.png` | Le tableau de bord : les décisions et alertes du jour, sans remplacer le planning. — thème clair, téléphone. |
| `interventions--clair--1280.png` | Le registre des interventions — un écran d'exploitation resté hors de la prise de vue (CG9, constat C-A3). — thème clair, poste de travail. |
| `interventions--clair--1024.png` | Le registre des interventions — un écran d'exploitation resté hors de la prise de vue (CG9, constat C-A3). — thème clair, poste de travail. |
| `interventions--clair--375.png` | Le registre des interventions — un écran d'exploitation resté hors de la prise de vue (CG9, constat C-A3). — thème clair, téléphone. |
| `imports-rapport--clair--1280.png` | Le rapport de contrôle d'un import : ce qui sera créé, ce qui sera modifié, ce qui est rejeté et pourquoi — AVANT toute écriture (I6). — thème clair, poste de travail. |
| `imports-rapport--clair--1024.png` | Le rapport de contrôle d'un import : ce qui sera créé, ce qui sera modifié, ce qui est rejeté et pourquoi — AVANT toute écriture (I6). — thème clair, poste de travail. |
| `imports-rapport--clair--375.png` | Le rapport de contrôle d'un import : ce qui sera créé, ce qui sera modifié, ce qui est rejeté et pourquoi — AVANT toute écriture (I6). — thème clair, téléphone. |
| `imports--clair--1280.png` | Les imports Excel : le dépôt d'un classeur, ce qu'on sait appliquer et ce qu'on ne sait que contrôler, et le journal des chargements. — thème clair, poste de travail. |
| `imports--clair--1024.png` | Les imports Excel : le dépôt d'un classeur, ce qu'on sait appliquer et ce qu'on ne sait que contrôler, et le journal des chargements. — thème clair, poste de travail. |
| `imports--clair--375.png` | Les imports Excel : le dépôt d'un classeur, ce qu'on sait appliquer et ce qu'on ne sait que contrôler, et le journal des chargements. — thème clair, téléphone. |
| `intervention-creation--clair--1280.png` | La création d'une intervention depuis le planning. — thème clair, poste de travail. |
| `intervention-creation--clair--1024.png` | La création d'une intervention depuis le planning. — thème clair, poste de travail. |
| `intervention-creation--clair--375.png` | La création d'une intervention depuis le planning. — thème clair, téléphone. |
| `parc--clair--1280.png` | Le parc machines — le résumé compté SUR LES LIGNES RENDUES, jamais par une seconde requête. — thème clair, poste de travail. |
| `parc--clair--1024.png` | Le parc machines — le résumé compté SUR LES LIGNES RENDUES, jamais par une seconde requête. — thème clair, poste de travail. |
| `parc--clair--375.png` | Le parc machines — le résumé compté SUR LES LIGNES RENDUES, jamais par une seconde requête. — thème clair, téléphone. |
| `clients--clair--1280.png` | Le référentiel client — UN SEUL compteur, celui qui nomme un geste (RG-IMP-05, D29). — thème clair, poste de travail. |
| `clients--clair--1024.png` | Le référentiel client — UN SEUL compteur, celui qui nomme un geste (RG-IMP-05, D29). — thème clair, poste de travail. |
| `clients--clair--375.png` | Le référentiel client — UN SEUL compteur, celui qui nomme un geste (RG-IMP-05, D29). — thème clair, téléphone. |
| `client-creation--clair--1280.png` | La création d'une fiche — la société vient de la session, jamais d'une saisie. — thème clair, poste de travail. |
| `client-creation--clair--1024.png` | La création d'une fiche — la société vient de la session, jamais d'une saisie. — thème clair, poste de travail. |
| `client-creation--clair--375.png` | La création d'une fiche — la société vient de la session, jamais d'une saisie. — thème clair, téléphone. |
| `absences--clair--1280.png` | Les blocages d'agenda — une personne, une période, et RIEN d'autre (R3-14). Aucun créneau n'est proposé (D106). — thème clair, poste de travail. |
| `absences--clair--1024.png` | Les blocages d'agenda — une personne, une période, et RIEN d'autre (R3-14). Aucun créneau n'est proposé (D106). — thème clair, poste de travail. |
| `absences--clair--375.png` | Les blocages d'agenda — une personne, une période, et RIEN d'autre (R3-14). Aucun créneau n'est proposé (D106). — thème clair, téléphone. |
| `sites--clair--1280.png` | Les lieux d'intervention, avec leur RATTACHEMENT à côté du temps de trajet (D56). — thème clair, poste de travail. |
| `sites--clair--1024.png` | Les lieux d'intervention, avec leur RATTACHEMENT à côté du temps de trajet (D56). — thème clair, poste de travail. |
| `sites--clair--375.png` | Les lieux d'intervention, avec leur RATTACHEMENT à côté du temps de trajet (D56). — thème clair, téléphone. |
| `parametres-trajets--clair--1280.png` | Les temps de trajet par zone — des DÉFAUTS qui se règlent, et la cascade rend son ORIGINE (D107). — thème clair, poste de travail. |
| `parametres-trajets--clair--1024.png` | Les temps de trajet par zone — des DÉFAUTS qui se règlent, et la cascade rend son ORIGINE (D107). — thème clair, poste de travail. |
| `parametres-trajets--clair--375.png` | Les temps de trajet par zone — des DÉFAUTS qui se règlent, et la cascade rend son ORIGINE (D107). — thème clair, téléphone. |
| `parametres--clair--1280.png` | La porte des écrans de paramétrage (R3-08) — elle ne lit aucune base et ne compte rien. — thème clair, poste de travail. |
| `parametres--clair--1024.png` | La porte des écrans de paramétrage (R3-08) — elle ne lit aucune base et ne compte rien. — thème clair, poste de travail. |
| `parametres--clair--375.png` | La porte des écrans de paramétrage (R3-08) — elle ne lit aucune base et ne compte rien. — thème clair, téléphone. |
| `vgp--clair--1280.png` | Le registre des vérifications périodiques. CODIPLAN n'affirme JAMAIS la conformité : il dit ce qu'on lui a dit (D88). — thème clair, poste de travail. |
| `vgp--clair--1024.png` | Le registre des vérifications périodiques. CODIPLAN n'affirme JAMAIS la conformité : il dit ce qu'on lui a dit (D88). — thème clair, poste de travail. |
| `vgp--clair--375.png` | Le registre des vérifications périodiques. CODIPLAN n'affirme JAMAIS la conformité : il dit ce qu'on lui a dit (D88). — thème clair, téléphone. |
| `vgp-a-determiner--clair--1280.png` | Les familles dont l'assujettissement n'a pas été tranché — une case décochée serait indiscernable d'une famille jamais examinée. — thème clair, poste de travail. |
| `vgp-a-determiner--clair--1024.png` | Les familles dont l'assujettissement n'a pas été tranché — une case décochée serait indiscernable d'une famille jamais examinée. — thème clair, poste de travail. |
| `vgp-a-determiner--clair--375.png` | Les familles dont l'assujettissement n'a pas été tranché — une case décochée serait indiscernable d'une famille jamais examinée. — thème clair, téléphone. |
| `parametres-agences--clair--1280.png` | Les horaires d'ouverture, réglés **par agence** — I7, jamais un calendrier global. — thème clair, poste de travail. |
| `parametres-agences--clair--1024.png` | Les horaires d'ouverture, réglés **par agence** — I7, jamais un calendrier global. — thème clair, poste de travail. |
| `parametres-agences--clair--375.png` | Les horaires d'ouverture, réglés **par agence** — I7, jamais un calendrier global. — thème clair, téléphone. |
| `parametres-forfaits--clair--1280.png` | Le catalogue des forfaits et leur RANG (D86). Il naît vide : les valeurs sont à l'exploitation. — thème clair, poste de travail. |
| `parametres-forfaits--clair--1024.png` | Le catalogue des forfaits et leur RANG (D86). Il naît vide : les valeurs sont à l'exploitation. — thème clair, poste de travail. |
| `parametres-forfaits--clair--375.png` | Le catalogue des forfaits et leur RANG (D86). Il naît vide : les valeurs sont à l'exploitation. — thème clair, téléphone. |
| `parametres-prestations--clair--1280.png` | Le catalogue des prestations (R3-15) — une durée, jamais un taux (D109, D113). Il naît vide : les valeurs sont à l'exploitation. — thème clair, poste de travail. |
| `parametres-prestations--clair--1024.png` | Le catalogue des prestations (R3-15) — une durée, jamais un taux (D109, D113). Il naît vide : les valeurs sont à l'exploitation. — thème clair, poste de travail. |
| `parametres-prestations--clair--375.png` | Le catalogue des prestations (R3-15) — une durée, jamais un taux (D109, D113). Il naît vide : les valeurs sont à l'exploitation. — thème clair, téléphone. |

## Mesure

**Une observation, pas une porte** : la mesure ne fait pas échouer le script, comme un refus de capture (voir plus haut). Seuils lus, jamais inventés : texte < 12 px (D138) ; cible < 32×32 px au bureau hors lien dans le texte (spec ergonomie-graphisme-usage-2026-09-28.md §10 :963) ; cible < 44×44 px au terrain (spec §10 :964, CDC §13.4) ; défilement horizontal de la page (spec §10 :965, PR-10) ; erreur de console (spec §10 :966).

| Écran | Largeur | Textes < 12 px | Cibles sous le seuil | Débordement | Erreurs |
|---|---|---|---|---|---|
| `enrolement` | 1280 | 1 | 0 | 0 | 0 |
| `enrolement` | 1024 | 1 | 0 | 0 | 0 |
| `enrolement` | 375 | 1 | 0 | 0 | 0 |
| `terrain` | 1280 | 5 | 0 | 0 | 0 |
| `terrain` | 1024 | 5 | 0 | 0 | 0 |
| `terrain` | 375 | 5 | 2 | 26px | 0 |
| `terrain-intervention` | 1280 | 2 | 0 | 0 | 0 |
| `terrain-intervention` | 1024 | 2 | 0 | 0 | 0 |
| `terrain-intervention` | 375 | 2 | 12 | 26px | 0 |
| `connexion-code` | 1280 | 1 | 0 | 0 | 0 |
| `connexion-code` | 1024 | 1 | 0 | 0 | 0 |
| `connexion-code` | 375 | 1 | 0 | 0 | 0 |
| `accueil` | 1280 | 1 | 0 | 0 | 0 |
| `accueil` | 1024 | 1 | 0 | 0 | 0 |
| `accueil` | 375 | 1 | 0 | 0 | 0 |
| `connexion` | 1280 | 1 | 0 | 0 | 0 |
| `connexion` | 1024 | 1 | 0 | 0 | 0 |
| `connexion` | 375 | 1 | 0 | 0 | 0 |
| `premier-acces` | 1280 | 1 | 0 | 0 | 0 |
| `premier-acces` | 1024 | 1 | 0 | 0 | 0 |
| `premier-acces` | 375 | 1 | 0 | 0 | 0 |
| `sante` | 1280 | 0 | 0 | 0 | 0 |
| `sante` | 1024 | 0 | 0 | 0 | 0 |
| `sante` | 375 | 0 | 0 | 0 | 0 |
| `arrivee` | 1280 | 7 | 0 | 0 | 0 |
| `arrivee` | 1024 | 7 | 0 | 0 | 0 |
| `arrivee` | 375 | 3 | 1 | 0 | 0 |
| `planning` | 1280 | 106 | 0 | 0 | 0 |
| `planning` | 1024 | 106 | 0 | 0 | 0 |
| `planning` | 375 | 110 | 10 | 0 | 0 |
| `planning-jour` | 1280 | 58 | 0 | 0 | 0 |
| `planning-jour` | 1024 | 58 | 0 | 0 | 0 |
| `planning-jour` | 375 | 53 | 13 | 0 | 0 |
| `tableau-de-bord` | 1280 | 16 | 0 | 0 | 0 |
| `tableau-de-bord` | 1024 | 16 | 0 | 0 | 0 |
| `tableau-de-bord` | 375 | 12 | 3 | 0 | 0 |
| `interventions` | 1280 | 66 | 0 | 0 | 0 |
| `interventions` | 1024 | 66 | 0 | 0 | 0 |
| `interventions` | 375 | 62 | 2 | 0 | 0 |
| `imports-rapport` | 1280 | 13 | 0 | 0 | 0 |
| `imports-rapport` | 1024 | 13 | 0 | 0 | 0 |
| `imports-rapport` | 375 | 9 | 2 | 0 | 0 |
| `imports` | 1280 | 40 | 0 | 0 | 0 |
| `imports` | 1024 | 40 | 0 | 0 | 0 |
| `imports` | 375 | 36 | 1 | 0 | 0 |
| `intervention-creation` | 1280 | 6 | 0 | 0 | 0 |
| `intervention-creation` | 1024 | 6 | 0 | 0 | 0 |
| `intervention-creation` | 375 | 2 | 2 | 0 | 0 |
| `parc` | 1280 | 32 | 0 | 0 | 0 |
| `parc` | 1024 | 32 | 0 | 74px | 0 |
| `parc` | 375 | 28 | 1 | 0 | 0 |
| `clients` | 1280 | 8 | 0 | 0 | 0 |
| `clients` | 1024 | 8 | 0 | 0 | 0 |
| `clients` | 375 | 4 | 2 | 0 | 0 |
| `client-creation` | 1280 | 5 | 0 | 0 | 0 |
| `client-creation` | 1024 | 5 | 0 | 0 | 0 |
| `client-creation` | 375 | 1 | 2 | 0 | 0 |
| `absences` | 1280 | 25 | 0 | 0 | 0 |
| `absences` | 1024 | 25 | 0 | 0 | 0 |
| `absences` | 375 | 21 | 6 | 0 | 0 |
| `sites` | 1280 | 5 | 0 | 0 | 0 |
| `sites` | 1024 | 5 | 0 | 0 | 0 |
| `sites` | 375 | 1 | 3 | 0 | 0 |
| `parametres-trajets` | 1280 | 12 | 0 | 0 | 0 |
| `parametres-trajets` | 1024 | 12 | 0 | 0 | 0 |
| `parametres-trajets` | 375 | 8 | 7 | 0 | 0 |
| `parametres` | 1280 | 4 | 0 | 0 | 0 |
| `parametres` | 1024 | 4 | 0 | 0 | 0 |
| `parametres` | 375 | 0 | 1 | 0 | 0 |
| `vgp` | 1280 | 68 | 0 | 0 | 0 |
| `vgp` | 1024 | 68 | 0 | 0 | 0 |
| `vgp` | 375 | 64 | 10 | 0 | 0 |
| `vgp-a-determiner` | 1280 | 6 | 0 | 0 | 0 |
| `vgp-a-determiner` | 1024 | 6 | 0 | 0 | 0 |
| `vgp-a-determiner` | 375 | 2 | 2 | 0 | 0 |
| `parametres-agences` | 1280 | 16 | 0 | 0 | 0 |
| `parametres-agences` | 1024 | 16 | 0 | 0 | 0 |
| `parametres-agences` | 375 | 12 | 5 | 0 | 0 |
| `parametres-forfaits` | 1280 | 14 | 0 | 0 | 0 |
| `parametres-forfaits` | 1024 | 14 | 0 | 0 | 0 |
| `parametres-forfaits` | 375 | 10 | 8 | 0 | 0 |
| `parametres-prestations` | 1280 | 15 | 0 | 0 | 0 |
| `parametres-prestations` | 1024 | 15 | 0 | 0 | 0 |
| `parametres-prestations` | 375 | 11 | 7 | 0 | 0 |

**`enrolement` à 1280 px — textes < 12 px (5 premiers) :**

  - span.text-app-encre-faible.block — 9px — « SAV »

**`enrolement` à 1024 px — textes < 12 px (5 premiers) :**

  - span.text-app-encre-faible.block — 9px — « SAV »

**`enrolement` à 375 px — textes < 12 px (5 premiers) :**

  - span.text-app-encre-faible.block — 9px — « SAV »

**`terrain` à 1280 px — textes < 12 px (5 premiers) :**

  - span.text-app-encre-faible.block — 9px — « SAV »
  - span.border-app-orange-bord.bg-app-orange-fond — 11px — « Nouveau »
  - span.bg-app-orange-fond.text-app-orange-encre — 11px — « Suspendue »
  - span.border-app-orange-bord.bg-app-orange-fond — 11px — « Nouveau »
  - span.bg-app-gris-fond.text-app-gris-encre — 11px — « À planifier »

**`terrain` à 1024 px — textes < 12 px (5 premiers) :**

  - span.text-app-encre-faible.block — 9px — « SAV »
  - span.border-app-orange-bord.bg-app-orange-fond — 11px — « Nouveau »
  - span.bg-app-orange-fond.text-app-orange-encre — 11px — « Suspendue »
  - span.border-app-orange-bord.bg-app-orange-fond — 11px — « Nouveau »
  - span.bg-app-gris-fond.text-app-gris-encre — 11px — « À planifier »

**`terrain` à 375 px — textes < 12 px (5 premiers) :**

  - span.text-app-encre-faible.block — 9px — « SAV »
  - span.border-app-orange-bord.bg-app-orange-fond — 11px — « Nouveau »
  - span.bg-app-orange-fond.text-app-orange-encre — 11px — « Suspendue »
  - span.border-app-orange-bord.bg-app-orange-fond — 11px — « Nouveau »
  - span.bg-app-gris-fond.text-app-gris-encre — 11px — « À planifier »

**`terrain` à 375 px — cibles sous le seuil (5 premières) :**

  - a.flex.flex-shrink-0 — 123×34px — « CODIPLAN SAV »
  - button.text-app-encre-faible.hover:bg-app-fond — 121×30px — « Se déconnecter »

**`terrain-intervention` à 1280 px — textes < 12 px (5 premiers) :**

  - span.text-app-encre-faible.block — 9px — « SAV »
  - span.rounded-full.px-2 — 11px — « Suspendue »

**`terrain-intervention` à 1024 px — textes < 12 px (5 premiers) :**

  - span.text-app-encre-faible.block — 9px — « SAV »
  - span.rounded-full.px-2 — 11px — « Suspendue »

**`terrain-intervention` à 375 px — textes < 12 px (5 premiers) :**

  - span.text-app-encre-faible.block — 9px — « SAV »
  - span.rounded-full.px-2 — 11px — « Suspendue »

**`terrain-intervention` à 375 px — cibles sous le seuil (5 premières) :**

  - a.flex.flex-shrink-0 — 123×34px — « CODIPLAN SAV »
  - button.text-app-encre-faible.hover:bg-app-fond — 121×30px — « Se déconnecter »
  - a.text-[12.5px].text-app-marque — 343×18px — « ← Retour à ma journée »
  - button.inline-flex.items-center — 309×36px — « Démarrer l'intervention »
  - button.inline-flex.items-center — 172×32px — « Enregistrer le rapport »

**`connexion-code` à 1280 px — textes < 12 px (5 premiers) :**

  - span.text-app-encre-faible.block — 9px — « SAV »

**`connexion-code` à 1024 px — textes < 12 px (5 premiers) :**

  - span.text-app-encre-faible.block — 9px — « SAV »

**`connexion-code` à 375 px — textes < 12 px (5 premiers) :**

  - span.text-app-encre-faible.block — 9px — « SAV »

**`accueil` à 1280 px — textes < 12 px (5 premiers) :**

  - span.text-app-encre-faible.block — 9px — « SAV »

**`accueil` à 1024 px — textes < 12 px (5 premiers) :**

  - span.text-app-encre-faible.block — 9px — « SAV »

**`accueil` à 375 px — textes < 12 px (5 premiers) :**

  - span.text-app-encre-faible.block — 9px — « SAV »

**`connexion` à 1280 px — textes < 12 px (5 premiers) :**

  - span.text-app-encre-faible.block — 9px — « SAV »

**`connexion` à 1024 px — textes < 12 px (5 premiers) :**

  - span.text-app-encre-faible.block — 9px — « SAV »

**`connexion` à 375 px — textes < 12 px (5 premiers) :**

  - span.text-app-encre-faible.block — 9px — « SAV »

**`premier-acces` à 1280 px — textes < 12 px (5 premiers) :**

  - span.text-app-encre-faible.block — 9px — « SAV »

**`premier-acces` à 1024 px — textes < 12 px (5 premiers) :**

  - span.text-app-encre-faible.block — 9px — « SAV »

**`premier-acces` à 375 px — textes < 12 px (5 premiers) :**

  - span.text-app-encre-faible.block — 9px — « SAV »

**`arrivee` à 1280 px — textes < 12 px (5 premiers) :**

  - span.text-app-chrome-encre-faible.block — 9px — « SAV »
  - div.text-app-chrome-encre-faible.mb-1 — 11px — « EXPLOITATION »
  - div.text-app-chrome-encre-faible.mb-1 — 11px — « CLIENTS & PARC »
  - div.text-app-chrome-encre-faible.mb-1 — 11px — « PARAMÈTRES »
  - span.text-app-encre-faible.text-[11.5px] — 11.5px — « Direction »

**`arrivee` à 1024 px — textes < 12 px (5 premiers) :**

  - span.text-app-chrome-encre-faible.block — 9px — « SAV »
  - div.text-app-chrome-encre-faible.mb-1 — 11px — « EXPLOITATION »
  - div.text-app-chrome-encre-faible.mb-1 — 11px — « CLIENTS & PARC »
  - div.text-app-chrome-encre-faible.mb-1 — 11px — « PARAMÈTRES »
  - span.text-app-encre-faible.text-[11.5px] — 11.5px — « Direction »

**`arrivee` à 375 px — textes < 12 px (5 premiers) :**

  - span.text-app-encre-faible.text-[11.5px] — 11.5px — « Direction »
  - span.text-app-encre-faible.ml-auto — 11.5px — « Société active »
  - span.text-app-encre-faible.text-[11.5px] — 11.5px — « Direction »

**`arrivee` à 375 px — cibles sous le seuil (5 premières) :**

  - a.focus:bg-app-surface.focus:text-app-marque — 1×1px — « Aller au contenu »

**`planning` à 1280 px — textes < 12 px (5 premiers) :**

  - span.text-app-chrome-encre-faible.block — 9px — « SAV »
  - div.text-app-chrome-encre-faible.mb-1 — 11px — « EXPLOITATION »
  - div.text-app-chrome-encre-faible.mb-1 — 11px — « CLIENTS & PARC »
  - div.text-app-chrome-encre-faible.mb-1 — 11px — « PARAMÈTRES »
  - label.flex.flex-col — 11px — « Agence Tous Dolbeau Ducos Koné »

**`planning` à 1024 px — textes < 12 px (5 premiers) :**

  - span.text-app-chrome-encre-faible.block — 9px — « SAV »
  - div.text-app-chrome-encre-faible.mb-1 — 11px — « EXPLOITATION »
  - div.text-app-chrome-encre-faible.mb-1 — 11px — « CLIENTS & PARC »
  - div.text-app-chrome-encre-faible.mb-1 — 11px — « PARAMÈTRES »
  - label.flex.flex-col — 11px — « Agence Tous Dolbeau Ducos Koné »

**`planning` à 375 px — textes < 12 px (5 premiers) :**

  - label.flex.flex-col — 11px — « Agence Tous Dolbeau Ducos Koné »
  - label.flex.flex-col — 11px — « Technicien Tous Non affectées D. Garnier »
  - label.flex.flex-col — 11px — « Nature Tous Préventif sous contrat Préve »
  - label.flex.flex-col — 11px — « Priorité Tous P1 — critique P2 — haute P »
  - label.flex.flex-col — 11px — « Client Tous Atelier Ducos Garage du Nord »

**`planning` à 375 px — cibles sous le seuil (5 premières) :**

  - a.focus:bg-app-surface.focus:text-app-marque — 1×1px — « Aller au contenu »
  - select.border-app-bord.rounded-md — 88×27px — « Tous Dolbeau Ducos Koné »
  - select.border-app-bord.rounded-md — 124×27px — « Tous Non affectées D. Garnier J. Lemaîtr »
  - select.border-app-bord.rounded-md — 175×27px — « Tous Préventif sous contrat Préventif ho »
  - select.border-app-bord.rounded-md — 120×27px — « Tous P1 — critique P2 — haute P3 — norma »

**`planning-jour` à 1280 px — textes < 12 px (5 premiers) :**

  - span.text-app-chrome-encre-faible.block — 9px — « SAV »
  - div.text-app-chrome-encre-faible.mb-1 — 11px — « EXPLOITATION »
  - div.text-app-chrome-encre-faible.mb-1 — 11px — « CLIENTS & PARC »
  - div.text-app-chrome-encre-faible.mb-1 — 11px — « PARAMÈTRES »
  - label.flex.flex-col — 11px — « Agence Tous Dolbeau Ducos Koné »

**`planning-jour` à 1024 px — textes < 12 px (5 premiers) :**

  - span.text-app-chrome-encre-faible.block — 9px — « SAV »
  - div.text-app-chrome-encre-faible.mb-1 — 11px — « EXPLOITATION »
  - div.text-app-chrome-encre-faible.mb-1 — 11px — « CLIENTS & PARC »
  - div.text-app-chrome-encre-faible.mb-1 — 11px — « PARAMÈTRES »
  - label.flex.flex-col — 11px — « Agence Tous Dolbeau Ducos Koné »

**`planning-jour` à 375 px — textes < 12 px (5 premiers) :**

  - label.flex.flex-col — 11px — « Agence Tous Dolbeau Ducos Koné »
  - label.flex.flex-col — 11px — « Technicien Tous Non affectées D. Garnier »
  - label.flex.flex-col — 11px — « Nature Tous Préventif sous contrat Préve »
  - label.flex.flex-col — 11px — « Priorité Tous P1 — critique P2 — haute P »
  - label.flex.flex-col — 11px — « Client Tous Atelier Ducos Garage du Nord »

**`planning-jour` à 375 px — cibles sous le seuil (5 premières) :**

  - a.focus:bg-app-surface.focus:text-app-marque — 1×1px — « Aller au contenu »
  - select.border-app-bord.rounded-md — 88×27px — « Tous Dolbeau Ducos Koné »
  - select.border-app-bord.rounded-md — 124×27px — « Tous Non affectées D. Garnier J. Lemaîtr »
  - select.border-app-bord.rounded-md — 175×27px — « Tous Préventif sous contrat Préventif ho »
  - select.border-app-bord.rounded-md — 120×27px — « Tous P1 — critique P2 — haute P3 — norma »

**`tableau-de-bord` à 1280 px — textes < 12 px (5 premiers) :**

  - span.text-app-chrome-encre-faible.block — 9px — « SAV »
  - div.text-app-chrome-encre-faible.mb-1 — 11px — « EXPLOITATION »
  - div.text-app-chrome-encre-faible.mb-1 — 11px — « CLIENTS & PARC »
  - div.text-app-chrome-encre-faible.mb-1 — 11px — « PARAMÈTRES »
  - div.text-app-encre-faible.text-[11px] — 11px — « INTERVENTIONS AUJOURD'HUI »

**`tableau-de-bord` à 1024 px — textes < 12 px (5 premiers) :**

  - span.text-app-chrome-encre-faible.block — 9px — « SAV »
  - div.text-app-chrome-encre-faible.mb-1 — 11px — « EXPLOITATION »
  - div.text-app-chrome-encre-faible.mb-1 — 11px — « CLIENTS & PARC »
  - div.text-app-chrome-encre-faible.mb-1 — 11px — « PARAMÈTRES »
  - div.text-app-encre-faible.text-[11px] — 11px — « INTERVENTIONS AUJOURD'HUI »

**`tableau-de-bord` à 375 px — textes < 12 px (5 premiers) :**

  - div.text-app-encre-faible.text-[11px] — 11px — « INTERVENTIONS AUJOURD'HUI »
  - div.text-app-encre-faible.text-[11px] — 11px — « TAUX D'OCCUPATION »
  - span.text-app-encre-faible.text-[11px] — 11px — « Non calculé »
  - div.text-app-encre-faible.text-[11px] — 11px — « DOSSIERS BLOQUÉS »
  - div.text-app-encre-faible.text-[11px] — 11px — « dont 1 en attente de pièce »

**`tableau-de-bord` à 375 px — cibles sous le seuil (5 premières) :**

  - a.focus:bg-app-surface.focus:text-app-marque — 1×1px — « Aller au contenu »
  - a.border-app-bord.rounded-md — 63×31px — « Ouvrir »
  - a.border-app-bord.rounded-md — 63×31px — « Ouvrir »

**`interventions` à 1280 px — textes < 12 px (5 premiers) :**

  - span.text-app-chrome-encre-faible.block — 9px — « SAV »
  - div.text-app-chrome-encre-faible.mb-1 — 11px — « EXPLOITATION »
  - div.text-app-chrome-encre-faible.mb-1 — 11px — « CLIENTS & PARC »
  - div.text-app-chrome-encre-faible.mb-1 — 11px — « PARAMÈTRES »
  - div.text-app-encre-faible.text-[11px] — 11px — « PLANIFIÉES CETTE SEMAINE »

**`interventions` à 1024 px — textes < 12 px (5 premiers) :**

  - span.text-app-chrome-encre-faible.block — 9px — « SAV »
  - div.text-app-chrome-encre-faible.mb-1 — 11px — « EXPLOITATION »
  - div.text-app-chrome-encre-faible.mb-1 — 11px — « CLIENTS & PARC »
  - div.text-app-chrome-encre-faible.mb-1 — 11px — « PARAMÈTRES »
  - div.text-app-encre-faible.text-[11px] — 11px — « PLANIFIÉES CETTE SEMAINE »

**`interventions` à 375 px — textes < 12 px (5 premiers) :**

  - div.text-app-encre-faible.text-[11px] — 11px — « PLANIFIÉES CETTE SEMAINE »
  - div.text-app-encre-faible.text-[11px] — 11px — « EN COURS »
  - div.text-app-encre-faible.text-[11px] — 11px — « EN ATTENTE »
  - th.bg-app-surface-creuse.border-app-bord — 10.5px — « RÉFÉRENCE »
  - th.bg-app-surface-creuse.border-app-bord — 10.5px — « CLIENT »

**`interventions` à 375 px — cibles sous le seuil (5 premières) :**

  - a.focus:bg-app-surface.focus:text-app-marque — 1×1px — « Aller au contenu »
  - input — 13×13px — «  »

**`imports-rapport` à 1280 px — textes < 12 px (5 premiers) :**

  - span.text-app-chrome-encre-faible.block — 9px — « SAV »
  - div.text-app-chrome-encre-faible.mb-1 — 11px — « EXPLOITATION »
  - div.text-app-chrome-encre-faible.mb-1 — 11px — « CLIENTS & PARC »
  - div.text-app-chrome-encre-faible.mb-1 — 11px — « PARAMÈTRES »
  - p.text-app-encre-faible.text-[11.5px] — 11.5px — « 30/09/2026 08:26 — Administration de dém »

**`imports-rapport` à 1024 px — textes < 12 px (5 premiers) :**

  - span.text-app-chrome-encre-faible.block — 9px — « SAV »
  - div.text-app-chrome-encre-faible.mb-1 — 11px — « EXPLOITATION »
  - div.text-app-chrome-encre-faible.mb-1 — 11px — « CLIENTS & PARC »
  - div.text-app-chrome-encre-faible.mb-1 — 11px — « PARAMÈTRES »
  - p.text-app-encre-faible.text-[11.5px] — 11.5px — « 30/09/2026 08:26 — Administration de dém »

**`imports-rapport` à 375 px — textes < 12 px (5 premiers) :**

  - p.text-app-encre-faible.text-[11.5px] — 11.5px — « 30/09/2026 08:26 — Administration de dém »
  - p.text-app-encre-faible.text-[11.5px] — 11.5px — « Durée de l'application — non mesurée — c »
  - span.text-app-encre-faible.text-[11.5px] — 11.5px — « seront créés »
  - span.text-app-encre-faible.text-[11.5px] — 11.5px — « seront mis à jour »
  - span.text-app-encre-faible.text-[11.5px] — 11.5px — « portent déjà ces valeurs : rien n'a été  »

**`imports-rapport` à 375 px — cibles sous le seuil (5 premières) :**

  - a.focus:bg-app-surface.focus:text-app-marque — 1×1px — « Aller au contenu »
  - a.text-app-marque.underline — 140×20px — « ← Retour aux imports »

**`imports` à 1280 px — textes < 12 px (5 premiers) :**

  - span.text-app-chrome-encre-faible.block — 9px — « SAV »
  - div.text-app-chrome-encre-faible.mb-1 — 11px — « EXPLOITATION »
  - div.text-app-chrome-encre-faible.mb-1 — 11px — « CLIENTS & PARC »
  - div.text-app-chrome-encre-faible.mb-1 — 11px — « PARAMÈTRES »
  - p.text-app-encre-faible.text-[11.5px] — 11.5px — « Un fichier .xlsx bâti sur le modèle CODI »

**`imports` à 1024 px — textes < 12 px (5 premiers) :**

  - span.text-app-chrome-encre-faible.block — 9px — « SAV »
  - div.text-app-chrome-encre-faible.mb-1 — 11px — « EXPLOITATION »
  - div.text-app-chrome-encre-faible.mb-1 — 11px — « CLIENTS & PARC »
  - div.text-app-chrome-encre-faible.mb-1 — 11px — « PARAMÈTRES »
  - p.text-app-encre-faible.text-[11.5px] — 11.5px — « Un fichier .xlsx bâti sur le modèle CODI »

**`imports` à 375 px — textes < 12 px (5 premiers) :**

  - p.text-app-encre-faible.text-[11.5px] — 11.5px — « Un fichier .xlsx bâti sur le modèle CODI »
  - p.text-app-encre-faible.mt-1 — 11.5px — « Chaque type listé sait contrôler un fich »
  - span.text-app-encre-faible.text-[11.5px] — 11.5px — « Clé de rapprochement : le code externe,  »
  - span.text-[11.5px].font-semibold — 11.5px — « Contrôle et application »
  - span.text-app-encre-faible.text-[11.5px] — 11.5px — « Lieux d'intervention, rattachés à un cli »

**`imports` à 375 px — cibles sous le seuil (5 premières) :**

  - a.focus:bg-app-surface.focus:text-app-marque — 1×1px — « Aller au contenu »

**`intervention-creation` à 1280 px — textes < 12 px (5 premiers) :**

  - span.text-app-chrome-encre-faible.block — 9px — « SAV »
  - div.text-app-chrome-encre-faible.mb-1 — 11px — « EXPLOITATION »
  - div.text-app-chrome-encre-faible.mb-1 — 11px — « CLIENTS & PARC »
  - div.text-app-chrome-encre-faible.mb-1 — 11px — « PARAMÈTRES »
  - span.text-app-encre-faible.text-[11px] — 11px — « Tapez un client, un site ou une commune »

**`intervention-creation` à 1024 px — textes < 12 px (5 premiers) :**

  - span.text-app-chrome-encre-faible.block — 9px — « SAV »
  - div.text-app-chrome-encre-faible.mb-1 — 11px — « EXPLOITATION »
  - div.text-app-chrome-encre-faible.mb-1 — 11px — « CLIENTS & PARC »
  - div.text-app-chrome-encre-faible.mb-1 — 11px — « PARAMÈTRES »
  - span.text-app-encre-faible.text-[11px] — 11px — « Tapez un client, un site ou une commune »

**`intervention-creation` à 375 px — textes < 12 px (5 premiers) :**

  - span.text-app-encre-faible.text-[11px] — 11px — « Tapez un client, un site ou une commune »
  - p.text-app-encre-faible.-mt-2 — 11.5px — « Le site choisi détermine l'agence — cela »

**`intervention-creation` à 375 px — cibles sous le seuil (5 premières) :**

  - a.focus:bg-app-surface.focus:text-app-marque — 1×1px — « Aller au contenu »
  - a.text-app-encre-faible.text-[12.5px] — 126×18px — « ← Retour au planning »

**`parc` à 1280 px — textes < 12 px (5 premiers) :**

  - span.text-app-chrome-encre-faible.block — 9px — « SAV »
  - div.text-app-chrome-encre-faible.mb-1 — 11px — « EXPLOITATION »
  - div.text-app-chrome-encre-faible.mb-1 — 11px — « CLIENTS & PARC »
  - div.text-app-chrome-encre-faible.mb-1 — 11px — « PARAMÈTRES »
  - label.text-app-encre-faible.text-[9px] — 9px — « FILTRER PAR STATUT »

**`parc` à 1024 px — textes < 12 px (5 premiers) :**

  - span.text-app-chrome-encre-faible.block — 9px — « SAV »
  - div.text-app-chrome-encre-faible.mb-1 — 11px — « EXPLOITATION »
  - div.text-app-chrome-encre-faible.mb-1 — 11px — « CLIENTS & PARC »
  - div.text-app-chrome-encre-faible.mb-1 — 11px — « PARAMÈTRES »
  - label.text-app-encre-faible.text-[9px] — 9px — « FILTRER PAR STATUT »

**`parc` à 375 px — textes < 12 px (5 premiers) :**

  - label.text-app-encre-faible.text-[9px] — 9px — « FILTRER PAR STATUT »
  - label.text-app-encre-faible.text-[9px] — 9px — « FILTRER PAR CLIENT »
  - label.text-app-encre-faible.text-[9px] — 9px — « SITE »
  - label.text-app-encre-faible.text-[9px] — 9px — « FAMILLE »
  - div.text-app-encre-faible.text-[11px] — 11px — « MACHINES AFFICHÉES »

**`parc` à 375 px — cibles sous le seuil (5 premières) :**

  - a.focus:bg-app-surface.focus:text-app-marque — 1×1px — « Aller au contenu »

**`clients` à 1280 px — textes < 12 px (5 premiers) :**

  - span.text-app-chrome-encre-faible.block — 9px — « SAV »
  - div.text-app-chrome-encre-faible.mb-1 — 11px — « EXPLOITATION »
  - div.text-app-chrome-encre-faible.mb-1 — 11px — « CLIENTS & PARC »
  - div.text-app-chrome-encre-faible.mb-1 — 11px — « PARAMÈTRES »
  - p.text-app-encre-faible.mt-1 — 11.5px — « Ces fiches n'ont pas de code de rapproch »

**`clients` à 1024 px — textes < 12 px (5 premiers) :**

  - span.text-app-chrome-encre-faible.block — 9px — « SAV »
  - div.text-app-chrome-encre-faible.mb-1 — 11px — « EXPLOITATION »
  - div.text-app-chrome-encre-faible.mb-1 — 11px — « CLIENTS & PARC »
  - div.text-app-chrome-encre-faible.mb-1 — 11px — « PARAMÈTRES »
  - p.text-app-encre-faible.mt-1 — 11.5px — « Ces fiches n'ont pas de code de rapproch »

**`clients` à 375 px — textes < 12 px (5 premiers) :**

  - p.text-app-encre-faible.mt-1 — 11.5px — « Ces fiches n'ont pas de code de rapproch »
  - span.inline-block.rounded-[20px] — 11px — « Actif »
  - span.inline-block.rounded-[20px] — 11px — « Actif »
  - p.text-app-encre-faible — 11.5px — « 2 clients »

**`clients` à 375 px — cibles sous le seuil (5 premières) :**

  - a.focus:bg-app-surface.focus:text-app-marque — 1×1px — « Aller au contenu »
  - input — 13×13px — «  »

**`client-creation` à 1280 px — textes < 12 px (5 premiers) :**

  - span.text-app-chrome-encre-faible.block — 9px — « SAV »
  - div.text-app-chrome-encre-faible.mb-1 — 11px — « EXPLOITATION »
  - div.text-app-chrome-encre-faible.mb-1 — 11px — « CLIENTS & PARC »
  - div.text-app-chrome-encre-faible.mb-1 — 11px — « PARAMÈTRES »
  - span.text-app-encre-faible.text-[11px] — 11px — « La clé par laquelle un import reconnaît  »

**`client-creation` à 1024 px — textes < 12 px (5 premiers) :**

  - span.text-app-chrome-encre-faible.block — 9px — « SAV »
  - div.text-app-chrome-encre-faible.mb-1 — 11px — « EXPLOITATION »
  - div.text-app-chrome-encre-faible.mb-1 — 11px — « CLIENTS & PARC »
  - div.text-app-chrome-encre-faible.mb-1 — 11px — « PARAMÈTRES »
  - span.text-app-encre-faible.text-[11px] — 11px — « La clé par laquelle un import reconnaît  »

**`client-creation` à 375 px — textes < 12 px (5 premiers) :**

  - span.text-app-encre-faible.text-[11px] — 11px — « La clé par laquelle un import reconnaît  »

**`client-creation` à 375 px — cibles sous le seuil (5 premières) :**

  - a.focus:bg-app-surface.focus:text-app-marque — 1×1px — « Aller au contenu »
  - a.text-app-encre-faible.text-[12.5px] — 109×18px — « ← Tous les clients »

**`absences` à 1280 px — textes < 12 px (5 premiers) :**

  - span.text-app-chrome-encre-faible.block — 9px — « SAV »
  - div.text-app-chrome-encre-faible.mb-1 — 11px — « EXPLOITATION »
  - div.text-app-chrome-encre-faible.mb-1 — 11px — « CLIENTS & PARC »
  - div.text-app-chrome-encre-faible.mb-1 — 11px — « PARAMÈTRES »
  - div.text-app-encre-faible.text-[11px] — 11px — « ABSENCES CE MOIS »

**`absences` à 1024 px — textes < 12 px (5 premiers) :**

  - span.text-app-chrome-encre-faible.block — 9px — « SAV »
  - div.text-app-chrome-encre-faible.mb-1 — 11px — « EXPLOITATION »
  - div.text-app-chrome-encre-faible.mb-1 — 11px — « CLIENTS & PARC »
  - div.text-app-chrome-encre-faible.mb-1 — 11px — « PARAMÈTRES »
  - div.text-app-encre-faible.text-[11px] — 11px — « ABSENCES CE MOIS »

**`absences` à 375 px — textes < 12 px (5 premiers) :**

  - div.text-app-encre-faible.text-[11px] — 11px — « ABSENCES CE MOIS »
  - div.text-app-encre-faible.text-[11px] — 11px — « RUPTURE DE SERVICE »
  - div.text-app-encre-faible.text-[11px] — 11px — « Aucune agence sans technicien disponible »
  - div.text-app-encre-faible.text-[11px] — 11px — « DEMANDES À VALIDER »
  - div.text-app-encre-faible.text-[11px] — 11px — « Le blocage est immédiat : il n'existe au »

**`absences` à 375 px — cibles sous le seuil (5 premières) :**

  - a.focus:bg-app-surface.focus:text-app-marque — 1×1px — « Aller au contenu »
  - a.border-app-bord.rounded-md — 27×32px — « ‹ »
  - a.border-app-bord.rounded-md — 27×32px — « › »
  - select#absence-personne.border-app-bord.bg-app-surface — 208×27px — « Sélectionner une personne D. Garnier J.  »
  - input#absence-du.border-app-bord.bg-app-surface — 137×28px — «  »

**`sites` à 1280 px — textes < 12 px (5 premiers) :**

  - span.text-app-chrome-encre-faible.block — 9px — « SAV »
  - div.text-app-chrome-encre-faible.mb-1 — 11px — « EXPLOITATION »
  - div.text-app-chrome-encre-faible.mb-1 — 11px — « CLIENTS & PARC »
  - div.text-app-chrome-encre-faible.mb-1 — 11px — « PARAMÈTRES »
  - p.text-app-encre-faible — 11.5px — « 3 sites »

**`sites` à 1024 px — textes < 12 px (5 premiers) :**

  - span.text-app-chrome-encre-faible.block — 9px — « SAV »
  - div.text-app-chrome-encre-faible.mb-1 — 11px — « EXPLOITATION »
  - div.text-app-chrome-encre-faible.mb-1 — 11px — « CLIENTS & PARC »
  - div.text-app-chrome-encre-faible.mb-1 — 11px — « PARAMÈTRES »
  - p.text-app-encre-faible — 11.5px — « 3 sites »

**`sites` à 375 px — textes < 12 px (5 premiers) :**

  - p.text-app-encre-faible — 11.5px — « 3 sites »

**`sites` à 375 px — cibles sous le seuil (5 premières) :**

  - a.focus:bg-app-surface.focus:text-app-marque — 1×1px — « Aller au contenu »
  - input — 13×13px — «  »
  - input — 13×13px — «  »

**`parametres-trajets` à 1280 px — textes < 12 px (5 premiers) :**

  - span.text-app-chrome-encre-faible.block — 9px — « SAV »
  - div.text-app-chrome-encre-faible.mb-1 — 11px — « EXPLOITATION »
  - div.text-app-chrome-encre-faible.mb-1 — 11px — « CLIENTS & PARC »
  - div.text-app-chrome-encre-faible.mb-1 — 11px — « PARAMÈTRES »
  - th.bg-app-surface-creuse.border-app-bord — 10.5px — « ZONE »

**`parametres-trajets` à 1024 px — textes < 12 px (5 premiers) :**

  - span.text-app-chrome-encre-faible.block — 9px — « SAV »
  - div.text-app-chrome-encre-faible.mb-1 — 11px — « EXPLOITATION »
  - div.text-app-chrome-encre-faible.mb-1 — 11px — « CLIENTS & PARC »
  - div.text-app-chrome-encre-faible.mb-1 — 11px — « PARAMÈTRES »
  - th.bg-app-surface-creuse.border-app-bord — 10.5px — « ZONE »

**`parametres-trajets` à 375 px — textes < 12 px (5 premiers) :**

  - th.bg-app-surface-creuse.border-app-bord — 10.5px — « ZONE »
  - th.bg-app-surface-creuse.border-app-bord — 10.5px — « VALEUR DE RÉFÉRENCE »
  - th.bg-app-surface-creuse.border-app-bord — 10.5px — « RÉGLAGE DE LA SOCIÉTÉ »
  - th.bg-app-surface-creuse.border-app-bord — 10.5px — « CE QUI S'APPLIQUE »
  - th.bg-app-surface-creuse.border-app-bord — 10.5px — « RÉGLER »

**`parametres-trajets` à 375 px — cibles sous le seuil (5 premières) :**

  - a.focus:bg-app-surface.focus:text-app-marque — 1×1px — « Aller au contenu »
  - a.text-app-encre-faible.text-[12.5px] — 115×18px — « ← Sociétés & tarifs »
  - input#trajet-grand_noumea.border-app-bord.bg-app-surface — 80×28px — «  »
  - input#trajet-sud.border-app-bord.bg-app-surface — 80×28px — «  »
  - input#trajet-cote_est.border-app-bord.bg-app-surface — 80×28px — «  »

**`parametres` à 1280 px — textes < 12 px (5 premiers) :**

  - span.text-app-chrome-encre-faible.block — 9px — « SAV »
  - div.text-app-chrome-encre-faible.mb-1 — 11px — « EXPLOITATION »
  - div.text-app-chrome-encre-faible.mb-1 — 11px — « CLIENTS & PARC »
  - div.text-app-chrome-encre-faible.mb-1 — 11px — « PARAMÈTRES »

**`parametres` à 1024 px — textes < 12 px (5 premiers) :**

  - span.text-app-chrome-encre-faible.block — 9px — « SAV »
  - div.text-app-chrome-encre-faible.mb-1 — 11px — « EXPLOITATION »
  - div.text-app-chrome-encre-faible.mb-1 — 11px — « CLIENTS & PARC »
  - div.text-app-chrome-encre-faible.mb-1 — 11px — « PARAMÈTRES »

**`parametres` à 375 px — cibles sous le seuil (5 premières) :**

  - a.focus:bg-app-surface.focus:text-app-marque — 1×1px — « Aller au contenu »

**`vgp` à 1280 px — textes < 12 px (5 premiers) :**

  - span.text-app-chrome-encre-faible.block — 9px — « SAV »
  - div.text-app-chrome-encre-faible.mb-1 — 11px — « EXPLOITATION »
  - div.text-app-chrome-encre-faible.mb-1 — 11px — « CLIENTS & PARC »
  - div.text-app-chrome-encre-faible.mb-1 — 11px — « PARAMÈTRES »
  - div.text-app-encre-faible.text-[11px] — 11px — « ÉCHÉANCES À VENIR »

**`vgp` à 1024 px — textes < 12 px (5 premiers) :**

  - span.text-app-chrome-encre-faible.block — 9px — « SAV »
  - div.text-app-chrome-encre-faible.mb-1 — 11px — « EXPLOITATION »
  - div.text-app-chrome-encre-faible.mb-1 — 11px — « CLIENTS & PARC »
  - div.text-app-chrome-encre-faible.mb-1 — 11px — « PARAMÈTRES »
  - div.text-app-encre-faible.text-[11px] — 11px — « ÉCHÉANCES À VENIR »

**`vgp` à 375 px — textes < 12 px (5 premiers) :**

  - div.text-app-encre-faible.text-[11px] — 11px — « ÉCHÉANCES À VENIR »
  - div.text-app-encre-faible.text-[11px] — 11px — « Une échéance déclarée est connue et n'es »
  - a.text-[11.5px].text-app-marque — 11.5px — « Voir les échéances à venir → »
  - div.text-app-encre-faible.text-[11px] — 11px — « ÉCHÉANCES DÉPASSÉES »
  - div.text-app-encre-faible.text-[11px] — 11px — « Une date déclarée est dépassée — une dat »

**`vgp` à 375 px — cibles sous le seuil (5 premières) :**

  - a.focus:bg-app-surface.focus:text-app-marque — 1×1px — « Aller au contenu »
  - a.text-[11.5px].text-app-marque — 160×17px — « Voir les échéances à venir → »
  - summary.text-app-encre-faible.cursor-pointer — 180×17px — « Voir le motif »
  - summary.text-app-encre-faible.cursor-pointer — 180×17px — « Voir le motif »
  - summary.text-app-encre-faible.cursor-pointer — 180×17px — « Voir le motif »

**`vgp-a-determiner` à 1280 px — textes < 12 px (5 premiers) :**

  - span.text-app-chrome-encre-faible.block — 9px — « SAV »
  - div.text-app-chrome-encre-faible.mb-1 — 11px — « EXPLOITATION »
  - div.text-app-chrome-encre-faible.mb-1 — 11px — « CLIENTS & PARC »
  - div.text-app-chrome-encre-faible.mb-1 — 11px — « PARAMÈTRES »
  - th.bg-app-surface-creuse.border-app-bord — 10.5px — « FAMILLE »

**`vgp-a-determiner` à 1024 px — textes < 12 px (5 premiers) :**

  - span.text-app-chrome-encre-faible.block — 9px — « SAV »
  - div.text-app-chrome-encre-faible.mb-1 — 11px — « EXPLOITATION »
  - div.text-app-chrome-encre-faible.mb-1 — 11px — « CLIENTS & PARC »
  - div.text-app-chrome-encre-faible.mb-1 — 11px — « PARAMÈTRES »
  - th.bg-app-surface-creuse.border-app-bord — 10.5px — « FAMILLE »

**`vgp-a-determiner` à 375 px — textes < 12 px (5 premiers) :**

  - th.bg-app-surface-creuse.border-app-bord — 10.5px — « FAMILLE »
  - th.bg-app-surface-creuse.border-app-bord — 10.5px — « MACHINES EN ATTENTE DE LA DÉCISION »

**`vgp-a-determiner` à 375 px — cibles sous le seuil (5 premières) :**

  - a.focus:bg-app-surface.focus:text-app-marque — 1×1px — « Aller au contenu »
  - a.text-app-encre-faible.text-[12.5px] — 124×18px — « ← Retour au registre »

**`parametres-agences` à 1280 px — textes < 12 px (5 premiers) :**

  - span.text-app-chrome-encre-faible.block — 9px — « SAV »
  - div.text-app-chrome-encre-faible.mb-1 — 11px — « EXPLOITATION »
  - div.text-app-chrome-encre-faible.mb-1 — 11px — « CLIENTS & PARC »
  - div.text-app-chrome-encre-faible.mb-1 — 11px — « PARAMÈTRES »
  - th.bg-app-surface-creuse.border-app-bord — 10.5px — « AGENCE »

**`parametres-agences` à 1024 px — textes < 12 px (5 premiers) :**

  - span.text-app-chrome-encre-faible.block — 9px — « SAV »
  - div.text-app-chrome-encre-faible.mb-1 — 11px — « EXPLOITATION »
  - div.text-app-chrome-encre-faible.mb-1 — 11px — « CLIENTS & PARC »
  - div.text-app-chrome-encre-faible.mb-1 — 11px — « PARAMÈTRES »
  - th.bg-app-surface-creuse.border-app-bord — 10.5px — « AGENCE »

**`parametres-agences` à 375 px — textes < 12 px (5 premiers) :**

  - th.bg-app-surface-creuse.border-app-bord — 10.5px — « AGENCE »
  - th.bg-app-surface-creuse.border-app-bord — 10.5px — « CALENDRIER »
  - th.bg-app-surface-creuse.border-app-bord — 10.5px — « JOURS TRAVAILLÉS »
  - th.bg-app-surface-creuse.border-app-bord — 10.5px — « HORAIRES »
  - th.bg-app-surface-creuse.border-app-bord — 10.5px — « CRÉNEAUX »

**`parametres-agences` à 375 px — cibles sous le seuil (5 premières) :**

  - a.focus:bg-app-surface.focus:text-app-marque — 1×1px — « Aller au contenu »
  - a.text-app-encre-faible.text-[12.5px] — 115×18px — « ← Sociétés & tarifs »
  - input#pas-01a0ef0f-9b42-7b55-992f-6345fecf4d52.border-app-bord.bg-app-surface — 80×28px — «  »
  - input#pas-01a0ef0f-9b42-7b55-992f-6345fecf4d52.border-app-bord.bg-app-surface — 80×28px — «  »
  - input#pas-01a0ef0f-9b4b-74ae-b2f9-d82a92b5b307.border-app-bord.bg-app-surface — 80×28px — «  »

**`parametres-forfaits` à 1280 px — textes < 12 px (5 premiers) :**

  - span.text-app-chrome-encre-faible.block — 9px — « SAV »
  - div.text-app-chrome-encre-faible.mb-1 — 11px — « EXPLOITATION »
  - div.text-app-chrome-encre-faible.mb-1 — 11px — « CLIENTS & PARC »
  - div.text-app-chrome-encre-faible.mb-1 — 11px — « PARAMÈTRES »
  - th.bg-app-surface-creuse.border-app-bord — 10.5px — « RANG »

**`parametres-forfaits` à 1024 px — textes < 12 px (5 premiers) :**

  - span.text-app-chrome-encre-faible.block — 9px — « SAV »
  - div.text-app-chrome-encre-faible.mb-1 — 11px — « EXPLOITATION »
  - div.text-app-chrome-encre-faible.mb-1 — 11px — « CLIENTS & PARC »
  - div.text-app-chrome-encre-faible.mb-1 — 11px — « PARAMÈTRES »
  - th.bg-app-surface-creuse.border-app-bord — 10.5px — « RANG »

**`parametres-forfaits` à 375 px — textes < 12 px (5 premiers) :**

  - th.bg-app-surface-creuse.border-app-bord — 10.5px — « RANG »
  - th.bg-app-surface-creuse.border-app-bord — 10.5px — « CODE »
  - th.bg-app-surface-creuse.border-app-bord — 10.5px — « LIBELLÉ »
  - th.bg-app-surface-creuse.border-app-bord — 10.5px — « CATÉGORIE »
  - th.bg-app-surface-creuse.border-app-bord — 10.5px — « MONTANT »

**`parametres-forfaits` à 375 px — cibles sous le seuil (5 premières) :**

  - a.focus:bg-app-surface.focus:text-app-marque — 1×1px — « Aller au contenu »
  - a.text-app-encre-faible.text-[12.5px] — 115×18px — « ← Sociétés & tarifs »
  - select.border-app-bord.bg-app-surface — 133×31px — « Grand Nouméa Sud Côte Est Côte Ouest Nor »
  - a.border-app-bord.rounded-md — 72×27px — « Modifier »
  - button.border-app-bord.rounded-md — 87×27px — « Désactiver »

**`parametres-prestations` à 1280 px — textes < 12 px (5 premiers) :**

  - span.text-app-chrome-encre-faible.block — 9px — « SAV »
  - div.text-app-chrome-encre-faible.mb-1 — 11px — « EXPLOITATION »
  - div.text-app-chrome-encre-faible.mb-1 — 11px — « CLIENTS & PARC »
  - div.text-app-chrome-encre-faible.mb-1 — 11px — « PARAMÈTRES »
  - label.text-app-encre-faible.text-[11px] — 11px — « Code »

**`parametres-prestations` à 1024 px — textes < 12 px (5 premiers) :**

  - span.text-app-chrome-encre-faible.block — 9px — « SAV »
  - div.text-app-chrome-encre-faible.mb-1 — 11px — « EXPLOITATION »
  - div.text-app-chrome-encre-faible.mb-1 — 11px — « CLIENTS & PARC »
  - div.text-app-chrome-encre-faible.mb-1 — 11px — « PARAMÈTRES »
  - label.text-app-encre-faible.text-[11px] — 11px — « Code »

**`parametres-prestations` à 375 px — textes < 12 px (5 premiers) :**

  - label.text-app-encre-faible.text-[11px] — 11px — « Code »
  - label.text-app-encre-faible.text-[11px] — 11px — « Libellé »
  - label.text-app-encre-faible.text-[11px] — 11px — « Famille de matériel »
  - label.text-app-encre-faible.text-[11px] — 11px — « Durée (en minutes — ex. 90 = 1 h 30) »
  - p.text-app-encre-faible.text-[11.5px] — 11.5px — « Une prestation ne porte pas de tarif. Le »

**`parametres-prestations` à 375 px — cibles sous le seuil (5 premières) :**

  - a.focus:bg-app-surface.focus:text-app-marque — 1×1px — « Aller au contenu »
  - a.text-app-encre-faible.text-[12.5px] — 115×18px — « ← Sociétés & tarifs »
  - input#nouvelle-code.border-app-bord.bg-app-surface — 144×28px — «  »
  - input#nouvelle-libelle.border-app-bord.bg-app-surface — 256×28px — «  »
  - select#nouvelle-famille.border-app-bord.bg-app-surface — 179×27px — « Aucune famille Accessoires de levage Com »
