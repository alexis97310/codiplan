# 9J04-PORTAIL-DEMANDES — passation

Budget : T0 22:18 (Pacific/Noumea), limite 150 min.

## Point 1 — inventaire (`lib/demandes/depot.ts`, `lib/demandes/saisie.ts`)

| Fichier | Ce qu'il porte |
|---|---|
| `lib/demandes/saisie.ts` | `schemaDepot` (Zod, `.strict()`) : `id`, `source` (six valeurs, dont `"portail"` déjà prévu), `client_id`, `site_id` (requis), `machine_id` (facultatif), `contact_id` (facultatif), `description`, `urgence` (défaut `p3`), `machine_arretee`, `etat_machine`, `date_souhaitee`. `STATUTS_DEMANDE`, `MOTIFS_CLOTURE`, `URGENCES`. |
| `lib/demandes/depot.ts` | `deposerDemande` — dépose SOUS le contexte cloisonné (forme « parc » de `demande`, `WITH CHECK` explicite, D102) ; déduit l'agence du site (D56), le départ du compteur d'accusé du calendrier de cette agence (D13) ; refuse `demande.refus.lieu_inconnu` si le site est introuvable ou hors périmètre — AUCUNE distinction entre les deux cas (D35/D50). `demandesOuvertes`, `demandesTraitees`, `compterDemandesTraitees`, `accuserReception`, `qualifierDemande`, `marquerTransformee`, `cloreSansSuite`, `lireDemandePourCreation`, `numeroDeLaDemande`. |

**Mesuré avant d'écrire** : `grep -rln '"source"\s*:\s*"portail"\|machine_id.*site.*deduit'` ne rendait aucun appelant portail — confirmé, `app/api/demandes/creer/route.ts` (back-office) est le seul appelant de `deposerDemande` avant ce ticket, et il REFUSE explicitement `source: "portail"` (`SOURCES_VOLET`).

## Points 2 à 4 — l'écran et la route

- `app/api/portail/demandes/{contexte,filet,saisie-recue}.ts` + `creer/route.ts` — même trio que
  `app/api/portail/contacts/**` (9J03), écrit une seconde fois plutôt qu'importé : chaque domaine de route
  porte sa propre porte (§6).
- **CLI-4.1 (machine identifiée)** : la route lit `machine_id` soumis, retrouve la machine SOUS le contexte
  portail (`lireMachine`, `lib/machines/depot.ts`, forme « parc ») — hors périmètre ou inexistante rendent la
  MÊME chose, `null` (D35/D50) — et en déduit `site_id`. Le `site_id` éventuellement soumis en même temps est
  ignoré : jamais deux lectures d'un même critère.
- **CLI-4.2 (sans machine)** : `site_id` est lu tel quel. `machine_id` reste `null`. Aucun champ « type
  d'intervention » n'existe ni n'est ajouté — une seule nature, générique.
- `source` est imposé `"portail"` EN DUR dans la route, jamais lu du formulaire (INTERDITS).
- Écran `/portail/demandes` — liste (fusion `demandesOuvertes` + `demandesTraitees`, triée par dépôt le plus
  RÉCENT d'abord : un choix délibérément distinct de l'ordre de la file ADV, voir le docblock de `page.tsx`)
  et formulaire de dépôt (un seul `<form>`, deux `<select>` — machine optionnelle, lieu optionnel-mais-requis-
  si-pas-de-machine — jamais deux formulaires séparés).
- **Aucune entrée de menu ajoutée** — même état que `/portail/contacts` (9J03) : atteignable par son URL
  directe seulement. Gap nommé, non bloquant.

## Point 5 — épreuves d'isolation

Deux fichiers neufs :
- `tests/isolation/portail-demandes-ecriture.test.ts` — `deposerDemande` sous `Role.client` : accepté pour
  son client (site dans son périmètre) ; refusé (lieu inconnu) pour un autre client ou un site hors périmètre
  du MÊME client ; défense en profondeur par deux requêtes brutes (`WITH CHECK`) — client forcé, site hors
  périmètre forcé ; audit (I8) : auteur = compte portail.
- `tests/isolation/9j04-portail-demandes-creer.test.ts` — la ROUTE elle-même (contexte mocké, base réelle) :
  refus de droit ; déduction du site depuis la machine (CLI-4.1) ; refus d'une machine hors périmètre
  (forgée) ; dépôt sans machine (CLI-4.2) ; refus sans machine ni lieu ; `source` forcé dans le formulaire
  **ignoré**, la ligne porte toujours `"portail"`.

