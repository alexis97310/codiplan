# Captures d'écran — ce que l'application affiche aujourd'hui

**Ces images montrent que les écrans s'affichent. Elles ne prouvent pas qu'ils fonctionnent.** Elles sont désormais prises par une COMMANDE — `pnpm exec tsx scripts/captures.mts` — et non à la main : une prise de vue manuelle ne se rejoue pas, et vieillit sans le dire.

| | |
|---|---|
| **Commit photographié** | `6dcd517fef221d146af0915de7f08cfffaf8c251` (`6dcd517`) — lu dans `git rev-parse HEAD` au moment de la prise, jamais de mémoire |
| **Date de la prise** | 2026-09-30 09:06 UTC — lue à l'horloge, jamais déduite |
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

Elle compare `6dcd517` à `HEAD` sur les chemins ci-dessous et rend l'un de **trois** verdicts. Le troisième est celui qu'on oublie : dans un clone tronqué (`--depth`), l'empreinte photographiée n'existe pas, et *« je ne sais pas » se lirait « rien n'a changé »* — le silence qui a exactement la forme du succès. Elle sort en **1** dans ce cas, et en **0** dès que la question est répondue, quelle que soit la réponse : *un écran qui change entre deux prises est le cours ordinaire du travail, pas une faute, et rougir là-dessus ferait un contrôle qu'on apprend à ne plus lire.*

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

- `arrivee-sans-societe--clair--1280.png : Error: session absente — Error: La connexion n'a pas abouti pour direction@codima.test : la page est restée sur http://127.0.0.1:3101/connexion/code. Le compte porte DÉJÀ un second facteur et la clé n'est pas connue de cette prise de vue : repasser `SECRET_TOTP`, ou repartir d'une base fraîchement semée. Aucune capture authentifiée ne sera prise — mieux vaut aucune image qu'une page de connexion r
  Cette image exige un compte habilité sur AU MOINS DEUX sociétés — sur la démonstration, `direction@codima.test` — et se connecte sous `COURRIEL_MULTI` / `MOT_DE_PASSE_MULTI`, une identité DÉDIÉE et distincte de `COURRIEL` (99O, constat C-A2) : les confondre a déjà produit deux images identiques à l'octet près, l'écran « aucune société active » montrant en réalité une société active. Sans ces deux variables, le refus le dit. Avec un compte mono-société, la connexion active la seule habilitation (D35) et le sélecteur ne s'affiche jamais : le refus est alors juste, et il dit que COURRIEL_MULTI désigne le mauvais compte.`
- `arrivee-sans-societe--clair--1024.png : Error: session absente — Error: La connexion n'a pas abouti pour direction@codima.test : la page est restée sur http://127.0.0.1:3101/connexion/code. Le compte porte DÉJÀ un second facteur et la clé n'est pas connue de cette prise de vue : repasser `SECRET_TOTP`, ou repartir d'une base fraîchement semée. Aucune capture authentifiée ne sera prise — mieux vaut aucune image qu'une page de connexion r
  Cette image exige un compte habilité sur AU MOINS DEUX sociétés — sur la démonstration, `direction@codima.test` — et se connecte sous `COURRIEL_MULTI` / `MOT_DE_PASSE_MULTI`, une identité DÉDIÉE et distincte de `COURRIEL` (99O, constat C-A2) : les confondre a déjà produit deux images identiques à l'octet près, l'écran « aucune société active » montrant en réalité une société active. Sans ces deux variables, le refus le dit. Avec un compte mono-société, la connexion active la seule habilitation (D35) et le sélecteur ne s'affiche jamais : le refus est alors juste, et il dit que COURRIEL_MULTI désigne le mauvais compte.`
- `arrivee-sans-societe--clair--375.png : Error: session absente — Error: La connexion n'a pas abouti pour direction@codima.test : la page est restée sur http://127.0.0.1:3101/connexion/code. Le compte porte DÉJÀ un second facteur et la clé n'est pas connue de cette prise de vue : repasser `SECRET_TOTP`, ou repartir d'une base fraîchement semée. Aucune capture authentifiée ne sera prise — mieux vaut aucune image qu'une page de connexion r
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
- `demande-detail--clair--1280.png : Error: le registre ne porte aucun lien de demande : il n'y a rien à détailler, et la capture est refusée plutôt que prise sur une page d'erreur.
  Cet écran n'existe que si le registre porte au moins une demande. Sur une base sans semis de démonstration, le refus est LÉGITIME et dit exactement cela — il ne se confond pas avec un écran cassé.`
- `demande-detail--clair--1024.png : Error: le registre ne porte aucun lien de demande : il n'y a rien à détailler, et la capture est refusée plutôt que prise sur une page d'erreur.
  Cet écran n'existe que si le registre porte au moins une demande. Sur une base sans semis de démonstration, le refus est LÉGITIME et dit exactement cela — il ne se confond pas avec un écran cassé.`
- `demande-detail--clair--375.png : Error: le registre ne porte aucun lien de demande : il n'y a rien à détailler, et la capture est refusée plutôt que prise sur une page d'erreur.
  Cet écran n'existe que si le registre porte au moins une demande. Sur une base sans semis de démonstration, le refus est LÉGITIME et dit exactement cela — il ne se confond pas avec un écran cassé.`
- `intervention-bon--clair--1280.png : Error: la fiche découverte ne propose pas de bon imprimable (`peutGenererLeBon` refuse ce statut) : la capture est refusée plutôt que prise sur une page d'erreur.
  Cet écran n'existe que si le registre porte une intervention dont le bon peut se générer (`peutGenererLeBon`, hors `planifiee`). Sur une base sans intervention dans cet état, le refus est LÉGITIME.`
- `intervention-bon--clair--1024.png : Error: la fiche découverte ne propose pas de bon imprimable (`peutGenererLeBon` refuse ce statut) : la capture est refusée plutôt que prise sur une page d'erreur.
  Cet écran n'existe que si le registre porte une intervention dont le bon peut se générer (`peutGenererLeBon`, hors `planifiee`). Sur une base sans intervention dans cet état, le refus est LÉGITIME.`
- `intervention-bon--clair--375.png : Error: la fiche découverte ne propose pas de bon imprimable (`peutGenererLeBon` refuse ce statut) : la capture est refusée plutôt que prise sur une page d'erreur.
  Cet écran n'existe que si le registre porte une intervention dont le bon peut se générer (`peutGenererLeBon`, hors `planifiee`). Sur une base sans intervention dans cet état, le refus est LÉGITIME.`

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
| `demandes--clair--1280.png` | Le registre des demandes — de la plus ancienne à la plus récente, avant qualification. — thème clair, poste de travail. |
| `demandes--clair--1024.png` | Le registre des demandes — de la plus ancienne à la plus récente, avant qualification. — thème clair, poste de travail. |
| `demandes--clair--375.png` | Le registre des demandes — de la plus ancienne à la plus récente, avant qualification. — thème clair, téléphone. |
| `parc-detail--clair--1280.png` | La fiche d'une machine — son identité, son historique, ses documents. — thème clair, poste de travail. |
| `parc-detail--clair--1024.png` | La fiche d'une machine — son identité, son historique, ses documents. — thème clair, poste de travail. |
| `parc-detail--clair--375.png` | La fiche d'une machine — son identité, son historique, ses documents. — thème clair, téléphone. |
| `site-detail--clair--1280.png` | La fiche d'un site — ses interlocuteurs et son équipement. — thème clair, poste de travail. |
| `site-detail--clair--1024.png` | La fiche d'un site — ses interlocuteurs et son équipement. — thème clair, poste de travail. |
| `site-detail--clair--375.png` | La fiche d'un site — ses interlocuteurs et son équipement. — thème clair, téléphone. |
| `site-creation--clair--1280.png` | La création d'un lieu d'intervention. — thème clair, poste de travail. |
| `site-creation--clair--1024.png` | La création d'un lieu d'intervention. — thème clair, poste de travail. |
| `site-creation--clair--375.png` | La création d'un lieu d'intervention. — thème clair, téléphone. |
| `parametres-equipe--clair--1280.png` | Les techniciens de la société active : créer, rattacher, désactiver. — thème clair, poste de travail. |
| `parametres-equipe--clair--1024.png` | Les techniciens de la société active : créer, rattacher, désactiver. — thème clair, poste de travail. |
| `parametres-equipe--clair--375.png` | Les techniciens de la société active : créer, rattacher, désactiver. — thème clair, téléphone. |
| `parametres-materiel--clair--1280.png` | Le référentiel matériel — familles et modèles. — thème clair, poste de travail. |
| `parametres-materiel--clair--1024.png` | Le référentiel matériel — familles et modèles. — thème clair, poste de travail. |
| `parametres-materiel--clair--375.png` | Le référentiel matériel — familles et modèles. — thème clair, téléphone. |
| `parametres-habilitations--clair--1280.png` | Le référentiel des qualifications requises pour intervenir. — thème clair, poste de travail. |
| `parametres-habilitations--clair--1024.png` | Le référentiel des qualifications requises pour intervenir. — thème clair, poste de travail. |
| `parametres-habilitations--clair--375.png` | Le référentiel des qualifications requises pour intervenir. — thème clair, téléphone. |
| `parametres-societe--clair--1280.png` | La charte de la société active. — thème clair, poste de travail. |
| `parametres-societe--clair--1024.png` | La charte de la société active. — thème clair, poste de travail. |
| `parametres-societe--clair--375.png` | La charte de la société active. — thème clair, téléphone. |
| `agence-detail--clair--1280.png` | Les plages d'ouverture d'un calendrier d'agence. — thème clair, poste de travail. |
| `agence-detail--clair--1024.png` | Les plages d'ouverture d'un calendrier d'agence. — thème clair, poste de travail. |
| `agence-detail--clair--375.png` | Les plages d'ouverture d'un calendrier d'agence. — thème clair, téléphone. |
| `agence-creation--clair--1280.png` | La création d'un établissement. — thème clair, poste de travail. |
| `agence-creation--clair--1024.png` | La création d'un établissement. — thème clair, poste de travail. |
| `agence-creation--clair--375.png` | La création d'un établissement. — thème clair, téléphone. |
| `agence-modification--clair--1280.png` | La modification d'un établissement. — thème clair, poste de travail. |
| `agence-modification--clair--1024.png` | La modification d'un établissement. — thème clair, poste de travail. |
| `agence-modification--clair--375.png` | La modification d'un établissement. — thème clair, téléphone. |
| `forfait-detail--clair--1280.png` | La fiche d'un forfait du catalogue. — thème clair, poste de travail. |
| `forfait-detail--clair--1024.png` | La fiche d'un forfait du catalogue. — thème clair, poste de travail. |
| `forfait-detail--clair--375.png` | La fiche d'un forfait du catalogue. — thème clair, téléphone. |

## Mesure

**Une observation, pas une porte** : la mesure ne fait pas échouer le script, comme un refus de capture (voir plus haut). Seuils lus, jamais inventés : texte < 12 px (D138) ; cible < 32×32 px au bureau hors lien dans le texte (spec ergonomie-graphisme-usage-2026-09-28.md §10 :963) ; cible < 44×44 px au terrain (spec §10 :964, CDC §13.4) ; défilement horizontal de la page (spec §10 :965, PR-10) ; erreur de console (spec §10 :966) ; taille hors 12/13/14/15/16/18/24/28 px (spec §3.2, D138, D143) ; texte de 12-13 px et graisse < 700 (décision du 30/09/2026, point 11) ; texte du terrain < 16 px (décision du 30/09/2026, point 8).

