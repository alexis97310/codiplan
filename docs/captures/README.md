# Captures d'écran — ce que l'application affiche aujourd'hui

**Ces images montrent que les écrans s'affichent. Elles ne prouvent pas qu'ils fonctionnent, et elles vieillissent : au moindre doute, comparer l'empreinte ci-dessous au dernier commit.**

| | |
|---|---|
| **Commit photographié** | `abbb6df5e4e41c82571f2f7188a065249900eab7` (`abbb6df`) — lue dans `git rev-parse HEAD`, jamais de mémoire |
| **Date de la prise** | 09/09/2026, 19:25 UTC — lue à l'horloge du conteneur, jamais déduite |
| **Base** | une base PostgreSQL 16 locale et jetable, remplie par `pnpm db:seed` — aucune donnée réelle (I9) |
| **Compte** | l'identité de démonstration du seed, ouverte par `scripts/amorcage-premier-compte.mts` |

## Les images

Chaque écran est photographié en **thème clair** et en **thème sombre**, à **1280 px** (poste de travail) et **390 px** (téléphone). Le nom se lit `écran--thème--largeur.png`.

| Fichier | Ce qu'on y voit |
|---|---|
| `connexion--clair--1280.png` | La page de connexion, thème clair, poste de travail. |
| `connexion--clair--390.png` | La page de connexion, thème clair, téléphone. |
| `connexion--sombre--1280.png` | La page de connexion, thème sombre, poste de travail. |
| `connexion--sombre--390.png` | La page de connexion, thème sombre, téléphone. |
| `enrolement--clair--1280.png` | L'activation du second facteur, première étape, thème clair, poste de travail. |
| `enrolement--clair--390.png` | L'activation du second facteur, première étape, thème clair, téléphone. |
| `enrolement--sombre--1280.png` | L'activation du second facteur, première étape, thème sombre, poste de travail. |
| `enrolement--sombre--390.png` | L'activation du second facteur, première étape, thème sombre, téléphone. |
| `second-facteur--clair--1280.png` | La demande du code à six chiffres à la connexion, thème clair, poste de travail. |
| `second-facteur--clair--390.png` | La demande du code à six chiffres à la connexion, thème clair, téléphone. |
| `second-facteur--sombre--1280.png` | La demande du code à six chiffres à la connexion, thème sombre, poste de travail. |
| `second-facteur--sombre--390.png` | La demande du code à six chiffres à la connexion, thème sombre, téléphone. |
| `arrivee--clair--1280.png` | La page d'arrivée — qui vous êtes, pour quelle société, thème clair, poste de travail. |
| `arrivee--clair--390.png` | La page d'arrivée — qui vous êtes, pour quelle société, thème clair, téléphone. |
| `arrivee--sombre--1280.png` | La page d'arrivée — qui vous êtes, pour quelle société, thème sombre, poste de travail. |
| `arrivee--sombre--390.png` | La page d'arrivée — qui vous êtes, pour quelle société, thème sombre, téléphone. |

## Les écrans qui manquent, et ce n'est pas un oubli de prise de vue

Huit écrans avaient été demandés. **Quatre existent, et ils sont ci-dessus.** Les quatre autres n'ont jamais été écrits — mesuré le 09/09/2026 en interrogeant l'application qui tourne :

| Chemin demandé | Réponse HTTP mesurée |
|---|---|
| `/premier-acces` | **404** |
| `/planning` | **404** |
| `/clients` | **404** |
| `/techniciens` | **404** |

Il n'y a donc **aucun planning à photographier, ni fiche d'intervention, ni parc, ni liste de techniciens** : la table `intervention` elle-même n'existe pas au schéma. *Une capture de ces écrans n'aurait pas pu être prise ; elle aurait dû être fabriquée, ce qui est le contraire de ce que ces images servent à établir.*

## Ce qui n'y figure jamais

Vérifié **en regardant les images**, écran par écran et thème par thème, jamais en le supposant : aucune ne porte de secret, d'URL de connexion, de nom de base, ni de nom de client réel.

**La seconde étape de l'enrôlement n'est pas photographiée**, et c'est délibéré : c'est elle qui affiche la clé TOTP et les codes de secours. *Un secret dans une image du dépôt est un secret publié.* La première étape — celle qui demande le mot de passe — est la seule qui figure ici.
