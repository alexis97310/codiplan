# 9CB-TP-UX1-3-COMPOSANTS — passation

## Ce que j'ai changé (et ce que ça change pour l'exploitation)

**Une planche d'icônes maison, `components/ui/icone.tsx`** (D139) — dix-huit
icônes (`chev-r`, `check`, `info`, `alert`, `alert-circle`, `check-circle`,
`inbox`, `home`, `calendar`, `clipboard`, `user-off`, `building`, `pin`,
`machine`, `shield`, `settings`, `upload`, `phone`), transcrites en JSX
depuis `ICONS` de `docs/propositions/ergonomie-2026-09-28/
maquette-toutes-pages.html` (:1624-1729, 104 icônes au total dans la
planche source), confrontées élément pour élément, attribut pour attribut
(`tests/unit/ui/icone.test.tsx`, 28 épreuves). Aucune dépendance ajoutée.

**Cinq composants de base neufs**, sans appelant dans `app/` aujourd'hui —
`Priorite`, `BandeDecomptes`, `Onglets`, `Message`, et `EtatVide` qui gagne
`titre`/`icone` facultatifs sans changer son rendu par défaut. `Badge` gagne
un gardien (« le mot toujours », aucun appel vide) sans changer sa
signature — deux appels réels passent un nombre ou deux enfants, `children:
string` aurait été faux.

**Quatre tuiles de chiffres deviennent cliquables, avec un chevron** (D140) —
`Kpi` gagne un `href` facultatif ; sans lui, le DOM est inchangé. `kpi-bloques`
et `kpi-en-retard` (tableau de bord), `kpi-en-cours` et `kpi-en-attente`
(registre) mènent désormais à la liste exacte qu'elles comptent ; le lien
secondaire déjà posé sous chaque tuile reste, inchangé.

**Le menu porte une icône devant chaque destination**, lien seulement — une
table `chemin → NomIcone` dans `components/navigation/barre.tsx` (douze
entrées, celles de `navModel()` de la maquette du 28/09), `lib/navigation/
entrees.ts` non modifié. « Portail client » (back-office et portail) reste
sans icône : la maquette ne la dessine pas.

**Pour l'exploitation** : rien de tout cela n'est encore visible sur un
écran réel sauf les tuiles et le menu — les cinq composants de base
attendent un appelant (voir « ce qui reste à faire »). Un exploitant qui
clique aujourd'hui sur « Dossiers bloqués », « En retard », « En cours » ou
« En attente » ouvre directement la liste que le chiffre annonçait déjà,
sans chercher le petit lien en dessous.

## Ce que j'ai mesuré (comptes AVANT/APRÈS)

**Icônes** : 18/18 confrontées à `ICONS` de la maquette, contour identique
(`tests/unit/ui/icone.test.tsx`) ; `package.json` sans bibliothèque
d'icônes, dépendances inchangées (vérifié par grep et par le diff du
commit).

**Captures**, AVANT (`6ad8e45`) → APRÈS (`7af3c71`), 35 écrans × 3 largeurs
(`docs/propositions/9CB-TP-UX1-3-COMPOSANTS/captures/README.md`) :

| Largeur | Textes < 12 px | Cibles sous le seuil | Débordement | Erreurs |
| ------- | -------------- | --------------------- | ------------ | -------- |
| 1280 px | 2 → **2**      | 0 → 0                  | 0 → 0        | 0 → 0    |
| 1024 px | 2 → **2**      | 0 → 0                  | 74 → 74      | 0 → 0    |
| 375 px  | 2 → **2**      | 367 → 367              | 52 → 52      | 0 → 0    |

Aucune colonne ne bouge — attendu, ce ticket ne touche ni taille de texte ni
mise en page sur un écran déjà capturé.

**Les tuiles**, une ligne chacune (remesurées après 9BX, condition tenue
sauf mention contraire) :

