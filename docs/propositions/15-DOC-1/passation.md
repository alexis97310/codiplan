# DOC-1 — passation

## 1. Ce que j'ai changé

- **`docs/constitution/erreurs-a-ne-pas-refaire.md`.** Les 58 entrées datées
  du §9 portent désormais chacune un titre `### DATE — TITRE` — le texte du
  titre est repris À L'IDENTIQUE de l'amorce en gras de l'entrée, sans en
  couper un mot. Un `### Sommaire` a été ajouté juste après le titre `## 9.`,
  listant les 58 titres dans l'ordre où le fichier les porte (qui n'est PAS
  l'ordre chronologique — les dates sautent, ex. `20/08` puis `19/08` puis
  `20/08` : je n'ai rien réordonné). Aucune phrase, aucun mot, aucune entrée
  n'a été coupé, résumé ou déplacé — vérifié programmatiquement (§2).
- **`docs/constitution/organisation-du-code.md`.** Un `### Sommaire` a été
  ajouté juste après le paragraphe `(prévu)`, listant 35 répertoires
  (`app/`, `lib/`, 29 sous-répertoires de `lib/`, `components/`, `prisma/`,
  `tests/`, `docs/`) avec le NUMÉRO DE LIGNE où chacun commence dans le
  fichier — PAS de titre Markdown à l'intérieur de l'arbre. Voir §3, point 1 :
  c'est une contrainte découverte en cours de route, pas un choix de style.
  Le bloc de code de l'arborescence est resté BYTE POUR BYTE identique à
  avant (`git diff` le montre : la seule chose insérée est le sommaire, rien
  n'est touché après).
- **`CLAUDE.md` §0.** Le tableau nomme désormais l'existence des deux
  sommaires. La prescription du §9 (`erreurs-a-ne-pas-refaire.md`) reste
  **intégralement** — voir §3, point 2, pourquoi je ne l'ai pas restreinte.
  La prescription du §6 (`organisation-du-code.md`) est restreinte : « le
  paragraphe d'introduction intégralement, puis la seule section du
  répertoire visé ». La phrase de clôture du §0 mentionne que le même gardien
  tient désormais le sommaire de ces fichiers.
- **`tests/unit/docs/constitution-indexee.test.ts`.** Étendu (pas réécrit) :
  les gardiens AT-05 existants sont intacts. Ajouté : la population des
  fichiers astreints (`fichiersATitrer`, seuil 250 lignes), deux fonctions de
  lecture (`titresDuCorps`/`entreesDuSommaire`, génériques, pour la forme à
  titres) et une troisième (`repertoiresAvecLigne`, pour la forme à lignes),
  un test générique qui confronte sommaire et corps dans les deux sens pour
  chaque fichier astreint (avec DISPATCH automatique sur la forme du
  sommaire — aucun nom de fichier codé en dur dans le test générique lui-même,
  seulement dans les épreuves), et deux blocs d'ÉPREUVE qui mettent
  réellement en échec chaque forme (un titre retiré, une entrée fantôme
  ajoutée ; un numéro de ligne faussé, un répertoire renommé) — 21 tests au
  total dans ce fichier, tous verts.
- **`docs/propositions/15-DOC-1/passation.md`** (ce fichier).

**Ce que ça change pour l'exploitation.** Une session qui doit répondre à une
question précise — « quelle est la règle avant d'écrire un gardien ? »,
« que porte `lib/documents/` ? » — n'a plus besoin de charger le fichier
entier pour savoir où chercher : elle ouvre le sommaire (quelques kilooctets),
repère la ou les sections utiles, et ne lit que celles-là. Le contenu normatif
n'a pas changé d'un mot ; ce qui a changé, c'est le coût de la navigation.

## 2. Ce que j'ai mesuré

**Le contenu n'a pas bougé — vérifié, pas supposé.** Pour les deux fichiers,
j'ai écrit un script de contrôle séparé (jetable, non commité) qui compare la
séquence des lignes NON vides et NON ajoutées du fichier transformé à celle de
l'original : égalité stricte dans les deux cas (`erreurs` : 204 lignes de
contenu de chaque côté, `organisation-du-code` : 1102 lignes de chaque côté).
Pour `organisation-du-code.md`, le `git diff` du fichier réel confirme en plus
que tout ce qui suit le point d'insertion — bloc de code compris — est
identique octet pour octet à `main`.

