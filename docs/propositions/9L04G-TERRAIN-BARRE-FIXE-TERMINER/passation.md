# 9L04G-TERRAIN-BARRE-FIXE-TERMINER — passation

Décision d'Alexis du 13/11/2026 : une barre d'action fixe en bas de la fiche terrain, et un
ajustement de la feuille « Terminer » (9K27/D242) pour que chaque manque mène au point précis,
focus compris.

## Point 1 — la barre fixe, par PORTAIL, jamais par état remonté

`components/terrain/barre-action-terrain.tsx` (neuf) : un conteneur `<div>` `fixed inset-x-0
z-[55]` posé au-dessus de la barre basse de navigation (`bottom: HAUTEUR_BARRE_BASSE_PX`,
`z-50`), SOUS la feuille plein écran de confirmation « Terminer » (`z-[60]`). `empty:hidden` lui
donne une hauteur nulle quand rien ne s'y porte — pas de second état à tenir.

`DeclencheurBarreAction` porte SES enfants vers ce conteneur par `createPortal`, ou les rend
inline si aucun `BarreActionTerrain` n'entoure l'appelant (repli utile pour les tests unitaires
existants qui montent `BoutonCompteurTerrain`/`BoutonSuspendreTerrain` seuls — **vérifié : les 87
tests de ces cinq fichiers passent sans modification**).

**Pourquoi un portail plutôt qu'un state levé** : `BoutonCompteurTerrain` et
`BoutonSuspendreTerrain` portent chacun leur propre logique (file hors réseau, refus serveur,
dialogue de confirmation `<dialog>` natif). Lever cet état vers un parent commun aurait dupliqué
ou cassé cette logique déjà éprouvée (D220, D236, 9K13…) ; le portail déplace seulement
l'EMPLACEMENT visuel du bouton déclencheur, jamais son comportement — vérifié par les épreuves e2e
existantes rejouées telles quelles (9f4-terrain-enregistrement-auto, captures-9g8, 9f4h4d, 9k13,
9k27 : tous verts, voir plus bas).

**Qui porte, et pourquoi** :
- `en_cours` → « Suspendre » (`BoutonSuspendreTerrain`, texte bleu `variant="ghost"
  text-app-bleu-plein`) + « Terminer » (`RapportTerrainAutomatique`, bleu plein, `flex-1`). Le
  bouton du COMPTEUR (« Mettre en pause »/« Reprendre le compteur ») reste INCHANGÉ, à sa place
  d'origine juste après l'en-tête : la décision d'Alexis du 13/11 ne le nomme jamais dans la
  barre pour cet état-là, seulement « Suspendre » et « Terminer ».
- Tout AUTRE statut où `BoutonCompteurTerrain` est monté (`affectee`, réouverture d'une
  `terminee` par D220…) → son bouton SEUL (« Démarrer l'intervention », ou la paire
  Oui/Non de réouverture) porte dans la barre — condition `statut !== "en_cours"` à l'intérieur du
  composant lui-même, aucun changement côté appelant (`page.tsx`).
- `suspendue` → **rien**. Voir plus bas, « Ce qui reste dû ».

Hauteurs : `h-14` (56 px) sur les boutons portés — dans la fourchette 52-56 px demandée. Le
conteneur garde `py-2` + `border-t` (filet 1 px, jeton épuré).

**Zone sûre iOS** : aucun `env(safe-area-inset-bottom)` posé. La barre fixe s'arrête à
`bottom: 60px` (au-dessus de la barre basse), et la barre basse elle-même (`barre-basse.tsx`,
60 px) dépasse déjà la hauteur typique de l'empiètement du bandeau d'accueil iOS (34 px sur un
iPhone à encoche) — composer les deux suffit à rester hors de cette zone, sans codé en dur
supplémentaire. Si un appareil à empiètement plus grand que 60 px existait, `barre-basse.tsx`
serait le fichier à ajuster (hors de ce lot).

**Réserve de contenu** : `app/(mobile)/terrain/[id]/page.tsx` ajoute `pb-16` (64 px) FIXE sur
`<main>`, que la barre porte ou non un bouton pour ce statut — la hauteur réelle ne se connaît
qu'au rendu CLIENT, une fois le portail attaché, et une réserve conditionnelle serait fausse
pendant l'hydratation (et sur une suspendue, qui n'a aujourd'hui rien à y porter).

## Point 2 — focus, pas seulement défilement

