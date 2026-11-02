# 9IC5-FEUILLE-DE-ROUTE — passation

État au 02/11/2026 ~15:43 (T0 15:11, limite 70 min).

## Ce qui est livré

1. **Le contenu** — `lib/feuille-de-route/contenu.ts` : un module de données
   typé (`SECTIONS_FEUILLE_DE_ROUTE`, `StatutFeuilleDeRoute`,
   `DATE_ETAT_FEUILLE_DE_ROUTE`), le texte de l'annexe repris mot pour mot,
   ordre conservé. Libellés d'interface (titre de page, « État au »,
   libellés de statut) dans `lib/i18n/fr.ts`, sous `feuille_de_route.*`.
2. **La page** — `app/(back-office)/feuille-de-route/page.tsx`. Une `Carte`
   par section, une pastille `Badge` par élément (ton selon le statut,
   aucune couleur en dur). Garde serveur : session exigée, rôle restreint à
   `admin_societe`/`admin_plateforme` (`RefusAcces` sinon). **Aucune lecture
   de base** — le contenu est statique, donc aucun garde « société active » :
   `admin_plateforme` n'a précisément aucune société active
   (`lib/auth/reinitialisation.ts` le documente déjà), et l'exiger ici lui
   aurait fermé une page que la demande d'Alexis lui ouvre explicitement.
3. **L'entrée de menu** — « Feuille de route » dans le groupe « Paramètres »
   de `lib/navigation/entrees.ts`. `CAPACITE_REQUISE` ne pouvait exprimer
   qu'une capacité ; aucune case de `lib/auth/habilitations.ts` ne tient
   EXACTEMENT « admin_societe et admin_plateforme, personne d'autre »
   (`parametrer_societe` couvre aussi `direction`). `ExigenceCapacite` gagne
   donc une troisième forme, `{ roles: readonly Role[] }`, posée uniquement
   ici — la matrice des capacités n'a pas été touchée (hors territoire).
   `lib/feuille-de-route/acces.ts` porte `ROLES_FEUILLE_DE_ROUTE` et
   `peutVoirFeuilleDeRoute`, partagés par la page ET par l'entrée de menu —
   jamais une seconde lecture du même critère.
4. **Épreuves** :
   - unitaire, `tests/unit/navigation/feuille-de-route-entree.test.ts` :
     sur les dix rôles, seuls `admin_societe` et `admin_plateforme` voient
     l'entrée (`entreeVisible`) ;
   - e2e, `tests/e2e/9ic5-feuille-de-route.spec.ts` : admin de société voit
     le lien ET la page (un titre de section du contenu, lu depuis le
     module de données plutôt que recopié en dur) ; ADV ne voit ni le lien
     ni la page, et l'adresse ouverte à la main rend le refus nommé ; sans
     session, redirection vers `/connexion`.
5. **Captures**, `tests/e2e/captures-9ic5-feuille-de-route.spec.ts` →
   `docs/propositions/9IC5-FEUILLE-DE-ROUTE/captures/` : `menu-1280.png`
   (139 446 o), `page-1280.png` (121 146 o), `menu-375.png` (45 364 o, le
   tiroir « Plus »), `page-375.png` (39 773 o).

## Décisions prises en cours de route (aucune n'est un point d'arrêt du §8)

- **Emplacement de la page : `/feuille-de-route`, PAS sous `/parametres/`.**
  Le hub `/parametres` range ses écrans par un système de « portes »
  fermé (`lib/navigation/portes-parametrage.ts`, hors territoire de ce
  ticket) ; par ailleurs, d'autres entrées du même groupe de menu
  « Paramètres » — Imports Excel (`/imports`), App technicien (`/terrain`)
  — sont déjà des routes autonomes, hors du hub. La nouvelle page suit ce
  précédent plutôt que d'ouvrir le territoire des portes.
- **Icône de menu** : `route` (`components/ui/icone.tsx`), inutilisée
  ailleurs — le gardien D144 (aucune icône dupliquée, aucune exception) et
  le gardien D121 (quatorze destinations de la maquette + écarts nommés)
  exigeaient tous deux une déclaration ; `nav.feuille_de_route` entre dans
  `ECARTS_HORS_MAQUETTE` au même titre que « Demandes » (D133) et
  « Indicateurs du mois » (D170).