**Les épreuves du gardien étendu rougissent quand on les joue à la main,
et restent vertes sur le fichier réel** — les six `it` de mise à l'échec
(§1) ont été exécutées et vérifiées une à une avant d'être committées avec
le reste ; aucune n'a été ajustée pour « faire passer » après coup.

**`pnpm verify:full` complet, une fois tout en place** : `format:check`,
`typecheck`, `lint`, `test` (2 556 tests unitaires, tous verts),
`test:isolation`, `build`, `feries:horizon`, `audit:partitions`, `test:e2e`
(136 passés, 2 ignorés — des routes dynamiques déjà exclues avant ce lot,
non liées à ce ticket). Sortie en 0. Aucun test existant n'a été modifié ni
désactivé.

**Un conflit RÉEL a été trouvé et résolu avant le premier `verify:full`
vert** — voir §3, point 1 : la première version scindait le bloc de code de
`organisation-du-code.md` en 35 petits blocs avec un titre devant chacun.
`pnpm test` a alors fait rougir `tests/unit/docs/organisation-du-code.test.ts`
(hors territoire de ce ticket) : son extracteur `arborescence()` ne lit que le
PREMIER bloc de code après `## 6.`, et ce premier bloc ne contenait plus que
`app/` — la branche `lib/` avait disparu de ce qu'il pouvait lire. Refait
selon la forme décrite en §1 (sommaire à lignes, bloc de code intact) ; les
9 tests de ce fichier repassent au vert sans qu'aucune de ses lignes ne soit
touchée.

**Le compte AVANT / APRÈS demandé par le ticket**, sur des questions
précises, mesuré avec le contenu réel du dépôt (pas une estimation) :

| Question | AVANT (charger le fichier entier) | APRÈS (sommaire + section(s) ciblée(s)) |
|---|---:|---:|
| « Que porte `lib/documents/` ? » (`organisation-du-code.md`) | 83 174 octets (fichier entier, contenu inchangé — 82 053 avant ce lot) | 1 119 (sommaire) + 1 910 (la section) = **3 029 octets**, soit ≈ 27× moins |
| « Quelles entrées du §9 parlent de « gardien » ? » (`erreurs-a-ne-pas-refaire.md`) | 127 458 octets (fichier entier — 112 618 avant ce lot) | 7 308 (sommaire) + 35 051 (les 13 entrées sur 58 dont le TITRE contient « gardien ») = **42 359 octets**, soit ≈ 3× moins |

La seconde ligne montre la limite honnête de ce lot sur ce fichier précis :
« avant d'écrire un gardien » touche une bonne partie des 58 leçons — la
réduction y est réelle mais modeste. Sur une question qui vise UNE seule
entrée ou UN seul répertoire, la réduction est de un à deux ordres de
grandeur (la première ligne du tableau). Le fichier lui-même a GROSSI en
octets (127 458 contre 112 618, +13 %) : le sommaire et les 58 titres ajoutés
coûtent de la place à charger si une session lit encore le fichier en entier
— ce qui reste le cas pour l'usage prescrit par `CLAUDE.md` (§9
intégralement, inchangé). Le gain n'existe que pour une lecture CIBLÉE, et
c'est écrit comme tel plutôt que présenté comme un gain inconditionnel.

## 3. Ce que j'ai tranché, et pourquoi