`allerAuCommentaire` (`rapport-automatique.tsx`) posait déjà `.focus()` + `.scrollIntoView()`.
Même patron ajouté à :
- `allerALaSignature` : `tabIndex={-1}` posé sur la `<section>` signature, `.focus()` appelé après
  le `.scrollIntoView()`.
- Le saut checklist (`ChecklistTerrain`, `EVENEMENT_CHECKLIST_SAUTER_AU_POINT`) : `tabIndex={-1}`
  posé sur `PointLigne` (le conteneur `#checklist-point-{id}`, QUEL QUE SOIT le type de réponse du
  point), `.focus()` appelé après le `.scrollIntoView()`. La rubrique se dépliait déjà (CK7,
  inchangé) — seul le focus est neuf.

## Point 2 — CE QUE CE LOT N'A PAS FAIT, ET POURQUOI (conflit avec D-S5/D242)

Le ticket demandait : *« La signature absente apparaît comme un avertissement (non bloquant) qui
conduit à la zone de signature. »* et explicitement : *« Mesure ce que 9K27 et D212 exigent
aujourd'hui et aligne-toi : si une règle écrite dit le contraire, ARRÊTE-toi et écris le
conflit. »*

Mesuré : **une règle écrite dit le contraire, à deux endroits de rang 1** :
- **D-S5** (`docs/arbitrages.md:5712`, reprise du texte source du 16/09/2026) : *« la signature est
  recueillie par le technicien, en fin d'intervention ; elle conditionne le terminé »* —
  `peutTerminer` (`lib/interventions/cycle-de-vie.ts`) refuse tant qu'AUCUNE issue de signature
  (`signee`/`client_absent`/`refus_signature`) n'est enregistrée.
- **D242** (`docs/arbitrages.md:8365`) : la signature est l'un des TROIS manques qui gardent
  « Confirmer la fin » INACTIF dans la feuille — au même titre que le commentaire et la checklist,
  pas différemment.

Donc **aujourd'hui, une signature TOTALEMENT absente (aucune des trois issues choisie) reste
bloquante**, par un texte de rang 1 — exactement ce que le ticket demandait de lever. Je ne l'ai
PAS levée : ce lot laisse `peutTerminer` et `manquesPourTerminer` inchangés sur ce point précis,
et la feuille continue de nommer « la signature du client » comme un manque qui désactive
« Confirmer la fin ».

**Ce qui EST déjà vrai, et que ce lot n'a pas eu besoin de changer** : dès qu'un MOTIF est donné
— « Client absent » ou « Refus de signer », avec son texte de motif — le manque disparaît, SANS
aucun trait dessiné. Si c'est cela que le ticket visait par « avertissement, pas un blocage, tant
qu'un motif… peut être donné », alors le comportement demandé existe déjà depuis 9K27/D242, et ce
lot se contente de le confirmer par une épreuve dédiée (voir plus bas). Si le ticket visait un cas
plus large — rien de saisi DU TOUT, pas même un motif —, c'est le conflit ci-dessus, et il reste
entier : **à trancher par Alexis**, avec une condition de réouverture si la réponse est « oui,
assouplir D-S5 ».

## Question pour Alexis — B2/F1 de la revue du 13/11

Mesuré, comme demandé : le SERVEUR accepte aujourd'hui la saisie de la signature, du rapport, des
prestations et de la checklist sur une intervention `affectee` (ou toute autre, hors `annulee`/
`cloturee`) — `enregistrerSignature`, `enregistrerRapportTexte`, `enregistrerReponses` ne gardent
que `estFige()` (figée = annulée/clôturée), jamais `statut === "en_cours"`. Seul « Terminer »
lui-même reste refusé hors `en_cours` (`peutTerminer`). Je n'ai RIEN changé à cette règle, comme
demandé si le serveur accepte — mais je le remonte comme question : est-ce voulu qu'un technicien
puisse signer/remplir la checklist d'une intervention qu'il n'a pas encore démarrée ?

## Ce qui reste dû — « Reprendre » depuis le terrain (suspendue)

La barre d'action est VIDE sur une intervention `suspendue`. Mesuré : **aucun chemin terrain
n'existe aujourd'hui pour reprendre soi-même une suspension** — `peutDemarrerLeCompteur` refuse
explicitement `suspendue` (« la reprise rend le statut que le créneau dicte, elle ne se redémarre
pas par ce geste-là ») et renvoie vers la REPRISE, qui existe seulement côté BUREAU
(`app/api/interventions/[id]/reprendre/route.ts`, `peutReprendre`). Le technicien PORTE pourtant
déjà la capacité `suspendre_reprendre_intervention`, scopée à lui-même (D131) — D236 l'a rappelé
en ouvrant le chemin terrain de SUSPENDRE, sans toucher à REPRENDRE : *« Seul manquait un CHEMIN
terrain [pour suspendre] »*.

