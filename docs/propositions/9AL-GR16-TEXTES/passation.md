# 9AL-GR16-TEXTES — passation

## Ce que j'ai changé

Neuf textes réécrits, sans changement de règle de gestion (aucune migration, aucune ligne de
semis, aucun prix, `required` inchangé partout) :

1. `clients.nouveau.sous_titre` supprimée — aucune épreuve ne la lisait, et elle expliquait un
   mécanisme déjà écrit ailleurs. `sousTitre` n'est plus passé à `/clients/nouveau`.
2. `demande.sans_numero` → « Numéro provisoire » (reprend `intervention.sans_numero`).
3. `absences.sous_titre` → « Qui n'est pas disponible, et quand. Le motif ne se saisit pas ici. »
   (retire la référence à la médecine du travail).
4. `imports.appliquer_aide` → « Importe les lignes nouvelles et modifiées ; les rejets ne sont
   pas importés. » (nomme ce que fait le bouton, plutôt que « écrit en base exactement… »).
5. `enrolement.reveler` → « Afficher la clé » ; `enrolement.mot_de_passe` → « Confirmez votre mot
   de passe pour afficher la clé » (retire le jargon « Révéler »).
6. `machine.nouvelle.sous_titre` et `machine.champ.numero_serie_aide` : retiré « (RG-PAR-02) » —
   un code de règle de gestion n'a rien à faire à l'écran.
7. `intervention.refus.cloturee_figee` → « Clôturée : contenu et temps validé sont figés. Seule
   l'annulation reste possible. » Les épreuves qui lisent `fr[...]` suivent automatiquement.
8. « Déduite du site » : nouvelle clé `intervention.deduite_du_prefixe`, composée par la fonction
   pure `deduiteDuSite()` (`app/(back-office)/interventions/presentation.ts`), appelée sur la
   fiche intervention et sur la fiche demande. `intervention.deduit_du_lieu` est retirée.
