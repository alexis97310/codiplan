# Captures d'écran — ce que l'application affiche aujourd'hui

**Ces images montrent que les écrans s'affichent. Elles ne prouvent pas qu'ils fonctionnent, et elles vieillissent : au moindre doute, comparer l'empreinte ci-dessous au dernier commit.**

| | |
|---|---|
| **Commit photographié** | `4b6e18efa4ff69f17fae283a07c1c12c60e1fd27` (`4b6e18e`) — lue dans `git rev-parse HEAD`, jamais de mémoire |
| **Date de la prise** | 09/09/2026, 20:59 UTC — lue à l'horloge du conteneur, jamais déduite |
| **Base** | une base PostgreSQL 16 locale et jetable, remplie par `pnpm db:seed` — aucune donnée réelle (I9). Le planning y montre les **six interventions de démonstration** du seed, plus celle créée pendant la prise de vue |
| **Compte** | l'identité de démonstration du seed, ouverte par `scripts/amorcage-premier-compte.mts` |

## Les images

Chaque écran est photographié en **thème clair** et en **thème sombre**, à **1280 px** (poste de travail) et **390 px** (téléphone). Le nom se lit `écran--thème--largeur.png`.

| Fichier | Ce qu'on y voit |
|---|---|
| `connexion--clair--1280.png` | La page de connexion. — thème clair, poste de travail. |
| `connexion--clair--390.png` | La page de connexion. — thème clair, téléphone. |
| `connexion--sombre--1280.png` | La page de connexion. — thème sombre, poste de travail. |
| `connexion--sombre--390.png` | La page de connexion. — thème sombre, téléphone. |
| `enrolement--clair--1280.png` | L'activation du second facteur, première étape. — thème clair, poste de travail. |
| `enrolement--clair--390.png` | L'activation du second facteur, première étape. — thème clair, téléphone. |
| `enrolement--sombre--1280.png` | L'activation du second facteur, première étape. — thème sombre, poste de travail. |
| `enrolement--sombre--390.png` | L'activation du second facteur, première étape. — thème sombre, téléphone. |
| `second-facteur--clair--1280.png` | La demande du code à six chiffres à la connexion. — thème clair, poste de travail. |
| `second-facteur--clair--390.png` | La demande du code à six chiffres à la connexion. — thème clair, téléphone. |
| `second-facteur--sombre--1280.png` | La demande du code à six chiffres à la connexion. — thème sombre, poste de travail. |
| `second-facteur--sombre--390.png` | La demande du code à six chiffres à la connexion. — thème sombre, téléphone. |
| `arrivee--clair--1280.png` | La page d'arrivée — qui vous êtes, pour quelle société. — thème clair, poste de travail. |
| `arrivee--clair--390.png` | La page d'arrivée — qui vous êtes, pour quelle société. — thème clair, téléphone. |
| `arrivee--sombre--1280.png` | La page d'arrivée — qui vous êtes, pour quelle société. — thème sombre, poste de travail. |
| `arrivee--sombre--390.png` | La page d'arrivée — qui vous êtes, pour quelle société. — thème sombre, téléphone. |
| `planning--clair--1280.png` | Le planning : la file d'attente et les interventions posées. — thème clair, poste de travail. |
| `planning--clair--390.png` | Le planning : la file d'attente et les interventions posées. — thème clair, téléphone. |
| `planning--sombre--1280.png` | Le planning : la file d'attente et les interventions posées. — thème sombre, poste de travail. |
| `planning--sombre--390.png` | Le planning : la file d'attente et les interventions posées. — thème sombre, téléphone. |
| `intervention-creation--clair--1280.png` | La création d'une intervention depuis le planning. — thème clair, poste de travail. |
| `intervention-creation--clair--390.png` | La création d'une intervention depuis le planning. — thème clair, téléphone. |
| `intervention-creation--sombre--1280.png` | La création d'une intervention depuis le planning. — thème sombre, poste de travail. |
| `intervention-creation--sombre--390.png` | La création d'une intervention depuis le planning. — thème sombre, téléphone. |
| `intervention-fiche--clair--1280.png` | La fiche d'intervention, et ses quatre actions. — thème clair, poste de travail. |
| `intervention-fiche--clair--390.png` | La fiche d'intervention, et ses quatre actions. — thème clair, téléphone. |
| `intervention-fiche--sombre--1280.png` | La fiche d'intervention, et ses quatre actions. — thème sombre, poste de travail. |
| `intervention-fiche--sombre--390.png` | La fiche d'intervention, et ses quatre actions. — thème sombre, téléphone. |
| `intervention-cloturee--clair--1280.png` | Une intervention clôturée : l'arrondi et le plancher de D83 sous les yeux, et les trois actions désormais refusées, avec leur raison. — thème clair, poste de travail. |
| `intervention-cloturee--clair--390.png` | Une intervention clôturée : l'arrondi et le plancher de D83 sous les yeux, et les trois actions désormais refusées, avec leur raison. — thème clair, téléphone. |
| `intervention-cloturee--sombre--1280.png` | Une intervention clôturée : l'arrondi et le plancher de D83 sous les yeux, et les trois actions désormais refusées, avec leur raison. — thème sombre, poste de travail. |
| `intervention-cloturee--sombre--390.png` | Une intervention clôturée : l'arrondi et le plancher de D83 sous les yeux, et les trois actions désormais refusées, avec leur raison. — thème sombre, téléphone. |
| `sante--clair--1280.png` | La page d'état de l'installation, **sans compte** — thème clair, poste de travail. |
| `sante--clair--390.png` | La page d'état de l'installation, **sans compte** — thème clair, téléphone. |
| `sante--sombre--1280.png` | La page d'état de l'installation, **sans compte** — thème sombre, poste de travail. |
| `sante--sombre--390.png` | La page d'état de l'installation, **sans compte** — thème sombre, téléphone. |

## Les écrans qui manquent, et ce n'est pas un oubli de prise de vue

Huit écrans avaient été demandés. **Quatre existaient au matin ; quatre sont ci-dessus, plus quatre qui ont été CONSTRUITS dans la journée** — le planning, la création, la fiche d'intervention et sa clôture. Ce qui n'existe toujours pas est nommé plus bas.

Au matin, les quatre manquants n'avaient jamais été écrits — mesuré le 09/09/2026 en interrogeant l'application qui tourne :

| Chemin demandé | Le matin | Le soir |
|---|---|---|
| `/planning` | **404** | **construit** — liste, file d'attente, création |
| `/premier-acces` | **404** | **404** — la redirection du premier accès ne mène à aucune page |
| `/clients` | **404** | **404** — le référentiel client existe en code, sans écran |
| `/techniciens` | **404** | **404** — la table `technicien` du chapitre 11 n'existe pas |

La table `intervention` n'existait pas au schéma le matin ; elle existe depuis **D84**, avec sa politique de cloisonnement, ses deux verrous de cycle de vie et son déclencheur d'audit. *Aucune de ces images n'a été fabriquée : chacune a été prise en parcourant l'application, y compris celle de la clôture — les 12 minutes y sont réellement saisies, et les 8 500 XPF réellement calculés.*

## Ce qui n'y figure jamais

Vérifié **en regardant les images**, écran par écran et thème par thème, jamais en le supposant : aucune ne porte de secret, d'URL de connexion, de nom de base, ni de nom de client réel.

**La seconde étape de l'enrôlement n'est pas photographiée**, et c'est délibéré : c'est elle qui affiche la clé TOTP et les codes de secours. *Un secret dans une image du dépôt est un secret publié.* La première étape — celle qui demande le mot de passe — est la seule qui figure ici.
