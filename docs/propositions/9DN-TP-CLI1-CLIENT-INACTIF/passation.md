# 9DN-TP-CLI1-CLIENT-INACTIF — passation

## Ce que j'ai changé, et ce que ça change pour l'exploitation

QT-16 (audit du 28/09/2026, CS16/CS15/CS27/CS45), décision 9 d'Alexis du
03/10/2026, précisions du pilote appliquées telles quelles (D165, à valider par
Alexis) :

- **CS16 — `modifierClient` refuse le passage à inactif** (`lib/clients/depot.ts`)
  tant qu'une intervention du client reste ouverte. L'état ACTUEL du client est
  relu DANS LA MÊME TRANSACTION que l'écriture (même précédent que D134 pour une
  agence déjà inactive) : seul le PASSAGE d'actif à inactif est jugé, jamais le
  MAINTIEN d'une fiche déjà inactive. Une intervention compte comme ouverte si
  son statut n'est NI `cloturee` NI `annulee` — **une `terminee` NON clôturée
  compte aussi** (choix du pilote : elle reste à clôturer), ce qui est DISTINCT
  de `STATUTS_INTERVENTION_FERMES` (le compteur d'affichage existant, inchangé).
  Nouvelle fonction à côté : `interventionsEmpechantDesactivationDans` (dans la
  transaction de l'appelant) et `interventionsEmpechantDesactivationDuClient`
  (lecture après coup, pour la fiche), `lib/interventions/depot.ts`. Le refus
  (`client.refus.interventions_ouvertes`) ne voyage qu'en clé par le canal de
  redirection (D50) ; la fiche relit la liste sous le contexte cloisonné pour
  l'afficher, avec un lien vers chaque intervention.
- **CS15 — badge, actions masquées, garde à la création de site.** Badge
  « Inactif » (même clé `clients.inactif` que la carte de la liste) en tête de
  la fiche client. « + Intervention » et « + Site » disparaissent sur un client
  inactif, même pour un rôle qui en aurait la capacité, avec la raison affichée
  en clair. `creerSite` (`lib/sites/depot.ts`) refuse désormais un client
  inactif, par un motif nommé `site.refus.client_inactif` — même famille que le
  refus déjà posé par `creerIntervention` (RG-PLA-08), vérifié inchangé.
- **CS27 — l'état du client se lit depuis un site.** La carte de `/sites` et la
  tête de la fiche d'un site portent, en plus de l'état du site, celui de son
  client. `libellesDesSites` (`lib/sites/depot.ts`) porte désormais aussi
  `clientsActifs`, une colonne ajoutée à la même lecture plutôt qu'une seconde
  requête.
- **CS45 — qui reçoit les courriels de planification se lit sur la fiche.** Une
  ligne « Courriels de planification envoyés à : <nom> (<courriel>) » (ou
  l'absence nommée) sur la fiche client et la fiche site, calculée par
  `destinataireClient` (`lib/avertissements/planification.ts`) RÉUTILISÉE,
  jamais recopiée. Son paramètre `siteId` accepte désormais `null` : la fiche
  client (sans site en contexte) l'appelle ainsi, et retombe naturellement sur
  le donneur d'ordre du client lui-même, jamais celui d'un de ses sites — la
  fiche site, elle, passe le site réel (celui-ci, à défaut le client, comme à
  l'envoi). Composition partagée par les deux fiches dans la nouvelle fonction
  `libelleDestinataireCourriels` (`app/(back-office)/presentation.ts`).
- **Décision D165** dans `docs/arbitrages.md` ; ligne QT-16 ajoutée à
  `docs/propositions/audit-2026-09-28/decisions-2026-09-28.md`.

Pour l'exploitation : un client qui a encore des interventions à traiter ou à
clôturer ne peut plus être désactivé par erreur — l'écran dit pourquoi et
montre lesquelles. Un client déjà inactif se voit au premier coup d'œil, sur sa
propre fiche, sur la liste des sites et sur la fiche d'un de ses sites, et
« + Site »/« + Intervention » n'y mènent plus à un refus silencieux. Et pour la
première fois, une fiche dit par avance qui recevra le courriel de
planification — avant même de planifier quoi que ce soit.

## Ce que j'ai mesuré

- **Unitaire** (`pnpm test`, 373 fichiers / 3981 tests, vert) : `destinataireClient`
  avec `siteId: null` (nouveaux cas, le client l'emporte même face à un contact
  de site mieux classé) ; `libelleDestinataireCourriels` (les trois cas : un
  destinataire trouvé, aucun, un contact sans courriel).
- **Isolation** (`pnpm test:isolation`, 154 fichiers / 1403 tests, vert, dont le
  nouveau `tests/isolation/client-desactivation-refusee.test.ts`, 8 épreuves) :
  témoin sans intervention (accepté) ; une `a_planifier` bloque, avec la bonne
  liste ; une `terminee` NON clôturée bloque AUSSI ; seulement `cloturee`/`annulee`
  n'empêche rien ; le MAINTIEN d'un client déjà inactif reste accepté même avec
  une ouverte ; un client d'une autre société rend `client_introuvable`, jamais
  `interventions_ouvertes` (qui en apprendrait l'existence) ; `creerSite` accepte
  un client actif et refuse un client inactif. `tests/isolation/ecran-client.test.ts`
  et `tests/isolation/client-inactif-masque.test.ts` : verts, inchangés.
- **Bout en bout** (`pnpm test:e2e`, spec dédié
  `tests/e2e/client-desactivation-refusee-qt16.spec.ts`, 2/2 vert, sur une scène
  créée par le fichier — deux clients `QT16-…`, jamais `SCENE.*`) : le refus
  avec son bandeau et le lien vers l'intervention bloquante, puis une vraie
  désactivation qui montre le badge, masque les deux actions avec leur raison,
  et se voit sur `/sites`. Rejoué aussi, sans régression : `historique-client`,
  `historique-client-machine`, `creation-depuis-client-tpa1`,
  `site-client-inactif-masque-a-la-creation`, `sites`, `gr12-sites`,
  `fiche-360-1`, `historique-site`, `listes-1`, `parc-sites`, `contacts` (33
  specs au total, tous verts).
- `pnpm format:check`, `pnpm typecheck`, `pnpm lint` : verts à chaque commit.

## Ce que j'ai tranché, et pourquoi

- **Le refus vérifie le PASSAGE à inactif, pas chaque sauvegarde où `actif`
  vaudrait `false`.** Le ticket dit « si le client PASSE à inactif » : une
  fiche déjà inactive doit rester modifiable sur ses autres champs même si elle
  porte encore une intervention ancienne non close, sans quoi elle se
  bloquerait elle-même sur ses propres données passées. Précédent direct :
  `modifierSite` et D134 (le maintien d'un rattachement déjà inactif reste
  accepté, seul le passage VERS une agence inactive est refusé).
- **`modifierClientDans` n'a pas reçu la garde** — elle reste sur `modifierClient`
  seul. `modifierClientDans` est aussi le chemin de l'import (application et
  annulation, `lib/imports/`), hors territoire de ce ticket et déjà soumis à
  I6 (contrôle préalable) par un autre mécanisme ; y ajouter cette garde aurait
  débordé sans y avoir été invité.
- **`modifierClient` a reçu un paramètre `client?: PrismaClient`** (absent
  jusqu'ici, à la différence de `creerSite`/`modifierSite`) : nécessaire pour
  l'éprouver sous le rôle applicatif restreint du harnais d'isolation, comme
  toutes les autres écritures cloisonnées de ce dépôt. Rétrocompatible —
  aucun appelant existant ne le fournissait, aucun n'est donc affecté.
- **`destinataireClient(contacts, siteId: string | null)`** plutôt qu'une
  seconde fonction : passer `null` fait retomber la première branche du filtre
  exactement sur la bonne réponse (aucun contact ne porte jamais `site_id ===
  null` comme identifiant de site réel), sans aucune duplication de la règle
  de départage. Voir le commentaire de la fonction.
- **CS45 : la ligne apparaît TOUJOURS**, pas seulement sur un client/site
  inactif — le ticket la demande comme une information permanente de la fiche,
  jamais conditionnée à l'état du client.

## Ce que je n'ai PAS fait

- Désactivation d'un site, recherche, formulaires de création, adresse,
  interlocuteurs : hors territoire, non touchés.
- Aucune migration, aucune ligne de semis, aucun prix inventé.
- Le quatrième refus nommé par D162 et les autres tickets en cours ne sont pas
  concernés par ce lot.
- Les captures AVANT/APRÈS demandées (fiche client 1280/375 px, `/sites`,
  fiche site) n'ont **pas** été produites dans cette session : le budget du
  lot a été consacré à l'implémentation, aux trois niveaux d'épreuve et à la
  vérification complète, et la recette AVANT/APRÈS (worktree sur le commit
  précédent, spec de capture dédié, `next build` qui type-vérifie le spec sur
  l'ancien code) n'a pas pu être menée dans le temps restant. **Non vérifié par
  une mesure, donc écrit comme tel.**

## Les pièges pour la session suivante

- **`destinataireClient` a changé de signature** (`siteId: string | null` au
  lieu de `string`) : si un futur appelant veut dire « pas de site », passer
  `null` plutôt que d'ajouter une branche — voir le commentaire déjà posé sur
  la fonction, qui explique pourquoi `null` fonctionne sans cas spécial.
- **`libellesDesSites` rend un champ de plus (`clientsActifs`)** : les
  appelants existants qui ne le lisent pas n'ont rien à changer, mais un futur
  écran qui a besoin de l'état du client sur une liste de sites devrait
  réutiliser cette lecture plutôt qu'une nouvelle requête sur les mêmes
  identifiants.
- **`STATUTS_NE_BLOQUANT_PAS_LA_DESACTIVATION` (`cloturee`, `annulee`) n'est
  PAS `STATUTS_INTERVENTION_FERMES`** (`terminee`, `cloturee`, `annulee`) : les
  deux existent côte à côte dans `lib/interventions/depot.ts`, pour deux
  questions différentes. Ne pas les fusionner un jour « pour simplifier » sans
  relire pourquoi elles diffèrent (le commentaire de la première l'explique).
- Les tests e2e de ce lot utilisent des UUID fixes en hexadécimal
  (`e2e00000-…-000000016105` etc., préfixe `qt16` impossible en UUID) — si une
  collision apparaît un jour avec un autre fichier e2e, c'est que deux lots ont
  choisi le même suffixe sans le savoir : changer l'un des deux suffixes suffit.

## Ce qui reste à faire

- **Produire les captures AVANT/APRÈS** demandées par le ticket (fiche client
  1280/375 px avec le refus et sa liste, le badge, les boutons masqués, la
  ligne des courriels ; `/sites` avec la carte d'un site de client inactif ;
  fiche site avec sa tête et sa ligne des courriels), par la recette du
  worktree sur le commit précédent (`docs/decisions/` ou mémoire de session —
  « captures-avant-apres-e2e »).
- Faire valider par Alexis les précisions du pilote écrites dans D165 (le
  classement de `terminee` comme « ouverte » pour cette seule question, en
  particulier).
