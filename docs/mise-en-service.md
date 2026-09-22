# CODIPLAN — Mise en service : les gestes du premier jour

*Écrit le 22/09/2026, à la demande de la revue croisée (C-08). Ce document ne configure rien et n'exécute aucun geste : c'est une liste ordonnée, avec pour chacun qui le fait, comment, et comment vérifier qu'il a réussi.*

**Ce document suppose une instance déjà en ligne.** L'hébergement (Vercel/Neon, variables, premier compte technique) est couvert par `docs/mise-en-ligne.md` — ne le refaites pas ici. Ce document commence là où celui-là s'arrête : **une application qui répond sur `/sante` avec trois lignes vertes, et zéro société.**

Il ne dit rien sur l'application terrain (hors périmètre de la première mise en service, décision du 15/09/2026) ni sur la facturation (qui reste dans Winpro).

---

## 0 — Le fil, en une phrase

Référentiels de plateforme → première société → premier compte → agences → taux horaire → jours fériés → équipe → *(import initial, encore hors d'atteinte)*. Chaque geste dépend du précédent — l'ordre n'est pas une convention, c'est ce que le code refuse si on l'inverse (mesuré à chaque étape ci-dessous).

---

## 1 — Les référentiels de plateforme (devises, parités)

**Qui** : l'exploitation, depuis GitHub Actions.
**Quoi** : flux **Amorcer une base (référentiels et première société)**, case `referentiels` seule cochée — ou `pnpm db:referentiels` (`scripts/referentiels-plateforme.mts`) depuis un poste.
**Pourquoi en premier** : une société porte une devise, et la création de société refuse si la devise n'est pas déjà au référentiel — mesuré, message exact : *« la devise XPF n'est pas au référentiel de plateforme »* (`docs/mise-en-ligne.md` §9). Ce sont des faits de plateforme, pas des données de démonstration (D4) : l'écriture est un `upsert`, rejouable sans dommage.
**Vérifier que ça a réussi** : la sortie du flux liste les devises et parités écrites. Zéro donnée propre à une société ici.

---

## 2 — La première société réelle

**Qui** : l'exploitation, depuis GitHub Actions (même flux qu'à l'étape 1, case `societe_initiale`).
**Quoi** : `scripts/societe-initiale.mts`. **Sept valeurs, aucune n'a de défaut** — le geste refuse de partir si l'une manque :

| Valeur | Ce que c'est |
|---|---|
| `code` | préfixe de numérotation de la société |
| `raison_sociale` | nom légal |
| `pays` | ISO 3166-1 alpha-2 |
| `territoire` | ISO 3166-1 alpha-2, indépendant du fuseau (D46) |
| `fuseau_horaire` | identifiant IANA (ex. `Pacific/Noumea`) |
| `devise_code` | doit déjà exister au référentiel (étape 1) |
| `majoration_hors_ouverture_pct` | **un pourcentage, donc un prix** — de 0 à 100, jamais inventé (§8 du CLAUDE.md) |

*(`langue` est demandée par le schéma mais non exploitée en V1 — D26.)*

**Pourquoi la majoration ne peut pas attendre** : c'est un taux qui entre dans le calcul d'une intervention dès la première planification hors horaire d'ouverture. La demander maintenant, plutôt que de la laisser à zéro par défaut, évite qu'un prix inventé se glisse silencieusement dans une facture réelle plus tard.
**Vérifier que ça a réussi** : le geste refuse s'il existe déjà une société portant ce `code`. Noter l'identifiant (UUID) rendu — il sert à toutes les étapes suivantes.

---

## 3 — Le premier compte réel

**Qui** : l'exploitation, depuis GitHub Actions.
**Quoi** : flux **Ouvrir le PREMIER compte** — voir `docs/mise-en-ligne.md` §9 en entier avant de jouer ce geste, notamment le point sur le jeton à usage unique (une heure de validité). Rôle : `admin_societe`.
**Pourquoi maintenant** : les gestes suivants (créer une agence, un technicien) passent par des écrans authentifiés qui exigent la capacité `parametrer_societe` ou `administrer_utilisateurs` — il faut une identité pour les jouer.
**Vérifier que ça a réussi** : l'URL de premier accès ouvre un choix de mot de passe puis l'activation du second facteur (obligatoire pour `admin_societe`, RG-DRO-05). Noter les codes de secours affichés une seule fois.

---

## 4 — Les agences (Ducos, Koné, Dolbeau)

**Qui** : la personne connectée avec le compte de l'étape 3, depuis l'écran — pas en script.
**Quoi** : `/parametres/agences/nouvelle`, une fois par agence. La route (`app/api/parametres/agences/creer/route.ts`) exige la capacité `parametrer_societe`.
**Ce que chaque agence demande** : son nom (Ducos, Koné ou Dolbeau — vocabulaire imposé, jamais « site »), son calendrier d'ouverture. **Le calendrier est initialement fermé tous les jours** — il faut le compléter écran par écran (`/parametres/agences/[id]`, livré par AGENCE-2) avant qu'un créneau ne s'y propose.
**Vérifier que ça a réussi** : les trois agences apparaissent dans `/parametres/agences`, chacune avec son calendrier renseigné — vérifier à l'écran, pas seulement leur existence.

---

## 5 — Le taux horaire initial

**Qui** : l'exploitation, depuis GitHub Actions (flux **Amorcer une base**, case `poser_taux` — AMORCAGE-2, 22/09/2026) ou en terminal (`scripts/taux-initial.mts`).
**Quoi** : le montant, **entier dans l'unité la plus fine de la devise de la société** (D68) — `7000` pour 7 000 XPF, `6500` pour 65,00 EUR — et une date d'effet facultative.
**Pourquoi ce n'est pas fait à l'étape 2** : c'est un geste séparé et volontairement distinct de la création de société (décision du 09/09/2026), avec son propre cliquet : le montant n'a aucune valeur par défaut, et le flux refuse de partir s'il est vide.
**Vérifier que ça a réussi** : le résumé de l'exécution répète le taux formaté — le relire. Le geste refuse ensuite de rejouer sur la même société ; une erreur d'échelle se corrige par le chemin ordinaire (pas en rejouant ce script).
**Ce qui bloque tant que ce geste n'est pas joué** : RG-TAR-04 n'a rien à appliquer, aucune intervention ne se valorise.

---

## 6 — Les jours fériés

**Qui** : l'exploitation, depuis GitHub Actions (même flux, case `etendre_feries`) **une fois qu'au moins une agence existe** (étape 4).
**Pourquoi après les agences, pas avant** : l'horizon des fériés se calcule par territoire, lu sur les agences (D46). Sans agence, le geste refuse en le disant : *« Aucun territoire n'est rattaché à une agence »*.
**Limite connue, mesurée le 22/09/2026** : sur une base hébergée migrée par un propriétaire non superutilisateur, ce bouton ne fonctionne pas encore — le script lit `agence` sous cloisonnement forcé et voit zéro ligne. **En attendant que `scripts/lib/feries.ts` soit réparé**, jouer depuis un terminal sous le rôle exempté : `HORIZON_DATABASE_URL=… pnpm feries:etendre`, puis vérifier avec `pnpm feries:horizon`.
**Vérifier que ça a réussi** : `pnpm feries:horizon` constate douze mois d'horizon couverts pour le territoire de la société.

---

## 7 — L'équipe (techniciens réels)

**Qui** : la personne connectée avec une identité `admin_societe` ou `direction`, depuis l'écran.
**Quoi** : `/parametres/equipe` (livré par ÉQUIPE-1, #245). Pour chaque technicien : nom, courriel, **agence de rattachement** — d'où la dépendance à l'étape 4, une agence doit déjà exister pour être proposée au choix.
**Ce que ce geste ne fait pas** : il crée l'identité du technicien, pas son accès. La personne obtient son accès par le flux d'enrôlement (`/enrolement`), séparément.
**Un courriel déjà pris ailleurs** : l'écran rattache la personne existante à la société plutôt que de créer un doublon, et le dit à l'écran.
**Vérifier que ça a réussi** : le technicien apparaît dans la liste de `/parametres/equipe`, actif, avec son agence.

---

## 8 — Les habilitations (si le site l'exige)

**Qui** : la personne connectée avec une identité `admin_societe`, `direction` ou `adv`.
**Quoi** : `/parametres/habilitations` pour le référentiel (créer un CACES, une induction, etc.), puis l'attribution depuis la fiche d'un technicien (`/parametres/equipe`) et l'exigence depuis la fiche d'un site (`/sites/[id]`).
**Pourquoi cette étape est facultative au premier jour, mais pas indéfiniment** : tant qu'aucune exigence n'est posée sur un site, le verrou d'affectation (`lib/habilitations/affectation.ts`) ne refuse personne — ce qui est correct pour un site sans contrainte, mais silencieux pour un site qui en aurait une non déclarée. **Poser les exigences avant la première intervention sur un site sensible (site minier, notamment).**
**Vérifier que ça a réussi** : sur un site portant une exigence, tenter d'affecter un technicien sans l'habilitation correspondante doit être refusé, en nommant le code de l'habilitation manquante.

---

## 9 — Ce qui reste hors d'atteinte au premier jour

**L'import initial depuis un fichier historique (type « Suivi_SAV_GBH »).** Aucun script ni route du dépôt ne référence nommément cette source — recherché exhaustivement, aucune occurrence. `lib/imports/` porte des imports génériques et déjà outillés pour le parc, les clients, les sites et les familles de matériel (`parc-agences.ts`, `parc-clients.ts`, `parc-familles.ts`, `televersement.ts`), tous au format `.xlsx` (jamais de CSV, D90). **Le premier jour d'une société réelle passera donc par ces imports génériques, avec un travail de mise en forme du fichier source vers le modèle attendu par `lib/imports/modeles.ts`** — ce n'est pas un geste supplémentaire à cette liste, c'est un chantier de préparation de données en amont, propre à chaque société importée.

**Les forfaits, prestations, familles de matériel et modèles.** Ces référentiels naissent vides par décision et se peuplent depuis `/parametres/forfaits`, `/parametres/prestations` et les écrans de matériel, un par un ou par import (ci-dessus) — aucun ordre de dépendance strict entre eux et les étapes 1-7, ils peuvent être renseignés en parallèle une fois la société et au moins une agence créées.

**La facturation.** Hors périmètre par décision du 15/09/2026 : CODIPLAN va jusqu'à l'état « facturée » (voir C-02 de `docs/revue-2026-09-22.md`, encore un ticket ouvert au moment d'écrire ce document), jamais au-delà.

---

## 10 — Récapitulatif vérifiable

| Étape | Geste | Dépend de | Vérification |
|---|---|---|---|
| 1 | Référentiels plateforme | rien | devises/parités listées dans la sortie du flux |
| 2 | Société initiale | étape 1 | identifiant rendu, refus si code déjà pris |
| 3 | Premier compte | étape 2 | mot de passe + second facteur activés |
| 4 | Agences (×3) | étape 3 | trois agences visibles, calendrier renseigné |
| 5 | Taux horaire | étape 2 | taux formaté répété dans le résumé |
| 6 | Jours fériés | étape 4 | `pnpm feries:horizon` : douze mois couverts |
| 7 | Équipe | étape 4 | techniciens visibles, actifs, avec agence |
| 8 | Habilitations | étapes 3, 7 (facultatif) | refus d'affectation testé sur un site exigeant |
| 9 | Import / référentiels tarifaires | étapes 2, 4 | selon le référentiel importé |