| Écran | Largeur | Textes < 12 px | Cibles sous le seuil | Débordement | Erreurs | Hors échelle | Petits textes légers | Terrain < 16 px |
|---|---|---|---|---|---|---|---|---|
| `enrolement` | 1280 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| `enrolement` | 1024 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| `enrolement` | 375 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| `terrain` | 1280 | 0 | 0 | 0 | 0 | 7 | 10 | 19 |
| `terrain` | 1024 | 0 | 0 | 0 | 0 | 7 | 10 | 19 |
| `terrain` | 375 | 0 | 2 | 26px | 0 | 7 | 10 | 19 |
| `terrain-intervention` | 1280 | 0 | 0 | 0 | 0 | 10 | 15 | 29 |
| `terrain-intervention` | 1024 | 0 | 0 | 0 | 0 | 10 | 15 | 29 |
| `terrain-intervention` | 375 | 0 | 12 | 26px | 0 | 10 | 15 | 29 |
| `connexion-code` | 1280 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| `connexion-code` | 1024 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| `connexion-code` | 375 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| `accueil` | 1280 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| `accueil` | 1024 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| `accueil` | 375 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| `connexion` | 1280 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| `connexion` | 1024 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| `connexion` | 375 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| `premier-acces` | 1280 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| `premier-acces` | 1024 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| `premier-acces` | 375 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| `sante` | 1280 | 0 | 0 | 0 | 0 | 0 | 3 | 0 |
| `sante` | 1024 | 0 | 0 | 0 | 0 | 0 | 3 | 0 |
| `sante` | 375 | 0 | 0 | 0 | 0 | 0 | 3 | 0 |
| `arrivee` | 1280 | 0 | 0 | 0 | 0 | 3 | 25 | 0 |
| `arrivee` | 1024 | 0 | 0 | 0 | 0 | 3 | 25 | 0 |
| `arrivee` | 375 | 0 | 1 | 0 | 0 | 2 | 13 | 0 |
| `planning` | 1280 | 0 | 0 | 0 | 0 | 18 | 96 | 0 |
| `planning` | 1024 | 0 | 0 | 0 | 0 | 18 | 96 | 0 |
| `planning` | 375 | 0 | 10 | 0 | 0 | 17 | 97 | 0 |
| `planning-jour` | 1280 | 0 | 0 | 0 | 0 | 14 | 51 | 0 |
| `planning-jour` | 1024 | 0 | 0 | 0 | 0 | 14 | 51 | 0 |
| `planning-jour` | 375 | 0 | 10 | 0 | 0 | 13 | 38 | 0 |
| `tableau-de-bord` | 1280 | 0 | 0 | 0 | 0 | 10 | 29 | 0 |
| `tableau-de-bord` | 1024 | 0 | 0 | 0 | 0 | 10 | 29 | 0 |
| `tableau-de-bord` | 375 | 0 | 3 | 0 | 0 | 9 | 17 | 0 |
| `interventions` | 1280 | 0 | 0 | 0 | 0 | 15 | 159 | 0 |
| `interventions` | 1024 | 0 | 0 | 0 | 0 | 15 | 159 | 0 |
| `interventions` | 375 | 0 | 2 | 0 | 0 | 14 | 147 | 0 |
| `imports-rapport` | 1280 | 0 | 0 | 0 | 0 | 2 | 29 | 0 |
| `imports-rapport` | 1024 | 0 | 0 | 0 | 0 | 2 | 29 | 0 |
| `imports-rapport` | 375 | 0 | 2 | 0 | 0 | 1 | 17 | 0 |
| `imports` | 1280 | 0 | 0 | 0 | 0 | 4 | 51 | 0 |
| `imports` | 1024 | 0 | 0 | 0 | 0 | 4 | 51 | 0 |
| `imports` | 375 | 0 | 1 | 0 | 0 | 3 | 39 | 0 |
| `intervention-creation` | 1280 | 0 | 0 | 0 | 0 | 11 | 23 | 0 |
| `intervention-creation` | 1024 | 0 | 0 | 0 | 0 | 11 | 23 | 0 |
| `intervention-creation` | 375 | 0 | 2 | 0 | 0 | 10 | 11 | 0 |
| `parc` | 1280 | 0 | 0 | 0 | 0 | 8 | 27 | 0 |
| `parc` | 1024 | 0 | 0 | 74px | 0 | 8 | 27 | 0 |
| `parc` | 375 | 0 | 1 | 0 | 0 | 7 | 15 | 0 |
| `clients` | 1280 | 0 | 0 | 0 | 0 | 5 | 23 | 0 |
| `clients` | 1024 | 0 | 0 | 0 | 0 | 5 | 23 | 0 |
| `clients` | 375 | 0 | 2 | 0 | 0 | 4 | 11 | 0 |
| `client-creation` | 1280 | 0 | 0 | 0 | 0 | 9 | 20 | 0 |
| `client-creation` | 1024 | 0 | 0 | 0 | 0 | 9 | 20 | 0 |
| `client-creation` | 375 | 0 | 2 | 0 | 0 | 8 | 8 | 0 |
| `absences` | 1280 | 0 | 0 | 0 | 0 | 8 | 32 | 0 |
| `absences` | 1024 | 0 | 0 | 0 | 0 | 8 | 32 | 0 |
| `absences` | 375 | 0 | 6 | 0 | 0 | 7 | 20 | 0 |
| `sites` | 1280 | 0 | 0 | 0 | 0 | 6 | 31 | 0 |
| `sites` | 1024 | 0 | 0 | 0 | 0 | 6 | 31 | 0 |
| `sites` | 375 | 0 | 3 | 0 | 0 | 5 | 19 | 0 |
| `parametres-trajets` | 1280 | 0 | 0 | 0 | 0 | 3 | 40 | 0 |
| `parametres-trajets` | 1024 | 0 | 0 | 0 | 0 | 3 | 40 | 0 |
| `parametres-trajets` | 375 | 0 | 7 | 0 | 0 | 2 | 28 | 0 |
| `parametres` | 1280 | 0 | 0 | 0 | 0 | 13 | 35 | 0 |
| `parametres` | 1024 | 0 | 0 | 0 | 0 | 13 | 35 | 0 |
| `parametres` | 375 | 0 | 1 | 0 | 0 | 12 | 23 | 0 |
| `vgp` | 1280 | 0 | 0 | 0 | 0 | 8 | 95 | 0 |
| `vgp` | 1024 | 0 | 0 | 0 | 0 | 8 | 95 | 0 |
| `vgp` | 375 | 0 | 9 | 0 | 0 | 7 | 83 | 0 |
| `vgp-a-determiner` | 1280 | 0 | 0 | 0 | 0 | 3 | 16 | 0 |
| `vgp-a-determiner` | 1024 | 0 | 0 | 0 | 0 | 3 | 16 | 0 |
| `vgp-a-determiner` | 375 | 0 | 2 | 0 | 0 | 2 | 4 | 0 |
| `parametres-agences` | 1280 | 0 | 0 | 0 | 0 | 3 | 36 | 0 |
| `parametres-agences` | 1024 | 0 | 0 | 0 | 0 | 3 | 36 | 0 |
| `parametres-agences` | 375 | 0 | 5 | 0 | 0 | 2 | 24 | 0 |
| `parametres-forfaits` | 1280 | 0 | 0 | 0 | 0 | 12 | 32 | 0 |
| `parametres-forfaits` | 1024 | 0 | 0 | 0 | 0 | 12 | 32 | 0 |
| `parametres-forfaits` | 375 | 0 | 8 | 0 | 0 | 11 | 20 | 0 |
| `parametres-prestations` | 1280 | 0 | 0 | 0 | 0 | 4 | 22 | 0 |
| `parametres-prestations` | 1024 | 0 | 0 | 0 | 0 | 4 | 22 | 0 |
| `parametres-prestations` | 375 | 0 | 7 | 0 | 0 | 3 | 10 | 0 |
| `demandes` | 1280 | 0 | 0 | 0 | 0 | 2 | 14 | 0 |
| `demandes` | 1024 | 0 | 0 | 0 | 0 | 2 | 14 | 0 |
| `demandes` | 375 | 0 | 1 | 0 | 0 | 1 | 2 | 0 |
| `parc-detail` | 1280 | 0 | 0 | 0 | 0 | 5 | 20 | 0 |
| `parc-detail` | 1024 | 0 | 0 | 0 | 0 | 5 | 20 | 0 |
| `parc-detail` | 375 | 0 | 1 | 0 | 0 | 4 | 8 | 0 |
| `site-detail` | 1280 | 0 | 0 | 0 | 0 | 22 | 82 | 0 |
| `site-detail` | 1024 | 0 | 0 | 0 | 0 | 22 | 82 | 0 |
| `site-detail` | 375 | 0 | 11 | 0 | 0 | 21 | 70 | 0 |
| `site-creation` | 1280 | 0 | 0 | 0 | 0 | 9 | 20 | 0 |
| `site-creation` | 1024 | 0 | 0 | 0 | 0 | 9 | 20 | 0 |
| `site-creation` | 375 | 0 | 2 | 0 | 0 | 8 | 8 | 0 |
| `parametres-equipe` | 1280 | 0 | 0 | 0 | 0 | 8 | 64 | 0 |
| `parametres-equipe` | 1024 | 0 | 0 | 0 | 0 | 8 | 64 | 0 |
| `parametres-equipe` | 375 | 0 | 35 | 0 | 0 | 7 | 52 | 0 |
| `parametres-materiel` | 1280 | 0 | 0 | 0 | 0 | 14 | 101 | 0 |
| `parametres-materiel` | 1024 | 0 | 0 | 0 | 0 | 14 | 101 | 0 |
| `parametres-materiel` | 375 | 0 | 53 | 0 | 0 | 13 | 89 | 0 |
| `parametres-habilitations` | 1280 | 0 | 0 | 0 | 0 | 21 | 162 | 0 |
| `parametres-habilitations` | 1024 | 0 | 0 | 0 | 0 | 21 | 162 | 0 |
| `parametres-habilitations` | 375 | 0 | 113 | 0 | 0 | 20 | 150 | 0 |
| `parametres-societe` | 1280 | 0 | 0 | 0 | 0 | 4 | 17 | 0 |
| `parametres-societe` | 1024 | 0 | 0 | 0 | 0 | 4 | 17 | 0 |
| `parametres-societe` | 375 | 0 | 2 | 0 | 0 | 3 | 5 | 0 |
| `agence-detail` | 1280 | 0 | 0 | 0 | 0 | 4 | 59 | 0 |
| `agence-detail` | 1024 | 0 | 0 | 0 | 0 | 4 | 59 | 0 |
| `agence-detail` | 375 | 0 | 38 | 0 | 0 | 3 | 47 | 0 |
| `agence-creation` | 1280 | 0 | 0 | 0 | 0 | 8 | 21 | 0 |
| `agence-creation` | 1024 | 0 | 0 | 0 | 0 | 8 | 21 | 0 |
| `agence-creation` | 375 | 0 | 2 | 0 | 0 | 7 | 9 | 0 |
| `agence-modification` | 1280 | 0 | 0 | 0 | 0 | 10 | 23 | 0 |
| `agence-modification` | 1024 | 0 | 0 | 0 | 0 | 10 | 23 | 0 |
| `agence-modification` | 375 | 0 | 3 | 0 | 0 | 9 | 11 | 0 |
| `forfait-detail` | 1280 | 0 | 0 | 0 | 0 | 11 | 24 | 0 |
| `forfait-detail` | 1024 | 0 | 0 | 0 | 0 | 11 | 24 | 0 |
| `forfait-detail` | 375 | 0 | 5 | 0 | 0 | 10 | 12 | 0 |

**`terrain` à 1280 px — textes hors échelle (5 premiers) :**

  - span.text-[12.5px].font-bold — 12.5px — « CODIMA Nouvelle-Calédonie »
  - button.text-app-encre-faible.hover:bg-app-fond — 12.5px — « Se déconnecter »
  - h1.text-[22px].font-extrabold — 22px — « Ma journée »
  - p.text-app-encre-faible.text-[12.5px] — 12.5px — « Site : Atelier principal »
  - p.text-app-encre-faible.text-[12.5px] — 12.5px — « Curatif »

**`terrain` à 1280 px — petits textes légers (5 premiers) :**

  - button.text-app-encre-faible.hover:bg-app-fond — 12.5px/600 — « Se déconnecter »
  - p.text-app-encre-faible.text-[13px] — 13px/400 — « 30/09/2026 »
  - span.border-app-orange-bord.bg-app-orange-fond — 12px/600 — « Nouveau »
  - span.bg-app-orange-fond.text-app-orange-encre — 12px/600 — « Suspendue »
  - p.text-app-encre-faible.text-[12.5px] — 12.5px/400 — « Site : Atelier principal »

**`terrain` à 1280 px — textes du terrain sous 16 px (5 premiers) :**

  - span.text-app-encre-faible.block — 12px — « SAV »
  - span.text-[12.5px].font-bold — 12.5px — « CODIMA Nouvelle-Calédonie »
  - button.text-app-encre-faible.hover:bg-app-fond — 12.5px — « Se déconnecter »
  - span.bg-app-marque.text-app-marque-encre — 12px — « DG »
  - p.text-app-encre-faible.text-[13px] — 13px — « 30/09/2026 »

**`terrain` à 1024 px — textes hors échelle (5 premiers) :**

  - span.text-[12.5px].font-bold — 12.5px — « CODIMA Nouvelle-Calédonie »
  - button.text-app-encre-faible.hover:bg-app-fond — 12.5px — « Se déconnecter »
  - h1.text-[22px].font-extrabold — 22px — « Ma journée »
  - p.text-app-encre-faible.text-[12.5px] — 12.5px — « Site : Atelier principal »
  - p.text-app-encre-faible.text-[12.5px] — 12.5px — « Curatif »

**`terrain` à 1024 px — petits textes légers (5 premiers) :**

  - button.text-app-encre-faible.hover:bg-app-fond — 12.5px/600 — « Se déconnecter »
  - p.text-app-encre-faible.text-[13px] — 13px/400 — « 30/09/2026 »
  - span.border-app-orange-bord.bg-app-orange-fond — 12px/600 — « Nouveau »
  - span.bg-app-orange-fond.text-app-orange-encre — 12px/600 — « Suspendue »
  - p.text-app-encre-faible.text-[12.5px] — 12.5px/400 — « Site : Atelier principal »

**`terrain` à 1024 px — textes du terrain sous 16 px (5 premiers) :**

  - span.text-app-encre-faible.block — 12px — « SAV »
  - span.text-[12.5px].font-bold — 12.5px — « CODIMA Nouvelle-Calédonie »
  - button.text-app-encre-faible.hover:bg-app-fond — 12.5px — « Se déconnecter »
  - span.bg-app-marque.text-app-marque-encre — 12px — « DG »
  - p.text-app-encre-faible.text-[13px] — 13px — « 30/09/2026 »

**`terrain` à 375 px — cibles sous le seuil (5 premières) :**

  - a.flex.flex-shrink-0 — 123×38px — « CODIPLAN SAV »
  - button.text-app-encre-faible.hover:bg-app-fond — 121×30px — « Se déconnecter »

**`terrain` à 375 px — textes hors échelle (5 premiers) :**

  - span.text-[12.5px].font-bold — 12.5px — « CODIMA Nouvelle-Calédonie »
  - button.text-app-encre-faible.hover:bg-app-fond — 12.5px — « Se déconnecter »
  - h1.text-[22px].font-extrabold — 22px — « Ma journée »
  - p.text-app-encre-faible.text-[12.5px] — 12.5px — « Site : Atelier principal »
  - p.text-app-encre-faible.text-[12.5px] — 12.5px — « Curatif »

**`terrain` à 375 px — petits textes légers (5 premiers) :**

  - button.text-app-encre-faible.hover:bg-app-fond — 12.5px/600 — « Se déconnecter »
  - p.text-app-encre-faible.text-[13px] — 13px/400 — « 30/09/2026 »
  - span.border-app-orange-bord.bg-app-orange-fond — 12px/600 — « Nouveau »
  - span.bg-app-orange-fond.text-app-orange-encre — 12px/600 — « Suspendue »
  - p.text-app-encre-faible.text-[12.5px] — 12.5px/400 — « Site : Atelier principal »

**`terrain` à 375 px — textes du terrain sous 16 px (5 premiers) :**

  - span.text-app-encre-faible.block — 12px — « SAV »
  - span.text-[12.5px].font-bold — 12.5px — « CODIMA Nouvelle-Calédonie »
  - button.text-app-encre-faible.hover:bg-app-fond — 12.5px — « Se déconnecter »
  - span.bg-app-marque.text-app-marque-encre — 12px — « DG »
  - p.text-app-encre-faible.text-[13px] — 13px — « 30/09/2026 »

**`terrain-intervention` à 1280 px — textes hors échelle (5 premiers) :**

  - span.text-[12.5px].font-bold — 12.5px — « CODIMA Nouvelle-Calédonie »
  - button.text-app-encre-faible.hover:bg-app-fond — 12.5px — « Se déconnecter »
  - a.text-[12.5px].text-app-marque — 12.5px — « ← Retour à ma journée »
  - h1.text-[20px].font-extrabold — 20px — « Atelier Ducos »
  - span.text-[12.5px].font-medium — 12.5px — « Commentaire »

**`terrain-intervention` à 1280 px — petits textes légers (5 premiers) :**

  - button.text-app-encre-faible.hover:bg-app-fond — 12.5px/600 — « Se déconnecter »
  - a.text-[12.5px].text-app-marque — 12.5px/400 — « ← Retour à ma journée »
  - dt.text-app-encre-faible — 13px/400 — « Site »
  - dd.font-medium — 13px/500 — « Atelier principal »
  - dt.text-app-encre-faible — 13px/400 — « Nature »

**`terrain-intervention` à 1280 px — textes du terrain sous 16 px (5 premiers) :**

  - span.text-app-encre-faible.block — 12px — « SAV »
  - span.text-[12.5px].font-bold — 12.5px — « CODIMA Nouvelle-Calédonie »
  - button.text-app-encre-faible.hover:bg-app-fond — 12.5px — « Se déconnecter »
  - span.bg-app-marque.text-app-marque-encre — 12px — « DG »
  - a.text-[12.5px].text-app-marque — 12.5px — « ← Retour à ma journée »

**`terrain-intervention` à 1024 px — textes hors échelle (5 premiers) :**

  - span.text-[12.5px].font-bold — 12.5px — « CODIMA Nouvelle-Calédonie »
  - button.text-app-encre-faible.hover:bg-app-fond — 12.5px — « Se déconnecter »
  - a.text-[12.5px].text-app-marque — 12.5px — « ← Retour à ma journée »
  - h1.text-[20px].font-extrabold — 20px — « Atelier Ducos »
  - span.text-[12.5px].font-medium — 12.5px — « Commentaire »

**`terrain-intervention` à 1024 px — petits textes légers (5 premiers) :**

  - button.text-app-encre-faible.hover:bg-app-fond — 12.5px/600 — « Se déconnecter »
  - a.text-[12.5px].text-app-marque — 12.5px/400 — « ← Retour à ma journée »
  - dt.text-app-encre-faible — 13px/400 — « Site »
  - dd.font-medium — 13px/500 — « Atelier principal »
  - dt.text-app-encre-faible — 13px/400 — « Nature »

**`terrain-intervention` à 1024 px — textes du terrain sous 16 px (5 premiers) :**

  - span.text-app-encre-faible.block — 12px — « SAV »
  - span.text-[12.5px].font-bold — 12.5px — « CODIMA Nouvelle-Calédonie »
  - button.text-app-encre-faible.hover:bg-app-fond — 12.5px — « Se déconnecter »
  - span.bg-app-marque.text-app-marque-encre — 12px — « DG »
  - a.text-[12.5px].text-app-marque — 12.5px — « ← Retour à ma journée »

**`terrain-intervention` à 375 px — cibles sous le seuil (5 premières) :**

  - a.flex.flex-shrink-0 — 123×38px — « CODIPLAN SAV »
  - button.text-app-encre-faible.hover:bg-app-fond — 121×30px — « Se déconnecter »
  - a.text-[12.5px].text-app-marque — 343×18px — « ← Retour à ma journée »
  - button.inline-flex.items-center — 309×36px — « Démarrer l'intervention »
  - button.inline-flex.items-center — 172×32px — « Enregistrer le rapport »

**`terrain-intervention` à 375 px — textes hors échelle (5 premiers) :**

  - span.text-[12.5px].font-bold — 12.5px — « CODIMA Nouvelle-Calédonie »
  - button.text-app-encre-faible.hover:bg-app-fond — 12.5px — « Se déconnecter »
  - a.text-[12.5px].text-app-marque — 12.5px — « ← Retour à ma journée »
  - h1.text-[20px].font-extrabold — 20px — « Atelier Ducos »
  - span.text-[12.5px].font-medium — 12.5px — « Commentaire »

**`terrain-intervention` à 375 px — petits textes légers (5 premiers) :**

  - button.text-app-encre-faible.hover:bg-app-fond — 12.5px/600 — « Se déconnecter »
  - a.text-[12.5px].text-app-marque — 12.5px/400 — « ← Retour à ma journée »
  - dt.text-app-encre-faible — 13px/400 — « Site »
  - dd.font-medium — 13px/500 — « Atelier principal »
  - dt.text-app-encre-faible — 13px/400 — « Nature »

**`terrain-intervention` à 375 px — textes du terrain sous 16 px (5 premiers) :**

  - span.text-app-encre-faible.block — 12px — « SAV »
  - span.text-[12.5px].font-bold — 12.5px — « CODIMA Nouvelle-Calédonie »
  - button.text-app-encre-faible.hover:bg-app-fond — 12.5px — « Se déconnecter »
  - span.bg-app-marque.text-app-marque-encre — 12px — « DG »
  - a.text-[12.5px].text-app-marque — 12.5px — « ← Retour à ma journée »

**`sante` à 1280 px — petits textes légers (5 premiers) :**

  - p.text-muted-foreground.text-xs — 12px/400 — « L'application doit se connecter avec un  »
  - p.text-muted-foreground.text-xs — 12px/400 — « Le cloisonnement l'interdit à cette conn »
  - p.text-muted-foreground.text-xs — 12px/400 — « Le cloisonnement l'interdit à cette conn »