9. « (obligatoire) » sur les quatre champs obligatoires de `/parc/nouvelle` (modèle, n° de série,
   client, site) — décision d'Alexis du 27/09 : ce suffixe partout, jamais un astérisque, même
   forme que la création d'intervention. `libelleChampObligatoire` a déménagé de
   `app/(back-office)/interventions/presentation.ts` vers `lib/i18n/obligatoire.ts`, sans changer
   son texte ni sa sortie, pour servir aussi `formulaire-machine.tsx`. Le sous-titre de l'écran,
   qui annonçait un astérisque jamais rendu (constat G18 de l'audit), nomme maintenant le
   marqueur réel.
9b. `prestations.sans_checklist` raccourcie à « La checklist type arrivera plus tard. » (décision
    d'Alexis du 27/09) — le raisonnement complet reste dans le docblock de la page.
9c. `enrolement.definitif` réécrite : « Une fois activé, ce code vous sera demandé à chaque
    connexion ; il ne se désactive pas. Téléphone perdu : prévenez l'administrateur de la
    plateforme. » (décision d'Alexis du 27/09, toujours définitif).

**Ce que ça change pour l'exploitation** : neuf écrans disent une chose plus courte, plus
directe, ou moins technique, sans qu'aucun comportement ne change. Le geste le plus visible est
le n°9 : les quatre champs obligatoires de la fiche machine sont enfin marqués à l'écran — avant
ce lot, le sous-titre promettait un astérisque qu'aucun champ ne montrait (mesuré, constat G18).

## Ce que j'ai mesuré

`pnpm verify` (format, typecheck, lint, tests unitaires, isolation, build) est vert après chaque
commit ; `CI=1 pnpm verify:full` (avec `test:e2e`) est vert en fin de lot — voir la sortie jointe
à cette passation dans la session.

Captures AVANT/APRÈS des sept écrans du lot, à 1280 et 375 px, dans `captures/` — prises par
`tests/e2e/captures-9al-gr16-textes.spec.ts`, rejouée une fois sur le commit `62ca665` (avant le
lot, code de `nouvelle/page.tsx`, `presentation.ts`, `formulaire-machine.tsx` et `fr.ts` remis à
leur état d'origine par `git checkout`), une fois sur `1495e63` (le code livré) :

- `clients-nouveau-{avant,apres}-{1280,375}.png`
- `demande-sans-numero-{avant,apres}-{1280,375}.png`
- `absences-{avant,apres}-{1280,375}.png`
- `imports-rapport-{avant,apres}-{1280,375}.png`
- `enrolement-premiere-etape-{avant,apres}-{1280,375}.png`
- `parc-nouvelle-{avant,apres}-{1280,375}.png`
- `intervention-deduite-du-site-{avant,apres}-{1280,375}.png`

Les 14 scénarios de l'épreuve passent dans les deux états. Vérifié à l'œil sur `absences` (le
sous-titre change) et sur `parc-nouvelle` (les quatre champs obligatoires portent « (obligatoire)
», les champs facultatifs n'en portent aucun).

## Ce que j'ai tranché et pourquoi

- **`libelleChampObligatoire` déménage plutôt que se duplique** : la fiche machine et la création
  d'intervention doivent afficher EXACTEMENT le même suffixe (décision d'Alexis) ; une seule
  fonction, dans un module neutre (`lib/i18n/obligatoire.ts`), le garantit mieux qu'une seconde
  copie dans `formulaire-machine.tsx`.
- **Pas d'export du nouveau module par le barrel `lib/i18n/index.ts`** : inutile. Le gardien
  `sans-chaine-visible-en-dur` déduit ses accesseurs autorisés du barrel, dont la liste est
  fermée (`tests/unit/i18n/sans-chaine-visible-en-dur.test.ts`, forme (e)) ; l'ajouter aurait
  rouvert cette liste pour rien, puisque les arguments de `libelleChampObligatoire` sont déjà des
  appels à `t`/`mot` ou des identifiants — aucune chaîne en dur n'y échappe sans lui.
  Confirmé : `pnpm test` reste vert sans cet ajout.
- **Le sous-titre de `/parc/nouvelle` (point 6, puis reformulé au point 9)** : GR16f a d'abord
  retiré « (RG-PAR-02) » en gardant « marqués d'un astérisque » ; GR16i a ensuite corrigé cette
  phrase pour nommer « (obligatoire) », puisque laisser « astérisque » aurait rendu le sous-titre
  faux une seconde fois — ce n'était pas demandé au point 9 mais découlait directement de son
  propre changement.
- **La scène des captures ne touche aucune fixture partagée** : un client/site/demande à soi
  (préfixe d'identifiants `9a16…`), un compte d'enrôlement créé et détruit par l'épreuve, un lot
  d'import propre (`nom_fichier` distinct de celui de GR15b, pour ne jamais entrer en collision
  sous `fullyParallel`). Seule `SCENE.deplacable` est lue pour la fiche intervention, jamais
  écrite.

## Ce que je n'ai PAS fait

- Je n'ai touché à aucune règle de gestion, aucune migration, aucun prix.
- Je n'ai pas renommé `intervention.creation.obligatoire_suffixe` ni changé sa valeur : le point
  9 demandait de la RÉUTILISER telle quelle.
- Je n'ai pas ajouté de prop nouvelle à `SelecteurRecherche` : le libellé déjà suffixé lui est
  passé tel quel, comme demandé.
- Je n'ai pas touché C7 (passe éditoriale) ni le logo de connexion (9AW) — hors lot.
- Je n'ai pas corrigé le titre de section « LA CHECKLIST TYPE N'EST PAS SAISIE, et c'est écrit
  plutôt que tu » du docblock de `parametres/prestations/page.tsx` (l.54), qui semble tronqué
  (« que tu » sans fin) : préexistant au lot, hors de son périmètre, signalé ici plutôt que
  corrigé sans qu'on me le demande.

## Les pièges pour la session suivante

- **La maquette AVANT/APRÈS suppose un arbre propre.** `git checkout <commit-avant-le-lot>` puis
  `git checkout main` fonctionne seulement si rien n'est en cours ailleurs dans le dépôt ; vérifié
  `git status` avant et après les deux bascules.
- **Le fichier de captures n'existe pas au commit AVANT** : il a fallu le recopier sur le disque
  après le premier `checkout` (untracked), le supprimer avant de revenir sur `main` (sinon
  conflit de checkout), puis le laisser réapparaître depuis le commit qui le porte.
- **`reemettreJetonPremierAcces` exige un `Compte` déjà posé** (« aucun moyen de connexion »
  sinon) : il faut reproduire le geste `poserLeMoyenDeConnexionAuRepos` de `prisma/seed.ts`
  (`avecDesignationAuth(client).compte.create(...)`, `mot_de_passe: null`) avant de réémettre un
  jeton pour une identité fabriquée par une épreuve — `ouvrirLeCompteDeLEpreuve` de
  `tests/e2e/setup/scene.ts` ne le fait pas lui-même, il suppose que le semis l'a déjà fait.
- **`jetonDeLUrl` a deux formes à lire** (paramètre `token`, ou dernier segment du chemin) — la
  fonction n'est pas exportée de `tests/e2e/setup/scene.ts` ; je l'ai recopiée dans le nouveau
  fichier de captures plutôt que de la dupliquer à l'identique sans le dire.
- **Supprimer un compte de capture proprement** : `journal_acces` référence l'utilisateur sans
  cascade — le supprimer avant `utilisateur_societe` puis `utilisateur`, sinon la suppression
  échoue sur une contrainte de clé étrangère.

## Ce qui reste à faire

Rien dans le périmètre de ce lot. Les neuf points du constat (G18) sont livrés, testés (unitaires
+ un scénario e2e dédié pour le point 9) et capturés avant/après.