| Page | `data-bloc` | URL | Lignes comptées par l'e2e | Statut |
| --- | --- | --- | --- | --- |
| `/tableau-de-bord` | `kpi-interventions` | — | — | **INERTE** — condition non remplie avec confiance (voir plus bas) |
| `/tableau-de-bord` | `kpi-occupation` | — | — | INERTE — « non calculé », aucun chiffre |
| `/tableau-de-bord` | `kpi-bloques` | `/interventions?vue=bloquees` | badge de l'onglet « Bloquées » | **CLIQUABLE**, éprouvé |
| `/tableau-de-bord` | `kpi-vgp` | — | — | INERTE — aucun filtre « dépassées + à venir » sur `/vgp` |
| `/tableau-de-bord` | `kpi-en-retard` | `/interventions?vue=en_retard` | badge de l'onglet « En retard » | **CLIQUABLE**, éprouvé |
| `/interventions` | `kpi-semaine` | — | — | INERTE — autre critère que `?vue=a_venir` (tout statut vs. planifiée/affectée) |
| `/interventions` | `kpi-en-cours` | `/interventions?vue=en_cours` | badge de l'onglet « En cours » | **CLIQUABLE**, éprouvé |
| `/interventions` | `kpi-en-attente` | `/interventions?vue=bloquees` | badge de l'onglet « Bloquées » | **CLIQUABLE**, éprouvé |

Les quatre CLIQUABLES sont éprouvées par `tests/e2e/tuiles-cliquables.spec.ts`
(8 épreuves, toutes vertes au premier passage) : chiffre de la tuile = compte
de l'onglet qu'elle ouvre, lu dans le même passage (jamais un nombre absolu,
`fullyParallel`), plus le focus visible de 9BZ. Les quatre INERTES sont
éprouvées dans le même fichier (aucun rôle `link` sur la tuile elle-même).

**`kpi-interventions` — la condition de 9BX n'a pas pu être vérifiée avec
confiance.** Le ticket conditionnait ce lien à un test vert « chiffre =
interventions du jour dans `[data-maquette-bloc="vue-jour"]` ». Une
recherche dédiée (agent Explore) montre que la vue jour du planning répartit
ses cartes sur TROIS zones DOM distinctes — la grille horaire (`data-bloc`
par intervention, correct), la ligne « sans heure » (`data-tiroir-declencheur`,
sans marqueur de comptage), et `HorsGrille` (aucun `data-*` du tout, un total
déjà affiché en clair) — sans convention de comptage agrégé existante dans le
dépôt. Écrire un total combiné aurait été fragile (risque de compter juste
sur la scène de démonstration et faux en production dès qu'une intervention
est sans heure ou sans technicien). J'ai retiré le `href`, conformément à la
clause de repli du ticket (point 3.d) : « si l'un rougit, tu retires le href
et tu l'écris en passation » — ici, le risque a été jugé trop élevé pour même
tenter le test. **Aucun test n'a rougi deux fois** : je n'ai pas écrit ce test
du tout, après avoir mesuré le coût.

## Ce que j'ai tranché et pourquoi

- **`font-extrabold` (800) pour les graisses 850 et 750 de la maquette** —
  `Priorite`, `BandeDecomptes`, `Onglets` : aucune classe Tailwind ne vaut ni
  l'une ni l'autre ; `800` est déjà la convention du dépôt pour `850`
  (`components/mise-en-page/page.tsx`, `Kpi`), et je l'ai étendue à `750`
  (écart de 50 dans les deux sens, aucune raison de trancher autrement).
- **Aucune classe de rayon sur `Priorite`** — la maquette demande 6 px, et
  aucun jeton (`--radius-sm/md/lg/xl` = 10/12/14/18) ne vaut 6 : plutôt que
  d'en approcher un, j'ai laissé la puce sans rayon (carrée à angles droits
  via l'absence de classe), une lecture littérale de « pas de jeton, pas de
  classe ».
- **La couleur de `Priorite` vient de `tonDePriorite`/`CLASSES_TON` (GR5),
  jamais de `.prio.p1`…`.prio.p4`** — la maquette peint P1 en rouge plein et
  P2 en `#8a5600` (hors jeton) ; GR5 (26/09/2026) a déjà tranché P1
  rouge/P2 orange/P3-P4 gris pour les CINQ écrans qui affichent une priorité,
  partagée par `tonDePriorite`. Une seconde correspondance ici aurait refait
  la faute que GR5 a fermée.
- **`Message` n'a que trois tons** (`succes`/`avertissement`/`refus`,
  `TonMessage` existant) — la maquette en propose quatre (`info` en plus) ;
  je n'ai pas ajouté de quatrième ton non demandé par le ticket, qui ne cite
  que les trois existants.