**`sante` à 1024 px — petits textes légers (5 premiers) :**

  - p.text-muted-foreground.text-xs — 12px/400 — « L'application doit se connecter avec un  »
  - p.text-muted-foreground.text-xs — 12px/400 — « Le cloisonnement l'interdit à cette conn »
  - p.text-muted-foreground.text-xs — 12px/400 — « Le cloisonnement l'interdit à cette conn »

**`sante` à 375 px — petits textes légers (5 premiers) :**

  - p.text-muted-foreground.text-xs — 12px/400 — « L'application doit se connecter avec un  »
  - p.text-muted-foreground.text-xs — 12px/400 — « Le cloisonnement l'interdit à cette conn »
  - p.text-muted-foreground.text-xs — 12px/400 — « Le cloisonnement l'interdit à cette conn »

**`arrivee` à 1280 px — textes hors échelle (5 premiers) :**

  - span.text-[12.5px].font-bold — 12.5px — « CODIMA Nouvelle-Calédonie »
  - h1.mb-[3px].text-[22px] — 22px — « Vous êtes connecté »
  - p.text-app-encre-faible.text-[12.5px] — 12.5px — « Vous êtes habilité sur plusieurs société »

**`arrivee` à 1280 px — petits textes légers (5 premiers) :**

  - a.w-full.rounded-md — 13px/600 — « Tableau de bord »
  - a.w-full.rounded-md — 13px/600 — « Planning »
  - a.w-full.rounded-md — 13px/600 — « Demandes »
  - a.w-full.rounded-md — 13px/600 — « Interventions »
  - a.w-full.rounded-md — 13px/600 — « Absences »

**`arrivee` à 1024 px — textes hors échelle (5 premiers) :**

  - span.text-[12.5px].font-bold — 12.5px — « CODIMA Nouvelle-Calédonie »
  - h1.mb-[3px].text-[22px] — 22px — « Vous êtes connecté »
  - p.text-app-encre-faible.text-[12.5px] — 12.5px — « Vous êtes habilité sur plusieurs société »

**`arrivee` à 1024 px — petits textes légers (5 premiers) :**

  - a.w-full.rounded-md — 13px/600 — « Tableau de bord »
  - a.w-full.rounded-md — 13px/600 — « Planning »
  - a.w-full.rounded-md — 13px/600 — « Demandes »
  - a.w-full.rounded-md — 13px/600 — « Interventions »
  - a.w-full.rounded-md — 13px/600 — « Absences »

**`arrivee` à 375 px — cibles sous le seuil (5 premières) :**

  - a.focus:bg-app-surface.focus:text-app-marque — 1×1px — « Aller au contenu »

**`arrivee` à 375 px — textes hors échelle (5 premiers) :**

  - h1.mb-[3px].text-[22px] — 22px — « Vous êtes connecté »
  - p.text-app-encre-faible.text-[12.5px] — 12.5px — « Vous êtes habilité sur plusieurs société »

**`arrivee` à 375 px — petits textes légers (5 premiers) :**

  - p.text-app-encre-faible.mb-[20px] — 13px/400 — « Votre compte, la société sur laquelle vo »
  - dt.text-app-encre-faible — 13px/400 — « Compte »
  - dd.font-medium — 13px/500 — « Direction de démonstration »
  - dt.text-app-encre-faible — 13px/400 — « Adresse électronique »
  - dd.font-medium — 13px/500 — « direction@codima.test »

**`planning` à 1280 px — textes hors échelle (5 premiers) :**

  - span.text-[12.5px].font-bold — 12.5px — « CODIMA Nouvelle-Calédonie »
  - h1.mb-[3px].text-[22px] — 22px — « Planning des interventions »
  - a.rounded-md.px-3 — 12.5px — « Semaine »
  - a.rounded-md.px-3 — 12.5px — « Jour »
  - a.border-app-bord.text-app-encre-faible — 12.5px — « ← Semaine précédente »

**`planning` à 1280 px — petits textes légers (5 premiers) :**

  - a.w-full.rounded-md — 13px/600 — « Tableau de bord »
  - a.w-full.rounded-md — 13px/600 — « Planning »
  - a.w-full.rounded-md — 13px/600 — « Demandes »
  - a.w-full.rounded-md — 13px/600 — « Interventions »
  - a.w-full.rounded-md — 13px/600 — « Absences »

**`planning` à 1024 px — textes hors échelle (5 premiers) :**

  - span.text-[12.5px].font-bold — 12.5px — « CODIMA Nouvelle-Calédonie »
  - h1.mb-[3px].text-[22px] — 22px — « Planning des interventions »
  - a.rounded-md.px-3 — 12.5px — « Semaine »
  - a.rounded-md.px-3 — 12.5px — « Jour »
  - a.border-app-bord.text-app-encre-faible — 12.5px — « ← Semaine précédente »

**`planning` à 1024 px — petits textes légers (5 premiers) :**

  - a.w-full.rounded-md — 13px/600 — « Tableau de bord »
  - a.w-full.rounded-md — 13px/600 — « Planning »
  - a.w-full.rounded-md — 13px/600 — « Demandes »
  - a.w-full.rounded-md — 13px/600 — « Interventions »
  - a.w-full.rounded-md — 13px/600 — « Absences »

**`planning` à 375 px — cibles sous le seuil (5 premières) :**

  - a.focus:bg-app-surface.focus:text-app-marque — 1×1px — « Aller au contenu »
  - select.border-app-bord.rounded-md — 88×27px — « Tous Dolbeau Ducos Koné »
  - select.border-app-bord.rounded-md — 124×27px — « Tous Non affectées D. Garnier J. Lemaîtr »
  - select.border-app-bord.rounded-md — 175×27px — « Tous Préventif sous contrat Préventif ho »
  - select.border-app-bord.rounded-md — 120×27px — « Tous P1 — critique P2 — haute P3 — norma »

**`planning` à 375 px — textes hors échelle (5 premiers) :**

  - h1.mb-[3px].text-[22px] — 22px — « Planning des interventions »
  - a.rounded-md.px-3 — 12.5px — « Semaine »
  - a.rounded-md.px-3 — 12.5px — « Jour »
  - a.border-app-bord.text-app-encre-faible — 12.5px — « ← Semaine précédente »
  - a.border-app-bord.text-app-encre-faible — 12.5px — « Aujourd’hui »

**`planning` à 375 px — petits textes légers (5 premiers) :**

  - p.text-app-encre-faible.mb-[20px] — 13px/400 — « Semaine 40 — du 28/09 au 03/10/2026 »
  - a.border-app-bord.text-app-encre-faible — 12.5px/600 — « ← Semaine précédente »
  - a.border-app-bord.text-app-encre-faible — 12.5px/600 — « Aujourd’hui »
  - a.border-app-bord.text-app-encre-faible — 12.5px/600 — « Semaine suivante → »
  - a.border-app-bord.rounded-md — 12.5px/600 — « Afficher les annulées »

**`planning-jour` à 1280 px — textes hors échelle (5 premiers) :**

  - span.text-[12.5px].font-bold — 12.5px — « CODIMA Nouvelle-Calédonie »
  - h1.mb-[3px].text-[22px] — 22px — « Planning des interventions »
  - a.rounded-md.px-3 — 12.5px — « Semaine »
  - a.rounded-md.px-3 — 12.5px — « Jour »
  - a.border-app-bord.text-app-encre-faible — 12.5px — « ← Jour précédent »

**`planning-jour` à 1280 px — petits textes légers (5 premiers) :**

  - a.w-full.rounded-md — 13px/600 — « Tableau de bord »
  - a.w-full.rounded-md — 13px/600 — « Planning »
  - a.w-full.rounded-md — 13px/600 — « Demandes »
  - a.w-full.rounded-md — 13px/600 — « Interventions »
  - a.w-full.rounded-md — 13px/600 — « Absences »

**`planning-jour` à 1024 px — textes hors échelle (5 premiers) :**

  - span.text-[12.5px].font-bold — 12.5px — « CODIMA Nouvelle-Calédonie »
  - h1.mb-[3px].text-[22px] — 22px — « Planning des interventions »
  - a.rounded-md.px-3 — 12.5px — « Semaine »
  - a.rounded-md.px-3 — 12.5px — « Jour »
  - a.border-app-bord.text-app-encre-faible — 12.5px — « ← Jour précédent »

**`planning-jour` à 1024 px — petits textes légers (5 premiers) :**

  - a.w-full.rounded-md — 13px/600 — « Tableau de bord »
  - a.w-full.rounded-md — 13px/600 — « Planning »
  - a.w-full.rounded-md — 13px/600 — « Demandes »
  - a.w-full.rounded-md — 13px/600 — « Interventions »
  - a.w-full.rounded-md — 13px/600 — « Absences »

**`planning-jour` à 375 px — cibles sous le seuil (5 premières) :**

  - a.focus:bg-app-surface.focus:text-app-marque — 1×1px — « Aller au contenu »
  - select.border-app-bord.rounded-md — 88×27px — « Tous Dolbeau Ducos Koné »
  - select.border-app-bord.rounded-md — 124×27px — « Tous Non affectées D. Garnier J. Lemaîtr »
  - select.border-app-bord.rounded-md — 175×27px — « Tous Préventif sous contrat Préventif ho »
  - select.border-app-bord.rounded-md — 120×27px — « Tous P1 — critique P2 — haute P3 — norma »

**`planning-jour` à 375 px — textes hors échelle (5 premiers) :**

  - h1.mb-[3px].text-[22px] — 22px — « Planning des interventions »
  - a.rounded-md.px-3 — 12.5px — « Semaine »
  - a.rounded-md.px-3 — 12.5px — « Jour »
  - a.border-app-bord.text-app-encre-faible — 12.5px — « ← Jour précédent »
  - a.border-app-bord.text-app-encre-faible — 12.5px — « Aujourd’hui »

**`planning-jour` à 375 px — petits textes légers (5 premiers) :**

  - p.text-app-encre-faible.mb-[20px] — 13px/400 — « mercredi 30/09/2026 »
  - a.border-app-bord.text-app-encre-faible — 12.5px/600 — « ← Jour précédent »
  - a.border-app-bord.text-app-encre-faible — 12.5px/600 — « Aujourd’hui »
  - a.border-app-bord.text-app-encre-faible — 12.5px/600 — « Jour suivant → »
  - a.border-app-bord.rounded-md — 12.5px/600 — « Afficher les annulées »

**`tableau-de-bord` à 1280 px — textes hors échelle (5 premiers) :**

  - span.text-[12.5px].font-bold — 12.5px — « CODIMA Nouvelle-Calédonie »
  - h1.mb-[3px].text-[22px] — 22px — « Tableau de bord »
  - div.mt-[4px].mb-[2px] — 27px — « 1 »
  - div.mt-[4px].mb-[2px] — 27px — « 1 »
  - div.mt-[4px].mb-[2px] — 27px — « 1 »

**`tableau-de-bord` à 1280 px — petits textes légers (5 premiers) :**

  - a.w-full.rounded-md — 13px/600 — « Tableau de bord »
  - a.w-full.rounded-md — 13px/600 — « Planning »
  - a.w-full.rounded-md — 13px/600 — « Demandes »
  - a.w-full.rounded-md — 13px/600 — « Interventions »
  - a.w-full.rounded-md — 13px/600 — « Absences »

**`tableau-de-bord` à 1024 px — textes hors échelle (5 premiers) :**

  - span.text-[12.5px].font-bold — 12.5px — « CODIMA Nouvelle-Calédonie »
  - h1.mb-[3px].text-[22px] — 22px — « Tableau de bord »
  - div.mt-[4px].mb-[2px] — 27px — « 1 »
  - div.mt-[4px].mb-[2px] — 27px — « 1 »
  - div.mt-[4px].mb-[2px] — 27px — « 1 »

**`tableau-de-bord` à 1024 px — petits textes légers (5 premiers) :**

  - a.w-full.rounded-md — 13px/600 — « Tableau de bord »
  - a.w-full.rounded-md — 13px/600 — « Planning »
  - a.w-full.rounded-md — 13px/600 — « Demandes »
  - a.w-full.rounded-md — 13px/600 — « Interventions »
  - a.w-full.rounded-md — 13px/600 — « Absences »

**`tableau-de-bord` à 375 px — cibles sous le seuil (5 premières) :**

  - a.focus:bg-app-surface.focus:text-app-marque — 1×1px — « Aller au contenu »
  - a.border-app-bord.rounded-md — 63×31px — « Ouvrir »
  - a.border-app-bord.rounded-md — 63×31px — « Ouvrir »

**`tableau-de-bord` à 375 px — textes hors échelle (5 premiers) :**

  - h1.mb-[3px].text-[22px] — 22px — « Tableau de bord »
  - div.mt-[4px].mb-[2px] — 27px — « 1 »
  - div.mt-[4px].mb-[2px] — 27px — « 1 »
  - div.mt-[4px].mb-[2px] — 27px — « 1 »
  - div.mt-[4px].mb-[2px] — 27px — « 0 »

**`tableau-de-bord` à 375 px — petits textes légers (5 premiers) :**

  - p.text-app-encre-faible.mb-[20px] — 13px/400 — « Les décisions et alertes du jour, sans r »
  - a.inline-flex.min-h-[32px] — 13px/400 — « Voir la journée sur le planning → »
  - span.text-app-encre-faible.text-12 — 12px/400 — « Non calculé »
  - a.inline-flex.min-h-[32px] — 13px/400 — « Voir la charge sur le planning → »
  - div.text-app-encre-faible.text-12 — 12px/400 — « dont 1 en attente de pièce »

**`interventions` à 1280 px — textes hors échelle (5 premiers) :**

  - span.text-[12.5px].font-bold — 12.5px — « CODIMA Nouvelle-Calédonie »
  - h1.mb-[3px].text-[22px] — 22px — « Interventions »
  - label.flex.items-center — 12.5px — « Inclure les clients inactifs »
  - div.mt-[4px].mb-[2px] — 27px — « 15 »
  - div.mt-[4px].mb-[2px] — 27px — « 1 »

**`interventions` à 1280 px — petits textes légers (5 premiers) :**

  - a.w-full.rounded-md — 13px/600 — « Tableau de bord »
  - a.w-full.rounded-md — 13px/600 — « Planning »
  - a.w-full.rounded-md — 13px/600 — « Demandes »
  - a.w-full.rounded-md — 13px/600 — « Interventions »
  - a.w-full.rounded-md — 13px/600 — « Absences »

**`interventions` à 1024 px — textes hors échelle (5 premiers) :**

  - span.text-[12.5px].font-bold — 12.5px — « CODIMA Nouvelle-Calédonie »
  - h1.mb-[3px].text-[22px] — 22px — « Interventions »
  - label.flex.items-center — 12.5px — « Inclure les clients inactifs »
  - div.mt-[4px].mb-[2px] — 27px — « 15 »
  - div.mt-[4px].mb-[2px] — 27px — « 1 »

**`interventions` à 1024 px — petits textes légers (5 premiers) :**

  - a.w-full.rounded-md — 13px/600 — « Tableau de bord »
  - a.w-full.rounded-md — 13px/600 — « Planning »
  - a.w-full.rounded-md — 13px/600 — « Demandes »
  - a.w-full.rounded-md — 13px/600 — « Interventions »
  - a.w-full.rounded-md — 13px/600 — « Absences »

**`interventions` à 375 px — cibles sous le seuil (5 premières) :**

  - a.focus:bg-app-surface.focus:text-app-marque — 1×1px — « Aller au contenu »
  - input — 13×13px — «  »

**`interventions` à 375 px — textes hors échelle (5 premiers) :**

  - h1.mb-[3px].text-[22px] — 22px — « Interventions »
  - label.flex.items-center — 12.5px — « Inclure les clients inactifs »
  - div.mt-[4px].mb-[2px] — 27px — « 15 »
  - div.mt-[4px].mb-[2px] — 27px — « 1 »
  - div.mt-[4px].mb-[2px] — 27px — « 1 »

**`interventions` à 375 px — petits textes légers (5 premiers) :**

  - p.text-app-encre-faible.mb-[20px] — 13px/400 — « Le registre des interventions de la soci »
  - label.flex.flex-col — 12px/600 — « Client, lieu ou numéro de série »
  - label.flex.flex-col — 12px/600 — « Agence Toutes les agences Dolbeau — DOLB »
  - label.flex.flex-col — 12px/600 — « Nature Toutes les natures Préventif sous »
  - label.flex.flex-col — 12px/600 — « Statut Tous les statuts À planifier Plan »

**`imports-rapport` à 1280 px — textes hors échelle (5 premiers) :**

  - span.text-[12.5px].font-bold — 12.5px — « CODIMA Nouvelle-Calédonie »
  - h1.mb-[3px].text-[22px] — 22px — « Rapport de contrôle »

