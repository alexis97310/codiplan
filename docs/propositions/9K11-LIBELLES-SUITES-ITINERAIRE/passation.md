# 9K11-LIBELLES-SUITES-ITINERAIRE — passation

## 1. Mesure

### Les trois libellés

- `lib/i18n/fr.ts` bloc « SUITES À DONNER » (:1561-1660) :
  - `suites_a_donner.action.qualifier` (:1594) — « Qualifier ». Rendu sur
    `app/(back-office)/interventions/suites-a-donner/page.tsx:192` (ligne « À
    qualifier ») et `app/(back-office)/interventions/[id]/page.tsx:1771` (la
    fiche). Distinct de `demande.action.qualifier` (:2888) — un AUTRE geste
    (qualifier une **demande**, D164) — non touché.
  - `suites_a_donner.statut.a_replanifier` (:1592) — « À déplacer ». Rendu
    comme pastille de statut sur le registre
    (`suites-a-donner/page.tsx:228`), sur la fiche intervention (`[id]/
    page.tsx:1748`), et dans les textes de refus/aide qui le NOMMENT en toutes
    lettres (`suites_a_donner.refus.statut_invalide`,
    `suites_a_donner.accord.recu_aide`).
  - `suites_a_donner.action.replanifier` / `.replanifier.titre` (:1598,
    :1642) — « Déplacer… ». Rendu comme lien d'action sur le registre
    (`suites-a-donner/page.tsx:300`) et comme titre de l'écran
    `/interventions/suites-a-donner/[id]/replanifier/`.
  - Toutes les épreuves qui cherchent ces textes passent par `fr["clé"]`
    (jamais un littéral), donc suivent le changement de VALEUR sans rien à
    réécrire : vérifié par recherche sur les trois clés dans `tests/`.

- **Ce qui n'est PAS dans ce périmètre** : `intervention.action.deplacer`
  (:2164) et `interventions.colonne.deplacer` (:1688) portent aussi
  « Déplacer » / « Déplacer… », mais pour le geste GÉNÉRIQUE — replanifier
  n'importe quelle intervention déjà posée (colonne « En retard » du
  registre, bouton de la fiche). Mesuré sur
  `app/(back-office)/tableau-de-bord/presentation.ts:543`
  (`prioritesEnRetard`) : aucune de ces trois clés ne nomme une reprise de
  suite à donner. Elles restent « Déplacer… », inchangées.

### Contradiction trouvée et signalée — D172 (TR-52/TR-55)

**`docs/arbitrages.md:6106`, décision D172, bornée aux « cinq synonymes
fermés » :** « replanifier » → « Déplacer… » est un des cinq, posé précisément
sur `suites_a_donner.statut.a_replanifier` et
`suites_a_donner.action.replanifier`/`.replanifier.titre` — CE SONT les
clés que ce ticket demande de changer. `tests/unit/i18n/
vocabulaire-impose.test.ts` (`SYNONYMES_FERMES`) ferme le mot « replanifier »
lui-même (regex `\breplanifi(?:er|cation)s?\b`, sans exemption) mais
n'impose PAS mécaniquement le mot « Déplacer » : le nouveau texte
(« À planifier », « Planifier la reprise… ») ne contient pas « replanifier »
et ne fait donc rougir aucun gardien automatique.

La condition de réouverture de D172 nomme pourtant EXACTEMENT ce cas : « le
jour où Alexis ne valide pas une des précisions du pilote […] notamment […]
la liste BORNÉE des cinq synonymes fermés […] cette page se rouvre pour la
trancher à sa place. » Les décisions d'Alexis du 09/11 (ce ticket) ne citent
pas D172 — rien n'indique qu'elles aient été prises en connaissance de ce
verrou.

**Décision prise ici** : j'applique le changement tel que demandé, mais
UNIQUEMENT sur les clés `suites_a_donner.*` qui portent la reprise d'un
dossier (jamais sur le geste générique `intervention.action.deplacer` /
`interventions.colonne.deplacer`, qui reste « Déplacer… », conforme à
D172). J'ajoute une ligne d'amendement sous D172 dans `docs/arbitrages.md`
pour que la trace écrite existe — **à valider par Alexis** : si ce n'est pas
ce qu'il voulait, la bonne réouverture est D172 lui-même, pas un nouveau
ticket.

## 2. Libellés

