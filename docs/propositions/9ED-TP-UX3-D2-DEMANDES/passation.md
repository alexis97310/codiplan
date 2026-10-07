# Passation — 9ED-TP-UX3-D2-DEMANDES

Commit final : `e5763e56` (4 commits sur cette branche, par-dessus `40c469f6`,
main au départ du lot). Aucune migration, aucun push.

## Ce que j'ai changé

**Liste `/demandes`** (`app/(back-office)/demandes/page.tsx`) : colonnes
« Reçue (deux niveaux) · Client·site (deux niveaux, machine en second) ·
Demande (coupée à deux lignes) · Source », puis une cellule de droite qui
groupe l'urgence, l'état et un bouton-lien « Qualifier » (gardé par
`qualifier_affecter`, aucun POST depuis la liste) sur « À traiter », ou
« Suite » sur « Traitées ». Plus de colonne N° ni de colonne Urgence
séparée — aucune donnée ne les porte (`Demande.numero` reste NUL partout).

**Fiche `/demandes/[id]`** (`app/(back-office)/demandes/[id]/page.tsx`) :
titre devenu « <client> · <site> » (`titreFiche` revu — pas « Demande —
<client> »), surtitre « Demande · DEM-… » ou « Demande · Numéro provisoire »
(prop `surtitre` neuve de `Page`), sous-titre « Reçue le JJ/MM à HH:MM ·
<source> ». Carte « Ce qui est demandé » restructurée (citation, grille
Client/Site·commune/Machine/Donneur d'ordre, puis — sans rien retirer —
agence déduite, source, machine à l'arrêt, date souhaitée, interlocuteur,
déposée le, motif de clôture). Carte « Transformer en intervention » qui
change de forme selon le statut : `nouvelle` → refus nommé + Qualifier +
Clore (repliée sous son bouton, `<details>`) ; `qualifiee` et autorisé → le
formulaire de création EN LIGNE (Nature, Priorité en boutons radio, Machine,
Mode de valorisation, Durée, Description), posté vers `/api/interventions
/creer` ; figée → un message. Carte « Interventions sur cette machine »
(4 lignes les plus récentes + « Tout voir », décision 26 d'Alexis).

**Décision 14 d'Alexis** (`lib/interventions/depot.ts`,
`creerIntervention`) : quand `demande_id` est fourni, la capacité
`qualifier_affecter` est désormais exigée (refus `demande.refus
.capacite_requise` avant toute lecture), et — dans la MÊME transaction,
après les refus existants (IN-42/D164) et avant l'écriture de
l'intervention — la demande `qualifiee` passe `transformee`
(`updateMany` sous condition de statut). Un second envoi concurrent sur la
même demande trouve `count === 0` et se refuse
(`intervention.refus.demande_deja_traitee`) : plus un seul geste manuel
« Marquer comme transformée » à jouer après une création normale. Ce
dernier reste offert, inchangé, pour une intervention née AVANT cette
décision (le filet que demandes.spec.ts et demandes-marquer-transformee.spec
.ts éprouvent déjà).

**`components/ui/choix.tsx`** (neuf) : groupe de boutons radio natifs, rien
coché sans `valeurInitiale` (IN-02, IN-28). **`components/mise-en-page
/page.tsx`** : prop `surtitre` qui remplace le surtitre de domaine déduit du
chemin.

## Ce que j'ai mesuré

- `pnpm format:check`, `pnpm typecheck`, `pnpm lint` : verts, à chaque
  commit.
- `pnpm test` (unitaires) : 400 fichiers, 4230 tests, verts — dont les
  épreuves neuves (`tests/unit/demandes/presentation.test.ts`,
  `tests/unit/ui/choix.test.tsx`, `titre-fiche.test.ts` revu).