**`imports-rapport` à 1280 px — petits textes légers (5 premiers) :**

  - a.w-full.rounded-md — 13px/600 — « Tableau de bord »
  - a.w-full.rounded-md — 13px/600 — « Planning »
  - a.w-full.rounded-md — 13px/600 — « Demandes »
  - a.w-full.rounded-md — 13px/600 — « Interventions »
  - a.w-full.rounded-md — 13px/600 — « Absences »

**`imports-rapport` à 1024 px — textes hors échelle (5 premiers) :**

  - span.text-[12.5px].font-bold — 12.5px — « CODIMA Nouvelle-Calédonie »
  - h1.mb-[3px].text-[22px] — 22px — « Rapport de contrôle »

**`imports-rapport` à 1024 px — petits textes légers (5 premiers) :**

  - a.w-full.rounded-md — 13px/600 — « Tableau de bord »
  - a.w-full.rounded-md — 13px/600 — « Planning »
  - a.w-full.rounded-md — 13px/600 — « Demandes »
  - a.w-full.rounded-md — 13px/600 — « Interventions »
  - a.w-full.rounded-md — 13px/600 — « Absences »

**`imports-rapport` à 375 px — cibles sous le seuil (5 premières) :**

  - a.focus:bg-app-surface.focus:text-app-marque — 1×1px — « Aller au contenu »
  - a.text-app-marque.underline — 140×20px — « ← Retour aux imports »

**`imports-rapport` à 375 px — textes hors échelle (5 premiers) :**

  - h1.mb-[3px].text-[22px] — 22px — « Rapport de contrôle »

**`imports-rapport` à 375 px — petits textes légers (5 premiers) :**

  - p.text-app-encre-faible.mb-[20px] — 13px/400 — « clients-demonstration.xlsx »
  - p.text-app-encre-faible.text-12 — 12px/400 — « 30/09/2026 20:04 — Administration de dém »
  - p.text-app-encre-faible.text-12 — 12px/400 — « Durée de l'application — non mesurée — c »
  - span.w-[150px].font-semibold — 13px/600 — « Nouveaux »
  - span.text-app-encre-faible.text-12 — 12px/400 — « seront créés »

**`imports` à 1280 px — textes hors échelle (5 premiers) :**

  - span.text-[12.5px].font-bold — 12.5px — « CODIMA Nouvelle-Calédonie »
  - h1.mb-[3px].text-[22px] — 22px — « Imports Excel »
  - section.border-app-bleu-bord.bg-app-bleu-fond — 12.5px — « Aucun import n'est appliqué sans validat »
  - b — 12.5px — « Aucun import n'est appliqué sans validat »

**`imports` à 1280 px — petits textes légers (5 premiers) :**

  - a.w-full.rounded-md — 13px/600 — « Tableau de bord »
  - a.w-full.rounded-md — 13px/600 — « Planning »
  - a.w-full.rounded-md — 13px/600 — « Demandes »
  - a.w-full.rounded-md — 13px/600 — « Interventions »
  - a.w-full.rounded-md — 13px/600 — « Absences »

**`imports` à 1024 px — textes hors échelle (5 premiers) :**

  - span.text-[12.5px].font-bold — 12.5px — « CODIMA Nouvelle-Calédonie »
  - h1.mb-[3px].text-[22px] — 22px — « Imports Excel »
  - section.border-app-bleu-bord.bg-app-bleu-fond — 12.5px — « Aucun import n'est appliqué sans validat »
  - b — 12.5px — « Aucun import n'est appliqué sans validat »

**`imports` à 1024 px — petits textes légers (5 premiers) :**

  - a.w-full.rounded-md — 13px/600 — « Tableau de bord »
  - a.w-full.rounded-md — 13px/600 — « Planning »
  - a.w-full.rounded-md — 13px/600 — « Demandes »
  - a.w-full.rounded-md — 13px/600 — « Interventions »
  - a.w-full.rounded-md — 13px/600 — « Absences »

**`imports` à 375 px — cibles sous le seuil (5 premières) :**

  - a.focus:bg-app-surface.focus:text-app-marque — 1×1px — « Aller au contenu »

**`imports` à 375 px — textes hors échelle (5 premiers) :**

  - h1.mb-[3px].text-[22px] — 22px — « Imports Excel »
  - section.border-app-bleu-bord.bg-app-bleu-fond — 12.5px — « Aucun import n'est appliqué sans validat »
  - b — 12.5px — « Aucun import n'est appliqué sans validat »

**`imports` à 375 px — petits textes légers (5 premiers) :**

  - p.text-app-encre-faible.mb-[20px] — 13px/400 — « Les échanges avec les outils du client p »
  - section.border-app-bleu-bord.bg-app-bleu-fond — 12.5px/400 — « Aucun import n'est appliqué sans validat »
  - label.flex.flex-col — 12px/600 — « Classeur à contrôler »
  - p.text-app-encre-faible.text-12 — 12px/400 — « Un fichier .xlsx bâti sur le modèle CODI »
  - p.text-app-encre-faible.mt-1 — 12px/400 — « Chaque type listé sait contrôler un fich »

**`intervention-creation` à 1280 px — textes hors échelle (5 premiers) :**

  - span.text-[12.5px].font-bold — 12.5px — « CODIMA Nouvelle-Calédonie »
  - h1.mb-[3px].text-[22px] — 22px — « Créer une intervention »
  - a.text-app-encre-faible.text-[12.5px] — 12.5px — « ← Retour au planning »
  - label.relative.flex — 12.5px — « Site (obligatoire) Tapez un client, un s »
  - button.min-h-11.rounded-md — 12.5px — « 30 min »

**`intervention-creation` à 1280 px — petits textes légers (5 premiers) :**

  - a.w-full.rounded-md — 13px/600 — « Tableau de bord »
  - a.w-full.rounded-md — 13px/600 — « Planning »
  - a.w-full.rounded-md — 13px/600 — « Demandes »
  - a.w-full.rounded-md — 13px/600 — « Interventions »
  - a.w-full.rounded-md — 13px/600 — « Absences »

**`intervention-creation` à 1024 px — textes hors échelle (5 premiers) :**

  - span.text-[12.5px].font-bold — 12.5px — « CODIMA Nouvelle-Calédonie »
  - h1.mb-[3px].text-[22px] — 22px — « Créer une intervention »
  - a.text-app-encre-faible.text-[12.5px] — 12.5px — « ← Retour au planning »
  - label.relative.flex — 12.5px — « Site (obligatoire) Tapez un client, un s »
  - button.min-h-11.rounded-md — 12.5px — « 30 min »

**`intervention-creation` à 1024 px — petits textes légers (5 premiers) :**

  - a.w-full.rounded-md — 13px/600 — « Tableau de bord »
  - a.w-full.rounded-md — 13px/600 — « Planning »
  - a.w-full.rounded-md — 13px/600 — « Demandes »
  - a.w-full.rounded-md — 13px/600 — « Interventions »
  - a.w-full.rounded-md — 13px/600 — « Absences »

**`intervention-creation` à 375 px — cibles sous le seuil (5 premières) :**

  - a.focus:bg-app-surface.focus:text-app-marque — 1×1px — « Aller au contenu »
  - a.text-app-encre-faible.text-[12.5px] — 126×18px — « ← Retour au planning »

**`intervention-creation` à 375 px — textes hors échelle (5 premiers) :**

  - h1.mb-[3px].text-[22px] — 22px — « Créer une intervention »
  - a.text-app-encre-faible.text-[12.5px] — 12.5px — « ← Retour au planning »
  - label.relative.flex — 12.5px — « Site (obligatoire) Tapez un client, un s »
  - button.min-h-11.rounded-md — 12.5px — « 30 min »
  - button.min-h-11.rounded-md — 12.5px — « 1 h »

**`intervention-creation` à 375 px — petits textes légers (5 premiers) :**

  - a.text-app-encre-faible.text-[12.5px] — 12.5px/400 — « ← Retour au planning »
  - label.relative.flex — 12.5px/600 — « Site (obligatoire) Tapez un client, un s »
  - span.text-app-encre-faible.text-12 — 12px/400 — « Tapez un client, un site ou une commune »
  - p.text-app-encre-faible.-mt-2 — 12px/400 — « Le site choisi détermine l'agence — cela »
  - button.min-h-11.rounded-md — 12.5px/600 — « 30 min »

**`parc` à 1280 px — textes hors échelle (5 premiers) :**

  - span.text-[12.5px].font-bold — 12.5px — « CODIMA Nouvelle-Calédonie »
  - h1.mb-[3px].text-[22px] — 22px — « Parc machines »
  - span.text-app-encre-faible.pointer-events-none — 20px — « ⌕ »
  - div.mt-[4px].mb-[2px] — 27px — « 8 »
  - div.mt-[4px].mb-[2px] — 27px — « 0 »

**`parc` à 1280 px — petits textes légers (5 premiers) :**

  - a.w-full.rounded-md — 13px/600 — « Tableau de bord »
  - a.w-full.rounded-md — 13px/600 — « Planning »
  - a.w-full.rounded-md — 13px/600 — « Demandes »
  - a.w-full.rounded-md — 13px/600 — « Interventions »
  - a.w-full.rounded-md — 13px/600 — « Absences »

**`parc` à 1024 px — textes hors échelle (5 premiers) :**

  - span.text-[12.5px].font-bold — 12.5px — « CODIMA Nouvelle-Calédonie »
  - h1.mb-[3px].text-[22px] — 22px — « Parc machines »
  - span.text-app-encre-faible.pointer-events-none — 20px — « ⌕ »
  - div.mt-[4px].mb-[2px] — 27px — « 8 »
  - div.mt-[4px].mb-[2px] — 27px — « 0 »

**`parc` à 1024 px — petits textes légers (5 premiers) :**

  - a.w-full.rounded-md — 13px/600 — « Tableau de bord »
  - a.w-full.rounded-md — 13px/600 — « Planning »
  - a.w-full.rounded-md — 13px/600 — « Demandes »
  - a.w-full.rounded-md — 13px/600 — « Interventions »
  - a.w-full.rounded-md — 13px/600 — « Absences »

**`parc` à 375 px — cibles sous le seuil (5 premières) :**

  - a.focus:bg-app-surface.focus:text-app-marque — 1×1px — « Aller au contenu »

**`parc` à 375 px — textes hors échelle (5 premiers) :**

  - h1.mb-[3px].text-[22px] — 22px — « Parc machines »
  - span.text-app-encre-faible.pointer-events-none — 20px — « ⌕ »
  - div.mt-[4px].mb-[2px] — 27px — « 8 »
  - div.mt-[4px].mb-[2px] — 27px — « 0 »
  - div.mt-[4px].mb-[2px] — 27px — « 2 »

**`parc` à 375 px — petits textes légers (5 premiers) :**

  - p.text-app-encre-faible.mb-[20px] — 13px/400 — « Recherche sur l’identifiant, le numéro d »
  - div.text-app-encre-faible.text-12 — 12px/400 — « sur 8 machines au total · 1 fiche à comp »
  - div.text-app-encre-faible.text-12 — 12px/400 — « 1 en panne · 1 arrêtée »
  - span.text-app-encre-faible.text-[12px] — 12px/400 — « 8 machines »
  - p.text-app-encre-faible.text-[12px] — 12px/400 — « Compresseurs d'air · AC-GA11-2018-1177 · »

**`clients` à 1280 px — textes hors échelle (5 premiers) :**

  - span.text-[12.5px].font-bold — 12.5px — « CODIMA Nouvelle-Calédonie »
  - h1.mb-[3px].text-[22px] — 22px — « Clients »
  - span.text-[26px].font-extrabold — 26px — « 1 »
  - span.text-app-encre-faible.pointer-events-none — 20px — « ⌕ »
  - label.flex.items-center — 12.5px — « Afficher aussi les clients sans équipeme »

**`clients` à 1280 px — petits textes légers (5 premiers) :**

  - a.w-full.rounded-md — 13px/600 — « Tableau de bord »
  - a.w-full.rounded-md — 13px/600 — « Planning »
  - a.w-full.rounded-md — 13px/600 — « Demandes »
  - a.w-full.rounded-md — 13px/600 — « Interventions »
  - a.w-full.rounded-md — 13px/600 — « Absences »

**`clients` à 1024 px — textes hors échelle (5 premiers) :**

  - span.text-[12.5px].font-bold — 12.5px — « CODIMA Nouvelle-Calédonie »
  - h1.mb-[3px].text-[22px] — 22px — « Clients »
  - span.text-[26px].font-extrabold — 26px — « 1 »
  - span.text-app-encre-faible.pointer-events-none — 20px — « ⌕ »
  - label.flex.items-center — 12.5px — « Afficher aussi les clients sans équipeme »

**`clients` à 1024 px — petits textes légers (5 premiers) :**

  - a.w-full.rounded-md — 13px/600 — « Tableau de bord »
  - a.w-full.rounded-md — 13px/600 — « Planning »
  - a.w-full.rounded-md — 13px/600 — « Demandes »
  - a.w-full.rounded-md — 13px/600 — « Interventions »
  - a.w-full.rounded-md — 13px/600 — « Absences »

**`clients` à 375 px — cibles sous le seuil (5 premières) :**

  - a.focus:bg-app-surface.focus:text-app-marque — 1×1px — « Aller au contenu »
  - input — 13×13px — «  »

**`clients` à 375 px — textes hors échelle (5 premiers) :**

  - h1.mb-[3px].text-[22px] — 22px — « Clients »
  - span.text-[26px].font-extrabold — 26px — « 1 »
  - span.text-app-encre-faible.pointer-events-none — 20px — « ⌕ »
  - label.flex.items-center — 12.5px — « Afficher aussi les clients sans équipeme »

**`clients` à 375 px — petits textes légers (5 premiers) :**

  - p.text-app-encre-faible.mb-[20px] — 13px/400 — « Le référentiel des clients de la société »
  - p.text-app-encre-faible.mt-1 — 12px/400 — « Ces fiches n'ont pas de code de rapproch »
  - label.flex.items-center — 12.5px/500 — « Afficher aussi les clients sans équipeme »
  - p.text-app-encre-faible.my-[3px] — 12px/400 — « DEMO-001 · Bourail »
  - p.text-app-encre-faible.my-[3px] — 12px/400 — « Commercial référent — Commercial de démo »

**`client-creation` à 1280 px — textes hors échelle (5 premiers) :**

  - span.text-[12.5px].font-bold — 12.5px — « CODIMA Nouvelle-Calédonie »
  - h1.mb-[3px].text-[22px] — 22px — « Nouveau client »
  - a.text-app-encre-faible.text-[12.5px] — 12.5px — « ← Tous les clients »
  - label.flex.flex-col — 12.5px — « Raison sociale »
  - label.flex.flex-col — 12.5px — « Code Winpro La clé par laquelle un impor »

**`client-creation` à 1280 px — petits textes légers (5 premiers) :**

  - a.w-full.rounded-md — 13px/600 — « Tableau de bord »
  - a.w-full.rounded-md — 13px/600 — « Planning »
  - a.w-full.rounded-md — 13px/600 — « Demandes »
  - a.w-full.rounded-md — 13px/600 — « Interventions »
  - a.w-full.rounded-md — 13px/600 — « Absences »

**`client-creation` à 1024 px — textes hors échelle (5 premiers) :**

  - span.text-[12.5px].font-bold — 12.5px — « CODIMA Nouvelle-Calédonie »
  - h1.mb-[3px].text-[22px] — 22px — « Nouveau client »
  - a.text-app-encre-faible.text-[12.5px] — 12.5px — « ← Tous les clients »
  - label.flex.flex-col — 12.5px — « Raison sociale »
  - label.flex.flex-col — 12.5px — « Code Winpro La clé par laquelle un impor »

**`client-creation` à 1024 px — petits textes légers (5 premiers) :**

  - a.w-full.rounded-md — 13px/600 — « Tableau de bord »
  - a.w-full.rounded-md — 13px/600 — « Planning »
  - a.w-full.rounded-md — 13px/600 — « Demandes »
  - a.w-full.rounded-md — 13px/600 — « Interventions »
  - a.w-full.rounded-md — 13px/600 — « Absences »

**`client-creation` à 375 px — cibles sous le seuil (5 premières) :**

  - a.focus:bg-app-surface.focus:text-app-marque — 1×1px — « Aller au contenu »
  - a.text-app-encre-faible.text-[12.5px] — 109×18px — « ← Tous les clients »

**`client-creation` à 375 px — textes hors échelle (5 premiers) :**

  - h1.mb-[3px].text-[22px] — 22px — « Nouveau client »
  - a.text-app-encre-faible.text-[12.5px] — 12.5px — « ← Tous les clients »
  - label.flex.flex-col — 12.5px — « Raison sociale »
  - label.flex.flex-col — 12.5px — « Code Winpro La clé par laquelle un impor »
  - label.flex.flex-col — 12.5px — « RIDET »

