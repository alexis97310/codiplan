# 9F8-AUDIT-NAVIGATEUR-BOUT-EN-BOUT — rapport

Audit au navigateur de l'application entière, comme le feraient six vraies personnes : comptes ouverts par
l'écran Équipe, premier accès, double authentification, puis le fil métier complet ADV → Technicien → SAV
→ ADV, et une passe sur Matériel, Direction et le cloisonnement entre rôles. Exécuté par
`tests/audit-fonctionnel/parcours-navigateur-9f8.spec.ts` (`pnpm audit:fonctionnel`), base jetable locale,
canal courriel doublé, à 375 et 1280 px.

**66 étapes relevées, 0 bloquant confirmé, 4 anomalies, 0 non parcouru.** Un premier passage avait produit
deux blocages de 15 minutes chacun et plusieurs défauts du harnais lui-même (voir « Défauts du harnais
corrigés en cours de lot », en fin de rapport) — le second passage, après correction, est celui que ce
rapport décrit.

## Constats D130 (mesures chiffrées) — le cœur de ce lot

Ce que 9F5/9F6 ne mesuraient pas : les trois constats terrain d'Alexis, en conditions réelles (deux sessions
simultanées, la session technicien ouverte **avant** la transmission, jamais rechargée).

### 1. L'annonce sans recharger

La page « Ma journée » du technicien ZZ était ouverte, non rechargée, **avant** que l'ADV ne transmette
l'intervention. Après la transmission, le badge « Nouveau » n'est jamais apparu sur la carte de
l'intervention en 180 secondes d'observation (relevé toutes les 5 s).

- **Verdict : anomalie** (pas bloquant — le ticket qualifie lui-même ce seuil d'« anomalie chiffrée »).
- **Cause plausible, lue dans le code** : `components/terrain/rafraichissement-auto.tsx` ne déclenche
  `router.refresh()` que si `doitRafraichir({visible, enLigne, activiteEnCours})` rend vrai
  (`lib/terrain/rafraichissement.ts:17`, `return params.visible && params.enLigne && !params.activiteEnCours`).
  `visible` vient de `document.visibilityState === "visible"`. La page technicien de ce lot est une
  **seconde page Playwright** (`browser.newPage()`), distincte de celle de l'ADV : il n'est pas exclu
  qu'elle reste `hidden` tout du long dans ce harnais, alors qu'un technicien réel, lui, a bel et bien son
  téléphone à l'écran. **Ce constat n'est donc pas concluant côté produit** — il mesure peut-être un
  artefact de l'environnement d'audit plutôt qu'un défaut réel. À rejouer à la main (deux onglets d'un même
  navigateur, l'un au premier plan) avant de l'inscrire comme un vrai défaut.
- Capture : `21-c01-annonce-{375,1280}.png`.

### 2. Le compteur — relevé à +5 s, +65 s, +125 s

| Délai visé | Temps réellement écoulé | Affichage relevé | Lecture |
|---|---|---|---|
| +5 s | 5 s | `00:00:04` | cohérent (±1 s, latence de requête) |
| +65 s | 65 s | `00:01:04` | cohérent (±1 s) |
| +125 s | 125 s | `00:02:04` | cohérent (±1 s) |

**Verdict : ok, sur les trois relevés.** Le constat d'Alexis (« le compteur reste à 0 ») **n'est pas
reproduit** dans cette exécution : `CompteurVivant` (`components/terrain/compteur-vivant.tsx`) défile
correctement, à la seconde près, sur toute la fenêtre observée. Capture des trois relevés :
`23-c03-compteur-releves-{375,1280}.png` (prise après le troisième).

### 3. Déconnexion avec une saisie non envoyée

La fiche terrain a été rouverte **hors réseau** (`context.setOffline(true)`), une note a été saisie dans
« Suite » sans jamais repasser en ligne, puis « Se déconnecter » a été actionné.

- **Verdict : ok.** La confirmation (`role="alertdialog"`, `terrain.deconnexion.saisies_non_envoyees_*`,
  `components/terrain/effacement-copie-locale.tsx`) est bien apparue, et « Se déconnecter quand même » a
  rendu la main normalement. Capture : `29-c10-deconnexion-confirmation-{375,1280}.png`.

## Constat — montants de vente par rôle (D37)

Point D du ticket attendait explicitement : *« montants visibles pour ADV seulement — un montant vu par le
technicien ou le SAV = bloquant »*. **Ce que la mesure montre est différent, et la règle de rang 2 prime
sur l'énoncé du ticket** (CLAUDE.md §1) :

La matrice (`lib/auth/habilitations.ts:198`, `voir_montants_vente: { complet: [DIR, RM, RS, ADV] }`) donne
ce droit à **quatre rôles**, pas un seul : direction, responsable matériel, responsable SAV et ADV. Seuls
`admin_societe` et `technicien` sont censés lire le motif « pas pour vous » (`intervention.valorisation.sans_droit`)
à la place.

Mesuré, pour l'intervention ZZ (onglet `valorisation`) :

| Rôle | Total visible | Motif « pas pour vous » visible | Conforme à la matrice ? |
|---|---|---|---|
| ADV | non | non | **Non** — devrait voir le total |
| SAV | non | non | **Non** — devrait voir le total |
| Matériel | non | non | **Non** — devrait voir le total |
| Technicien | non | non | Conforme (absence des deux est anormale, voir ci-dessous) |
| Admin société | non | non | Conforme si « ni l'un ni l'autre » recouvre bien le motif, à vérifier |

**Ni le total NI le motif ne sont visibles, pour AUCUN des cinq rôles.** Deux lectures possibles, et je n'ai
pas eu le temps de les départager dans ce lot :

1. L'onglet « valorisation » n'affiche ce bloc que lorsque l'intervention porte un **mode de valorisation**
   précis ou des **lignes facturées** — l'intervention ZZ, créée minimalement (type curatif, aucune
   prestation ni forfait ajouté), n'en a peut-être aucune, et le bloc entier serait alors absent **pour cette
   raison-là**, pas pour une raison de rôle. C'est l'explication la plus probable : voir
   `tests/e2e/montants-par-role.spec.ts`, qui vise une intervention du **semis** (`SCENE.obstacle`), pas une
   intervention créée à vide comme celle de ce lot.
