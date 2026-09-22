# BON-1 — passation

## Ce que j'ai changé

**Avant ce lot, aucun document d'intervention n'existait** — le constat du ticket est
vérifié : le seul « imprimer » du produit était `machine.qr.imprimer`. Un technicien qui
finissait une intervention n'avait rien à laisser au client.

**Depuis ce lot**, une route neuve `/interventions/[id]/bon` affiche un bon imprimable, mis
en page pour un A4, avec ce que la base porte déjà :

- l'en-tête société (raison sociale, mentions légales — jamais le logo, hors périmètre de
  L0-09) ;
- client, site, agence ;
- la ou les machines rattachées, ou l'absence nommée (« aucune machine… porte sur
  l'ensemble du site ») ;
- les segments de travail (`segment_travail`), un par technicien et par aller, avec leur
  durée et la somme — **lus, jamais ressaisis** ;
- le taux horaire en vigueur **à la date de l'intervention** (`tauxEnVigueur`), ou son
  absence nommée ;
- le forfait de déplacement, s'il y en a un ;
- le montant total hors taxes, tel que la clôture l'a figé (`intervention.montant_ht`) —
  **sauf si le taux ne se retrouve plus aujourd'hui**, auquel cas le total est tu lui aussi
  (voir « ce que j'ai tranché »).

Un bouton « Imprimer le bon » (`components/interventions/actions-bon.tsx`) déclenche
`window.print()` après avoir isolé le bon du reste de l'écran, par le même mécanisme que
la carte QR d'une machine (`print-qr` → `print-bon`, dans `app/globals.css`). Un lien
« Bon d'intervention » a été ajouté sur la fiche existante pour que l'écran ait un
appelant.

Les cinq blocs du lot 17 (prestations, commentaire, suite à donner, photos, signature) sont
nommés dans une note visible à l'écran mais **masquée à l'impression** (`print:hidden`) :
rien de vide n'est remis au client.

**Pour l'exploitation** : un technicien (rôle `technicien`, capacité `consulter_planning`
en degré restreint) peut désormais ouvrir cette page pour SES interventions et
l'imprimer sur place. Un rôle sans `voir_montants_vente` (ex. `admin_societe`) voit le bon
sans aucun montant, exactement comme sur la fiche — c'est une règle déjà arbitrée (D37,
3.8), pas une nouvelle décision de ce lot.

## Ce que j'ai mesuré

- `pnpm typecheck`, `pnpm lint`, `pnpm format:check` : verts.
- `pnpm test` (unitaires) : 2569 tests passés, 0 échec (dont
  `tests/unit/i18n/vocabulaire-impose.test.ts`, qui a d'abord rougi — voir plus bas).
- `pnpm test:isolation` : la suite complète passe, dont mes deux scénarios neufs
  (`tests/isolation/bon-intervention.test.ts`, 2 tests, tous deux verts au premier
  passage après correction de l'ordre d'écriture des colonnes figées).
- `pnpm test:e2e` (suite complète, 138 exécutés + 2 ignorés) : vert, dont
  `tests/e2e/bon-intervention.spec.ts` et l'ajout du résolveur
  `/interventions/[id]/bon` dans `tests/e2e/tous-les-ecrans-rendent.spec.ts`.
- `pnpm verify:full` : **vert de bout en bout**, exécuté deux fois (la seconde après
  correction du gardien de vocabulaire et du gardien des résolveurs de route).
- `git diff --cached --stat` : 14 fichiers touchés, +932/-9 lignes, dont 3 fichiers
  binaires (les captures).

**Non mesuré** : je n'ai pas mesuré le rendu sur un vrai navigateur mobile (le technicien
imprime depuis son poste ou une tablette de terrain) — seul Chromium/Desktop a été
observé, via les captures et les scénarios Playwright.

## Ce que j'ai tranché, et pourquoi