**`client-creation` à 375 px — petits textes légers (5 premiers) :**

  - a.text-app-encre-faible.text-[12.5px] — 12.5px/400 — « ← Tous les clients »
  - label.flex.flex-col — 12.5px/600 — « Raison sociale »
  - label.flex.flex-col — 12.5px/600 — « Code Winpro La clé par laquelle un impor »
  - span.text-app-encre-faible.text-12 — 12px/400 — « La clé par laquelle un import reconnaît  »
  - label.flex.flex-col — 12.5px/600 — « RIDET »

**`absences` à 1280 px — textes hors échelle (5 premiers) :**

  - span.text-[12.5px].font-bold — 12.5px — « CODIMA Nouvelle-Calédonie »
  - h1.mb-[3px].text-[22px] — 22px — « Blocages d'agenda »
  - div.mt-[4px].mb-[2px] — 27px — « 0 »
  - div.mt-[4px].mb-[2px] — 27px — « 0 »
  - div.mt-[4px].mb-[2px] — 27px — « Sans objet »

**`absences` à 1280 px — petits textes légers (5 premiers) :**

  - a.w-full.rounded-md — 13px/600 — « Tableau de bord »
  - a.w-full.rounded-md — 13px/600 — « Planning »
  - a.w-full.rounded-md — 13px/600 — « Demandes »
  - a.w-full.rounded-md — 13px/600 — « Interventions »
  - a.w-full.rounded-md — 13px/600 — « Absences »

**`absences` à 1024 px — textes hors échelle (5 premiers) :**

  - span.text-[12.5px].font-bold — 12.5px — « CODIMA Nouvelle-Calédonie »
  - h1.mb-[3px].text-[22px] — 22px — « Blocages d'agenda »
  - div.mt-[4px].mb-[2px] — 27px — « 0 »
  - div.mt-[4px].mb-[2px] — 27px — « 0 »
  - div.mt-[4px].mb-[2px] — 27px — « Sans objet »

**`absences` à 1024 px — petits textes légers (5 premiers) :**

  - a.w-full.rounded-md — 13px/600 — « Tableau de bord »
  - a.w-full.rounded-md — 13px/600 — « Planning »
  - a.w-full.rounded-md — 13px/600 — « Demandes »
  - a.w-full.rounded-md — 13px/600 — « Interventions »
  - a.w-full.rounded-md — 13px/600 — « Absences »

**`absences` à 375 px — cibles sous le seuil (5 premières) :**

  - a.focus:bg-app-surface.focus:text-app-marque — 1×1px — « Aller au contenu »
  - a.border-app-bord.rounded-md — 27×32px — « ‹ »
  - a.border-app-bord.rounded-md — 27×32px — « › »
  - select#absence-personne.border-app-bord.bg-app-surface — 208×27px — « Sélectionner une personne D. Garnier J.  »
  - input#absence-du.border-app-bord.bg-app-surface — 137×28px — «  »

**`absences` à 375 px — textes hors échelle (5 premiers) :**

  - h1.mb-[3px].text-[22px] — 22px — « Blocages d'agenda »
  - div.mt-[4px].mb-[2px] — 27px — « 0 »
  - div.mt-[4px].mb-[2px] — 27px — « 0 »
  - div.mt-[4px].mb-[2px] — 27px — « Sans objet »
  - a.border-app-bord.rounded-md — 12.5px — « ‹ »

**`absences` à 375 px — petits textes légers (5 premiers) :**

  - p.text-app-encre-faible.mb-[20px] — 13px/400 — « Qui n'est pas disponible, et quand. Le m »
  - div.text-app-encre-faible.text-12 — 12px/400 — « Aucune agence sans technicien disponible »
  - div.text-app-encre-faible.text-12 — 12px/400 — « Le blocage est immédiat : il n'existe au »
  - a.border-app-bord.rounded-md — 12.5px/600 — « ‹ »
  - a.border-app-bord.rounded-md — 12.5px/600 — « Aujourd'hui »

**`sites` à 1280 px — textes hors échelle (5 premiers) :**

  - span.text-[12.5px].font-bold — 12.5px — « CODIMA Nouvelle-Calédonie »
  - h1.mb-[3px].text-[22px] — 22px — « Sites »
  - label.flex.items-center — 12.5px — « Afficher aussi les sites sans équipement »
  - label.flex.items-center — 12.5px — « Sous contrat uniquement »
  - p.text-app-encre-faible.text-[12.5px] — 12.5px — « 2 sites sans équipement masqués · Affich »

**`sites` à 1280 px — petits textes légers (5 premiers) :**

  - a.w-full.rounded-md — 13px/600 — « Tableau de bord »
  - a.w-full.rounded-md — 13px/600 — « Planning »
  - a.w-full.rounded-md — 13px/600 — « Demandes »
  - a.w-full.rounded-md — 13px/600 — « Interventions »
  - a.w-full.rounded-md — 13px/600 — « Absences »

**`sites` à 1024 px — textes hors échelle (5 premiers) :**

  - span.text-[12.5px].font-bold — 12.5px — « CODIMA Nouvelle-Calédonie »
  - h1.mb-[3px].text-[22px] — 22px — « Sites »
  - label.flex.items-center — 12.5px — « Afficher aussi les sites sans équipement »
  - label.flex.items-center — 12.5px — « Sous contrat uniquement »
  - p.text-app-encre-faible.text-[12.5px] — 12.5px — « 2 sites sans équipement masqués · Affich »

**`sites` à 1024 px — petits textes légers (5 premiers) :**

  - a.w-full.rounded-md — 13px/600 — « Tableau de bord »
  - a.w-full.rounded-md — 13px/600 — « Planning »
  - a.w-full.rounded-md — 13px/600 — « Demandes »
  - a.w-full.rounded-md — 13px/600 — « Interventions »
  - a.w-full.rounded-md — 13px/600 — « Absences »

**`sites` à 375 px — cibles sous le seuil (5 premières) :**

  - a.focus:bg-app-surface.focus:text-app-marque — 1×1px — « Aller au contenu »
  - input — 13×13px — «  »
  - input — 13×13px — «  »

**`sites` à 375 px — textes hors échelle (5 premiers) :**

  - h1.mb-[3px].text-[22px] — 22px — « Sites »
  - label.flex.items-center — 12.5px — « Afficher aussi les sites sans équipement »
  - label.flex.items-center — 12.5px — « Sous contrat uniquement »
  - p.text-app-encre-faible.text-[12.5px] — 12.5px — « 2 sites sans équipement masqués · Affich »
  - a.text-app-marque.underline — 12.5px — « Afficher »

**`sites` à 375 px — petits textes légers (5 premiers) :**

  - p.text-app-encre-faible.mb-[20px] — 13px/400 — « Les sites d'intervention de vos clients, »
  - label.flex.flex-col — 12px/600 — « Libellé, commune ou client »
  - label.flex.items-center — 12.5px/500 — « Afficher aussi les sites sans équipement »
  - label.flex.items-center — 12.5px/500 — « Sous contrat uniquement »
  - p.text-app-encre-faible.text-[12.5px] — 12.5px/400 — « 2 sites sans équipement masqués · Affich »

**`parametres-trajets` à 1280 px — textes hors échelle (5 premiers) :**

  - span.text-[12.5px].font-bold — 12.5px — « CODIMA Nouvelle-Calédonie »
  - h1.mb-[3px].text-[22px] — 22px — « Temps de trajet par zone »
  - a.text-app-encre-faible.text-[12.5px] — 12.5px — « ← Sociétés & tarifs »

**`parametres-trajets` à 1280 px — petits textes légers (5 premiers) :**

  - a.w-full.rounded-md — 13px/600 — « Tableau de bord »
  - a.w-full.rounded-md — 13px/600 — « Planning »
  - a.w-full.rounded-md — 13px/600 — « Demandes »
  - a.w-full.rounded-md — 13px/600 — « Interventions »
  - a.w-full.rounded-md — 13px/600 — « Absences »

**`parametres-trajets` à 1024 px — textes hors échelle (5 premiers) :**

  - span.text-[12.5px].font-bold — 12.5px — « CODIMA Nouvelle-Calédonie »
  - h1.mb-[3px].text-[22px] — 22px — « Temps de trajet par zone »
  - a.text-app-encre-faible.text-[12.5px] — 12.5px — « ← Sociétés & tarifs »

**`parametres-trajets` à 1024 px — petits textes légers (5 premiers) :**

  - a.w-full.rounded-md — 13px/600 — « Tableau de bord »
  - a.w-full.rounded-md — 13px/600 — « Planning »
  - a.w-full.rounded-md — 13px/600 — « Demandes »
  - a.w-full.rounded-md — 13px/600 — « Interventions »
  - a.w-full.rounded-md — 13px/600 — « Absences »

**`parametres-trajets` à 375 px — cibles sous le seuil (5 premières) :**

  - a.focus:bg-app-surface.focus:text-app-marque — 1×1px — « Aller au contenu »
  - a.text-app-encre-faible.text-[12.5px] — 115×18px — « ← Sociétés & tarifs »
  - input#trajet-grand_noumea.border-app-bord.bg-app-surface — 80×28px — «  »
  - input#trajet-sud.border-app-bord.bg-app-surface — 80×28px — «  »
  - input#trajet-cote_est.border-app-bord.bg-app-surface — 80×28px — «  »

**`parametres-trajets` à 375 px — textes hors échelle (5 premiers) :**

  - h1.mb-[3px].text-[22px] — 22px — « Temps de trajet par zone »
  - a.text-app-encre-faible.text-[12.5px] — 12.5px — « ← Sociétés & tarifs »

**`parametres-trajets` à 375 px — petits textes légers (5 premiers) :**

  - p.text-app-encre-faible.mb-[20px] — 13px/400 — « Trajet aller depuis l'établissement dont »
  - a.text-app-encre-faible.text-[12.5px] — 12.5px/400 — « ← Sociétés & tarifs »
  - td.border-app-bord.border-b — 13px/400 — « 30 min »
  - td.border-app-bord.border-b — 13px/400 — « Non réglée »
  - td.border-app-bord.border-b — 13px/400 — « 30 min — valeur de référence »

**`parametres` à 1280 px — textes hors échelle (5 premiers) :**

  - span.text-[12.5px].font-bold — 12.5px — « CODIMA Nouvelle-Calédonie »
  - h1.mb-[3px].text-[22px] — 22px — « Sociétés & tarifs »
  - span.text-app-marque.mt-3 — 12.5px — « Ouvrir »
  - span.text-app-marque.mt-3 — 12.5px — « Ouvrir »
  - span.text-app-marque.mt-3 — 12.5px — « Ouvrir »

**`parametres` à 1280 px — petits textes légers (5 premiers) :**

  - a.w-full.rounded-md — 13px/600 — « Tableau de bord »
  - a.w-full.rounded-md — 13px/600 — « Planning »
  - a.w-full.rounded-md — 13px/600 — « Demandes »
  - a.w-full.rounded-md — 13px/600 — « Interventions »
  - a.w-full.rounded-md — 13px/600 — « Absences »

**`parametres` à 1024 px — textes hors échelle (5 premiers) :**

  - span.text-[12.5px].font-bold — 12.5px — « CODIMA Nouvelle-Calédonie »
  - h1.mb-[3px].text-[22px] — 22px — « Sociétés & tarifs »
  - span.text-app-marque.mt-3 — 12.5px — « Ouvrir »
  - span.text-app-marque.mt-3 — 12.5px — « Ouvrir »
  - span.text-app-marque.mt-3 — 12.5px — « Ouvrir »

**`parametres` à 1024 px — petits textes légers (5 premiers) :**

  - a.w-full.rounded-md — 13px/600 — « Tableau de bord »
  - a.w-full.rounded-md — 13px/600 — « Planning »
  - a.w-full.rounded-md — 13px/600 — « Demandes »
  - a.w-full.rounded-md — 13px/600 — « Interventions »
  - a.w-full.rounded-md — 13px/600 — « Absences »

**`parametres` à 375 px — cibles sous le seuil (5 premières) :**

  - a.focus:bg-app-surface.focus:text-app-marque — 1×1px — « Aller au contenu »

**`parametres` à 375 px — textes hors échelle (5 premiers) :**

  - h1.mb-[3px].text-[22px] — 22px — « Sociétés & tarifs »
  - span.text-app-marque.mt-3 — 12.5px — « Ouvrir »
  - span.text-app-marque.mt-3 — 12.5px — « Ouvrir »
  - span.text-app-marque.mt-3 — 12.5px — « Ouvrir »
  - span.text-app-marque.mt-3 — 12.5px — « Ouvrir »

**`parametres` à 375 px — petits textes légers (5 premiers) :**

  - p.text-app-encre-faible.mb-[20px] — 13px/400 — « Les réglages de la société : ce qui déci »
  - span.text-app-encre-faible.mt-1.5 — 13px/400 — « L'identité affichée de la société active »
  - span.text-app-marque.mt-3 — 12.5px/500 — « Ouvrir »
  - span.text-app-encre-faible.mt-1.5 — 13px/400 — « Les jours travaillés, les horaires et le »
  - span.text-app-marque.mt-3 — 12.5px/500 — « Ouvrir »

**`vgp` à 1280 px — textes hors échelle (5 premiers) :**

  - span.text-[12.5px].font-bold — 12.5px — « CODIMA Nouvelle-Calédonie »
  - h1.mb-[3px].text-[22px] — 22px — « Registre des vérifications périodiques »
  - div.mt-[4px].mb-[2px] — 27px — « 1 »
  - div.mt-[4px].mb-[2px] — 27px — « 1 »
  - div.mt-[4px].mb-[2px] — 27px — « 2 »

**`vgp` à 1280 px — petits textes légers (5 premiers) :**

  - a.w-full.rounded-md — 13px/600 — « Tableau de bord »
  - a.w-full.rounded-md — 13px/600 — « Planning »
  - a.w-full.rounded-md — 13px/600 — « Demandes »
  - a.w-full.rounded-md — 13px/600 — « Interventions »
  - a.w-full.rounded-md — 13px/600 — « Absences »

**`vgp` à 1024 px — textes hors échelle (5 premiers) :**

  - span.text-[12.5px].font-bold — 12.5px — « CODIMA Nouvelle-Calédonie »
  - h1.mb-[3px].text-[22px] — 22px — « Registre des vérifications périodiques »
  - div.mt-[4px].mb-[2px] — 27px — « 1 »
  - div.mt-[4px].mb-[2px] — 27px — « 1 »
  - div.mt-[4px].mb-[2px] — 27px — « 2 »

**`vgp` à 1024 px — petits textes légers (5 premiers) :**

  - a.w-full.rounded-md — 13px/600 — « Tableau de bord »
  - a.w-full.rounded-md — 13px/600 — « Planning »
  - a.w-full.rounded-md — 13px/600 — « Demandes »
  - a.w-full.rounded-md — 13px/600 — « Interventions »
  - a.w-full.rounded-md — 13px/600 — « Absences »

**`vgp` à 375 px — cibles sous le seuil (5 premières) :**

  - a.focus:bg-app-surface.focus:text-app-marque — 1×1px — « Aller au contenu »
  - summary.text-app-encre-faible.cursor-pointer — 182×17px — « Voir le motif »
  - summary.text-app-encre-faible.cursor-pointer — 182×17px — « Voir le motif »
  - summary.text-app-encre-faible.cursor-pointer — 182×17px — « Voir le motif »
  - summary.text-app-encre-faible.cursor-pointer — 182×17px — « Voir le motif »

**`vgp` à 375 px — textes hors échelle (5 premiers) :**

  - h1.mb-[3px].text-[22px] — 22px — « Registre des vérifications périodiques »
  - div.mt-[4px].mb-[2px] — 27px — « 1 »
  - div.mt-[4px].mb-[2px] — 27px — « 1 »
  - div.mt-[4px].mb-[2px] — 27px — « 2 »
  - div.mt-[4px].mb-[2px] — 27px — « 1 »

**`vgp` à 375 px — petits textes légers (5 premiers) :**

  - p.text-app-encre-faible.mb-[20px] — 13px/400 — « Ce qu'on nous a dit, et quand on nous l' »
  - div.text-app-encre-faible.text-12 — 12px/400 — « Une échéance déclarée est connue et n'es »
  - a.text-12.text-app-marque — 12px/400 — « Voir les échéances à venir → »
  - div.text-app-encre-faible.text-12 — 12px/400 — « Une date déclarée est dépassée — une dat »
  - a.text-12.text-app-marque — 12px/400 — « Voir les échéances dépassées → »

**`vgp-a-determiner` à 1280 px — textes hors échelle (5 premiers) :**

  - span.text-[12.5px].font-bold — 12.5px — « CODIMA Nouvelle-Calédonie »
  - h1.mb-[3px].text-[22px] — 22px — « Familles à déterminer »
  - a.text-app-encre-faible.text-[12.5px] — 12.5px — « ← Retour au registre »

