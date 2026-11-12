# 9L01-COPIE-LIEN-EXCLUSIVITE — passation

Décision d'Alexis du 10/11/2026 : deux chemins voisins de D226 (01/11/2026, 9I8D1) ne posaient pas
la même question qu'elle. Écrite en entier : `docs/arbitrages.md` D247.

## AUCUNE MIGRATION — signalé par le ticket, confirmé en cours de route

Les deux correctifs tiennent entièrement dans `lib/` : aucune colonne, aucune politique RLS, aucun
schéma n'a changé. `identiteExclusiveALaSociete` (D226, `lib/auth/lien-d-acces.ts`) et la fonction
`SECURITY DEFINER` qu'elle appelle existaient déjà ; ce ticket les appelle depuis deux chemins de
plus, rien de plus.

## Ce que ce ticket fait

1. **Copier le PREMIER lien d'accès** (`copierLienDAcces`, `lib/auth/acces-technicien.ts` ;
   `copierLienDAccesBureau`, `lib/auth/acces-bureau.ts`) pose désormais `identiteExclusiveALaSociete`
   juste après l'appartenance, AVANT tout jeton — même motif nommé, `autre_societe`, que la copie
   d'un NOUVEAU lien. **Aucune « cible protégée » (D223) ici** : ce contrôle ne vaut que pour la
   copie d'un nouveau lien, le premier lien d'un compte de direction ou d'un autre administrateur de
   société restant permis, comme avant ce ticket. Le refus n'écrit aucune trace — même discipline que
   les autres refus de ce geste (`introuvable`, `deja_un_mot_de_passe`), eux-mêmes muets.

2. **Créer un compte de bureau** (`creerCompteDeBureau`, `lib/auth/acces-bureau.ts`) **et créer un
   technicien** (`creerTechnicien`, `lib/techniciens/depot.ts`) posent la même fonction AVANT de
   rattacher une identité trouvée par courriel. Motif UNIQUE et NEUTRE, `courriel_connu_ailleurs`,
   partagé par les deux chemins : il ne révèle ni le rôle de cette identité ailleurs, ni si son
   compte y est déjà activé. Un courriel connu de la MÊME société garde son refus propre
   (`deja_membre`), inchangé — `identiteExclusiveALaSociete` y répond VRAI, comme avant.

3. **`lib/i18n/fr.ts`** — deux clés neuves, même texte, un mot pour mot neutre : `equipe.refus.courriel_connu_ailleurs`
   et `equipe.bureau.refus.courriel_connu_ailleurs`. Rien côté route : `versLEquipe`/`versLEquipeBureau`
   redirigent déjà génériquement sur `equipe[.bureau].refus.<motif>`, et `BandeauMotif` (page
   Équipe) comme `BoutonCopierLien` (le bouton « Copier le lien d'accès ») rendent toute clé connue
   du dictionnaire — aucune des deux n'avait besoin d'un changement pour afficher ce nouveau motif.
   `equipe.acces.refus.autre_societe` et `equipe.bureau.acces.refus.autre_societe` existaient déjà
   (D226, posées pour le NOUVEAU lien) : le premier lien les réutilise telles quelles.

## MESURÉ EN COURS DE ROUTE — un harnais à réparer, pas un bogue du code visé

`tests/unit/techniciens/depot.test.ts` rejoue `creerTechnicien` sur un client Prisma FACTICE, sans
base (voir son en-tête). `identiteExclusiveALaSociete` y appelle `avecSociete(...).$queryRaw`, que ce
client factice n'exposait pas — chaque appel à `creerTechnicien` avec une identité EXISTANTE serait
tombé dans le `catch` fail-closed de D226 et aurait renvoyé `false` (non exclusif) sans distinction,
faisant échouer silencieusement les témoins de rattachement déjà écrits. Corrigé en ajoutant un
`$queryRaw` factice au harnais (`identiteExclusive` par défaut `true`, comme AVANT ce ticket) et en
comptant la transaction supplémentaire qu'`avecSociete` ouvre (2 → 3 pour le scénario « rattache »).
Un test neuf (`identiteExclusive: false`) éprouve le refus lui-même sous ce même harnais.

**Second correctif, découvert par `pnpm verify` lui-même** — l'épreuve de bout en bout vérifiait
d'abord que le bandeau ne contenait NI « ADV » NI « activ », en plus de l'égalité exacte avec le
texte du dictionnaire. `tests/unit/i18n/sans-chaine-visible-en-dur.test.ts` (L0-11) a refusé ces deux
assertions : toute chaîne en dur passée à une requête d'écran est interdite, même en négatif. Retiré
— l'égalité exacte déjà posée juste au-dessus prouve la même chose : rien d'autre que ce seul texte
neutre n'est affiché.

## Épreuves

- **Unitaires** — `tests/unit/techniciens/depot.test.ts` (refus `courriel_connu_ailleurs`, avant
  toute écriture) ; `tests/unit/techniciens/creer-envoi-acces-non-parti.test.ts` et
  `tests/unit/equipe/bureau-creer-envoi-acces-non-parti.test.ts` (la route redirige vers le bon
  motif, sans jamais tenter l'envoi) ; `tests/unit/equipe/copier-lien-cache-control.test.ts` (le
  motif `autre_societe` traverse intact les DEUX routes « premier lien », sous `no-store`).
- **Isolation** — `tests/isolation/acces-bureau.test.ts` et `tests/isolation/acces-technicien.test.ts` :
  société B crée un compte non activé, société A tente (a) de le créer avec le même courriel — refus
  neutre, rien n'est écrit pour A ; (b) un compte déjà exclusif, activé puis rattaché à une AUTRE
  société par un autre chemin, copie son premier lien — refus `autre_societe`, aucun jeton, aucune
  trace, chez A ET chez B ; un compte resté EXCLUSIF reste copiable (témoin) ; FAIL-CLOSED (9I8D2)
  — `EXECUTE` révoqué sur la fonction, le refus tient quand même.
- **Bout en bout** — `tests/e2e/captures-9l01-copie-lien-exclusivite.spec.ts` : un compte de bureau
  et un technicien, non activés, dans l'AUTRE société du semis ; la tentative de création, par le
  VRAI formulaire de l'écran Équipe, affiche le bandeau neutre (texte vérifié mot pour mot, et
  l'absence du rôle/de l'activation dans le texte rendu) ; rien n'est écrit pour la société active.
  Captures 1280/375 sous `docs/propositions/9L01-COPIE-LIEN-EXCLUSIVITE/captures/`
  (`CAPTURES_9L01=<dossier>` — rien n'est écrit sans cette variable, même discipline que
  `captures-9i8d1-reprise-9i8d.spec.ts`).

