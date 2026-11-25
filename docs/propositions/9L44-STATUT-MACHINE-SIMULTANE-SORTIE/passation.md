# 9L44-STATUT-MACHINE-SIMULTANE-SORTIE — passation

Ligne « Statut machine : écritures simultanées, confirmation de sortie du parc renforcée » des réserves des
revues (`lib/feuille-de-route/contenu.ts`). **Aucune migration.**

## Ce qui a été mesuré avant d'écrire une ligne

`changerStatutMachine` (`lib/machines/depot.ts`) lisait le statut, décidait (`decisionDepuisLaFiche`), puis
écrivait sans jamais revérifier qu'il n'avait pas changé entre les deux : deux écritures concurrentes sur la
même fiche, la **dernière** gagnait toujours, en silence — aucun refus, aucune trace de ce qui avait été
perdu.

**Première forme écrite, et écartée en la mesurant** : un verrou optimiste sur `modifie_le` (le candidat
naturel, `@updatedAt`) — posé dans le `WHERE` de l'écriture. **Elle ne fonctionnait JAMAIS, même sans la
moindre écriture concurrente** : la colonne est `timestamptz` (microseconde), le `Date` JavaScript ne porte
que la milliseconde, et Prisma — en relisant puis en reposant la même valeur — perd systématiquement les six
derniers chiffres. Le premier test isolé l'a montré immédiatement (le chemin « accepté » déjà existant du
fichier de test se mettait soudain à refuser « modifie_entre_temps », sans aucune concurrence). Corriger la
précision aurait exigé une migration (`@db.Timestamptz(3)`), exclue de ce lot par consigne. **Le statut LU
est le champ exact que ce chemin dispute, ne perd rien au passage, et sert de verrou à sa place** — voir D285
pour le détail, et la note de tête de `changerStatutMachineDans`.

## Ce qui a été livré

