# 9D1-SIGNATURE-CLIENT-ABSENT — passation

## Ce que j'ai changé

`app/api/terrain/[id]/signature/route.ts` : la route `POST
/api/terrain/{id}/signature` construisait TOUJOURS un objet avec les cinq
clés (`issue`, `image_base64`, `signataire_nom`, `signataire_qualite`,
`motif`) avant de le passer à `schemaSignature.safeParse`, quelle que soit
l'issue. Depuis 9DF/9DFA (R1, relecture du 04/10/2026), les branches
`client_absent` et `refus_signature` du schéma sont `.strict()` — une clé
présente, même à `null` (le formulaire terrain envoie toujours un champ caché
`image_base64`, vide en dehors de l'issue `signee`), devient une « clé
inconnue » refusée par Zod.

**Conséquence côté exploitation** : sur le terrain, un technicien qui
choisissait « Client absent » ou « Refus de signer » et saisissait un motif
voyait TOUJOURS son formulaire refusé avec le message « Le motif est
obligatoire… », même motif rempli. Ces deux issues étaient donc complètement
inutilisables depuis le commit e62923cb.

**Le correctif** construit l'objet donné à `safeParse` SELON L'ISSUE
déclarée : `{issue, motif}` seulement pour `client_absent`/`refus_signature`
(les seules clés que ces branches strictes acceptent), et l'objet complet
(`image_base64`, `signataire_nom`, `signataire_qualite`) pour `signee`. Le
schéma lui-même n'a pas changé — il reste `.strict()`, et l'invariant « ces
deux issues n'ont jamais d'image » reste gardé par
`signature-signataire.test.ts:~156`, inchangé. Un éventuel champ image
étranger envoyé avec `client_absent` est désormais ignoré par la route (motif
seul enregistré) plutôt que de faire échouer tout le dépôt — l'écran terrain
ne propose de toute façon jamais de canevas hors de l'issue `signee`.

## Ce que j'ai mesuré

- Reproduit AVANT correctif par un test de route
  (`tests/unit/interventions/signature-route.test.ts`, écrit avant la
  correction) : `POST` avec `{issue: "client_absent", motif: "Client
  injoignable"}` renvoyait `303` vers `/terrain/{id}?motif=terrain.signature.motif_manquant`
  et `enregistrerSignature` n'était jamais appelée — confirmé pour les deux
  issues `client_absent` et `refus_signature`.
- Après correctif, la même suite (8 cas) passe : les deux issues avec motif
  non vide sont acceptées (aucun paramètre `motif` dans la redirection,
  `enregistrerSignature` appelée avec `{issue, motif}` strict) ; motif vide
  toujours refusé ; un `image_base64` étranger envoyé avec `client_absent`
  n'empêche plus l'enregistrement du motif ; l'issue `signee` (image + nom)
  continue de fonctionner comme avant.
- Captures e2e réelles AVANT/APRÈS, écran terrain à 375 px, issue « Client
  absent » avec motif rempli, prises avec un spec jetable (supprimé après
  usage, voir « ce que je n'ai pas fait ») :
  `docs/propositions/9D1-SIGNATURE-CLIENT-ABSENT/captures/signature-client-absent-avant-refus-375.png`
  (bandeau rouge « Le motif est obligatoire… ») et
  `…-apres-enregistre-375.png` (bandeau orange « Une signature a déjà été
  recueillie… »). Prises en revenant temporairement au code d'avant (`git
  checkout` du seul fichier de la route, patch ré-appliqué ensuite), serveur
  de dev relancé entre les deux, pas d'hypothèse — les deux captures montrent
  un run réel.
- `CI=1 pnpm verify:full` vert : format, typecheck, lint, 2745+ tests
  unitaires, isolation, build, fériés, partitions, et l'intégralité de
  `test:e2e` (855 passés, 7 skip connus, 0 échec) — deux passages complets,
  le premier (avec le spec de capture encore présent) a révélé que ce spec
  jetable ne pouvait pas rester dans la suite permanente (voir plus bas), le
  second est le passage retenu.

## Ce que j'ai tranché et pourquoi

- **Corriger la ROUTE, pas le schéma** (conforme à la consigne du ticket) :
  le schéma `.strict()` est la bonne défense pour quiconque appelle
  `enregistrerSignature`/`schemaSignature` directement avec une image sur ces
  deux issues (R1 reste gardé) ; la route, elle, ne doit simplement jamais
  construire une clé qu'une issue n'accepte pas.
- **Le spec e2e de capture n'a pas sa place dans la suite permanente** :
  j'ai d'abord écrit `tests/e2e/captures-9d1-signature-client-absent.spec.ts`
  avec deux tests, « AVANT » (asserte le refus) et « APRÈS » (asserte
  l'enregistrement), filtrés par `-g` pour capturer chaque état sur la bonne
  version du code — recette de
  `docs/propositions/captures-avant-apres-e2e.md` déjà éprouvée. Mais à la
  différence des captures « avant/après » d'autres tickets (ex. 9DF, dont les
  deux états sont deux FAITS intrinsèquement vrais en même temps — deux
  interventions de statuts différents), ici les deux tests assertent des
  comportements MUTUELLEMENT EXCLUSIFS de LA MÊME action sur LA MÊME version
  du code : le test « AVANT » échoue nécessairement une fois le correctif
  committé. Le premier `verify:full` complet l'a confirmé (1 échec, exactement
  ce test). Je l'ai donc supprimé après avoir produit les deux PNG — seules
  les captures restent, pas l'outil qui les a prises.
- **Test de régression permanent au niveau de la route, en unitaire**
  (`tests/unit/interventions/signature-route.test.ts`), pas en e2e : plus
  rapide, suffisant pour prouver que c'est bien l'objet construit par la
  route (et non le schéma) qui était fautif, et c'est exactement ce que
  demandait le ticket (« test d'intégration de la route suffit » si aucun
  spec terrain dédié n'existe déjà pour la signature — aucun n'existe,
  `bon-4.spec.ts` et `9de-terminer-signature.spec.ts` couvrent l'issue
  `signee` et une écriture directe en base, jamais `client_absent`/
  `refus_signature` par la route).
- **96 captures PNG étrangères au lot, modifiées ou régénérées par le run
  complet de `test:e2e`**, restaurées avec `git checkout --` (fichiers déjà
  suivis) ou supprimées (nouveaux fichiers jamais commités) avant chaque
  commit — comportement déjà connu du run complet (chaque spec qui prend ses
  propres captures les régénère), sans rapport avec ce lot, jamais commité
  (consigne explicite du ticket).

## Ce que je n'ai PAS fait

- Je n'ai touché ni `depot/` ni `11-FILE.sh`, aucune migration, aucune ligne
  de semis, aucun prix, aucune décision D — rien que le ticket n'autorisait
  pas.
- Je n'ai pas ajouté de spec e2e permanent pour `client_absent`/
  `refus_signature` : le test de route suffit (voir ci-dessus), et un e2e
  permanent qui saisit un motif puis s'arrête sans clôturer n'aurait rien
  prouvé de plus que ce que `signature-route.test.ts` prouve déjà, avec un
  coût d'exécution bien plus élevé.
- Je n'ai pas vérifié le comportement si un VRAI appel malveillant (hors
  écran terrain) envoie `client_absent` + une vraie image en direct sur la
  route : avec le correctif, cette image est désormais silencieusement
  ignorée par la route (le motif seul est enregistré) plutôt que refusée au
  niveau HTTP — ce n'est PAS mesuré par un test de route dédié à ce cas
  précis (seul `signature-signataire.test.ts:~156`, au niveau du schéma,
  couvre le refus). Si ce cas doit un jour être refusé AU NIVEAU DE LA ROUTE
  elle-même (pas seulement ignoré), c'est un arbitrage à part.

## Les pièges pour la session suivante

- Le formulaire terrain (`components/interventions/signature-terrain.tsx`)
  pose un `<input type="hidden" name="image_base64" />` **toujours présent**
  dans le DOM, quelle que soit l'issue choisie — rempli seulement pour
  `signee` (ligne ~121-123). C'est LA cause du bug : `formulaire.get(...)`
  renvoie une chaîne vide, pas `null`, donc la clé existe toujours côté
  FormData. Toute nouvelle issue ajoutée à `schemaSignature` doit vérifier
  qu'aucun champ caché superflu n'est transmis à son branch `.strict()`.
- Lancer `pnpm verify:full` sur ce dépôt régénère des dizaines de captures
  PNG non liées au lot en cours (chaque spec e2e qui prend ses propres
  captures les réécrit). `git status --porcelain | grep "^ M docs/propositions/"`
  avant de committer, et restaurer ces fichiers avec `git checkout --`
  (jamais `git checkout .`) ; les captures NOUVELLES et non suivies
  (`??`) étrangères au lot sont à supprimer, pas à committer.
- `pnpm verify:full` complet (avec la suite e2e) prend environ 35 minutes
  rien que pour `test:e2e` sur cette machine — prévoir la durée, ne pas le
  relancer sans raison.

## Ce qui reste à faire

Rien côté correctif — la régression est corrigée, mesurée (avant/après, en
unitaire et en capture réelle), et `verify:full` est vert. Aucun ticket de
suivi identifié par ce lot.