- `pnpm test:isolation` : 163 fichiers, 1474 tests, verts — dont les 4
  épreuves neuves de la décision 14 (`tests/isolation/demandes-2.test.ts`) :
  capacité manquante refusée avant écriture, transformation automatique,
  double envoi concurrent refusé sans écrire de seconde intervention, refus
  antérieur (machine d'un autre site) qui laisse la demande `qualifiee`.
- `pnpm build` : vert (production).
- `CI=1 pnpm verify` (format + typecheck + lint + test + isolation + build)
  : **vert, rejoué en entier, deux fois** (`/tmp/verify-full.log`, aucun
  FAIL ni erreur).
- `npx playwright test` **ciblé** sur les fichiers que ce lot touche ou que
  la décision 14 pouvait faire rougir, chacun REJOUÉ APRÈS correction et VERT
  : `demandes.spec.ts` (7/7), `demandes-2.spec.ts` (1/1, réécrit),
  `demandes-marquer-transformee.spec.ts` (3/3, dont le test 3 réécrit),
  `demande-titre.spec.ts` (1/1, réécrit), `captures-9dca-droits-terrain
  -demandes.spec.ts` (4/4), `captures-9al-gr16-textes.spec.ts` (8/8, non
  modifié). **`CI=1 pnpm test:e2e` (les 262 fichiers) n'a PAS été rejoué en
  entier** — voir « ce qui reste à faire ».
- Captures AVANT (commit `40c469f6`) / APRÈS (`e5763e56`), à 1280 et 375 px,
  sur une scène jetable : liste (deux onglets), fiche nouvelle/qualifiee
  /close. Vérifiées à l'œil (voir `captures/`) : le formulaire en ligne,
  les boutons radio de priorité, la grille, l'onglet « Qualifier » rendent
  comme attendu.

## Ce que j'ai tranché, et pourquoi

- **« Marquer comme transformée » reste offerte SANS condition sur les
  interventions issues**, malgré une phrase du corps du ticket qui semblait
  dire le contraire (« tant que… ET qu'une intervention est issue ») :
  `demandes.spec.ts:240-294` et `demandes-marquer-transformee.spec.ts
  :153-181` sont explicitement nommés « restent INTACTS » par l'addendum du
  07/10, et les deux exercent ce bouton sur une demande qui n'a ENCORE
  aucune intervention issue. J'ai suivi les tests nommés plutôt que la
  phrase résumée.
- **« Clore sans suite » replié sous son bouton** (`<details>`), plutôt
  qu'un dialogue de confirmation portant le `<select>` du motif :
  `BoutonAvecConfirmation` n'enrobe qu'un `ReactNode` dans un `<p>`, pas un
  `<form>` séparé, et le ticket nomme explicitement cette échappatoire
  (« si le dialogue ne peut pas porter le select, garde le formulaire en
  ligne replié »). Conséquence : `demandes.spec.ts` ouvre le `<details>`
  avant d'interagir avec le `<select>`.
- **Le pied « Clore / Créer » n'est pas une seule ligne flexbox** comme la
  maquette le montre : les deux sont des `<form>` DISTINCTS (jamais
  imbriqués, HTML invalide sinon), et `BoutonCreer` (le filet visuel anti-
  double-clic de `/interventions/nouvelle`) n'accepte pas de `form=""` —
  je ne l'ai pas modifié (hors territoire du ticket, réservé à 9EI). Le
  bouton « Créer » est un `<Button type="submit">` ordinaire, DANS le
  formulaire de création ; « Clore sans suite » est au-dessus, dans son
  propre `<details>`. La garantie réelle reste serveur (relecture de l'`id`,
  §PARCOURS-1) : la perte est seulement visuelle/UX, nommée ici.
- **La pastille d'alerte d'onglet n'est pas construite** : `chargerCalendrierAgence`
  coûte déjà DEUX lectures par agence même avec son cache ; la contrainte du
  ticket (pas plus d'une lecture par agence) est atteinte. Dit dans D176.
- **Capacité `qualifier_affecter` exigée dans `creerIntervention`, pas
  seulement dans la route** : choix du pilote du 07/10 cité par le ticket,
  implémenté en l'ajoutant comme refus nommé AVANT toute lecture de la
  demande, prouvé par isolation (TEC refusé).

## Ce que je n'ai PAS fait

- Colonne N°, volet « + Demande », origine « de <technicien> · <intervention> »,
  « créée par », carte « Intervention d'origine » — aucune donnée ni route
  dans le produit (constat 4 du ticket, D125/D128).
- `<title>` dynamique (le client) — coûterait une lecture de plus
  qu'aujourd'hui (`generateMetadata` ne partage pas celle de la page).
- Pastille d'alerte d'onglet (30 minutes, CDC §16.1) — contrainte d'une
  lecture par agence non atteignable sans un calendrier mémorisé plus
  largement.
- `/interventions/nouvelle` et sa Priorité : non touchés (lot 9EI à suivre).
- **`CI=1 pnpm test:e2e` sur les 262 fichiers n'a pas tourné en entier** —
  coût horaire jugé disproportionné dans le temps restant ; `pnpm verify`
  (sans e2e) est vert, et les fichiers e2e directement concernés par ce lot
  sont tous rejoués et verts individuellement (voir « ce que j'ai mesuré »).
  C'est une hypothèse, pas une mesure complète : la prochaine session (ou la
  file, qui rejoue `verify:full` elle-même avant de publier) doit confirmer
  qu'aucun autre fichier ne contient une chaîne en dur, un lien mort vers
  `/interventions/nouvelle?demande=`, ou une dépendance à l'ancien titre
  « Demande — <client> ».

## Pièges pour la session suivante

- **`sans-chaine-visible-en-dur`** refuse toute requête d'écran
  (`toContainText`, `getByText`, etc.) composée, même partiellement, d'une
  constante de scène littérale locale au fichier de test — y compris une
  constante dérivée d'aucune clé du dictionnaire. `toHaveValue` n'est PAS
  concerné (il n'est pas dans la liste des méthodes surveillées). Rencontré
  en écrivant une assertion de titre dans `demandes-2.spec.ts` ; retiré
  plutôt que contourné, la composition est déjà éprouvée par
  `demande-titre.spec.ts`.
- **`next build` manque de mémoire par défaut** sur ce poste pendant la
  vérification de types (`--max-old-space-size=3072` du script `build` a
  suffi en isolation ; un essai manuel SANS cette variable a fini en
  `FATAL ERROR: Reached heap limit`). Si `pnpm verify` OOM un jour, c'est la
  première case à vérifier.
- **Deux worktrees éphémères** ont servi aux captures AVANT/APRÈS
  (`/tmp/avant-9ed`, détruit en fin de lot avec `git worktree remove
  --force`) et un script jetable (`zzz-captures-9ed-temp.spec.ts`,
  `zzz-run-captures-9ed.mjs`, supprimés) — rien n'en reste dans le dépôt
  (`git status --porcelain` vide avant chaque commit).
- `components/ui/choix.tsx` et la prop `surtitre` de `Page` sont maintenant
  posés : 9EI et 9EE (annoncés comme devant passer APRÈS ce lot) peuvent les
  réutiliser tels quels.

## Ce qui reste à faire

1. Rejouer `CI=1 pnpm test:e2e` en entier (ou laisser la file le faire) avant
   publication — c'est la seule case de `verify:full` non rejouée ici.
2. Valider auprès d'Alexis les points nommés en condition de réouverture de
   D176 : le repli du titre sur le client seul (cas non observé en
   production, `Demande.site_id` étant NOT NULL), le nombre de lignes de
   « Interventions sur cette machine » si 4 doit changer, et la
   non-construction de la pastille d'alerte d'onglet.
3. Lot 9EI (formulaire `/interventions/nouvelle`, sa Priorité) et 9EE,
   annoncés pour passer après ce lot et réutiliser `components/ui/choix.tsx`
   et `surtitre`.