- **`admin_plateforme` n'a aujourd'hui aucun chemin de session réel** —
  `role_actif` n'est posé que par la bascule de société
  (`lib/auth/societe-active.ts`), qui exige une ligne dans
  `utilisateur_societe` ; `admin_plateforme` n'en a jamais (console éditeur
  inerte, lot 7). L'épreuve e2e ne couvre donc QUE `admin_societe` et ADV,
  comme le ticket le demande explicitement ; `admin_plateforme` est couvert
  en isolation par le test unitaire (`entreeVisible`) et par la forme du
  garde de la page, qui n'exige pas de société active pour cette raison
  précise. Rien n'a été changé à ce mécanisme — hors territoire.

## Un quirk d'outillage rencontré, sans conséquence pour le lecteur

`pnpm sommaires:regenerer` (régénération du sommaire par numéro de ligne de
`docs/constitution/organisation-du-code.md`) est en un seul passage : quand
le NOMBRE d'entrées de l'arborescence change (ici +1, `lib/feuille-de-route/`),
le sommaire lui-même grandit d'une ligne, ce qui décale tout ce qui suit —
mais les numéros déjà écrits dans CE MÊME passage datent d'avant ce
décalage. Il faut le rejouer une seconde fois pour converger (la commande
l'indique : « régénéré » puis « déjà à jour »). Deux fixtures à ligne fixe
de `tests/unit/docs/constitution-indexee.test.ts` ont dû être bougées de un
cran pour la même raison (74→75, 120→121) — un module de plus dans `lib/`
fera le même effet au prochain ticket qui en ajoute un.

## Territoire respecté

Aucune migration, aucune dépendance neuve, `lib/auth/habilitations.ts` non
touché, `app/(back-office)/template.tsx` non touché.

## Ce qui reste, si la suite le demande

- Rien de bloquant. Le contenu (`lib/feuille-de-route/contenu.ts`) devra
  être tenu à jour par les tickets qui livrent, et par le pilote à chaque
  relance — c'est écrit en tête du fichier.

## Reprise 9IC51 (02/11/2026 ~19:40–20:10)

Mesuré par la vérification indépendante du lot ci-dessus (1er passage,
`traces/9IC5-FEUILLE-DE-ROUTE-verify-1.txt`) : `document.title` valait
« CODIPLAN » seul sur `/feuille-de-route` — la page n'exportait pas
`metadata`, à la différence de Matériel et Équipe (VISUEL-1).

- **Correction** : `app/(back-office)/feuille-de-route/page.tsx` exporte
  désormais `export const metadata: Metadata = { title: t("feuille_de_route.titre") };`,
  posé juste après le commentaire d'en-tête — même forme que
  `app/(back-office)/parametres/materiel/page.tsx:37` et
  `app/(back-office)/parametres/equipe/page.tsx:94`. La clé
  `feuille_de_route.titre` existait déjà dans `lib/i18n/fr.ts` (posée au
  point 1 de 9IC5, déjà utilisée pour le `<h1>` de la page) ; rien ajouté
  au dictionnaire.
- **Vérifié** : `tests/e2e/tous-les-ecrans-rendent.spec.ts` ciblé sur
  `/feuille-de-route rend 200` (le fichier n'a pas été touché — hors
  territoire) ; les trois épreuves de
  `tests/e2e/9ic5-feuille-de-route.spec.ts` ; `CI=1 pnpm verify` entier,
  vert.
- **Captures** : `captures-9ic5-feuille-de-route.spec.ts` rejoué pour les
  quatre captures. `page-1280.png` et `page-375.png` ressortent
  bit-à-bit identiques — le titre d'onglet n'entre pas dans une capture du
  contenu de la page, rien à mettre à jour. `menu-1280.png` avait divergé
  de quelques octets au second passage (rendu non déterministe, aucun lien
  avec ce correctif) ; cette capture n'était pas demandée par ce point et a
  été restaurée à sa version déjà commitée plutôt que commitée pour rien.
- **Hors territoire, non touché** : `tests/e2e/tous-les-ecrans-rendent.spec.ts`,
  `lib/navigation/entrees.ts`, `lib/auth/**`, `lib/feuille-de-route/contenu.ts`,
  toute migration, `CLAUDE.md`.