**`vgp-a-determiner` à 1280 px — petits textes légers (5 premiers) :**

  - a.w-full.rounded-md — 13px/600 — « Tableau de bord »
  - a.w-full.rounded-md — 13px/600 — « Planning »
  - a.w-full.rounded-md — 13px/600 — « Demandes »
  - a.w-full.rounded-md — 13px/600 — « Interventions »
  - a.w-full.rounded-md — 13px/600 — « Absences »

**`vgp-a-determiner` à 1024 px — textes hors échelle (5 premiers) :**

  - span.text-[12.5px].font-bold — 12.5px — « CODIMA Nouvelle-Calédonie »
  - h1.mb-[3px].text-[22px] — 22px — « Familles à déterminer »
  - a.text-app-encre-faible.text-[12.5px] — 12.5px — « ← Retour au registre »

**`vgp-a-determiner` à 1024 px — petits textes légers (5 premiers) :**

  - a.w-full.rounded-md — 13px/600 — « Tableau de bord »
  - a.w-full.rounded-md — 13px/600 — « Planning »
  - a.w-full.rounded-md — 13px/600 — « Demandes »
  - a.w-full.rounded-md — 13px/600 — « Interventions »
  - a.w-full.rounded-md — 13px/600 — « Absences »

**`vgp-a-determiner` à 375 px — cibles sous le seuil (5 premières) :**

  - a.focus:bg-app-surface.focus:text-app-marque — 1×1px — « Aller au contenu »
  - a.text-app-encre-faible.text-[12.5px] — 124×18px — « ← Retour au registre »

**`vgp-a-determiner` à 375 px — textes hors échelle (5 premiers) :**

  - h1.mb-[3px].text-[22px] — 22px — « Familles à déterminer »
  - a.text-app-encre-faible.text-[12.5px] — 12.5px — « ← Retour au registre »

**`vgp-a-determiner` à 375 px — petits textes légers (5 premiers) :**

  - p.text-app-encre-faible.mb-[20px] — 13px/400 — « Une famille naît « à déterminer » : une  »
  - a.text-app-encre-faible.text-[12.5px] — 12.5px/400 — « ← Retour au registre »
  - td.border-app-bord.border-b — 13px/400 — « Outillage d'atelier »
  - td.border-app-bord.border-b — 13px/400 — « 1 »

**`parametres-agences` à 1280 px — textes hors échelle (5 premiers) :**

  - span.text-[12.5px].font-bold — 12.5px — « CODIMA Nouvelle-Calédonie »
  - h1.mb-[3px].text-[22px] — 22px — « Réglage des horaires d'ouverture »
  - a.text-app-encre-faible.text-[12.5px] — 12.5px — « ← Sociétés & tarifs »

**`parametres-agences` à 1280 px — petits textes légers (5 premiers) :**

  - a.w-full.rounded-md — 13px/600 — « Tableau de bord »
  - a.w-full.rounded-md — 13px/600 — « Planning »
  - a.w-full.rounded-md — 13px/600 — « Demandes »
  - a.w-full.rounded-md — 13px/600 — « Interventions »
  - a.w-full.rounded-md — 13px/600 — « Absences »

**`parametres-agences` à 1024 px — textes hors échelle (5 premiers) :**

  - span.text-[12.5px].font-bold — 12.5px — « CODIMA Nouvelle-Calédonie »
  - h1.mb-[3px].text-[22px] — 22px — « Réglage des horaires d'ouverture »
  - a.text-app-encre-faible.text-[12.5px] — 12.5px — « ← Sociétés & tarifs »

**`parametres-agences` à 1024 px — petits textes légers (5 premiers) :**

  - a.w-full.rounded-md — 13px/600 — « Tableau de bord »
  - a.w-full.rounded-md — 13px/600 — « Planning »
  - a.w-full.rounded-md — 13px/600 — « Demandes »
  - a.w-full.rounded-md — 13px/600 — « Interventions »
  - a.w-full.rounded-md — 13px/600 — « Absences »

**`parametres-agences` à 375 px — cibles sous le seuil (5 premières) :**

  - a.focus:bg-app-surface.focus:text-app-marque — 1×1px — « Aller au contenu »
  - a.text-app-encre-faible.text-[12.5px] — 115×18px — « ← Sociétés & tarifs »
  - input#pas-01a0f18e-de2a-7f91-863c-3528ec6e9df2.border-app-bord.bg-app-surface — 80×28px — «  »
  - input#pas-01a0f18e-de2a-7f91-863c-3528ec6e9df2.border-app-bord.bg-app-surface — 80×28px — «  »
  - input#pas-01a0f18e-de34-7f2b-81a0-4d3745d3ff49.border-app-bord.bg-app-surface — 80×28px — «  »

**`parametres-agences` à 375 px — textes hors échelle (5 premiers) :**

  - h1.mb-[3px].text-[22px] — 22px — « Réglage des horaires d'ouverture »
  - a.text-app-encre-faible.text-[12.5px] — 12.5px — « ← Sociétés & tarifs »

**`parametres-agences` à 375 px — petits textes légers (5 premiers) :**

  - p.text-app-encre-faible.mb-[20px] — 13px/400 — « Ce que chaque établissement ouvre aujour »
  - a.text-app-encre-faible.text-[12.5px] — 12.5px/400 — « ← Sociétés & tarifs »
  - a.text-app-marque.underline — 13px/400 — « Nouméa — horaires de démonstration »
  - td.border-app-bord.border-b — 13px/400 — « lundi, mardi, mercredi, jeudi, vendredi, »
  - td.border-app-bord.border-b — 13px/400 — « 07:30–11:30, 13:00–17:00 »

**`parametres-forfaits` à 1280 px — textes hors échelle (5 premiers) :**

  - span.text-[12.5px].font-bold — 12.5px — « CODIMA Nouvelle-Calédonie »
  - h1.mb-[3px].text-[22px] — 22px — « Forfaits applicables »
  - a.text-app-encre-faible.text-[12.5px] — 12.5px — « ← Sociétés & tarifs »
  - button.border-app-bord.rounded-md — 12.5px — « Voir »
  - label.flex.flex-col — 12.5px — « Code »

**`parametres-forfaits` à 1280 px — petits textes légers (5 premiers) :**

  - a.w-full.rounded-md — 13px/600 — « Tableau de bord »
  - a.w-full.rounded-md — 13px/600 — « Planning »
  - a.w-full.rounded-md — 13px/600 — « Demandes »
  - a.w-full.rounded-md — 13px/600 — « Interventions »
  - a.w-full.rounded-md — 13px/600 — « Absences »

**`parametres-forfaits` à 1024 px — textes hors échelle (5 premiers) :**

  - span.text-[12.5px].font-bold — 12.5px — « CODIMA Nouvelle-Calédonie »
  - h1.mb-[3px].text-[22px] — 22px — « Forfaits applicables »
  - a.text-app-encre-faible.text-[12.5px] — 12.5px — « ← Sociétés & tarifs »
  - button.border-app-bord.rounded-md — 12.5px — « Voir »
  - label.flex.flex-col — 12.5px — « Code »

**`parametres-forfaits` à 1024 px — petits textes légers (5 premiers) :**

  - a.w-full.rounded-md — 13px/600 — « Tableau de bord »
  - a.w-full.rounded-md — 13px/600 — « Planning »
  - a.w-full.rounded-md — 13px/600 — « Demandes »
  - a.w-full.rounded-md — 13px/600 — « Interventions »
  - a.w-full.rounded-md — 13px/600 — « Absences »

**`parametres-forfaits` à 375 px — cibles sous le seuil (5 premières) :**

  - a.focus:bg-app-surface.focus:text-app-marque — 1×1px — « Aller au contenu »
  - a.text-app-encre-faible.text-[12.5px] — 115×18px — « ← Sociétés & tarifs »
  - select.border-app-bord.bg-app-surface — 133×31px — « Grand Nouméa Sud Côte Est Côte Ouest Nor »
  - a.border-app-bord.rounded-md — 72×27px — « Modifier »
  - button.border-app-bord.rounded-md — 87×27px — « Désactiver »

**`parametres-forfaits` à 375 px — textes hors échelle (5 premiers) :**

  - h1.mb-[3px].text-[22px] — 22px — « Forfaits applicables »
  - a.text-app-encre-faible.text-[12.5px] — 12.5px — « ← Sociétés & tarifs »
  - button.border-app-bord.rounded-md — 12.5px — « Voir »
  - label.flex.flex-col — 12.5px — « Code »
  - label.flex.flex-col — 12.5px — « Libellé »

**`parametres-forfaits` à 375 px — petits textes légers (5 premiers) :**

  - p.text-app-encre-faible.mb-[20px] — 13px/400 — « Pour une zone donnée, quels forfaits s'a »
  - a.text-app-encre-faible.text-[12.5px] — 12.5px/400 — « ← Sociétés & tarifs »
  - label.text-app-encre-faible.text-[12px] — 12px/600 — « Zone géographique »
  - button.border-app-bord.rounded-md — 12.5px/600 — « Voir »
  - span.tabular-nums — 13px/400 — « 1 »

**`parametres-prestations` à 1280 px — textes hors échelle (5 premiers) :**

  - span.text-[12.5px].font-bold — 12.5px — « CODIMA Nouvelle-Calédonie »
  - h1.mb-[3px].text-[22px] — 22px — « Catalogue des prestations »
  - a.text-app-encre-faible.text-[12.5px] — 12.5px — « ← Sociétés & tarifs »
  - label.min-h-11.min-w-11 — 12.5px — « Active »

**`parametres-prestations` à 1280 px — petits textes légers (5 premiers) :**

  - a.w-full.rounded-md — 13px/600 — « Tableau de bord »
  - a.w-full.rounded-md — 13px/600 — « Planning »
  - a.w-full.rounded-md — 13px/600 — « Demandes »
  - a.w-full.rounded-md — 13px/600 — « Interventions »
  - a.w-full.rounded-md — 13px/600 — « Absences »

**`parametres-prestations` à 1024 px — textes hors échelle (5 premiers) :**

  - span.text-[12.5px].font-bold — 12.5px — « CODIMA Nouvelle-Calédonie »
  - h1.mb-[3px].text-[22px] — 22px — « Catalogue des prestations »
  - a.text-app-encre-faible.text-[12.5px] — 12.5px — « ← Sociétés & tarifs »
  - label.min-h-11.min-w-11 — 12.5px — « Active »

**`parametres-prestations` à 1024 px — petits textes légers (5 premiers) :**

  - a.w-full.rounded-md — 13px/600 — « Tableau de bord »
  - a.w-full.rounded-md — 13px/600 — « Planning »
  - a.w-full.rounded-md — 13px/600 — « Demandes »
  - a.w-full.rounded-md — 13px/600 — « Interventions »
  - a.w-full.rounded-md — 13px/600 — « Absences »

**`parametres-prestations` à 375 px — cibles sous le seuil (5 premières) :**

  - a.focus:bg-app-surface.focus:text-app-marque — 1×1px — « Aller au contenu »
  - a.text-app-encre-faible.text-[12.5px] — 115×18px — « ← Sociétés & tarifs »
  - input#nouvelle-code.border-app-bord.bg-app-surface — 144×28px — «  »
  - input#nouvelle-libelle.border-app-bord.bg-app-surface — 256×28px — «  »
  - select#nouvelle-famille.border-app-bord.bg-app-surface — 179×27px — « Aucune famille Accessoires de levage Com »

**`parametres-prestations` à 375 px — textes hors échelle (5 premiers) :**

  - h1.mb-[3px].text-[22px] — 22px — « Catalogue des prestations »
  - a.text-app-encre-faible.text-[12.5px] — 12.5px — « ← Sociétés & tarifs »
  - label.min-h-11.min-w-11 — 12.5px — « Active »

**`parametres-prestations` à 375 px — petits textes légers (5 premiers) :**

  - p.text-app-encre-faible.mb-[20px] — 13px/400 — « Ce qu'on sait faire, et le temps que cel »
  - a.text-app-encre-faible.text-[12.5px] — 12.5px/400 — « ← Sociétés & tarifs »
  - label.text-app-encre-faible.text-12 — 12px/400 — « Code »
  - label.text-app-encre-faible.text-12 — 12px/400 — « Libellé »
  - label.text-app-encre-faible.text-12 — 12px/400 — « Famille de matériel »

**`demandes` à 1280 px — textes hors échelle (5 premiers) :**

  - span.text-[12.5px].font-bold — 12.5px — « CODIMA Nouvelle-Calédonie »
  - h1.mb-[3px].text-[22px] — 22px — « Demandes »

**`demandes` à 1280 px — petits textes légers (5 premiers) :**

  - a.w-full.rounded-md — 13px/600 — « Tableau de bord »
  - a.w-full.rounded-md — 13px/600 — « Planning »
  - a.w-full.rounded-md — 13px/600 — « Demandes »
  - a.w-full.rounded-md — 13px/600 — « Interventions »
  - a.w-full.rounded-md — 13px/600 — « Absences »

**`demandes` à 1024 px — textes hors échelle (5 premiers) :**

  - span.text-[12.5px].font-bold — 12.5px — « CODIMA Nouvelle-Calédonie »
  - h1.mb-[3px].text-[22px] — 22px — « Demandes »

**`demandes` à 1024 px — petits textes légers (5 premiers) :**

  - a.w-full.rounded-md — 13px/600 — « Tableau de bord »
  - a.w-full.rounded-md — 13px/600 — « Planning »
  - a.w-full.rounded-md — 13px/600 — « Demandes »
  - a.w-full.rounded-md — 13px/600 — « Interventions »
  - a.w-full.rounded-md — 13px/600 — « Absences »

**`demandes` à 375 px — cibles sous le seuil (5 premières) :**

  - a.focus:bg-app-surface.focus:text-app-marque — 1×1px — « Aller au contenu »

**`demandes` à 375 px — textes hors échelle (5 premiers) :**

  - h1.mb-[3px].text-[22px] — 22px — « Demandes »

**`demandes` à 375 px — petits textes légers (5 premiers) :**

  - p.text-app-encre-faible.mb-[20px] — 13px/400 — « Les demandes ouvertes, de la plus ancien »
  - td.border-app-bord.text-app-encre-faible — 13px/400 — « Aucune demande en attente de qualificati »

**`parc-detail` à 1280 px — textes hors échelle (5 premiers) :**

  - span.text-[12.5px].font-bold — 12.5px — « CODIMA Nouvelle-Calédonie »
  - h1.mb-[3px].text-[22px] — 22px — « Fiche machine »
  - div.bg-app-bleu-fond.text-app-marque — 26px — « M »
  - h2.mt-[3px].mb-[7px] — 22px — « Atlas Copco GA-11 »
  - p.text-app-encre-faible.mt-[3px] — 12.5px — « Ceux de cette machine, et ceux de son mo »

**`parc-detail` à 1280 px — petits textes légers (5 premiers) :**

  - a.w-full.rounded-md — 13px/600 — « Tableau de bord »
  - a.w-full.rounded-md — 13px/600 — « Planning »
  - a.w-full.rounded-md — 13px/600 — « Demandes »
  - a.w-full.rounded-md — 13px/600 — « Interventions »
  - a.w-full.rounded-md — 13px/600 — « Absences »

**`parc-detail` à 1024 px — textes hors échelle (5 premiers) :**

  - span.text-[12.5px].font-bold — 12.5px — « CODIMA Nouvelle-Calédonie »
  - h1.mb-[3px].text-[22px] — 22px — « Fiche machine »
  - div.bg-app-bleu-fond.text-app-marque — 26px — « M »
  - h2.mt-[3px].mb-[7px] — 22px — « Atlas Copco GA-11 »
  - p.text-app-encre-faible.mt-[3px] — 12.5px — « Ceux de cette machine, et ceux de son mo »

**`parc-detail` à 1024 px — petits textes légers (5 premiers) :**

  - a.w-full.rounded-md — 13px/600 — « Tableau de bord »
  - a.w-full.rounded-md — 13px/600 — « Planning »
  - a.w-full.rounded-md — 13px/600 — « Demandes »
  - a.w-full.rounded-md — 13px/600 — « Interventions »
  - a.w-full.rounded-md — 13px/600 — « Absences »

**`parc-detail` à 375 px — cibles sous le seuil (5 premières) :**

  - a.focus:bg-app-surface.focus:text-app-marque — 1×1px — « Aller au contenu »

**`parc-detail` à 375 px — textes hors échelle (5 premiers) :**

  - h1.mb-[3px].text-[22px] — 22px — « Fiche machine »
  - div.bg-app-bleu-fond.text-app-marque — 26px — « M »
  - h2.mt-[3px].mb-[7px] — 22px — « Atlas Copco GA-11 »
  - p.text-app-encre-faible.mt-[3px] — 12.5px — « Ceux de cette machine, et ceux de son mo »

**`parc-detail` à 375 px — petits textes légers (5 premiers) :**

  - p.text-app-encre-faible.mb-[20px] — 13px/400 — « Atelier Ducos · Atelier principal — Noum »
  - a.text-app-encre-faible.inline-flex — 13px/400 — « ← Retour au parc »
  - div.text-app-encre-faible.font-mono — 12px/400 — « Local-000008 »
  - td.border-app-bord.text-app-encre-faible — 13px/400 — « Aucune intervention enregistrée pour cet »
  - p.text-app-encre-faible.mt-[3px] — 12.5px/400 — « Ceux de cette machine, et ceux de son mo »

