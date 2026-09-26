# 99O-CAPTURES-TEMOIN — passation

## Ce que j'ai change (et ce que ca change pour l'exploitation)

- `scripts/lib/verdict-temoin.ts` (nouveau) : le verdict d'un temoin est desormais une
  fonction PURE, `verdictDuTemoin({ corps, cheminAtteint, ecran })`, eprouvable sans
  navigateur. En plus du controle historique (le texte du temoin est-il present ?), elle
  ajoute, pour les seuls ecrans `arrivee` et `arrivee-sans-societe` : (a) le chemin
  reellement atteint doit etre le chemin declare de l'ecran ; (b) pour
  `arrivee-sans-societe` uniquement, le corps ne doit PAS porter le lien
  `t("arrivee.entrer.planning")` (« Ouvrir le planning ») et doit porter AU MOINS DEUX
  occurrences de `t("arrivee.choix.activer")` (« Travailler sur cette société »).
- `scripts/captures.mts` : `photographier()` appelle desormais `verdictDuTemoin` a la place
  de son `innerText().includes()` nu. La passe `sans-societe` (`connexionSansSociete`) ne
  reutilise plus l'identite globale `COURRIEL` : elle exige une identite DEDIEE,
  `COURRIEL_MULTI` / `MOT_DE_PASSE_MULTI`, et REFUSE avec un motif ecrit si elles sont
  absentes plutot que de retomber en silence sur `COURRIEL`. `seConnecter` a ete
  decompose : `seConnecterAvec(page, identite, choisir, secretConnu)` porte desormais la
  logique a deux tours (connexion, activation eventuelle du second facteur, reconnexion),
  et `activerSecondFacteur` REND la cle revelee au lieu d'ecrire la variable partagee
  `cleActivee` — necessaire pour que l'identite MULTI, si elle doit s'enroler, ne pollue
  pas le secret de reconnexion de `COURRIEL`.
- `tests/unit/captures/verdict-temoin.test.ts` (nouveau) : douze scenarios, dont les quatre
  demandes par le ticket (page « societe active » -> refusee ; un seul bouton -> refusee ;
  chemin != `/arrivee` -> refusee ; deux boutons + pas de lien + chemin `/arrivee` ->
  acceptee), plus le temoin absent, le cas `arrivee` normal (accepte/chemin errone), et un
  ecran ordinaire (`planning`) qui ne porte AUCUNE des regles propres a l'arrivee — pour
  que la generalisation implicite ne s'installe pas en silence. Toutes les pages sont
  composees depuis `t()`, jamais en dur.

Pour l'exploitation : la PROCHAINE prise de vue qui rejoue `scripts/captures.mts` sans
`COURRIEL_MULTI` / `MOT_DE_PASSE_MULTI` verra la capture `arrivee-sans-societe` refusee
plutot que silencieusement fausse — c'est un CHANGEMENT DE COMPORTEMENT delibere : avant ce
lot, l'image pouvait etre acceptee a tort (c'est exactement ce qui s'est produit le
26/09). Le README genere documente desormais cette troisieme identite au meme rang que
`COURRIEL_PORTAIL`.

## Ce que j'ai mesure (comptes AVANT/APRES)

