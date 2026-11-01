# 9I95-REFONTE-PARAMETRES-MATERIEL — passation

## La demande

Alexis, 02/11/2026 ~06:05 : « cette page : https://codiplan.vercel.app/parametres/materiel est juste mal
pensée, il faut la revoir pour améliorer l'ergonomie et l'affichage ». Trois gênes nommées (réponses à la
question du pilote) : **« Trop long, tout mélangé »**, **« Créer et modifier, pas clair »**, **« Lecture des
tableaux »**. Le gel a été déplacé à 15:00 pour ce lot.

## Les trois gênes, avant / après

| Gêne d'Alexis | Avant | Après |
|---|---|---|
| « Trop long, tout mélangé » | Familles et modèles sur une seule longue page : carte de création, tableau, un `<details>` de modification par famille, puis la même chose pour les modèles — tout défile à la suite. | Deux onglets (`Familles` / `Modèles`, `?onglet=`), chacun avec son propre titre, son décompte et sa propre liste. On ne voit qu'un sujet à la fois. |
| « Créer et modifier, pas clair » | « Ajouter » ouvrait une carte en haut de page ; « Modifier » dépliait un `<details>` par ligne, avec le MÊME formulaire recopié visuellement mais une mécanique différente (repli plutôt que volet). | « Ajouter … » et « Modifier » ouvrent tous les deux le MÊME volet latéral (`?volet=famille\|modele&id=`), le même composant de formulaire, pré-rempli en modification. Plus aucun formulaire déplié dans la liste. |
| « Lecture des tableaux » | Aucune recherche, aucun filtre d'activité ; régime VGP et périodicité déjà en clair (pastille + texte), mais noyés dans une page trop longue. | Une recherche (code/libellé ou marque/référence, sans distinction de casse) et un filtre Actifs/Inactifs/Tous (défaut Actifs) par onglet ; état vide explicite (« Aucun résultat ») quand la recherche ne trouve rien. |

Captures : `docs/propositions/9I95-REFONTE-PARAMETRES-MATERIEL/captures/` — `avant-*.png` (haut de page = tableau
des familles, tableau des modèles, un « Modifier » déplié) et `apres-*.png` (les deux onglets, la recherche avec
et sans résultat, le volet « Ajouter » et le volet « Modifier »), viewports 1280 et 375 px.

## Ce qui n'a pas changé

Les routes d'écriture (`app/api/parametres/materiel/**`), le dépôt (`lib/materiel/depot.ts`), les règles de
saisie et de VGP : hors territoire de ce lot, aucune règle métier modifiée. Le formulaire poste exactement comme
avant ; les refus nommés (`materiel.refus.*`) s'affichent de la même façon. Le filtre `?famille=<id>` existant
(utilisé en interne par le lien « N modèles », et en externe par `/vgp/a-determiner`) est conservé.

## Décisions prises en cours de route

1. **`famille` seul, sans `onglet` explicite, bascule sur l'onglet Modèles.** Le lien « Décider » de
   `/vgp/a-determiner` (hors territoire de ce lot) pointe vers `/parametres/materiel?famille=<id>#modeles` et
   n'a pas été modifié. Pour que ce lien externe continue de fonctionner sans toucher à `/vgp`, la page
   matériel traite la présence de `famille` (sans `onglet`) comme une demande implicite d'onglet Modèles
   filtré. Le fragment `#modeles` devient inerte (plus d'ancre de défilement sous un régime d'onglets), mais
   inoffensif.
2. **L'ancre `id="modeles"` a migré de la carte de tableau vers la section entière de l'onglet Modèles**
   (titre compris), pour que les anciens liens qui la visent (« Décider », « N modèles ») retrouvent un point
   toujours visible, quelle que soit la largeur — même raisonnement que 9G2B-FINITIONS-CARTES-375, étendu au
   nouveau périmètre de la section.
