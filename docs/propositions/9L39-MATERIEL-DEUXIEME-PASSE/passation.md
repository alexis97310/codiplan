# 9L39-MATERIEL-DEUXIEME-PASSE — passation

Ligne de la feuille de route « À écrire après la démo » : « Page Matériel, deuxième passe : état actif ou inactif
écrit en clair, saisie gardée après un refus (la famille présélectionnée, elle, est livrée — 9K17A) ». **Aucune
migration** (aucune colonne touchée).

## Mesure (point 1)

`app/(back-office)/parametres/materiel/page.tsx` — `ActionsLigne` : pour qui **ne peut pas** écrire, l'état était
déjà écrit en clair (`materiel.active`/`materiel.inactive`) ; pour qui **peut** écrire, la cellule ne montrait QUE
le bouton de bascule (« Activer »/« Désactiver ») — l'état ne se lisait qu'en déduisant le libellé du bouton,
jamais nommé lui-même (défaut d'accessibilité : rien ne le dit sans lire et interpréter un verbe).

`app/api/parametres/materiel/saisie-recue.ts` et les six routes de création/modification (familles, modèles,
sous-types) : un refus (schéma invalide ou motif du dépôt — code déjà pris, etc.) rouvrait le volet mais avec les
valeurs **DE LA BASE** (`valeurs?.champ`), jamais celles tapées — pour une CRÉATION refusée, aucune valeur en base
donc un formulaire VIDE. Documenté en toutes lettres dans l'en-tête du fichier (section 9K18A) comme une LIMITE
CONNUE restée ouverte.

**L'écran voisin qui le fait déjà, mesuré et réutilisé** : `app/(back-office)/parametres/prestations/page.tsx`
affiche TOUJOURS `{prestation.actif ? t("prestations.active") : t("prestations.inactive")}`, bouton ou pas — même
mécanique reprise ici. Pour la saisie gardée : `app/api/parametres/agences/creer/route.ts` et
`app/api/clients/creer/formulaire.ts` capturent « ce qui avait été soumis » (`champsResoumis`) AVANT toute
validation et le reportent au refus (9BR-TP-A4b-MESSAGES) — même mécanique adaptée au volet du référentiel
matériel (trois formulaires au lieu d'un, préfixe `cr_` plutôt qu'une page dédiée).

## Ce qui a été livré

1. **État écrit en clair** — `ActionsLigne` affiche désormais `{etatEnClair}` (le mot « Actif »/« Inactif »)
   systématiquement, le bouton de bascule s'ajoutant seulement si `peutEcrire`. Visible dans le tableau (≥900 px)
   ET la carte (<900 px), les deux partageant `ActionsLigne`.
2. **Saisie gardée après un refus** :
   - `champsResoumisFamille`, `champsResoumisModele`, `champsResoumisSousType`
     (`app/api/parametres/materiel/saisie-recue.ts`) — ce qui avait été soumis, capturé AVANT la validation Zod,
     un champ absent du formulaire devenant une chaîne vide plutôt qu'`undefined` (même raisonnement que les
     fonctions voisines).
   - `versLeReferentiel` accepte un `champs?: Record<string, string>` optionnel, reporté dans l'URL préfixé `cr_`
     (`cr_code`, `cr_marque`, …) — préfixe choisi pour ne jamais heurter les paramètres existants (`onglet`,
     `famille`, `q`, `etat`, `volet`, `id`, `motif`, `ligne`).
   - Les six routes (`familles/creer`, `familles/[id]/modifier`, `modeles/creer`, `modeles/[id]/modifier`,
     `sous-types/creer`, `sous-types/[id]/modifier`) capturent `champsResoumisXxx(formulaire)` avant d'appeler le
     schéma, et le passent à **chaque** retour de refus (schéma invalide ET motif du dépôt — code pris, famille
     hors société, etc.).
   - `PageMateriel` lit les `cr_*` (`champsSoumisDepuis`) et les transmet, via `VoletMateriel`, au formulaire
     ouvert (`soumis?: Record<string, string>`). Chaque champ affiché lit `soumis?.champ ?? valeurs?.champ` — la
     saisie refusée prime sur la base, et SANS refus (`soumis` absent), le comportement est identique à avant ce
     lot. `etatActifAffiche` fait de même pour la case « Active ».
   - Le `<select>` « Famille » du formulaire Modèle/Sous-type suit la même règle (`soumis?.famille_id ?? …`), si
     bien que la liste des sous-types choisissables reste cohérente avec la famille qui avait été soumise, pas
     seulement la première famille par défaut.