`tests/unit/auth/porte.test.ts` — ajout d'une exemption nommée (D-12) pour la nouvelle route, même motif que
les deux routes de contacts (gardée par `contextePortailDemande`, jamais par `exigerCapacite`).

## Point 6 — captures, et ce qui a été mesuré en les prenant

**Première ouverture de session PORTAIL en e2e** (`tests/e2e/captures-9j04-portail-demandes.spec.ts`) :
`inviterClientAuPortail` puis `choisirLePremierMotDePasse`, jamais un cookie fabriqué — même discipline que
`tests/e2e/setup/session.ts`. Aucune fixture de parc écrite : le premier client de la société de l'épreuve
porte déjà, par le semis de démonstration, au moins deux sites et plusieurs machines.

**GAP MESURÉ, HORS TERRITOIRE DE CE TICKET** : `/arrivee` n'offre AUCUN lien vers le portail pour un compte
`Role.client`. `estContexteActif` (`lib/auth/contexte.ts`) refuse TOUJOURS un contexte de rôle portail sans
client désigné (D70) — et la session, par construction, ne désigne jamais de client
(`lib/auth/session.ts` : « une session de rôle client est REFUSÉE par `motifRefusContexte`… c'est voulu »).
`etatArrivee` s'appuie sur ce même calcul pour décider entre les issues `"arrivee"` et `"sans_societe"`, et
c'est l'issue `"arrivee"` SEULE qui affiche le lien `Entree` (« Voir votre parc »). Un compte portail reçoit
donc TOUJOURS `"sans_societe"`, quel que soit le nombre de sociétés sur lesquelles il est rattaché — y
compris exactement une — et ne voit QUE le bouton « Travailler sur cette société », qui rebascule sur la
MÊME société (déjà active) et revient à la MÊME page, sans jamais le faire progresser. **Mesure concrète** :
un client qui vient de recevoir son lien de première connexion et choisit son mot de passe atterrit sur
`/arrivee` et n'a visuellement AUCUN moyen d'atteindre `/portail` — ni lien, ni bouton qui y mène.

Ce scénario-ci contourne le mur en visitant directement `/portail` après connexion — exactement ce que
`app/(portail)/portail/page.tsx` documente déjà pour lui-même (« cet écran n'est atteignable que par son URL
directe »), sauf que là, c'est la SEULE porte d'entrée qui existe pour TOUT le portail, pas seulement pour
`/portail/demandes`. **Proposition, non tranchée** : soit `etatArrivee` doit traiter un rôle portail comme
« arrivé » dès qu'une société est rattachée (sans exiger de client désigné, puisqu'aucun contexte cloisonné
n'est ouvert à ce stade), soit la connexion d'un compte portail doit rediriger directement vers `/portail`
sans passer par `/arrivee`. Les deux touchent un fichier hors du territoire de 9J04
(`app/(apres-session)/arrivee/**`, `app/api/session/connexion/route.ts`) et une décision de comportement
produit — à arbitrer.

**AVANT non capturé** (budget du lot — un AVANT véritable exige de rejouer ce même fichier sur le commit qui
précède 9J04, par un `git worktree` ou un `checkout` temporaire, ce que le budget de 150 min n'a pas permis
une fois ce gap d'authentification mesuré et contourné). Seul l'APRÈS est versé, dans
`docs/etudes/equipe-2026-10-29/tickets/9J04-captures/apres/` (six fichiers : liste, formulaire avec machine,
formulaire sans machine — chacun à 375 et 1280 px). À compléter par une reprise si Alexis le juge utile,
comme 9J10B l'a fait pour 9J10A.

## Hors territoire, rappelé

`lib/demandes/depot.ts` et `lib/demandes/saisie.ts` : lecture seule, aucune ligne modifiée. `prisma/` :
aucune migration — la politique « parc » de `demande` suffisait déjà (D102). Le volet back-office de
qualification : inchangé. `app/(back-office)/template.tsx` : inchangé. `CLAUDE.md` : inchangé.

Deux fichiers partagés touchés, hors du périmètre strict mais nécessaires et minimaux :
- `components/ui/bandeau-motif.tsx` — une ligne ajoutée à `CLES_REUSSITE` (`"portail.demandes.cree"`), même
  mécanique que `"contacts.cree"` : sans elle, le bandeau de succès se peindrait en rouge.
- `tests/unit/auth/porte.test.ts` — l'exemption D-12 de la nouvelle route (voir point 5).