3. **Limite connue, HORS TERRITOIRE** : après une création, une modification ou une bascule d'activité, les
   routes de `app/api/parametres/materiel/**` redirigent TOUJOURS vers `/parametres/materiel` (avec `?motif=`
   au refus), sans jamais reporter l'onglet ni les filtres — `versLeReferentiel`
   (`app/api/parametres/materiel/saisie-recue.ts`) ne les connaît pas, et ce fichier est hors territoire de ce
   lot (`app/api/parametres/materiel/**`). `equipe`/`demandes` reportent déjà ces paramètres dans leurs propres
   routes (`suite.toString()`) : un lot futur qui ouvrirait ce fichier devrait faire de même ici. En attendant,
   une action sur un MODÈLE renvoie sur l'onglet Familles (le défaut) plutôt que de rester sur Modèles — le
   motif de refus reste visible quel que soit l'onglet par défaut. Signalé en tête de
   `app/(back-office)/parametres/materiel/page.tsx`.
4. **Les triggers « Modifier » et « Activité » partagent désormais une seule colonne « Activité »** (plutôt
   que d'ajouter une sixième colonne), pour ne pas recréer le défaut de lisibilité à 1280 px que ce lot répare.

## Épreuves — adaptations des specs existantes (point 5)

Budget §4 autorise explicitement l'adaptation d'une épreuve qui lit l'ANCIENNE structure (sélecteurs, ancres
`#modeles`, ordre des cartes), à condition de garder ce qu'elle prouve. Trois fichiers adaptés :

- **`tests/e2e/materiel-replie.spec.ts`** — portait la preuve que le formulaire de modification n'est PAS
  rendu dans le flux de la liste, et qu'un geste explicite le découvre. Le geste change (`<summary>` → lien
  « Modifier » qui navigue vers `?volet=…&id=…`), la preuve reste identique : `toHaveCount(0)` avant le clic
  (au lieu de `not.toBeVisible()`, plus strict — le formulaire n'est même plus dans le DOM), `toBeVisible()`
  après.
- **`tests/e2e/visuel-2.spec.ts`** — le lien « N modèles » vise désormais `?onglet=modeles&famille=<id>`
  (au lieu de `?famille=<id>#modeles`), « Tout afficher » vise `?onglet=modeles` (au lieu de
  `/parametres/materiel#modeles`, qui ne peut plus fonctionner sous un régime d'onglets piloté par l'URL — un
  fragment n'atteint jamais le serveur). L'ancien contrôle « les formulaires modifier suivent le même filtre »
  (comptage de `<h2>` dans des `<details>`) est remplacé par un contrôle équivalent sur le nouveau mécanisme :
  présence du bouton « Modifier » dans la ligne filtrée, pour A1 et pour B1 après « Tout afficher ».
- **`tests/e2e/9g2b-finitions-cartes-375.spec.ts`** (second scénario seulement — le premier, sur
  `/parametres/trajets`, est hors sujet) — même changement d'URL pour « Tout afficher »
  (`?onglet=modeles` plutôt que `#modeles`).

**`tests/e2e/vgp-a-determiner-lien.spec.ts` n'a nécessité AUCUN changement** : il n'éprouve que le lien
externe généré par `/vgp/a-determiner` (hors territoire), qui reste `?famille=<id>#modeles` à l'identique — la
décision 1 ci-dessus fait que la page matériel continue de l'honorer sans que ce fichier ait besoin de savoir
comment.

Nouveau spec dédié : `tests/e2e/9i95-refonte-parametres-materiel.spec.ts` — les deux onglets et leur compte
dans l'URL, la recherche (sans distinction de casse) avec son état vide, le filtre actifs/inactifs/tous,
« Ajouter une famille » puis « Modifier » cette famille depuis le volet (valeur relue en base), « Voir ses
modèles » depuis une famille puis « Tout afficher », « Ajouter un modèle » (avec la limite connue de la
décision 3), un compte sans `parametrer_societe` complet sans bouton d'écriture, et le technicien toujours
redirigé vers `/terrain` avant d'atteindre la page (D221, `app/(back-office)/layout.tsx` — le refus nommé que
`RefusAcces` portait encore dans cette page n'est plus jamais atteint en pratique ; le test éprouve donc le
comportement réel plutôt que le code mort).

## `pnpm verify:full`

Voir `verify-final.txt` dans ce même dossier.