- **Le lien de la tuile réutilise l'URL déjà écrite pour le lien secondaire**,
  jamais une seconde forme — `href={CLASSES_LIEN_TUILE href}` recopié tel
  quel sur `<Kpi>`, pour que les deux liens (tuile et lien sous la tuile)
  mènent physiquement au même endroit.
- **`tests/unit/navigation/icones-du-menu.test.ts` → `.test.tsx`** — le
  fichier rend `<BarreDeNavigation>` (JSX), un `.ts` ne compile pas ; même
  raccord que tous les fichiers de rendu du dépôt.
- **Le compte `direction@codima.test` pour `COURRIEL`/`COURRIEL_MULTI`,
  `garnier@codima.test` pour `COURRIEL_TERRAIN`**, sans compte portail —
  même choix que 9BZ/9CA, pour la même raison (aucun compte portail ne peut
  recevoir de mot de passe aujourd'hui).
- **Deux bases locales jetables distinctes** (`codiplan_captures_9cb`,
  `codiplan_captures_9cb_apres`) plutôt qu'une resemée — le second facteur
  activé pendant AVANT n'est pas rejouable pour APRÈS sans son secret.

## Ce que je n'ai PAS fait

- **`kpi-interventions` n'est pas cliquable** — voir « ce que j'ai mesuré »,
  reste la reouverture de D140 (:5079) : « le jour où l'exploitation demande
  qu'une tuile précise reste inerte […], cette page se rouvre ».
- **Les cinq composants de base n'ont aucun appelant** dans `app/` — c'était
  hors territoire de ce ticket (`Kpi`/`Badge`/`EtatVide` seuls y touchent, et
  seulement pour `href`). Voir « ce qui reste à faire ».
- **Aucune icône dans les tuiles ni les titres de carte** (`tile()` :1789,
  `card()` :1796 de la maquette) — D139 dit « menu et boutons », pas les
  tuiles ni les cartes ; je m'y suis tenu à la lettre.
- **Les décomptes D128 (Demandes ouvertes, Techniciens indisponibles,
  Interventions sans durée) ne sont pas passés par `BandeDecomptes`** — ils
  restent rendus par `<Kpi>` (sans `href`, exclu de D140 par :5075) ; le
  composant existe, personne ne l'appelle encore.
- **Aucun survol posé sur `BandeDecomptes`** (`#9db6cf`, hors jeton) — voir
  « valeurs à fixer ».
- **`button.tsx` et `carte.tsx` non modifiés** — aucune variante ni hauteur
  changée sur `Button` (D139 ne demande rien de plus que l'icône elle-même,
  déjà couverte par sa règle d'échappement `size-*` — testée) ; `carte.tsx`
  n'a ni menu ni bouton, D139 ne le concerne pas.
- **« Un seul primaire par zone »** — MESURE demandée par le ticket, jamais
  faite : aucune page n'a été modifiée dans une mesure qui l'exigerait.

## Les pièges pour la session suivante

- **Un `getByText`/`getByRole({name})` avec une chaîne littérale, dans un
  fichier `.tsx` qui rend du JSX, est une chaîne visible hors dictionnaire**
  (L0-11, `tests/unit/i18n/sans-chaine-visible-en-dur.test.ts`) — y compris
  pour un NOMBRE (`getByText("3")`). Contourné en lisant `.textContent` et en
  comparant à `String(3)` (jamais `toHaveTextContent`, qui EST une requête
  d'écran repérée par le gardien), ou en import­ant une clé `fr[…]`
  existante comme texte de test — jamais une prose fabriquée, même pour un
  composant sans rapport avec le sens de la clé réutilisée.
- **La vue jour du planning n'a pas de comptage agrégé** — voir « ce que j'ai
  mesuré » pour `kpi-interventions`. Si un ticket futur veut la rendre
  cliquable, il faudra soit poser un marqueur `data-*` commun aux trois
  zones (grille, sans-heure, hors-grille), soit lire le total côté serveur
  et le comparer au lieu de compter le DOM.
- **`next start -p 3100` lancé à la main pour `scripts/captures.mts` doit
  être arrêté avant tout `pnpm exec playwright test`** — sinon le webServer
  de Playwright réutilise ce port occupé par la MAUVAISE base (piège déjà
  nommé par 9BZ/9CA) ; `ss -ltnp | grep 3100` puis `kill <pid>`, jamais
  `pkill -f "next start"` (tue aussi le shell appelant).
- **`ICONS` de la maquette est un objet JS avec des clés parfois nues
  (`home:`) et parfois entre guillemets (`"chev-r":`)** — le motif de
  lecture dans `icone.test.tsx` (`(?:"${nom}"|\\b${nom}):`) gère les deux ;
  un futur ajout à la planche qui casserait ce motif ferait échouer le test
  AVANT de mal transcrire une icône, jamais après.

## Ce qui reste à faire

- **Poser un appelant pour les cinq composants de base** — `Onglets` pour
  `ONGLETS_REGISTRE` (`app/(back-office)/interventions/page.tsx:610-627`,
  actuellement une liste de `<Link>` recopiée) ; `Priorite` pour la puce du
  registre (`:811-813`) et du planning (deux `<Badge ton={tonDePriorite}>`
  recopiés) ; `BandeDecomptes` pour les trois décomptes D128 du tableau de
  bord (spec §3.4 :259) ; `Message` pour les bandeaux de compte rendu
  existants (imports, formulaires) ; `EtatVide` avec `titre`/`icone` pour un
  état vide qui a aujourd'hui un texte seul.
- **`kpi-interventions`** — reste inerte, condition non remplie. Un futur
  ticket qui veut la rendre cliquable doit d'abord poser une convention de
  comptage pour la vue jour (voir « pièges »).
- **`components/planning/pose.tsx` et `components/interventions/
  trouver-creneau.tsx`** — les 2 dernières classes sous 12 px du dépôt,
  territoire de 9BW-AVERT-POSE-FICHE, toujours hors de portée (nommé par
  9BZ et 9CA, inchangé ici).
- **VALEURS À FIXER PAR ALEXIS** (rien n'a été décidé, comme demandé) :
  - Icônes de « Portail client » (back-office ET portail) — la maquette du
    28/09 ne dessine ni l'une ni l'autre (:5631).
  - Icône de menu au repos (`#72b5ee`, :77) — hors jeton, laissée à l'encre
    courante (`text-app-chrome-lien`, héritée).
  - Chevron de tuile au repos (`--muted-2`, :190) — hors jeton, laissé à
    l'encre courante héritée de `Kpi`.
  - Survol de tuile (`#9db6cf`, ombre, translation, :184) — non posé,
    `a.tile:hover` de la maquette porte trois effets hors jeton (couleur de
    bordure, ombre, translation verticale) ; `Kpi` n'en reprend aucun.
  - « En retard » à zéro : la maquette ôte le lien (:2873), D140 dit
    « toutes » — laissée cliquable même à 0, comme demandé.
  - Icônes dans les tuiles (:1789) et titres de carte (:1796) — hors D139,
    non posées.
  - Puce de priorité : rayon 6 px (aucun jeton) ; P1 plein/P3-P4 en contour
    (spec :256) contre GR5 — GR5 retenu, la géométrie « plein/contour » de
    la maquette non reprise.
  - `Message` : ton « information » (maquette :339, absent de `TonMessage`) ;
    trois tons seulement.
  - Interligne/graisse « plus petit texte » (§3.2, 700-850) — les composants
    neufs suivent leurs propres graisses lues sur `.prio`/`.strip-i`/`.tab`,
    jamais celle-ci.
  - Bouton : hauteurs 32/40/48 (56 au terrain) et rayon 9 (spec :255) contre
    `h-8/h-9/h-10` et `rounded-md` — non repris, `button.tsx` intouché.
  - Retrait du lien secondaire sous chaque tuile cliquable (doublon avec la
    tuile elle-même) — gardé tel quel, le ticket l'exige explicitement.