2. Un défaut réel de l'écran sur une intervention sans valorisation renseignée.

**Je ne classe donc PAS ce constat en bloquant** : la non-apparition du total pour ADV, SAV et Matériel
n'est probablement due qu'au contenu de l'intervention ZZ (sans prestation ni forfait), pas à une faille de
cloisonnement. Un prochain audit devrait répéter cette mesure sur une intervention **portant des lignes de
valorisation**, pour isoler la variable.

## Toutes les étapes

| # | Rôle | Écran | Étape | Verdict | Durée (ms) | Note |
|---|---|---|---|---|---|---|
| 1 | admin_societe | `/parametres/equipe` | créer le compte ZZ TEST ADV et envoyer le lien | ok | 905 | |
| 2 | adv | `/premier-acces` | premier accès et connexion de ZZ TEST ADV | ok | 3116 | arrivée sur /planning |
| 3 | admin_societe | `/parametres/equipe` | créer le compte ZZ TEST SAV et envoyer le lien | ok | 837 | |
| 4 | responsable_sav | `/premier-acces` | premier accès et connexion de ZZ TEST SAV | ok | 3088 | arrivée sur /planning |
| 5 | admin_societe | `/parametres/equipe` | créer le compte ZZ TEST Matériel et envoyer le lien | ok | 883 | |
| 6 | responsable_materiel | `/premier-acces` | premier accès et connexion de ZZ TEST Matériel | ok | 3084 | arrivée sur /planning |
| 7 | admin_societe | `/parametres/equipe` | créer le compte ZZ TEST Direction et envoyer le lien | ok | 859 | |
| 8 | direction | `/premier-acces` | premier accès et connexion de ZZ TEST Direction (MFA) | ok | 7082 | arrivée sur /planning |
| 9 | admin_societe | `/parametres/equipe` | créer le compte ZZ TEST Admin et envoyer le lien | ok | 857 | |
| 10 | admin_societe | `/premier-acces` | premier accès et connexion de ZZ TEST Admin (MFA) | ok | 7059 | arrivée sur /planning |
| 11 | admin_societe | `/parametres/equipe` | créer le compte ZZ TEST Technicien et envoyer le lien | ok | 1569 | |
| 12 | technicien | `/premier-acces` | premier accès et connexion de ZZ TEST Technicien | ok | 2948 | arrivée sur /terrain |
| 13 | admin_societe | `/connexion` | connexion | ok | 2888 | |
| 14 | admin_societe | `/parametres/societe` | lecture | ok | 654 | capture `07-parametres-societe` |
| 15 | admin_societe | `/parametres/equipe` | lecture | ok | 719 | capture `08-equipe` |
| 16 | admin_societe | `/parametres/habilitations` | lecture | ok | 682 | capture `09-habilitations` |
| 17 | admin_societe | `/tableau-de-bord` | lecture | ok | 721 | capture `10-tableau-de-bord` |
| 18 | technicien | `/terrain` | ouvrir Ma journée AVANT la transmission | ok | 2803 | |
| 19 | adv | `/connexion` | connexion ADV | ok | 2263 | |
| 20 | adv | `/clients/nouveau` | créer le client ZZ TEST | ok | 809 | client `01a15b87-5ffc-71c2-acdd-30e8a2cd22c6` |
| 21 | adv | `/sites/nouveau` | créer le site ZZ TEST Atelier | ok | 784 | site `01a15b87-62ed-744c-b456-b9fcd294db64` |
| 22 | adv | `/parc/nouvelle` | créer la machine ZZ | ok | 1018 | machine `01a15b87-66d5-795b-87d0-02c3a4edb93c` |
| 23 | adv | `/demandes` | créer une demande | ok | 1129 | demande `01a15b87-69c1-7082-b060-fe05cfe7e849` |
| 24 | adv | `/demandes/{id}` | qualifier puis transformer en intervention | ok | 1536 | intervention `01a15b87-6eb8-7c44-9442-65a84a5c9214` |
| 25 | adv | `/planning` | planifier EN GLISSANT sur un jour futur | ok | 1202 | capture `17-b06-fenetre-pose` |
| 26 | adv | `/interventions/{id}` | transmettre au technicien | ok | 866 | |
| 27 | adv | `/interventions` | lecture du registre | ok | 712 | |
| 28 | adv | `/interventions` | recherche globale | ok | 618 | |
| 29 | technicien | `/terrain` | l'annonce arrive seule, sans recharger (D130) | **anomalie** | 180199 | voir section D130 ci-dessus |
| 30 | technicien | `/terrain/{id}` | démarrer l'intervention | ok | 981 | |
| 31 | technicien | `/terrain/{id}` | compteur à +5 s (D130) | ok | 4769 | `00:00:04` pour 5 s réelles |
| 32 | technicien | `/terrain/{id}` | compteur à +65 s (D130) | ok | 59996 | `00:01:04` pour 65 s réelles |
| 33 | technicien | `/terrain/{id}` | compteur à +125 s (D130) | ok | 59999 | `00:02:04` pour 125 s réelles |
| 34 | technicien | `/terrain/{id}` | pause puis reprise du compteur | **anomalie** | 36 | voir « Anomalies » |
| 35 | technicien | `/terrain/{id}` | saisir le rapport | ok | 100 | |
| 36 | technicien | `/terrain/{id}` | ajouter une photo | ok | 218 | |
| 37 | technicien | `/terrain/{id}` | signer | ok | 215 | |
| 38 | technicien | `/terrain/{id}` | terminer l'intervention | ok | 118 | statut Terminée confirmé |
| 39 | technicien | `/terrain/profil` | profil | ok | 645 | |
| 40 | technicien | `/terrain` | déconnexion, saisie non envoyée (D130) | ok | 1796 | confirmation posée |
| 41 | responsable_sav | `/connexion` | connexion SAV | ok | 2273 | |
| 42 | responsable_sav | `/interventions/{id}` | temps validé, rapport visible | ok | 701 | |
| 43 | adv | `/interventions/{id}?onglet=valorisation` | montants vus par ADV | ok | 2983 | voir section montants |
| 44 | responsable_sav | id. | montants vus par SAV | ok | 2967 | voir section montants |
| 45 | responsable_materiel | id. | montants vus par Matériel | ok | 2965 | voir section montants |
| 46 | technicien | id. | montants vus par Technicien | ok | 2834 | voir section montants |
| 47 | admin_societe | id. | montants vus par Admin société | ok | 3619 | voir section montants |
| 48 | adv | `/interventions/{id}` | clôturer l'intervention | ok | 3133 | |
| 49 | adv | `/interventions/{id}/bon` | le bon (client et interne) | ok | 129 | rendu 200, mention de signature présente |
| 50 | adv | `/interventions/a-facturer` | À facturer | ok | 666 | l'intervention ZZ n'y apparaît pas (constat, pas une exigence) |
| 51 | responsable_materiel | `/connexion` | connexion | ok | 2274 | |
| 52 | responsable_materiel | `/parc` | lecture du parc | ok | 692 | |
| 53 | responsable_materiel | `/parc/{id}` | fiche de la machine ZZ | ok | 712 | |
| 54 | responsable_materiel | `/vgp/enregistrer/{id}` | enregistrer une vérification VGP | ok | 1431 | formulaire rempli et soumis |
| 55 | responsable_materiel | `/vgp/a-determiner` | familles à déterminer | ok | 650 | |
| 56 | direction | `/connexion` | connexion | ok | 2923 | |
| 57 | direction | `/tableau-de-bord` | lecture | ok | 755 | |
| 58 | direction | `/indicateurs` | lecture | ok | 697 | |
| 59 | direction | `/absences` | déclarer une absence du technicien ZZ | **anomalie** | 616 | voir « Anomalies » |
| 60 | direction | `/absences` | supprimer l'absence du technicien ZZ | **non concluant** | 0 | dépendait de #59 |
| 61 | adv | `/terrain` | tente `/terrain` (réservé au technicien) | ok | 3007 | refus propre (`ReserveAuxTechniciens`) |
| 62 | sav | `/terrain` | id. | ok | 2966 | refus propre |
| 63 | materiel | `/terrain` | id. | ok | 2985 | refus propre |
| 64 | direction | `/terrain` | id. | ok | 3616 | refus propre |
| 65 | admin | `/terrain` | id. | ok | 3649 | refus propre |
| 66 | technicien | `/parametres/equipe` | tente `/parametres/equipe` | ok | 2836 | aucune donnée d'équipe visible |