**`site-detail` à 1280 px — textes hors échelle (5 premiers) :**

  - span.text-[12.5px].font-bold — 12.5px — « CODIMA Nouvelle-Calédonie »
  - h1.mb-[3px].text-[22px] — 22px — « Atelier principal »
  - a.text-app-encre-faible.text-[12.5px] — 12.5px — « ← Tous les sites »
  - p.text-app-encre-faible.text-[12.5px] — 12.5px — « Aucune habilitation exigée. »
  - label.flex.items-center — 12.5px — « Bloquante »

**`site-detail` à 1280 px — petits textes légers (5 premiers) :**

  - a.w-full.rounded-md — 13px/600 — « Tableau de bord »
  - a.w-full.rounded-md — 13px/600 — « Planning »
  - a.w-full.rounded-md — 13px/600 — « Demandes »
  - a.w-full.rounded-md — 13px/600 — « Interventions »
  - a.w-full.rounded-md — 13px/600 — « Absences »

**`site-detail` à 1024 px — textes hors échelle (5 premiers) :**

  - span.text-[12.5px].font-bold — 12.5px — « CODIMA Nouvelle-Calédonie »
  - h1.mb-[3px].text-[22px] — 22px — « Atelier principal »
  - a.text-app-encre-faible.text-[12.5px] — 12.5px — « ← Tous les sites »
  - p.text-app-encre-faible.text-[12.5px] — 12.5px — « Aucune habilitation exigée. »
  - label.flex.items-center — 12.5px — « Bloquante »

**`site-detail` à 1024 px — petits textes légers (5 premiers) :**

  - a.w-full.rounded-md — 13px/600 — « Tableau de bord »
  - a.w-full.rounded-md — 13px/600 — « Planning »
  - a.w-full.rounded-md — 13px/600 — « Demandes »
  - a.w-full.rounded-md — 13px/600 — « Interventions »
  - a.w-full.rounded-md — 13px/600 — « Absences »

**`site-detail` à 375 px — cibles sous le seuil (5 premières) :**

  - a.focus:bg-app-surface.focus:text-app-marque — 1×1px — « Aller au contenu »
  - a.text-app-marque.underline — 41×17px — « Clients »
  - a.text-app-marque.underline — 79×17px — « Atelier Ducos »
  - a.text-app-encre-faible.text-[12.5px] — 99×18px — « ← Tous les sites »
  - select#0192f0a0-4000-7000-8000-000000000001-habilitation.border-app-bord.bg-app-surface — 208×27px — « Sélectionner une habilitation B0 B1V B2V »

**`site-detail` à 375 px — textes hors échelle (5 premiers) :**

  - h1.mb-[3px].text-[22px] — 22px — « Atelier principal »
  - a.text-app-encre-faible.text-[12.5px] — 12.5px — « ← Tous les sites »
  - p.text-app-encre-faible.text-[12.5px] — 12.5px — « Aucune habilitation exigée. »
  - label.flex.items-center — 12.5px — « Bloquante »
  - p.text-app-encre-faible.text-[12.5px] — 12.5px — « Aucun interlocuteur n'est enregistré pou »

**`site-detail` à 375 px — petits textes légers (5 premiers) :**

  - a.text-app-marque.underline — 12px/400 — « Clients »
  - span — 12px/400 — « › »
  - a.text-app-marque.underline — 12px/400 — « Atelier Ducos »
  - span — 12px/400 — « › »
  - span — 12px/400 — « Atelier principal »

**`site-creation` à 1280 px — textes hors échelle (5 premiers) :**

  - span.text-[12.5px].font-bold — 12.5px — « CODIMA Nouvelle-Calédonie »
  - h1.mb-[3px].text-[22px] — 22px — « Nouveau site »
  - a.text-app-encre-faible.text-[12.5px] — 12.5px — « ← Tous les sites »
  - label.relative.flex — 12.5px — « Client »
  - label.flex.flex-col — 12.5px — « Agence — Rattachement Dolbeau — DOLBEAU  »

**`site-creation` à 1280 px — petits textes légers (5 premiers) :**

  - a.w-full.rounded-md — 13px/600 — « Tableau de bord »
  - a.w-full.rounded-md — 13px/600 — « Planning »
  - a.w-full.rounded-md — 13px/600 — « Demandes »
  - a.w-full.rounded-md — 13px/600 — « Interventions »
  - a.w-full.rounded-md — 13px/600 — « Absences »

**`site-creation` à 1024 px — textes hors échelle (5 premiers) :**

  - span.text-[12.5px].font-bold — 12.5px — « CODIMA Nouvelle-Calédonie »
  - h1.mb-[3px].text-[22px] — 22px — « Nouveau site »
  - a.text-app-encre-faible.text-[12.5px] — 12.5px — « ← Tous les sites »
  - label.relative.flex — 12.5px — « Client »
  - label.flex.flex-col — 12.5px — « Agence — Rattachement Dolbeau — DOLBEAU  »

**`site-creation` à 1024 px — petits textes légers (5 premiers) :**

  - a.w-full.rounded-md — 13px/600 — « Tableau de bord »
  - a.w-full.rounded-md — 13px/600 — « Planning »
  - a.w-full.rounded-md — 13px/600 — « Demandes »
  - a.w-full.rounded-md — 13px/600 — « Interventions »
  - a.w-full.rounded-md — 13px/600 — « Absences »

**`site-creation` à 375 px — cibles sous le seuil (5 premières) :**

  - a.focus:bg-app-surface.focus:text-app-marque — 1×1px — « Aller au contenu »
  - a.text-app-encre-faible.text-[12.5px] — 99×18px — « ← Tous les sites »

**`site-creation` à 375 px — textes hors échelle (5 premiers) :**

  - h1.mb-[3px].text-[22px] — 22px — « Nouveau site »
  - a.text-app-encre-faible.text-[12.5px] — 12.5px — « ← Tous les sites »
  - label.relative.flex — 12.5px — « Client »
  - label.flex.flex-col — 12.5px — « Agence — Rattachement Dolbeau — DOLBEAU  »
  - label.flex.flex-col — 12.5px — « Libellé »

**`site-creation` à 375 px — petits textes légers (5 premiers) :**

  - a.text-app-encre-faible.text-[12.5px] — 12.5px/400 — « ← Tous les sites »
  - label.relative.flex — 12.5px/600 — « Client »
  - label.flex.flex-col — 12.5px/600 — « Agence — Rattachement Dolbeau — DOLBEAU  »
  - label.flex.flex-col — 12.5px/600 — « Libellé »
  - label.flex.flex-col — 12.5px/600 — « Commune »

**`parametres-equipe` à 1280 px — textes hors échelle (5 premiers) :**

  - span.text-[12.5px].font-bold — 12.5px — « CODIMA Nouvelle-Calédonie »
  - h1.mb-[3px].text-[22px] — 22px — « Équipe »
  - a.text-app-encre-faible.text-[12.5px] — 12.5px — « ← Sociétés & tarifs »
  - label.min-h-11.min-w-11 — 12.5px — « Actif »
  - label.min-h-11.min-w-11 — 12.5px — «  »

**`parametres-equipe` à 1280 px — petits textes légers (5 premiers) :**

  - a.w-full.rounded-md — 13px/600 — « Tableau de bord »
  - a.w-full.rounded-md — 13px/600 — « Planning »
  - a.w-full.rounded-md — 13px/600 — « Demandes »
  - a.w-full.rounded-md — 13px/600 — « Interventions »
  - a.w-full.rounded-md — 13px/600 — « Absences »

**`parametres-equipe` à 1024 px — textes hors échelle (5 premiers) :**

  - span.text-[12.5px].font-bold — 12.5px — « CODIMA Nouvelle-Calédonie »
  - h1.mb-[3px].text-[22px] — 22px — « Équipe »
  - a.text-app-encre-faible.text-[12.5px] — 12.5px — « ← Sociétés & tarifs »
  - label.min-h-11.min-w-11 — 12.5px — « Actif »
  - label.min-h-11.min-w-11 — 12.5px — «  »

**`parametres-equipe` à 1024 px — petits textes légers (5 premiers) :**

  - a.w-full.rounded-md — 13px/600 — « Tableau de bord »
  - a.w-full.rounded-md — 13px/600 — « Planning »
  - a.w-full.rounded-md — 13px/600 — « Demandes »
  - a.w-full.rounded-md — 13px/600 — « Interventions »
  - a.w-full.rounded-md — 13px/600 — « Absences »

**`parametres-equipe` à 375 px — cibles sous le seuil (5 premières) :**

  - a.focus:bg-app-surface.focus:text-app-marque — 1×1px — « Aller au contenu »
  - a.text-app-encre-faible.text-[12.5px] — 115×18px — « ← Sociétés & tarifs »
  - input#nouveau-nom.border-app-bord.bg-app-surface — 224×28px — «  »
  - input#nouveau-email.border-app-bord.bg-app-surface — 224×28px — «  »
  - select#nouveau-agence.border-app-bord.bg-app-surface — 215×27px — « Sélectionner un rattachement Dolbeau — D »

**`parametres-equipe` à 375 px — textes hors échelle (5 premiers) :**

  - h1.mb-[3px].text-[22px] — 22px — « Équipe »
  - a.text-app-encre-faible.text-[12.5px] — 12.5px — « ← Sociétés & tarifs »
  - label.min-h-11.min-w-11 — 12.5px — « Actif »
  - label.min-h-11.min-w-11 — 12.5px — «  »
  - label.min-h-11.min-w-11 — 12.5px — «  »

**`parametres-equipe` à 375 px — petits textes légers (5 premiers) :**

  - p.text-app-encre-faible.mb-[20px] — 13px/400 — « Les techniciens de la société active : c »
  - a.text-app-encre-faible.text-[12.5px] — 12.5px/400 — « ← Sociétés & tarifs »
  - label.text-app-encre-faible.text-12 — 12px/400 — « Nom »
  - label.text-app-encre-faible.text-12 — 12px/400 — « Courriel »
  - label.text-app-encre-faible.text-12 — 12px/400 — « Agence de rattachement »

**`parametres-materiel` à 1280 px — textes hors échelle (5 premiers) :**

  - span.text-[12.5px].font-bold — 12.5px — « CODIMA Nouvelle-Calédonie »
  - h1.mb-[3px].text-[22px] — 22px — « Référentiel matériel »
  - a.text-app-encre-faible.text-[12.5px] — 12.5px — « ← Sociétés & tarifs »
  - label.min-h-11.min-w-11 — 12.5px — « Actif »
  - label.min-h-11.min-w-11 — 12.5px — «  »

**`parametres-materiel` à 1280 px — petits textes légers (5 premiers) :**

  - a.w-full.rounded-md — 13px/600 — « Tableau de bord »
  - a.w-full.rounded-md — 13px/600 — « Planning »
  - a.w-full.rounded-md — 13px/600 — « Demandes »
  - a.w-full.rounded-md — 13px/600 — « Interventions »
  - a.w-full.rounded-md — 13px/600 — « Absences »

**`parametres-materiel` à 1024 px — textes hors échelle (5 premiers) :**

  - span.text-[12.5px].font-bold — 12.5px — « CODIMA Nouvelle-Calédonie »
  - h1.mb-[3px].text-[22px] — 22px — « Référentiel matériel »
  - a.text-app-encre-faible.text-[12.5px] — 12.5px — « ← Sociétés & tarifs »
  - label.min-h-11.min-w-11 — 12.5px — « Actif »
  - label.min-h-11.min-w-11 — 12.5px — «  »

**`parametres-materiel` à 1024 px — petits textes légers (5 premiers) :**

  - a.w-full.rounded-md — 13px/600 — « Tableau de bord »
  - a.w-full.rounded-md — 13px/600 — « Planning »
  - a.w-full.rounded-md — 13px/600 — « Demandes »
  - a.w-full.rounded-md — 13px/600 — « Interventions »
  - a.w-full.rounded-md — 13px/600 — « Absences »

**`parametres-materiel` à 375 px — cibles sous le seuil (5 premières) :**

  - a.focus:bg-app-surface.focus:text-app-marque — 1×1px — « Aller au contenu »
  - a.text-app-encre-faible.text-[12.5px] — 115×18px — « ← Sociétés & tarifs »
  - input#nouveau-code.border-app-bord.bg-app-surface — 144×28px — «  »
  - input#nouveau-libelle.border-app-bord.bg-app-surface — 256×28px — «  »
  - input — 13×13px — «  »

**`parametres-materiel` à 375 px — textes hors échelle (5 premiers) :**

  - h1.mb-[3px].text-[22px] — 22px — « Référentiel matériel »
  - a.text-app-encre-faible.text-[12.5px] — 12.5px — « ← Sociétés & tarifs »
  - label.min-h-11.min-w-11 — 12.5px — « Actif »
  - label.min-h-11.min-w-11 — 12.5px — «  »
  - label.min-h-11.min-w-11 — 12.5px — «  »

**`parametres-materiel` à 375 px — petits textes légers (5 premiers) :**

  - p.text-app-encre-faible.mb-[20px] — 13px/400 — « Les familles et les modèles que le parc  »
  - a.text-app-encre-faible.text-[12.5px] — 12.5px/400 — « ← Sociétés & tarifs »
  - label.text-app-encre-faible.text-12 — 12px/400 — « Code »
  - label.text-app-encre-faible.text-12 — 12px/400 — « Libellé »
  - label.min-h-11.min-w-11 — 12.5px/400 — « Actif »

**`parametres-habilitations` à 1280 px — textes hors échelle (5 premiers) :**

  - span.text-[12.5px].font-bold — 12.5px — « CODIMA Nouvelle-Calédonie »
  - h1.mb-[3px].text-[22px] — 22px — « Habilitations »
  - a.text-app-encre-faible.text-[12.5px] — 12.5px — « ← Sociétés & tarifs »
  - label.min-h-11.min-w-11 — 12.5px — «  »
  - label.min-h-11.min-w-11 — 12.5px — «  »

**`parametres-habilitations` à 1280 px — petits textes légers (5 premiers) :**

  - a.w-full.rounded-md — 13px/600 — « Tableau de bord »
  - a.w-full.rounded-md — 13px/600 — « Planning »
  - a.w-full.rounded-md — 13px/600 — « Demandes »
  - a.w-full.rounded-md — 13px/600 — « Interventions »
  - a.w-full.rounded-md — 13px/600 — « Absences »

**`parametres-habilitations` à 1024 px — textes hors échelle (5 premiers) :**

  - span.text-[12.5px].font-bold — 12.5px — « CODIMA Nouvelle-Calédonie »
  - h1.mb-[3px].text-[22px] — 22px — « Habilitations »
  - a.text-app-encre-faible.text-[12.5px] — 12.5px — « ← Sociétés & tarifs »
  - label.min-h-11.min-w-11 — 12.5px — «  »
  - label.min-h-11.min-w-11 — 12.5px — «  »

**`parametres-habilitations` à 1024 px — petits textes légers (5 premiers) :**

  - a.w-full.rounded-md — 13px/600 — « Tableau de bord »
  - a.w-full.rounded-md — 13px/600 — « Planning »
  - a.w-full.rounded-md — 13px/600 — « Demandes »
  - a.w-full.rounded-md — 13px/600 — « Interventions »
  - a.w-full.rounded-md — 13px/600 — « Absences »

**`parametres-habilitations` à 375 px — cibles sous le seuil (5 premières) :**

  - a.focus:bg-app-surface.focus:text-app-marque — 1×1px — « Aller au contenu »
  - a.text-app-encre-faible.text-[12.5px] — 115×18px — « ← Sociétés & tarifs »
  - input#nouvelle-code.border-app-bord.bg-app-surface — 144×28px — «  »
  - input#nouvelle-libelle.border-app-bord.bg-app-surface — 256×28px — «  »
  - input#nouvelle-duree.border-app-bord.bg-app-surface — 144×28px — «  »

**`parametres-habilitations` à 375 px — textes hors échelle (5 premiers) :**

  - h1.mb-[3px].text-[22px] — 22px — « Habilitations »
  - a.text-app-encre-faible.text-[12.5px] — 12.5px — « ← Sociétés & tarifs »
  - label.min-h-11.min-w-11 — 12.5px — «  »
  - label.min-h-11.min-w-11 — 12.5px — «  »
  - label.min-h-11.min-w-11 — 12.5px — «  »

**`parametres-habilitations` à 375 px — petits textes légers (5 premiers) :**

  - p.text-app-encre-faible.mb-[20px] — 13px/400 — « Le référentiel des qualifications requis »
  - a.text-app-encre-faible.text-[12.5px] — 12.5px/400 — « ← Sociétés & tarifs »
  - label.text-app-encre-faible.text-12 — 12px/400 — « Code »
  - label.text-app-encre-faible.text-12 — 12px/400 — « Libellé »
  - label.text-app-encre-faible.text-12 — 12px/400 — « Durée de validité (mois) »