Construire ce chemin pour « Reprendre » demande, pour respecter I4 (le terrain fonctionne sans
réseau) : une route `app/api/terrain/[id]/reprendre/`, un geste de file neuf
(`lib/terrain/file-saisies.ts`), et le bouton — le même ordre de travail que 9K13/D236 pour
« Suspendre ». Ça n'entre pas dans le budget de ce lot (aucune migration requise, en revanche).
**Proposé pour un prochain ticket, même patron que D236.**

## Épreuves

- **Unitaires** (`tests/unit/terrain/{compteur-terrain,suspendre-terrain,rapport-automatique,
  checklist-terrain,fiche-hors-reseau-travail}.test.tsx`) : 87 tests, inchangés, tous verts — le
  repli « rendu inline si aucune barre n'entoure » (`DeclencheurBarreAction`) le garantit.
  `pnpm test` (525 fichiers, 5812 tests) et `pnpm test:isolation` (243 fichiers, 2211 tests) :
  verts.
- **Bout en bout** (`tests/e2e/9l04g-terrain-barre-fixe-terminer.spec.ts`, neuf) : barre fixe au
  défilement (même position Y avant/après un grand défilement) ; feuille à exactement DEUX manques
  (signature, checklist — le commentaire est pré-rempli par la scène) ; le lien checklist referme
  la feuille, déplie la rubrique ET y pose le focus (`toBeFocused()`) ; même vérification sur
  « Aller à la signature » (section entière) ; un motif SANS trait dessiné lève le manque
  signature, « Confirmer la fin » s'active ; « Suspendre » depuis la barre, pièce + date, la barre
  se vide ensuite sur la suspendue qui en résulte.
- **Régression ciblée** (toutes rejouées, toutes vertes) : `tests/e2e/9k27-terrain-terminer-ce-qui-
  manque.spec.ts` (2), `tests/e2e/tous-les-ecrans-rendent.spec.ts` (61 passés, 4 ignorés sans
  lien), `tests/e2e/9f4-terrain-enregistrement-auto.spec.ts` + `captures-9g8-terrain-confirmations
  -et-acces.spec.ts` + `offline/9f4h4d-coquille-sans-session.spec.ts` (17, dont la réouverture
  D220 et le « Démarrer » de la coquille hors session).
- `CI=1 pnpm verify` : format, typecheck, lint, test, test:isolation, build — vert.

## i18n

`terrain.barre_action.libelle` (aria-label du groupe de boutons). `terrain.e2e.piece_ref_barre_
fixe` (fixture de l'épreuve — le gardien L0-11 refuse une chaîne visible écrite en dur dans un
`getByText`, même dans un test).

## Captures (375 px, AVANT/APRÈS)

`docs/propositions/9L04G-TERRAIN-BARRE-FIXE-TERMINER/captures/` : fiche en cours (haut, bas) et
fiche affectée/terminée, AVANT (code parent `8f68b937c`, via un script temporaire de navigation +
capture, jamais committé) et APRÈS ce lot. Feuille « Terminer » à deux manques, point de checklist
atteint (le focus est visible — contour), feuille « Suspendre », barre vidée après suspension, et
fin sans trait avec motif : en APRÈS seulement — ces quatre derniers écrans n'ont pas changé
d'apparence À EUX SEULS (seul ce qui y mène, et le focus posé sur le point de checklist, a bougé).

**`docs/captures/` (la galerie repo-wide) n'a PAS été rafraîchie** — même motif que la passation de
9K27 : la procédure de `docs/captures/README.md` (base jetable, build de production, amorçage d'un
compte neuf par lien de premier accès, identités portail/multi-société) n'entre pas dans le budget
de ce lot et exige des secrets (mots de passe à choisir en direct) que cette session ne détient
pas.

## Ce qui n'est pas touché

Aucune migration. `docs/arbitrages.md` : aucune entrée neuve — rien n'a été TRANCHÉ par ce lot (les
deux points ouverts ci-dessus restent des questions pour Alexis, pas des décisions). `9K27/D242`
inchangés dans leurs règles ; seule la NAVIGATION vers les manques gagne le focus.
