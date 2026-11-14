# 9L04K-REACTIVER-ACCES-INTERNE — passation

Livré. Voir D255 (`docs/arbitrages.md`) pour la décision et sa condition de réouverture.

## Ce qui a été fait

1. **Le chemin de création réactive, il ne duplique plus.** `creerCompteDeBureau`
   (`lib/auth/acces-bureau.ts`) et `habiliterEtRattacherDans`
   (`lib/techniciens/depot.ts`, appelée par `creerTechnicien`) lisent la ligne
   `utilisateur_societe` existante AVANT d'écrire : INACTIVE, elle est réactivée
   (`actif = true`) — avec, pour le seul chemin de bureau, le RÔLE du formulaire
   resoumis ; ACTIVE, le refus `deja_membre` est inchangé. La fiche `technicien`
   n'est jamais recréée ni modifiée par cette réactivation (sa clé est
   `(societe_id, utilisateur_id)`, PRIMAIRE).
2. **Un bouton direct, « Rétablir l'accès »**, sur chaque ligne « Accès retiré »
   des deux onglets d'Équipe (`app/(back-office)/parametres/equipe/page.tsx`,
   `BoutonRetablirAcces`) — passe par `retablirAccesInterne`
   (`lib/auth/retrait-acces.ts`), symétrique de `retirerAccesInterne` : il pose
   `actif = true` sur la même ligne, SANS toucher au rôle. Route
   `POST /api/equipe/[id]/retablir-acces`, partagée par les deux onglets comme
   `retirer-acces` (`onglet` voyage dans le formulaire).
3. **La tuile « Accès à ouvrir » du tableau de bord** (`techniciensAccesAOuvrir`,
   `lib/tableau-de-bord/lectures.ts`) exclut désormais les lignes dont l'accès a
   été retiré (`accesInterneActif`), en plus du filtre `technicien.actif` déjà
   présent.

## Le point mesuré et NON corrigé, documenté plutôt que contourné

Le ticket demandait de tracer le rétablissement au `journal_acces`, en
réutilisant la valeur d'`EvenementAcces` de 9L03C (`retrait_acces_interne`) « si
elle convient — sinon ARRÊTE-toi : une valeur neuve serait une migration ». Elle
ne convient pas : le commentaire qui l'introduit (D251) est explicite — « un seul
geste, un seul événement » — et ce geste-ci est l'INVERSE exact de celui qu'elle
nomme. L'écrire sur une ligne de rétablissement ferait mentir le journal (« Accès
retiré » affiché pour un accès qu'on vient de rendre). Aucune autre valeur
existante ne convient davantage. Ajouter une valeur neuve est une migration
(`ALTER TYPE ... ADD VALUE`), explicitement hors territoire de ce lot.

**Ce n'est pas un geste invisible pour autant** : `utilisateur_societe` est dans
le périmètre audité par déclencheur (I8) — `journal_audit` porte déjà l'auteur,
l'horodatage et les valeurs avant/après de la bascule `actif`. Seul
`journal_acces`, qui répond à une question plus étroite (D34 : « qui a tenté
d'accéder à quelles données »), ne nomme pas ce geste précis. Voir D255 pour la
condition de réouverture : le jour où une valeur dédiée existe (migration
décidée pour elle-même), `retablirAccesInterne` et les deux chemins de création
se relisent pour y écrire une trace.

## Ce qui a été mesuré et laissé tel quel

- Le rôle appliqué à la réactivation par le BOUTON direct (`retablirAccesInterne`)
  est celui que la ligne portait déjà — jamais redemandé, contrairement au
  chemin de création qui applique le rôle du formulaire resoumis. Les deux
  chemins ont des contrats différents par construction (l'un n'a aucun
  formulaire, l'autre en a toujours un).
- `lib/habilitations/depot.ts`, `lib/avertissements/signature-terrain.ts` et les
  autres lecteurs de `utilisateur_societe` déjà recensés par la passation de
  9L03C n'ont pas été rouverts : aucun n'ouvrait d'accès à une ligne inactive,
  seule la tuile « Accès à ouvrir » le faisait (voir D255).
- `docs/captures/README.md` était DÉJÀ stale avant ce lot — `pnpm captures:etat`
  liste des dizaines de fichiers changés depuis la prise du 27/09/2026, bien
  antérieurs à ce ticket. Reprendre la prise de vue systématique (base jetable,
  plusieurs identités, amorçage manuel d'un mot de passe) sort du budget de ce
  lot et n'est pas une dette que ce ticket a créée. Les captures PROPRES à ce
  lot, demandées par le brief, sont livrées sous
  `docs/propositions/9L04K-REACTIVER-ACCES-INTERNE/captures/`.

## Épreuves

- `tests/isolation/9l04k-reactiver-acces-interne.test.ts` (créé, 10 scénarios) —
  `retablirAccesInterne` (réactivation dans sa société, société B introuvable,
  ligne déjà active → `deja_membre`, ADV sans capacité refusé avant toute
  écriture, une connexion ouvre la société après rétablissement) ;
  `creerCompteDeBureau`/`creerTechnicien` resoumis (réactivation avec le rôle du
  formulaire, ligne active → `deja_membre` inchangé, fiche `technicien` jamais
  touchée) ; `techniciensAccesAOuvrir` n'annonce plus une ligne retirée.
- `tests/unit/equipe/retablir-acces-route.test.ts` (créé) — même patron que
  `retirer-acces-route.test.ts`.
- `tests/unit/techniciens/depot.test.ts` — un scénario neuf (réactivation), le
  mock de `tx.utilisateurSociete` complété (`findFirst`/`update`).
- `tests/unit/auth/porte.test.ts` — `ROUTE_CAPACITE` et son décompte (115).
- `tests/e2e/captures-9l04k-reactiver-acces.spec.ts` (créé, 4/4 verts, aux deux
  largeurs) — bureau : retrait puis rétablissement jusqu'au bout, captures
  avant/confirmation/après, et une connexion NEUVE prouve que la société est
  bien rouverte ; technicien : le bouton ne se propose jamais tant que l'accès
  est actif (scène partagée non touchée) ; la tuile « Accès à ouvrir » du
  tableau de bord est capturée avant et après.

`pnpm test` (5848 scénarios), `pnpm test:isolation` (2231 scénarios),
`pnpm typecheck`, `pnpm lint` tous verts avant de rendre la main. `test:e2e`
n'a pas été rejoué en entier (budget de temps, et la consigne du pilote limite
les e2e au premier plan aux specs ciblées) — seul le spec neuf de ce lot a été
joué, deux fois (sans puis avec les captures).