- `pnpm typecheck` : vert avant integration, vert apres (0 erreur).
- `pnpm format:check` : vert.
- `pnpm lint` : vert (0 avertissement, `--max-warnings 0`).
- `pnpm test` : AVANT ce lot, 268 fichiers / 2886 tests (mesure du lot precedent,
  99N-AUDITS-26-09). APRES : **269 fichiers / 2896 tests**, tous verts — soit +1 fichier et
  +10 tests, exactement ceux de `verdict-temoin.test.ts`. Aucune regression ailleurs, en
  particulier `tests/unit/captures/surface-decran.test.ts` reste vert : le nouveau fichier
  `scripts/lib/verdict-temoin.ts` n'est PAS detecte comme « restituant » par
  `tests/unit/outils/rendu-visible.ts` (aucun JSX, aucune `metadata`, aucun appel dont le
  nom correspond a une requete d'ecran de Testing Library/Playwright) — verifie en lisant
  le detecteur, pas suppose.
- `CI=1 pnpm verify:full`, execute UNE FOIS en entier au premier plan : vert de bout en bout
  (`format:check`, `typecheck`, `lint`, `test`, `test:isolation`, `build`, `feries:horizon`,
  `audit:partitions`, `test:e2e` — 298 passed, 3 skipped, aucun echec). La chaine `&&` de
  `package.json` garantit que chaque etape anterieure a reussi pour que la suivante
  s'execute ; je n'ai donc pas eu besoin de faire defiler la sortie complete pour le
  verifier.
- Aucun ecran de l'application n'a ete touche : `git diff --stat` sur ce commit ne porte
  que `scripts/captures.mts`, `scripts/lib/verdict-temoin.ts`,
  `tests/unit/captures/verdict-temoin.test.ts`.

## Ce que j'ai tranche et pourquoi

- **Le controle de chemin (regle a) est restreint a `arrivee` et `arrivee-sans-societe`**,
  pas generalise a tous les ecrans sans `decouvrir`. Le ticket dit « au moins pour » ces
  deux-la ; les autres ecrans peuvent legitimement atterrir ailleurs que leur `chemin`
  declare sans que ce soit une panne (aucun cas connu aujourd'hui, mais generaliser sans
  necessite mesuree aurait ete une regle inventee). Un test dedie (« un ecran ordinaire »)
  fixe cette limite pour qu'elle ne s'etende pas en silence demain.
- **`activerSecondFacteur` REND la cle au lieu d'ecrire `cleActivee`.** L'identite
  `COURRIEL_MULTI` peut avoir besoin de son propre enrolement (le role `direction` exige un
  second facteur, `ROLES_SECOND_FACTEUR_OBLIGATOIRE`, `lib/auth/roles.ts:91-95`) ; si la
  fonction avait continue d'ecrire la variable PARTAGEE, la reconnexion de `COURRIEL` en
  fin de script aurait pu calculer son code TOTP sur le secret du MAUVAIS compte. Chaque
  appelant (`seConnecter` pour COURRIEL, `connexionSansSociete` pour COURRIEL_MULTI) decide
  seul de ce qu'il retient.
- **`connexionSansSociete` ne conserve pas la cle revelee pour `COURRIEL_MULTI`.** Le
  ticket interdit d'ecrire un mot de passe dans un fichier ; je n'ai pas non plus ajoute de
  `SECRET_TOTP_MULTI` pour l'imprimer et permettre un rejeu sans reenrolement — ce n'etait
  pas demande, et l'ajouter aurait ete une fonctionnalite en plus du perimetre du ticket.
  Consequence acceptee : SI la base est rejouee (nouvelle prise sur la MEME base sans
  reseed), l'identite MULTI devra se reenroler a chaque execution du script, comme
  `COURRIEL` le ferait sans `SECRET_TOTP`.
- **Le README documente `COURRIEL_MULTI` au meme endroit et sur le meme modele que
  `COURRIEL_PORTAIL`** (un paragraphe apres la commande d'exemple), plutot que de creer une
  section a part : les deux jouent le meme role structurel (une identite necessaire a UNE
  seule image).

## Ce que je n'ai PAS fait

- Je n'ai pas ajoute de cle de dictionnaire : aucune n'etait necessaire, les deux textes
  compares (`arrivee.entrer.planning`, `arrivee.choix.activer`) existaient deja.
- Je n'ai pas touche `prisma/`, `app/`, ni aucune ligne de semis — territoire respecte.
- Je n'ai pas lance la prise de vue (`scripts/captures.mts` execute reellement) : aucune
  base jetable n'a ete montee pour ce lot, conformement a la consigne (« le dernier ticket
  du lot »). Le comportement de `verdictDuTemoin` est donc verifie par les tests unitaires
  et par relecture du code de l'ecran (`app/(back-office)/arrivee/page.tsx`,
  `app/(back-office)/arrivee/composants.tsx`, `app/(back-office)/arrivee/decision.ts`),
  jamais par une capture reelle.