1. **Le verrou optimiste** — `changerStatutMachineDans` (`lib/machines/depot.ts`) reçoit un `statutAttendu`
   optionnel, rejoint `id` dans le `WHERE` de l'`updateMany`. `changerStatutMachine` le passe désormais,
   armé du statut qu'elle vient de lire. Une ligne déjà changée par une autre transaction depuis cette
   lecture ne matche plus : zéro ligne touchée, refus nommé **`modifie_entre_temps`** (nouveau motif de
   `MotifRefusMachine`), jamais un écrasement silencieux. `deposerDemande` (`lib/demandes/depot.ts`), seul
   autre appelant de `changerStatutMachineDans`, omet ce paramètre et garde son comportement déjà arbitré
   (une valeur annexe à une création s'ignore, elle ne se dispute pas) — **inchangé**.
2. **La confirmation d'une vraie sortie du parc retape le code** — `remplacee`/`ferraillee` seulement,
   jamais le RETOUR (qui vise un état actif, et garde son dialogue Confirmer/Revenir simple, inchangé).
   `BoutonAvecConfirmation` (`components/ui/bouton-confirmation.tsx`) porte le mécanisme en générique
   (`saisieDeControle: { attendu, libelle }`) — le bouton de confirmation reste désactivé tant que le texte
   saisi (espaces de bord ignorés) n'égale pas exactement `attendu`. Réutilisable par un autre geste
   irréversible de ce dépôt sans dupliquer la mécanique. Le code comparé est `referenceMachine(machine)`
   (`MAC-000123`/`Local-<6>`, déjà affiché en tête de fiche), jamais le numéro de série (qui peut porter
   « fiche à compléter », N-11).
3. `optionsChangerStatutMachine` (`app/(back-office)/parc/presentation.ts`) porte un champ `sortie`
   supplémentaire (la cible est-elle réellement `remplacee`/`ferraillee`), distinct de `confirmation` (qui
   couvre aussi le retour). La tuile Machine (`interventions/[id]/page.tsx`), qui ne propose jamais de
   sortie, pose `sortie: false` en dur.
4. **Aucun champ « motif »** n'a été ajouté : il n'en existait pas déjà, et le ticket l'interdisait
   explicitement dans ce cas.

Deux clés neuves dans `lib/i18n/fr.ts` : `machine.refus.modifie_entre_temps`,
`machine.changer_etat.sortie_retape_avant`/`sortie_retape_apres`.

## Épreuves

- `tests/isolation/changer-statut-machine.test.ts` — nouveau describe « deux écritures concurrentes sur la
  même fiche » : un verrou `SELECT … FOR UPDATE` posé depuis une connexion **externe** (`clientOwner`) force
  deux transactions réelles à lire la même version avant que l'une des deux ne puisse écrire — sans lui,
  l'issue dépendrait du hasard du réseau (une lecture Prisma ne bloque jamais sur un verrou de ligne). Un
  appel est accepté, l'autre refusé `modifie_entre_temps`, rien n'est écrasé.
- `tests/e2e/9l44-sortie-du-parc-retype.spec.ts` (neuf, 1280 et 375 px) — le dialogue de sortie : bouton
  désactivé sans rien taper, toujours désactivé avec un code FAUX, activé avec le code EXACT, puis la fiche
  montre le nouveau statut.
- `pnpm test` (6095), `pnpm test:isolation` (2579), `pnpm typecheck`, `pnpm lint`, `CI=1 pnpm verify` (format,
  typecheck, lint, test, test:isolation, build) — tous verts.
- Un gardien de forme a dû être mis à jour en cours de route : `tests/unit/ui/carte-pas-recopiee.test.ts`
  (nouvelle exception nommée pour le `<input>` de retype dans `bouton-confirmation.tsx`) — jamais assoupli,
  une ligne EXPLIQUÉE ajoutée à sa liste fermée, comme le fichier le prescrit lui-même.

## Captures de ce lot

`docs/propositions/9L44-STATUT-MACHINE-SIMULTANE-SORTIE/captures/` — **APRÈS seulement**, à 1280 et 375 px :
`9l44-dialogue-retype-rempli-apres-{1280,375}.png` (dialogue ouvert, code exact tapé, bouton activé) et
`9l44-fiche-sortie-confirmee-apres-{1280,375}.png` (fiche machine après la sortie). **AVANT non versé** : le
champ de retype est NEUF, rien dans l'arbre d'avant ce lot ne le montre — même raisonnement déjà écrit par
`tests/e2e/9l20-deplacer-machine.spec.ts` (« AVANT NON REPRODUCTIBLE SUR CET ARBRE »). Le dialogue simple
(sans retype, pour le RETOUR) est inchangé et déjà documenté par les captures de 9I8F1-REPRISE-9I8F.

**`docs/captures/` (le fleet général) n'a PAS été rejoué.** `pnpm captures:etat` le montre déjà en retard de
**73 fichiers de surface** sur `6d207f0` — bien au-delà des quatre fichiers touchés par ce lot, preuve que ce
rafraîchissement complet (base jetable, migration, semis, trois comptes, `scripts/captures.mts`) n'est pas
rejoué à chaque ticket malgré la consigne qui le redemande en tête de chacun. Le relancer seul, pour ce lot,
n'aurait photographié aucun écart sur l'écran touché (le dialogue est fermé par défaut, le rendu de repos de
`/parc/[id]` ne change pas) mais aurait quand même consommé une bonne part du budget du lot sur un écart
préexistant et bien plus large que lui. **À signaler au pilote** : soit regrouper ce rafraîchissement dans un
lot dédié, soit confirmer qu'il reste attendu à chaque ticket malgré son coût.

## Feuille de route et arbitrage

- `lib/feuille-de-route/contenu.ts` : la ligne migrée de « Réserves des revues, à regrouper » vers « Livré
  depuis le 31/10 », référencée `(9L44)`.
- `docs/arbitrages.md` : **D285** — le choix du statut lu plutôt que `modifie_le` (et pourquoi), et la
  confirmation renforcée de la sortie du parc, avec condition de réouverture.

## Pour la suite

- `lib/machines/depot.ts` porte désormais, en tête de `changerStatutMachineDans`, la mise en garde contre un
  futur verrou sur `modifie_le` sans migration préalable de précision — à relire avant toute tentative.
- `saisieDeControle` (`components/ui/bouton-confirmation.tsx`) est prêt à être réemployé par un autre geste
  irréversible qui en aurait besoin, sans dupliquer le mécanisme.