**`parametres-societe` à 1280 px — textes hors échelle (5 premiers) :**

  - span.text-[12.5px].font-bold — 12.5px — « CODIMA Nouvelle-Calédonie »
  - h1.mb-[3px].text-[22px] — 22px — « Charte de la société »
  - a.text-app-encre-faible.text-[12.5px] — 12.5px — « ← Sociétés & tarifs »
  - p.text-app-encre-faible.text-[12.5px] — 12.5px — « Distingue une société qui a choisi ses p »

**`parametres-societe` à 1280 px — petits textes légers (5 premiers) :**

  - a.w-full.rounded-md — 13px/600 — « Tableau de bord »
  - a.w-full.rounded-md — 13px/600 — « Planning »
  - a.w-full.rounded-md — 13px/600 — « Demandes »
  - a.w-full.rounded-md — 13px/600 — « Interventions »
  - a.w-full.rounded-md — 13px/600 — « Absences »

**`parametres-societe` à 1024 px — textes hors échelle (5 premiers) :**

  - span.text-[12.5px].font-bold — 12.5px — « CODIMA Nouvelle-Calédonie »
  - h1.mb-[3px].text-[22px] — 22px — « Charte de la société »
  - a.text-app-encre-faible.text-[12.5px] — 12.5px — « ← Sociétés & tarifs »
  - p.text-app-encre-faible.text-[12.5px] — 12.5px — « Distingue une société qui a choisi ses p »

**`parametres-societe` à 1024 px — petits textes légers (5 premiers) :**

  - a.w-full.rounded-md — 13px/600 — « Tableau de bord »
  - a.w-full.rounded-md — 13px/600 — « Planning »
  - a.w-full.rounded-md — 13px/600 — « Demandes »
  - a.w-full.rounded-md — 13px/600 — « Interventions »
  - a.w-full.rounded-md — 13px/600 — « Absences »

**`parametres-societe` à 375 px — cibles sous le seuil (5 premières) :**

  - a.focus:bg-app-surface.focus:text-app-marque — 1×1px — « Aller au contenu »
  - a.text-app-encre-faible.text-[12.5px] — 115×18px — « ← Sociétés & tarifs »

**`parametres-societe` à 375 px — textes hors échelle (5 premiers) :**

  - h1.mb-[3px].text-[22px] — 22px — « Charte de la société »
  - a.text-app-encre-faible.text-[12.5px] — 12.5px — « ← Sociétés & tarifs »
  - p.text-app-encre-faible.text-[12.5px] — 12.5px — « Distingue une société qui a choisi ses p »

**`parametres-societe` à 375 px — petits textes légers (5 premiers) :**

  - p.text-app-encre-faible.mb-[20px] — 13px/400 — « L'identité affichée de la société active »
  - a.text-app-encre-faible.text-[12.5px] — 12.5px/400 — « ← Sociétés & tarifs »
  - span.bg-societe-accent.text-societe-accent-encre — 12px/600 — « Charte de la société »
  - p.text-app-encre-faible.text-[12.5px] — 12.5px/400 — « Distingue une société qui a choisi ses p »
  - p.text-app-encre-faible.text-12 — 12px/400 — « Les couleurs se règlent depuis la consol »

**`agence-detail` à 1280 px — textes hors échelle (5 premiers) :**

  - span.text-[12.5px].font-bold — 12.5px — « CODIMA Nouvelle-Calédonie »
  - h1.mb-[3px].text-[22px] — 22px — « Horaires d'ouverture — Nouméa — horaires »
  - p.text-app-encre-faible.text-[12.5px] — 12.5px — « Pas des créneaux : 30 »
  - p.border-app-bord.bg-app-surface — 12.5px — « Ce que ce réglage change, et ce qu'il ne »

**`agence-detail` à 1280 px — petits textes légers (5 premiers) :**

  - a.w-full.rounded-md — 13px/600 — « Tableau de bord »
  - a.w-full.rounded-md — 13px/600 — « Planning »
  - a.w-full.rounded-md — 13px/600 — « Demandes »
  - a.w-full.rounded-md — 13px/600 — « Interventions »
  - a.w-full.rounded-md — 13px/600 — « Absences »

**`agence-detail` à 1024 px — textes hors échelle (5 premiers) :**

  - span.text-[12.5px].font-bold — 12.5px — « CODIMA Nouvelle-Calédonie »
  - h1.mb-[3px].text-[22px] — 22px — « Horaires d'ouverture — Nouméa — horaires »
  - p.text-app-encre-faible.text-[12.5px] — 12.5px — « Pas des créneaux : 30 »
  - p.border-app-bord.bg-app-surface — 12.5px — « Ce que ce réglage change, et ce qu'il ne »

**`agence-detail` à 1024 px — petits textes légers (5 premiers) :**

  - a.w-full.rounded-md — 13px/600 — « Tableau de bord »
  - a.w-full.rounded-md — 13px/600 — « Planning »
  - a.w-full.rounded-md — 13px/600 — « Demandes »
  - a.w-full.rounded-md — 13px/600 — « Interventions »
  - a.w-full.rounded-md — 13px/600 — « Absences »

**`agence-detail` à 375 px — cibles sous le seuil (5 premières) :**

  - a.focus:bg-app-surface.focus:text-app-marque — 1×1px — « Aller au contenu »
  - a.text-app-marque.underline — 181×20px — « Revenir aux établissements »
  - input#debut-01a0f18e-de2c-7b24-997d-51212a82f817.border-app-bord.bg-app-surface — 112×29px — «  »
  - input#fin-01a0f18e-de2c-7b24-997d-51212a82f817.border-app-bord.bg-app-surface — 112×29px — «  »
  - input#debut-01a0f18e-de2d-795f-8598-7b07e8f8b109.border-app-bord.bg-app-surface — 112×29px — «  »

**`agence-detail` à 375 px — textes hors échelle (5 premiers) :**

  - h1.mb-[3px].text-[22px] — 22px — « Horaires d'ouverture — Nouméa — horaires »
  - p.text-app-encre-faible.text-[12.5px] — 12.5px — « Pas des créneaux : 30 »
  - p.border-app-bord.bg-app-surface — 12.5px — « Ce que ce réglage change, et ce qu'il ne »

**`agence-detail` à 375 px — petits textes légers (5 premiers) :**

  - p.text-app-encre-faible.mb-[20px] — 13px/400 — « Chaque jour ouvre par une ou plusieurs p »
  - p.text-app-encre-faible.text-[12.5px] — 12.5px/400 — « Pas des créneaux : 30 »
  - p.border-app-bord.bg-app-surface — 12.5px/400 — « Ce que ce réglage change, et ce qu'il ne »
  - p.text-app-encre-faible.text-12 — 12px/400 — « Créneaux proposés : 07:30 → 16:30 (16) »
  - label.text-app-encre-faible.text-12 — 12px/400 — « Ouverture »

**`agence-creation` à 1280 px — textes hors échelle (5 premiers) :**

  - span.text-[12.5px].font-bold — 12.5px — « CODIMA Nouvelle-Calédonie »
  - h1.mb-[3px].text-[22px] — 22px — « Nouvel établissement »
  - a.text-app-encre-faible.text-[12.5px] — 12.5px — « ← Tous les établissements »
  - p.border-app-bord.bg-app-surface — 12.5px — « Le calendrier créé avec cet établissemen »
  - label.flex.flex-col — 12.5px — « Code Repère unique dans la société, util »

**`agence-creation` à 1280 px — petits textes légers (5 premiers) :**

  - a.w-full.rounded-md — 13px/600 — « Tableau de bord »
  - a.w-full.rounded-md — 13px/600 — « Planning »
  - a.w-full.rounded-md — 13px/600 — « Demandes »
  - a.w-full.rounded-md — 13px/600 — « Interventions »
  - a.w-full.rounded-md — 13px/600 — « Absences »

**`agence-creation` à 1024 px — textes hors échelle (5 premiers) :**

  - span.text-[12.5px].font-bold — 12.5px — « CODIMA Nouvelle-Calédonie »
  - h1.mb-[3px].text-[22px] — 22px — « Nouvel établissement »
  - a.text-app-encre-faible.text-[12.5px] — 12.5px — « ← Tous les établissements »
  - p.border-app-bord.bg-app-surface — 12.5px — « Le calendrier créé avec cet établissemen »
  - label.flex.flex-col — 12.5px — « Code Repère unique dans la société, util »

**`agence-creation` à 1024 px — petits textes légers (5 premiers) :**

  - a.w-full.rounded-md — 13px/600 — « Tableau de bord »
  - a.w-full.rounded-md — 13px/600 — « Planning »
  - a.w-full.rounded-md — 13px/600 — « Demandes »
  - a.w-full.rounded-md — 13px/600 — « Interventions »
  - a.w-full.rounded-md — 13px/600 — « Absences »

**`agence-creation` à 375 px — cibles sous le seuil (5 premières) :**

  - a.focus:bg-app-surface.focus:text-app-marque — 1×1px — « Aller au contenu »
  - a.text-app-encre-faible.text-[12.5px] — 162×18px — « ← Tous les établissements »

**`agence-creation` à 375 px — textes hors échelle (5 premiers) :**

  - h1.mb-[3px].text-[22px] — 22px — « Nouvel établissement »
  - a.text-app-encre-faible.text-[12.5px] — 12.5px — « ← Tous les établissements »
  - p.border-app-bord.bg-app-surface — 12.5px — « Le calendrier créé avec cet établissemen »
  - label.flex.flex-col — 12.5px — « Code Repère unique dans la société, util »
  - label.flex.flex-col — 12.5px — « Agence »

**`agence-creation` à 375 px — petits textes légers (5 premiers) :**

  - a.text-app-encre-faible.text-[12.5px] — 12.5px/400 — « ← Tous les établissements »
  - p.border-app-bord.bg-app-surface — 12.5px/400 — « Le calendrier créé avec cet établissemen »
  - label.flex.flex-col — 12.5px/600 — « Code Repère unique dans la société, util »
  - span.text-app-encre-faible.text-12 — 12px/400 — « Repère unique dans la société, utilisé n »
  - label.flex.flex-col — 12.5px/600 — « Agence »

**`agence-modification` à 1280 px — textes hors échelle (5 premiers) :**

  - span.text-[12.5px].font-bold — 12.5px — « CODIMA Nouvelle-Calédonie »
  - h1.mb-[3px].text-[22px] — 22px — « Modifier un établissement »
  - a.text-app-encre-faible.text-[12.5px] — 12.5px — « ← Tous les établissements »
  - p.border-app-bord.bg-app-surface — 12.5px — « Les horaires se règlent à part : Régler  »
  - a.text-app-marque.underline — 12.5px — « Régler les horaires »

**`agence-modification` à 1280 px — petits textes légers (5 premiers) :**

  - a.w-full.rounded-md — 13px/600 — « Tableau de bord »
  - a.w-full.rounded-md — 13px/600 — « Planning »
  - a.w-full.rounded-md — 13px/600 — « Demandes »
  - a.w-full.rounded-md — 13px/600 — « Interventions »
  - a.w-full.rounded-md — 13px/600 — « Absences »

**`agence-modification` à 1024 px — textes hors échelle (5 premiers) :**

  - span.text-[12.5px].font-bold — 12.5px — « CODIMA Nouvelle-Calédonie »
  - h1.mb-[3px].text-[22px] — 22px — « Modifier un établissement »
  - a.text-app-encre-faible.text-[12.5px] — 12.5px — « ← Tous les établissements »
  - p.border-app-bord.bg-app-surface — 12.5px — « Les horaires se règlent à part : Régler  »
  - a.text-app-marque.underline — 12.5px — « Régler les horaires »

**`agence-modification` à 1024 px — petits textes légers (5 premiers) :**

  - a.w-full.rounded-md — 13px/600 — « Tableau de bord »
  - a.w-full.rounded-md — 13px/600 — « Planning »
  - a.w-full.rounded-md — 13px/600 — « Demandes »
  - a.w-full.rounded-md — 13px/600 — « Interventions »
  - a.w-full.rounded-md — 13px/600 — « Absences »

**`agence-modification` à 375 px — cibles sous le seuil (5 premières) :**

  - a.focus:bg-app-surface.focus:text-app-marque — 1×1px — « Aller au contenu »
  - a.text-app-encre-faible.text-[12.5px] — 162×18px — « ← Tous les établissements »
  - input — 13×13px — «  »

**`agence-modification` à 375 px — textes hors échelle (5 premiers) :**

  - h1.mb-[3px].text-[22px] — 22px — « Modifier un établissement »
  - a.text-app-encre-faible.text-[12.5px] — 12.5px — « ← Tous les établissements »
  - p.border-app-bord.bg-app-surface — 12.5px — « Les horaires se règlent à part : Régler  »
  - a.text-app-marque.underline — 12.5px — « Régler les horaires »
  - div.flex.flex-col — 12.5px — « Code DOLBEAU »

**`agence-modification` à 375 px — petits textes légers (5 premiers) :**

  - a.text-app-encre-faible.text-[12.5px] — 12.5px/400 — « ← Tous les établissements »
  - p.border-app-bord.bg-app-surface — 12.5px/400 — « Les horaires se règlent à part : Régler  »
  - a.text-app-marque.underline — 12.5px/400 — « Régler les horaires »
  - div.flex.flex-col — 12.5px/600 — « Code DOLBEAU »
  - p.text-app-encre-faible.text-[13px] — 13px/400 — « DOLBEAU »

**`forfait-detail` à 1280 px — textes hors échelle (5 premiers) :**

  - span.text-[12.5px].font-bold — 12.5px — « CODIMA Nouvelle-Calédonie »
  - h1.mb-[3px].text-[22px] — 22px — « Déplacement (démonstration) »
  - a.text-app-encre-faible.text-[12.5px] — 12.5px — « ← Retour au catalogue »
  - label.flex.flex-col — 12.5px — « Code »
  - label.flex.flex-col — 12.5px — « Libellé »

**`forfait-detail` à 1280 px — petits textes légers (5 premiers) :**

  - a.w-full.rounded-md — 13px/600 — « Tableau de bord »
  - a.w-full.rounded-md — 13px/600 — « Planning »
  - a.w-full.rounded-md — 13px/600 — « Demandes »
  - a.w-full.rounded-md — 13px/600 — « Interventions »
  - a.w-full.rounded-md — 13px/600 — « Absences »

**`forfait-detail` à 1024 px — textes hors échelle (5 premiers) :**

  - span.text-[12.5px].font-bold — 12.5px — « CODIMA Nouvelle-Calédonie »
  - h1.mb-[3px].text-[22px] — 22px — « Déplacement (démonstration) »
  - a.text-app-encre-faible.text-[12.5px] — 12.5px — « ← Retour au catalogue »
  - label.flex.flex-col — 12.5px — « Code »
  - label.flex.flex-col — 12.5px — « Libellé »

**`forfait-detail` à 1024 px — petits textes légers (5 premiers) :**

  - a.w-full.rounded-md — 13px/600 — « Tableau de bord »
  - a.w-full.rounded-md — 13px/600 — « Planning »
  - a.w-full.rounded-md — 13px/600 — « Demandes »
  - a.w-full.rounded-md — 13px/600 — « Interventions »
  - a.w-full.rounded-md — 13px/600 — « Absences »

**`forfait-detail` à 375 px — cibles sous le seuil (5 premières) :**

  - a.focus:bg-app-surface.focus:text-app-marque — 1×1px — « Aller au contenu »
  - a.text-app-encre-faible.text-[12.5px] — 135×18px — « ← Retour au catalogue »
  - input — 13×13px — «  »
  - input — 13×13px — «  »
  - button.bg-app-marque.text-app-marque-encre — 104×31px — « Enregistrer »

**`forfait-detail` à 375 px — textes hors échelle (5 premiers) :**

  - h1.mb-[3px].text-[22px] — 22px — « Déplacement (démonstration) »
  - a.text-app-encre-faible.text-[12.5px] — 12.5px — « ← Retour au catalogue »
  - label.flex.flex-col — 12.5px — « Code »
  - label.flex.flex-col — 12.5px — « Libellé »
  - label.flex.flex-col — 12.5px — « Type Déplacement Mise en service Contrôl »

**`forfait-detail` à 375 px — petits textes légers (5 premiers) :**

  - p.text-app-encre-faible.mb-[20px] — 13px/400 — « DEPL-DEMO »
  - a.text-app-encre-faible.text-[12.5px] — 12.5px/400 — « ← Retour au catalogue »
  - label.flex.flex-col — 12.5px/600 — « Code »
  - label.flex.flex-col — 12.5px/600 — « Libellé »
  - label.flex.flex-col — 12.5px/600 — « Type Déplacement Mise en service Contrôl »