- Je n'ai pas ajoute de `SECRET_TOTP_MULTI` (voir ci-dessus, hors perimetre du ticket).
- Je n'ai pas modifie `docs/captures/*.png` ni `docs/captures/README.md` (fichier genere,
  regenere seulement a la prochaine prise reelle).

## Les pieges pour la session suivante

- **La prochaine prise de vue reelle doit fournir `COURRIEL_MULTI` / `MOT_DE_PASSE_MULTI`**,
  sans quoi UNE SEULE image (`arrivee-sans-societe`) sera refusee — ce n'est pas une
  regression, c'est le comportement voulu par ce lot remplacant un succes silencieusement
  faux.
- **Le mot de passe de `COURRIEL_MULTI` est le MEME cliquet que celui de `COURRIEL`** si
  les deux designent la meme identite (`direction@codima.test` sur la base de
  demonstration) : `Compte` n'a pas de `societe_id`, un seul mot de passe existe par
  identite (`prisma/schema.prisma`, `model Compte`), partage entre toutes les societes ou
  elle est habilitee. Poser le mot de passe pour `COURRIEL` (etape 3 du README) le pose
  donc AUSSI pour `COURRIEL_MULTI` si c'est la meme identite — inutile de rejouer
  l'amorcage une seconde fois pour la meme personne.
- **`direction@codima.test` exige un second facteur** (`Role.direction` est dans
  `ROLES_SECOND_FACTEUR_OBLIGATOIRE`). La premiere execution de `connexionSansSociete` sur
  une base fraiche l'enrolera comme n'importe quel autre role sensible ; la cle n'est
  imprimee nulle part pour cette identite (voir « Ce que je n'ai pas fait »).
- Si un futur ticket generalise le controle de chemin (regle a) a d'autres ecrans, relire
  d'abord les ecrans a `decouvrir` (`imports-rapport`, `intervention-detail`,
  `client-detail`, `terrain-intervention`) : ils naviguent DELIBEREMENT hors de leur
  `chemin` declare, et un controle naif les ferait tous refuser.

## Ce qui reste a faire

- Lancer reellement `scripts/captures.mts` (base jetable + semis + amorcage +
  `COURRIEL_MULTI`) pour produire les DEUX nouvelles images `arrivee--*` et
  `arrivee-sans-societe--*` qui, cette fois, doivent differer — et confirmer au `cmp`
  qu'elles ne sont plus identiques. C'est le ticket suivant, explicitement exclu de
  celui-ci.
- Remplacer, dans les trois audits qui ont cite l'image fausse comme preuve (nommes dans
  l'en-tete du ticket), la reference a l'ancienne capture une fois la nouvelle prise de vue
  faite.

## Reponse a la question posee par le ticket (§5)

`scripts/amorcage-premier-compte.mts --reemettre --societe <uuid> --email <courriel>`
CONVIENT a un compte habilite sur deux societes — lu dans `lib/auth/amorcage.ts:403-470`
(`reemettre`) : elle ne verifie l'habilitation QUE sur la societe passee en argument
(`utilisateurSociete.count({ societe_id: demande.societeId, utilisateur_id })`, doit etre
`> 0`), et le cliquet porte sur `Compte.mot_de_passe` qui n'a pas de `societe_id` — un seul
mot de passe par identite, partage entre toutes ses societes. Il suffit donc de passer
N'IMPORTE LAQUELLE des societes ou l'identite multi-societe est habilitee ; aucune reference
a un « nombre de societes » n'entre dans son code. Verifie par lecture, pas par execution.