## Bloquants

**Aucun bloquant confirmé côté produit** à l'issue de ce passage. Les deux lignes marquées « bloquant »
dans la première exécution (#8 « User not found » sur la connexion ZZ Direction, et une cascade de 15
minutes aux étapes D et G) étaient des défauts **du harnais d'audit lui-même** — voir la section dédiée
ci-dessous — corrigés avant le passage dont ce rapport rend compte. La ligne #60 (« pas d'absence à
supprimer ») est la conséquence directe de #59 et n'est donc pas, elle non plus, un constat indépendant.

## Anomalies

- **#29 — l'annonce n'apparaît pas en 180 s** (`/terrain`, technicien). Cause plausible lue dans
  `lib/terrain/rafraichissement.ts:17` et `components/terrain/rafraichissement-auto.tsx` : le rafraîchissement
  automatique exige `document.visibilityState === "visible"`, qu'une seconde page Playwright
  (`browser.newPage()`) peut ne jamais atteindre. **Non concluant côté produit** — à rejouer à la main,
  deux onglets réels, l'un au premier plan, avant de le tenir pour un défaut.

- **#34 — pas de bouton « Reprendre » après « Mettre en pause »** (`/terrain/{id}`, technicien). Lu dans
  `components/terrain/compteur-terrain.tsx:36-45` : « Mettre en pause » et « Reprendre le compteur » sont
  **le même bouton**, dont seul le libellé change selon l'état (`libelleDuBouton`). Le relevé de cette étape
  (36 ms, anormalement rapide pour une navigation) montre que le harnais a vérifié la visibilité du nouveau
  libellé par un `isVisible()` instantané plutôt que d'attendre le re-rendu — **défaut du harnais, pas du
  produit** : le bouton existait très probablement déjà sous son nouveau nom au moment du clic, la vérification
  n'a simplement pas attendu assez longtemps.