1. **Un taux qu'on ne retrouve plus efface le total, même s'il est encore écrit en base.**
   `lireBonIntervention` relit `tauxEnVigueur` à la date de l'intervention, en plus de lire
   `montant_ht` : si le premier ne trouve rien, le second n'est pas montré. *Un bon doit
   pouvoir se reproduire six mois plus tard* (l'arbitrage du ticket) ; s'il ne peut plus
   reconstituer la base du calcul, il ne peut plus vérifier le montant figé, et je préfère
   taire un montant que ne plus pouvoir en répondre. Éprouvé par le second scénario
   d'isolation (le taux est retiré APRÈS une clôture réussie).

2. **Le forfait et le total sont masqués ENSEMBLE quand le taux est absent**, pas
   seulement le total : le ticket dit « ne rend aucun montant », et j'ai choisi de le lire
   au pied de la lettre plutôt que de laisser un forfait isolé sans le total qui l'englobe.

3. **La porte est `consulter_planning`**, pas une capacité neuve. Aucune capacité de
   lecture seule n'existait pour une fiche d'intervention (la fiche elle-même n'est
   protégée que par la RLS) ; `consulter_planning` est la seule qui inclut le technicien en
   degré restreint, exactement le rôle qui doit pouvoir imprimer sur le site du client.
   Ajouter une capacité dédiée aurait été une décision d'arbitrage hors du périmètre de ce
   ticket (CLAUDE.md §8).

4. **Le logo de société n'est pas affiché**, alors que `Societe.logo_url` existe : c'est
   une décision DÉJÀ prise (registre des arbitrages, ticket L0-09) — afficher un logo
   suppose un stockage de fichiers, jamais tranché. Je ne l'ai pas rouverte.

5. **Trois fonctions privées de `lib/interventions/depot.ts` sont devenues exportées**
   (`restrictionParPersonne`, `montantDuForfait`, `instantDeLAgence`) plutôt que
   dupliquées dans le nouveau module : la maison du dépôt dit qu'une seconde lecture d'un
   même critère diverge en silence, et ces trois-là portent chacune une vraie règle
   (périmètre par personne, lecture d'un forfait, fuseau de l'agence).

6. **Le montant du forfait de déplacement s'affiche avec son libellé**
   (`"Déplacement zone rouge — 4 000 XPF"`), une seule ligne plutôt que deux, pour tenir le
   bon sur une page A4 sans multiplier les lignes `dl`.

## Ce que je n'ai PAS fait

- **Aucune génération de PDF serveur** : la page s'imprime depuis le navigateur, comme le
  ticket le demande explicitement (« une page imprimable, pas un générateur de PDF »).
  `lib/pdf/` reste `(prévu)`, non construit.
- **Aucun champ nouveau, aucune migration** : le territoire l'interdisait, et rien n'en
  avait besoin.
- **Rien des cinq blocs du lot 17** (prestations, commentaire, suite à donner, photos,
  signature) : seulement nommés, jamais construits.
- **Aucun test de rendu mobile ou tablette** pour l'impression (voir « ce que j'ai
  mesuré »).
- **Aucune vérification manuelle en dehors des scripts automatisés** : je n'ai pas ouvert
  `pnpm dev` à la main pour cliquer sur le bouton d'impression ; les trois captures et le
  scénario Playwright sont ma seule preuve que le geste fonctionne dans un vrai navigateur.
- **Je n'ai pas ajouté `lib/interventions/bon.ts` à `docs/constitution/organisation-du-code.md`**
  : le territoire du ticket ne le nommait pas, et `pnpm verify:full` ne l'exige pas
  (aucun gardien n'a rougi). Si un gardien futur l'exige, la description à ajouter serait
  proche de : « `bon.ts` : LE BON D'INTERVENTION IMPRIMABLE — une lecture neuve, aucune
  règle recalculée ».

## Les pièges pour la session suivante

- **Le technicien ne voit aujourd'hui AUCUN montant sur son propre bon.** `technicien`
  n'a pas `voir_montants_vente` dans la matrice (D37, 3.8) — c'est une règle déjà
  arbitrée, pas un défaut de ce lot, mais c'est une vraie tension d'exploitation : *le
  technicien qui imprime le bon sur le site du client ne peut pas lui montrer le prix.*
  Si l'exploitation le signale, c'est un point d'arrêt (CLAUDE.md §8 : ça touche
  potentiellement à l'argent facturé à un client), pas un bug à corriger seul.
- **`lib/interventions/bon.ts` fait DEUX lectures de l'agence** dans le cas rare où
  `date_planifiee` est `null` (file d'attente) : une pour `dateVisee` (via
  `instantDeLAgence`), une pour le fuseau d'affichage des segments. Mesuré comme
  acceptable pour ce lot (une file d'attente n'a normalement aucun segment de travail
  encore), mais à surveiller si un jour une intervention en file d'attente porte des
  segments.
- **La formule de « minutes par segment »** (`Math.floor((fin - debut) / 60000)`) est
  volontairement RÉÉCRITE plutôt que tirée de `mesurer()` (`lib/interventions/compteur.ts`),
  qui n'expose que l'AGRÉGAT. Le total, lui, passe bien par `mesurer()`. Si `compteur.ts`
  change un jour sa façon d'arrondir une durée individuelle, cette ligne du bon ne le
  suivra pas automatiquement — à surveiller.
- **`tests/isolation/bon-intervention.test.ts` réutilise le forfait par préfixe de code**
  `BON-%` pour son nettoyage (`afterEach`), comme `valorisation-intervention.test.ts` le
  fait avec `DEP-%` : si un futur test choisit aussi le préfixe `BON-`, les deux
  s'effaceront l'un l'autre entre deux `it()`.
- **Les captures ont été prises via un script Playwright temporaire**
  (`tests/e2e/zzz-capture-bon.spec.ts`), supprimé après usage — il n'est donc pas
  reproductible tel quel ; son contenu est décrit ci-dessus (deux interventions
  fabriquées à partir des repères Ducos de la scène e2e, l'une close normalement, l'autre
  datée en 2015, avant tout taux connu).

## Ce qui reste à faire

- Le lot `17-BON-2` : prestations réalisées, commentaire du technicien, suite à donner,
  photos, signature du client — les cinq blocs nommés mais non construits ici.
- Trancher, si l'exploitation le demande, ce qu'un technicien sans `voir_montants_vente`
  doit pouvoir montrer sur le bon qu'il imprime (voir « les pièges »).
- Un stockage de fichiers pour le logo de société (L0-09, jamais tranché), si un jour le
  bon doit le porter.
