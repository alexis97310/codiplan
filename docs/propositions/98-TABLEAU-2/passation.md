# 98-TABLEAU-2 — passation

## Ce que j'ai changé (et ce que ça change pour l'exploitation)

`app/(back-office)/tableau-de-bord/page.tsx` :

- La tuile **« Interventions aujourd'hui »** porte désormais un lien « Voir la
  journée sur le planning → », vers `/planning?vue=jour&jour=<AAAA-MM-JJ du
  jour>` — la même forme d'URL que `retourPlanning`
  (`app/(back-office)/interventions/presentation.ts`), jamais une URL
  reconstruite avec un vocabulaire différent.
- La tuile **« Techniciens indisponibles aujourd'hui »** porte désormais un
  lien « Voir la semaine dans les blocages d'agenda → », vers
  `/absences?semaine=<lundi de la semaine courante>`. `/absences` n'affiche
  qu'une semaine entière (son calendrier dessine sept colonnes) : il n'existe
  pas de paramètre « jour seul » à viser, la semaine qui contient aujourd'hui
  est donc la précision maximale possible.
- La tuile **« Dossiers bloqués »** ne porte AUCUN lien nouveau — voir « Ce
  que j'ai tranché et pourquoi ».
- Les QUATRE liens de tuile déjà posés (charge du planning, échéances VGP
  dépassées, qualifier une demande, interventions sans durée) passent de
  `text-[11.5px]` à un habillage partagé, `CLASSES_LIEN_TUILE` : texte 13 px,
  zone cliquable `min-h-[32px]` — la mesure exacte de l'audit d'ergonomie du
  25/09/2026 (constat 4, 11,5 px / ~17 px).

Pour l'exploitation : deux des trois tuiles « inertes » relevées par l'audit
mènent maintenant quelque part d'un geste, et les six liens de tuile de
l'écran sont désormais dans la même zone tactile que le reste de
l'application (déjà 32 px ailleurs, `components/machines/actions-qr.tsx`,
`components/interventions/actions-bon.tsx`).

## Ce que j'ai mesuré (comptes AVANT/APRÈS)

- **Tailles des liens, avant** : `text-[11.5px]`, aucune règle de hauteur
  minimale — l'audit avait mesuré ~17 px de haut au rendu. **Après** :
  `text-[13px]`, `min-h-[32px] items-center inline-flex` — vérifié par
  `tests/e2e/tableau-de-bord-liens-tuiles.spec.ts` (`getComputedStyle(...)
  .fontSize === "13px"` et `boundingBox().height >= 32`) sur les SIX liens
  (quatre anciens, deux neufs).
- **Ce que `enAttenteDePiece` compte contre ce que l'onglet « Bloquées » du
  registre compte** : `enAttenteDePiece` (`lib/interventions/depot.ts`) filtre
  `piece_attendue_ref: { not: null }`. L'onglet « Bloquées » de
  `/interventions` (`criteresVue`, même fichier) filtre `statut ===
  "suspendue"`. `lib/interventions/saisie.ts` (`schemaSuspension`) et
  `prisma/schema.prisma` (commentaire au-dessus de `piece_attendue_ref`)
  confirment qu'une suspension n'exige QUE le motif — la référence de pièce et
  sa date sont optionnelles, ensemble ou pas du tout (RG-INT-06). Les deux
  comptes peuvent donc diverger : toute suspension SANS attente de pièce
  compte dans « Bloquées » mais pas dans `enAttenteDePiece`. Je n'ai pas pu
  mesurer un écart chiffré en base de démonstration (le semis n'a posé aucune
  suspension sans pièce, donc les deux comptes coïncidaient par hasard sur
  cette base précise) — la divergence est structurelle (lue dans le schéma et
  le code), pas mesurée sur un cas vivant.
- Les quatre tests e2e neufs (`tests/e2e/tableau-de-bord-liens-tuiles.spec.ts`)
  sont passés du premier coup, aucun rouge à consigner.