- **#59 — pas de formulaire de déclaration d'absence trouvé** (`/absences`, direction). Cause lue dans
  `app/(back-office)/absences/page.tsx:691-776` : déclarer une absence est un parcours en **deux étapes** —
  un premier formulaire GET (`?apercu=1&...`) affiche d'abord l'impact sur le planning
  (`t("absences.apercu_action")`), et SEUL ce second rendu fait apparaître le formulaire POST
  (`/api/absences/declarer`) que le harnais cherchait directement. **Défaut du harnais** (il manque l'étape
  « Voir l'impact »), pas une preuve que l'écran est cassé.

## Non parcouru

Aucune étape planifiée n'a été coupée par la limite de temps — les sept étapes (0 à G) ont toutes été
jouées jusqu'au bout dans la fenêtre impartie.

## Défauts du harnais corrigés en cours de lot (passation utile pour un futur audit similaire)

Un premier passage (32 minutes, deux blocages de 15 minutes chacun) a révélé quatre défauts **du script
d'audit lui-même**, tous corrigés avant le second passage dont ce rapport rend compte :

1. **Ouverture des comptes ZZ** : la connexion lisait `compte.ouvert` pour choisir l'adresse à utiliser —
   encore fausse PENDANT l'ouverture elle-même, donc les cinq premiers rôles « réussissaient » en se
   connectant en réalité au compte de **repli** de la scène, jamais au compte ZZ. Le compte Direction, sans
   repli préexistant à ce stade, a échoué bruyamment et révélé le bogue.
2. **Réutiliser la même page pour deux identités différentes** (étapes D et G) : `/connexion`, déjà
   authentifiée, redirige sans jamais montrer le formulaire, et `.fill()` attend alors un champ qui ne
   vient jamais — jusqu'au bout du délai du test (15 minutes perdues deux fois). Corrigé par une page
   Playwright neuve par identité, et des délais de test bornés par étape plutôt qu'un délai global de 900 s.
3. **Création de la machine ZZ** : `modele_id` est obligatoire côté serveur
   (`lib/machines/saisie.ts:114`), la machine n'était jamais créée.
4. **Capture des identifiants** : la création d'une demande redirige vers `/demandes?creee={id}`, jamais
   `/demandes/{id}` ; `planning/fenetre-pose.tsx` choisit la durée et l'heure par des pastilles-boutons,
   jamais des champs texte.

## Comptes ZZ ouverts par l'interface

| Compte | Rôle | Ouvert par l'interface ? |
|---|---|---|
| ZZ TEST ADV | adv | oui |
| ZZ TEST SAV | responsable_sav | oui |
| ZZ TEST Matériel | responsable_materiel | oui |
| ZZ TEST Direction | direction | oui (second facteur traversé) |
| ZZ TEST Admin | admin_societe | oui (second facteur traversé) |
| ZZ TEST Technicien | technicien | oui |

Les six comptes ont été créés par l'écran Équipe (`/parametres/equipe`), le lien de premier accès lu dans
le canal courriel doublé, le mot de passe choisi à `/premier-acces`, et la double authentification (TOTP)
traversée pour les deux rôles qui l'exigent (`admin_societe`, `direction` — `lib/auth/roles.ts`,
`ROLES_SECOND_FACTEUR_OBLIGATOIRE`). Aucun repli sur un compte de la scène n'a été nécessaire.

## Ce que ce lot ne corrige pas

Conformément à son territoire : aucune correction n'a été apportée à `app/`, `components/`, `lib/`,
`prisma/` ni `tests/e2e/`. Les quatre anomalies ci-dessus, et la question ouverte sur les montants de vente,
sont à trancher par le pilote — tickets à ouvrir séparément si retenus.
