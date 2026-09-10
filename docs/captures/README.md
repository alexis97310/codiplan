# Captures d'écran — ce que l'application affiche aujourd'hui

**Ces images montrent que les écrans s'affichent. Elles ne prouvent pas qu'ils fonctionnent.** Elles sont désormais prises par une COMMANDE — `pnpm exec tsx scripts/captures.mts` — et non à la main : une prise de vue manuelle ne se rejoue pas, et vieillit sans le dire.

| | |
|---|---|
| **Commit photographié** | `7bd2ba75d9bc6762d5bc88891438ede3d972bb37` (`7bd2ba7`) — lu dans `git rev-parse HEAD` au moment de la prise, jamais de mémoire |
| **Date de la prise** | 2026-09-10 04:20 UTC — lue à l'horloge, jamais déduite |
| **Base** | un PostgreSQL 16 local et jetable, rempli par `pnpm db:seed` — aucune donnée réelle (I9) |
| **Compte** | l'identité de démonstration du seed |

## Ce que le script REFUSE de photographier

Chaque écran porte un **témoin** : un texte qui doit s'y trouver. Si la page ne le porte pas — parce que la connexion a échoué, parce que l'écran a été renommé, parce qu'une redirection a mené ailleurs — **la capture est refusée et l'absence est écrite ici**. *Une capture d'un écran de connexion rangée sous le nom « planning » est pire qu'une capture absente : elle se relit comme une preuve.*

### Refusées à cette prise

- `enrolement--clair--1280 : Error: « enrolement » ne porte pas son témoin « second facteur » : ce n'est pas l'écran attendu, et la capture est refusée.
  REFUS STRUCTUREL, et non un défaut : pour atteindre les écrans cloisonnés, cette prise de vue ACTIVE le second facteur — l'écran n'existe donc plus quand vient son tour d'être photographié. Le photographier demanderait une seconde identité, jamais enrôlée, et c'est ce qu'il faudra écrire le jour où cet écran devra figurer.`
- `enrolement--clair--390 : Error: « enrolement » ne porte pas son témoin « second facteur » : ce n'est pas l'écran attendu, et la capture est refusée.
  REFUS STRUCTUREL, et non un défaut : pour atteindre les écrans cloisonnés, cette prise de vue ACTIVE le second facteur — l'écran n'existe donc plus quand vient son tour d'être photographié. Le photographier demanderait une seconde identité, jamais enrôlée, et c'est ce qu'il faudra écrire le jour où cet écran devra figurer.`
- `enrolement--sombre--1280 : Error: « enrolement » ne porte pas son témoin « second facteur » : ce n'est pas l'écran attendu, et la capture est refusée.
  REFUS STRUCTUREL, et non un défaut : pour atteindre les écrans cloisonnés, cette prise de vue ACTIVE le second facteur — l'écran n'existe donc plus quand vient son tour d'être photographié. Le photographier demanderait une seconde identité, jamais enrôlée, et c'est ce qu'il faudra écrire le jour où cet écran devra figurer.`
- `enrolement--sombre--390 : Error: « enrolement » ne porte pas son témoin « second facteur » : ce n'est pas l'écran attendu, et la capture est refusée.
  REFUS STRUCTUREL, et non un défaut : pour atteindre les écrans cloisonnés, cette prise de vue ACTIVE le second facteur — l'écran n'existe donc plus quand vient son tour d'être photographié. Le photographier demanderait une seconde identité, jamais enrôlée, et c'est ce qu'il faudra écrire le jour où cet écran devra figurer.`

## Les images

Chaque écran est photographié en **thème clair** et en **thème sombre**, à **1280 px** (poste de travail) et **390 px** (téléphone). Le nom se lit `écran--thème--largeur.png`.

| Fichier | Ce qu'on y voit |
|---|---|
| `accueil--clair--1280.png` | La page d'accueil. — thème clair, poste de travail. |
| `accueil--clair--390.png` | La page d'accueil. — thème clair, téléphone. |
| `accueil--sombre--1280.png` | La page d'accueil. — thème sombre, poste de travail. |
| `accueil--sombre--390.png` | La page d'accueil. — thème sombre, téléphone. |
| `connexion--clair--1280.png` | La page de connexion. — thème clair, poste de travail. |
| `connexion--clair--390.png` | La page de connexion. — thème clair, téléphone. |
| `connexion--sombre--1280.png` | La page de connexion. — thème sombre, poste de travail. |
| `connexion--sombre--390.png` | La page de connexion. — thème sombre, téléphone. |
| `sante--clair--1280.png` | L'état de l'installation, **sans compte**. — thème clair, poste de travail. |
| `sante--clair--390.png` | L'état de l'installation, **sans compte**. — thème clair, téléphone. |
| `sante--sombre--1280.png` | L'état de l'installation, **sans compte**. — thème sombre, poste de travail. |
| `sante--sombre--390.png` | L'état de l'installation, **sans compte**. — thème sombre, téléphone. |
| `arrivee--clair--1280.png` | La page d'arrivée — qui vous êtes, pour quelle société. — thème clair, poste de travail. |
| `arrivee--clair--390.png` | La page d'arrivée — qui vous êtes, pour quelle société. — thème clair, téléphone. |
| `arrivee--sombre--1280.png` | La page d'arrivée — qui vous êtes, pour quelle société. — thème sombre, poste de travail. |
| `arrivee--sombre--390.png` | La page d'arrivée — qui vous êtes, pour quelle société. — thème sombre, téléphone. |
| `planning--clair--1280.png` | Le planning : la charge par technicien, la file d'attente et les interventions posées. — thème clair, poste de travail. |
| `planning--clair--390.png` | Le planning : la charge par technicien, la file d'attente et les interventions posées. — thème clair, téléphone. |
| `planning--sombre--1280.png` | Le planning : la charge par technicien, la file d'attente et les interventions posées. — thème sombre, poste de travail. |
| `planning--sombre--390.png` | Le planning : la charge par technicien, la file d'attente et les interventions posées. — thème sombre, téléphone. |
| `intervention-creation--clair--1280.png` | La création d'une intervention depuis le planning. — thème clair, poste de travail. |
| `intervention-creation--clair--390.png` | La création d'une intervention depuis le planning. — thème clair, téléphone. |
| `intervention-creation--sombre--1280.png` | La création d'une intervention depuis le planning. — thème sombre, poste de travail. |
| `intervention-creation--sombre--390.png` | La création d'une intervention depuis le planning. — thème sombre, téléphone. |