- `pnpm test` (2862 tests, 266 fichiers) : vert avant et après.

## Ce que j'ai tranché et pourquoi

**Aucun lien sous « Dossiers bloqués ».** Le ticket interdit explicitement un
lien vers une liste différente du compte affiché. `schemaRechercheInterventions`
(`lib/interventions/saisie.ts`) n'expose aucun paramètre sur
`piece_attendue_ref` — seul `vue=bloquees` existe, et il filtre sur `statut`,
un critère plus large. Écrire ce filtre manquant dans `/interventions`
uniquement pour ce lien aurait dépassé le territoire du ticket (qui ne cite
que `tableau-de-bord/page.tsx`, `lib/i18n/fr.ts` et l'épreuve neuve) et ajouté
une route non demandée pour un besoin qui reste à trancher : la tuile compte
maintenant, avec un commentaire au code qui nomme l'écart, plutôt que de
mentir par un lien approximatif.

**Le lien « Techniciens indisponibles » vise la SEMAINE, pas un jour isolé.**
`/absences` n'a pas de vue journalière — recréer une vue jour pour un seul
lien de tableau de bord aurait été hors du territoire de ce ticket (qui ne
touche que `tableau-de-bord/page.tsx`). Le paramètre `semaine=<lundi>` est
composé explicitement (jamais laissé au repli par défaut de l'écran) pour que
l'épreuve e2e puisse vérifier que l'URL porte le filtre attendu, comme demandé.

**Un habillage partagé, `CLASSES_LIEN_TUILE`, local à ce fichier** — plutôt que
de modifier `CLASSES_LIEN` (`lib/theme/apparence.ts`), qui est employé par une
vingtaine d'écrans hors du territoire de ce ticket. La taille de police et la
hauteur minimale sont un choix propre aux tuiles du tableau de bord, jamais un
changement de l'habillage partagé (couleur + soulignement).

## Ce que je n'ai PAS fait

- Aucune migration, aucune ligne de semis, aucun prix — conforme aux interdits
  du ticket.
- Aucun filtre neuf sur `/interventions` pour rapprocher son onglet
  « Bloquées » d'`enAttenteDePiece` — voir « Ce que j'ai tranché et pourquoi ».
  Si un lien devient nécessaire un jour, il faudra d'abord poser ce filtre
  (ou changer ce que la tuile compte) — c'est un nouveau ticket, pas une
  extension de celui-ci.
- Je n'ai pas touché la carte « Taux d'occupation : Non calculé » (hors
  ticket, explicitement).
- Je n'ai pas cherché à mesurer un cas vivant de suspension sans attente de
  pièce sur la base de démonstration : le semis n'en pose aucune, et en fabriquer
  une aurait été une ligne de semis, interdite par ce ticket.

## Les pièges pour la session suivante

- `CLASSES_LIEN_TUILE` est LOCAL à `tableau-de-bord/page.tsx` — ne pas
  l'exporter ni le dupliquer ailleurs sans relire pourquoi il n'est pas dans
  `lib/theme/apparence.ts` (voir « Ce que j'ai tranché et pourquoi »).
- Si un futur ticket ajoute un filtre `piece_attendue_ref` (ou équivalent) à
  `schemaRechercheInterventions`, la tuile « Dossiers bloqués » redevient
  linkable — chercher ce commentaire dans le code avant de refaire la mesure.
- `/absences` n'a pas de vue jour ; si un ticket futur en ajoute une, le lien
  de cette tuile devrait probablement la viser au lieu de la semaine.

## Ce qui reste à faire

- Rien d'ouvert dans le périmètre de ce ticket. La question de fond « faut-il
  qu'`/interventions` sache filtrer sur l'attente de pièce elle-même » reste
  entière et n'est pas tranchée ici (§8 : un changement de schéma de filtre
  n'est pas une décision à prendre en passant).