1. **`organisation-du-code.md` ne reçoit AUCUN titre à l'intérieur de son
   arbre — sommaire par numéro de ligne, pas par titre.** Ma première
   version scindait le bloc de code unique en 35 blocs, chacun précédé d'un
   titre `###`/`####`. Mesuré (§2) : cela casse
   `tests/unit/docs/organisation-du-code.test.ts`, hors territoire de ce
   ticket et donc INTOUCHABLE — son extracteur suppose que tout `§6` tient
   dans UN SEUL bloc de code, `lib/` compris. Le ticket interdit par ailleurs
   de « toucher à aucun code applicatif » et limite le territoire aux deux
   fichiers de contenu, à `CLAUDE.md` et à
   `tests/unit/docs/constitution-indexee.test.ts` — casser un gardien voisin
   pour en réparer un autre n'est pas une option. Le sommaire pointe donc par
   ligne (`` `lib/documents/` — ligne 769 ``) : c'est moins élégant qu'une
   ancre Markdown, mais c'est la seule forme qui laisse le bloc de code
   intact ET reste vérifiable dans les deux sens par un gardien (voir la
   troisième épreuve du gardien étendu). Réouverture : si
   `organisation-du-code.test.ts` change un jour sa façon de lire le §6 (par
   exemple s'il apprenait à lire plusieurs blocs), le sommaire par titres
   redevient possible et serait préférable.
2. **`erreurs-a-ne-pas-refaire.md` garde sa prescription « intégralement » au
   §0 de `CLAUDE.md`, malgré le sommaire.** Contrairement à
   `organisation-du-code.md` où une session ne s'intéresse en général qu'À
   UN répertoire, les 58 leçons du §9 se recoupent largement sur le sujet
   « avant d'écrire un gardien » (mesuré §2 : 13 sur 58 rien que sur le mot
   « gardien » dans le titre, et bien d'autres sans le mot dans le titre en
   parlent dans le corps). Restreindre la prescription à un sous-ensemble
   aurait fait perdre des leçons pertinentes sans que rien ne le signale — le
   ticket demande explicitement de ne restreindre « que quand le découpage le
   permet sans perte ». Le sommaire reste utile pour RETROUVER une entrée déjà
   lue, ou pour une question plus étroite que « avant d'écrire un gardien »
   (ex. « quelle est la règle sur `FORCE ROW LEVEL SECURITY` ? » — une seule
   entrée, trouvable en quelques centaines d'octets de sommaire).
3. **Le seuil de navigabilité est 250 lignes.** Posé pour laisser passer
   `invariants.md` (219 lignes, déjà navigable avec 13 titres) et les trois
   fichiers courts (24, 21, 17 lignes) SANS y toucher, et pour retenir les
   deux fichiers fautifs mesurés le 22/09/2026 (386 et 1 125 lignes). C'est la
   marge la plus étroite qui obtient ce partage — un chiffre rond (300, 200)
   aurait aussi fonctionné ici, je n'ai pas cherché plus étroit que
   nécessaire. Réouverture : si un futur fichier de `docs/constitution/`
   dépasse 250 lignes sans pouvoir porter de titres NI de sommaire par ligne
   (une troisième forme), le gardien générique échouera sur lui et il faudra
   soit lui trouver une forme, soit ajuster le dispatch — pas le seuil.
4. **Le sommaire de `organisation-du-code.md` ne descend d'un niveau que sous
   `lib/`.** `app/`, `tests/` et `docs/` mettent plusieurs répertoires sur une
   même ligne ou mêlent fichiers et répertoires — exactement la limite que le
   commentaire de `organisation-du-code.test.ts` documente déjà pour son
   propre parseur (« le périmètre s'arrête à `lib/`, et c'est une limite du
   PARSEUR »). J'ai repris la même limite plutôt que d'écrire une seconde
   heuristique qui aurait pu diverger de la première sur les mêmes lignes.

## 4. Ce que je n'ai PAS fait

- **Aucune ligne de contenu normatif modifiée, résumée ou déplacée** dans les
  deux fichiers — vérifié programmatiquement, pas seulement relu (§2).
- **Aucun lien Markdown cliquable (`[texte](#ancre)`) dans les sommaires.**
  J'ai considéré générer des ancres au format GitHub, puis y ai renoncé : ni
  `erreurs-a-ne-pas-refaire.md` ni `organisation-du-code.md` ne sont
  consultés via un rendu Markdown cliquable dans ce dépôt (CLAUDE.md est lu
  comme du texte brut par une session), et un algorithme de translittération
  d'ancre imparfait aurait ajouté une seconde source de divergence à garder
  sans bénéfice réel. Les sommaires sont du texte exact que `grep` ou une
  lecture avec `offset` retrouvent directement.
- **`README.md`, `docs/arbitrages.md`, `docs/backlog.md`** — hors territoire,
  non ouverts pour modification.
- **Aucun code applicatif** — hors territoire, non touché.
- **Je n'ai pas renuméroté ni réorganisé les 58 entrées du §9** dans un ordre
  chronologique, alors qu'elles ne le sont pas déjà (ex. `20/08` puis `19/08`
  puis `20/08` puis `20/08` d'affilée) : le ticket interdit de déplacer une
  entrée, et l'ordre actuel n'est pas sans styles — ranger dans l'ordre
  d'écriture semble intentionnel par endroits (une entrée du 08/09 renvoie
  explicitement à « l'entrée ci-dessus »).
- **Je n'ai pas ajouté d'ancres de deuxième niveau au sommaire lui-même**
  (un sommaire du sommaire) : à 58 et 35 entrées, les deux sommaires tiennent
  en une lecture, et une hiérarchie supplémentaire aurait été de la
  sur-ingénierie pour ce volume.

## 5. Les pièges pour la session suivante

- **`organisation-du-code.md` ne peut PAS recevoir de titres Markdown à
  l'intérieur du bloc de code de son arborescence, et ce n'est pas écrit
  ailleurs que dans ce fichier et dans le commentaire du gardien étendu.**
  Le bloc entier doit rester un UNIQUE `` ``` ... ``` `` pour que
  `tests/unit/docs/organisation-du-code.test.ts` continue à lire `lib/` — son
  extracteur capture tout entre le PREMIER `` ``` `` après `## 6.` et le
  `` ``` `` suivant, sans savoir qu'il pourrait y en avoir d'autres après.
  Si un ticket futur veut scinder ce bloc, il doit d'abord adapter cet
  extracteur (hors territoire de DOC-1, donc non fait ici).
- **Le sommaire de `organisation-du-code.md` porte des numéros de ligne EN
  DUR.** Toute modification future du fichier qui ajoute ou retire des lignes
  AVANT un repère (y compris dans le sommaire lui-même) décale tous les
  repères qui suivent. Le gardien étendu le détecte (il recalcule
  `repertoiresAvecLigne` à chaque exécution et compare), mais il faut
  regénérer les numéros à la main — je n'ai pas écrit de script permanent
  pour ça (le mien était jetable, à `/tmp`, non commité). Un ticket qui
  modifie `lib/` en profondeur devra les recalculer.
- **`arborescence()` dans le gardien voisin n'est pas exportée** : je n'ai
  pas pu la réutiliser pour `repertoiresAvecLigne` et j'ai réécrit une
  extraction de bloc de code équivalente, plus simple, dans
  `constitution-indexee.test.ts`. C'est une seconde implémentation d'un
  critère voisin (trouver le premier bloc de code après un titre) — le §9 du
  01/09/2026 met en garde contre exactement ça (« deux lectures d'un même
  critère divergent en silence »). Je ne l'ai pas évité parce que je ne
  pouvais pas toucher l'autre fichier pour en faire une fonction partagée ;
  le risque est faible ici (la logique tient en trois lignes et ne sert qu'à
  bâtir le sommaire, jamais à garantir le cloisonnement §6 lui-même, qui reste
  la seule affaire de l'autre gardien), mais si les deux se mettaient à
  diverger sur ce qu'est « un bloc de code », rien ne le signalerait — à
  garder en tête si l'un des deux change.
- **Le seuil de 250 lignes n'a pas été discuté avec l'exploitation.** Je l'ai
  choisi et justifié (§3.3) plutôt que de m'arrêter pour demander, parce que
  le ticket demandait explicitement « le seuil se mesure, il ne s'invente
  pas » avec un critère de réussite clair (`invariants.md` passe,
  les deux fautifs échouent) — pas une question d'argent, de droit ou de
  cloisonnement au sens du §8 de `CLAUDE.md`. Si ce choix doit être revu,
  c'est un ajustement du nombre dans
  `tests/unit/docs/constitution-indexee.test.ts`, pas une réouverture de
  ticket.

## 6. Ce qui reste à faire

- **Étendre la même forme de navigation à d'autres fichiers longs du dépôt**
  si `README.md` (218 749 octets, mentionné explicitement comme hors
  territoire par ce ticket) reçoit un jour son propre chantier : la forme à
  titres (`erreurs-a-ne-pas-refaire.md`) s'y appliquerait probablement sans
  la contrainte du bloc de code unique.
- **Un script PERMANENT qui régénère le sommaire par lignes de
  `organisation-du-code.md`** n'existe pas — chaque ticket qui modifie
  substantiellement l'arborescence devra recalculer les numéros à la main (ou
  écrire ce script, hors territoire de DOC-1). Le gardien étendu détecte la
  dérive mais ne la corrige pas.
- **`tests/unit/docs/organisation-du-code.test.ts` reste le seul obstacle à
  une navigation par titres dans ce fichier.** Si un ticket futur veut aller
  plus loin (des vrais titres Markdown, comme pour `erreurs-a-ne-pas-refaire.md`),
  il doit d'abord réécrire cet extracteur pour qu'il sache lire PLUSIEURS
  blocs de code à la suite — un ticket à lui seul, avec son propre territoire.