Dans `lib/i18n/fr.ts` : `suites_a_donner.action.qualifier` → « Ouvrir le
devis », `suites_a_donner.statut.a_replanifier` → « À planifier »,
`suites_a_donner.action.replanifier` et `.replanifier.titre` → « Planifier
la reprise… ». Suivis par cohérence interne (même geste, un seul mot, §9
01/09), au-delà des trois textes nommés par le ticket :
`suites_a_donner.refus.statut_invalide`, `.refus.deja_replanifiee`,
`.accord.recu_aide`, `.piece_recue` et `.replanifier.confirmer`
(« Confirmer le déplacement » → « Confirmer la planification ») — sinon
l'écran aurait dit « Planifier la reprise… » sur un bouton et « confirmer le
déplacement » sur l'écran suivant, deux mots pour le même geste. Le
docblock qui expliquait le choix de D172 (lignes au-dessus de la clé de
statut) est réécrit pour ne plus affirmer un état qui n'est plus vrai pour
CE geste précis — la contradiction est documentée ci-dessus plutôt
qu'effacée.

Une ligne ajoutée sous D172 dans `docs/arbitrages.md` porte la même
réserve, pour qu'elle survive à cette seule passation.

`demande.action.qualifier` (un autre geste, D164) n'est pas touché.
`intervention.action.deplacer`, `interventions.colonne.deplacer`,
`tableau_de_bord.priorite_action_deplacer` (le geste générique) ne sont pas
touchés.

Épreuves rejouées : `pnpm test` (5565/5565), `pnpm test:isolation`
(1995/1995), `tests/unit/i18n/vocabulaire-impose.test.ts` et
`tests/unit/docs/amendements-arbitrages.test.ts` (cette ligne d'amendement
ne porte pas la forme `**Amendé par D…**` que ce gardien surveille — elle
n'est donc pas vue par lui, ce qui est le point : 9K11 n'est pas un
numéro `D`).

## 3. Itinéraire

`lienItineraire` (`components/terrain/presentation.ts`) — un URI
`geo:0,0?q=<adresse encodée>`, `null` sans adresse. Posé sous la ligne
d'adresse de la fiche terrain (`app/(mobile)/terrain/[id]/page.tsx`), en
`<Button asChild variant="outline" size="lg">` autour d'un `<a>` —
`size="lg"` est déjà la convention du terrain (48 px, ≥ 44 px, D144), et les
deux gardiens qui comptent les `<Button>` du terrain
(`tests/unit/ui/composants-base.test.tsx`,
`tests/unit/ui/retouches-2a.test.ts`) sont mis à jour (20 → 21).

Pourquoi `geo:` plutôt qu'un lien `https://maps.google.com/…` : le premier
laisse l'APPAREIL choisir l'application (Google Maps, Waze, tout ce qui
s'enregistre pour ce schéma), le second ouvrirait TOUJOURS Google Maps —
contraire à « jamais une application imposée ». Aucune lecture réseau pour
construire ou afficher le lien (I4) : seule son ouverture par le téléphone,
hors du périmètre de ce ticket, en dépend.

Épreuve unitaire (`tests/unit/terrain/presentation.test.ts`, 3 cas : sans
adresse, adresse simple, adresse à caractères spéciaux) et épreuve e2e
dédiée à 375 px (`tests/e2e/9k11-itineraire-terrain.spec.ts`, sa propre
scène jetable) — voir le détail et le constat de fragilité multi-fichiers
(sans rapport avec ce lot) dans le message du commit correspondant.

## 4. Captures — NON FAIT, faute de temps

Point non tenu : aucune capture 375/1280 AVANT/APRÈS n'a été prise pour le
registre des suites à donner ni la fiche terrain. La session a dépassé
T0+50 (code neuf interdit passé ce repère) avant d'y arriver — construire la
paire AVANT/APRÈS exige la recette `git stash`/capture/restauration déjà
en mémoire (captures-avant-apres-e2e), un geste que je n'ai pas voulu
commencer après la limite. **Reste à faire, nommément, à la session
suivante.**

## 5. État à la fin de la session

- Branche dédiée `9K11-LIBELLES-SUITES-ITINERAIRE`, partant d'`origin/main`
  (HEAD était détaché sur `origin/main`, pas de `main` extraite ailleurs
  dans ce worktree).
- Quatre commits, un par point livré (mesure, libellés + trace D172,
  itinéraire + épreuve e2e), tous verts (`pnpm format`, `pnpm typecheck`,
  `pnpm lint`, `pnpm test`, `pnpm test:isolation`).
- `pnpm test:e2e tests/e2e/tous-les-ecrans-rendent.spec.ts` : vert.
- Point 4 (captures) non livré — voir ci-dessus.
- `git fetch origin` : `origin/main` n'a pas bougé depuis la création de la
  branche, aucun rebase nécessaire.
- `verify:full` est laissé à la file, non joué ici.
- **À valider par Alexis en priorité** : la révision de D172/TR-52 (§1
  ci-dessus) — si le mot « Déplacer… » devait rester pour la reprise d'une
  suite à donner, c'est cette seule décision qu'il faut défaire, pas
  « Ouvrir le devis » ni l'itinéraire.