## `CI=1 pnpm verify` — jouée au complet, vert

`format:check`, `typecheck`, `lint`, `test`, `test:isolation` et `build` : vert de bout en bout.

## NON FAIT — budget de temps, signalé plutôt que bâclé

- Le premier lien de bureau/technicien n'est pas préfiltré à l'écran (aucun `exclusif` passé au
  bouton « Copier le lien d'accès » tant que l'accès n'est pas encore actif) — le serveur refuse,
  le bouton affiche le texte du motif, exactement le même idiome que D223/D226 pour le menu « nouveau
  lien ». Aucune capture n'a été prise pour CE refus précis (copie du premier lien d'une identité
  partagée) ; l'isolation et les unitaires le couvrent.
- `envoyerLienDAcces`/`envoyerLienDAccesBureau` (envoi par courriel, premier ou nouveau lien) restent
  SANS ce contrôle, comme avant ce ticket et comme l'en-tête de `lib/auth/acces-technicien.ts` le
  nommait déjà — l'URL y est adressée à la personne, jamais à l'administrateur, qui ne la voit jamais
  (voir D247).

## Reprise 9L01A

Son premier passage de `verify:full` était rouge sur trois scènes e2e ANCIENNES. Deux portaient la
même cause, la troisième une cause indépendante.

- `tests/e2e/9i8d1-copie-nouveau-lien-autre-societe.spec.ts` et
  `tests/e2e/captures-9i8d1-reprise-9i8d.spec.ts` (9I8D1) posaient le rattachement à l'AUTRE société
  AVANT l'activation accélérée du compte (`copier-lien` puis mot de passe direct, hors sujet de ces
  fichiers). D247 étend désormais `identiteExclusiveALaSociete` au PREMIER lien de bureau
  (`copierLienDAccesBureau`) : rattachée avant activation, l'identité n'était déjà plus exclusive,
  le premier lien refusait (`autre_societe`), aucun compte n'était écrit, et la ligne restait à
  l'état « aucun accès » — sans menu « … », faisant échouer le clic qui le cherche (timeout, pas un
  refus silencieux). **Corrigé par une réponse à l'ordre des opérations, pas à une règle assouplie** :
  les deux scènes activent maintenant le compte TANT QU'IL EST ENCORE EXCLUSIF, puis rattachent à
  l'autre société après coup — même recette que `activer()` dans
  `tests/isolation/acces-bureau.test.ts` (D226 étendue), déjà écrite pour prouver la même chose au
  niveau fonction. Un rattachement après activation reste un cas RÉEL à couvrir (identité activée
  avant D247, ou rattachée par un autre chemin) : noté en commentaire dans chaque scène.
- `tests/e2e/9du-recherche-rail.spec.ts` (Ctrl K) — mesuré séparément : ce fichier pose sa PROPRE
  scène (un client et un site `9DU-…`), sans aucune identité partagée entre sociétés. Rejoué seul,
  `CI=1 --workers=1`, quatre fois d'affilée sans aucun échec. Cause INDÉPENDANTE de D247 — une
  instabilité déjà présente avant ce ticket, non reproduite ici, laissée telle quelle.

Rejoué au premier plan, `CI=1 --workers=1` : les trois fichiers ci-dessus, `copier-nouveau-lien`,
les e2e propres à 9L01 (`captures-9l01-copie-lien-exclusivite.spec.ts`),
`tests/e2e/tous-les-ecrans-rendent.spec.ts`, puis `pnpm test:isolation` et `CI=1 pnpm verify` —
tous verts.