3. **Hors périmètre, nommément** — aucune migration, aucune colonne : la LIMITE CONNUE « changer la famille dans
   le `<select>` sans recharger ne met pas à jour la liste des sous-types » (absence d'interactivité côté client)
   n'est PAS celle que ce lot ferme, et reste entière.

## Épreuves

- **`tests/unit/materiel/champs-resoumis.test.ts`** (nouveau) — les trois fonctions `champsResoumisXxx` capturent
  EXACTEMENT ce qui a été soumis (y compris une périodicité invalide comme `"abc"`, un champ absent devenu chaîne
  vide), jamais une valeur réinterprétée.
- **`tests/unit/materiel/suite.test.ts`** — deux scénarios ajoutés à la description `versLeReferentiel` : `champs`
  voyage préfixé `cr_`, et seulement quand il est donné (son absence ne pose aucun paramètre `cr_*`).
- **`tests/e2e/9l39-materiel-deuxieme-passe.spec.ts`** (nouveau, scène propre `9L39-`) :
  1. l'état « Actif » est visible dans le tableau (1280 px) ET la carte (375 px) pour un rôle qui peut écrire, à
     côté du bouton « Désactiver » — jamais le bouton seul ;
  2. une création de famille refusée pour code déjà pris rouvre le volet avec le code ET le libellé tapés
     (jamais un formulaire vide), motif affiché ; la correction ne retape QUE le code en défaut, le libellé n'est
     pas retouché, et la création aboutit.
- **`pnpm test`** (6074 tests), **`pnpm test:isolation`** (2567 tests, un faux rouge isolé rejoué seul — plan
  PostgreSQL `bitmap heap scan` au lieu de `hashed subplan` sur `modele_materiel`, reproductible AUSSI sur le code
  AVANT ce lot via un stash temporaire : dépend des statistiques de la base partagée, pas de ce lot) et
  **`CI=1 pnpm verify`** passent tous, rejoués en avant-plan.
- Régression ciblée : `tests/e2e/9i95-refonte-parametres-materiel.spec.ts` et
  `tests/e2e/9k18a-materiel-retour-onglet.spec.ts` rejoués entiers, verts.
  `tests/e2e/9k17a-materiel-sous-type.spec.ts` a un test préexistant qui échoue par timeout (« un modèle choisit
  le sous-type créé plus haut ») **quand il est rejoué juste après `9i95`** dans la même commande — reproduit à
  l'identique sur le code d'AVANT ce lot (stash temporaire, même résultat), donc **non causé par ce lot** ; seul
  dans sa propre commande, ce test passe. Signalé plutôt que caché.
  `pnpm test:e2e` en entier n'a pas été rejoué (budget du lot, mémo du poste : plus de 30 minutes à un worker) ;
  la file de nuit joue `verify:full`.

## Captures

`docs/propositions/9L39-MATERIEL-DEUXIEME-PASSE/captures/` — AVANT (ancien code, obtenu par un `git stash`
temporaire des fichiers du lot, jamais commité) et APRÈS (code livré), à 1280 et 375 px :
- `etat-en-clair-{AVANT,}-{1280,375}.png` — la liste des familles ; AVANT montre le bouton seul, APRÈS montre
  « Actif » écrit à côté.
- `refus-code-pris-volet-rouvert-{AVANT,}-{1280,375}.png` — le volet rouvert après le refus de code dupliqué ;
  AVANT montre les deux champs VIDES, APRÈS montre le code et le libellé tapés, conservés.
- `refus-code-pris-apres-correction-1280.png` — la famille créée après correction du seul champ en défaut.

`docs/captures/` (la prise de vue complète de l'application) n'a pas été rejouée — même limite que les lots
précédents : `docs/captures/README.md` exige un geste humain irréductible (choisir un mot de passe via un lien de
premier accès émis, suivi dans un navigateur) qu'une session non interactive ne peut pas accomplir.

## Feuille de route

`lib/feuille-de-route/contenu.ts` — l'élément « Page Matériel, deuxième passe » retiré de « À écrire après la
démo », ajouté à « Livré depuis le 31/10 » (statut `livre`, référence 9L39). `DATE_ETAT_FEUILLE_DE_ROUTE` avancée
au 24/11/2026.
