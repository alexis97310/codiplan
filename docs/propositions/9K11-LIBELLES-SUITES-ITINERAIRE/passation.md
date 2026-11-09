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
