# 89-DEMANDES-3 — passation

## Ce que j'ai changé (et ce que ça change pour l'exploitation)

1. **« Demandes » entre dans le menu**, dans le domaine Exploitation, entre
   Planning et Interventions (`lib/navigation/entrees.ts`). C'est un ÉCART
   NOMMÉ à la maquette (D121 fait foi sur les quatorze destinations de
   `docs/maquette/codiplan-maquette-complete.html`, qui n'en dessine pas
   quinze) — décidé par Alexis le 25/09/2026 à 14h25, écrit trois fois :
   dans `lib/navigation/entrees.ts` (`ECARTS_HORS_MAQUETTE`), dans
   `tests/unit/navigation/entrees.test.ts`, et dans `docs/arbitrages.md`
   (D133, à la suite de D132 où vit déjà l'historique de la barre).
2. **`/demandes` porte un bouton d'en-tête « Créer une intervention »**
   (`app/(back-office)/demandes/page.tsx`), même style et même position que
   sur le registre `/interventions` (`LienPrimaire`, bleu, en haut à
   droite), gardé par la même capacité que sur les fiches client et site —
   `creer_demande`.
3. **La clé i18n `nav.demandes`** = « Demandes » (`lib/i18n/fr.ts`).

**Pour l'exploitation** : un exploitant qui quitte le tableau de bord ne
perd plus le chemin vers la file de qualification — il l'atteint depuis
n'importe quel écran du back-office, et l'entrée s'allume pour dire où il
est. Depuis `/demandes`, il peut créer une intervention sans repasser par
le registre ou une fiche client/site.

## Ce que j'ai mesuré

- `pnpm test` (unitaires) : **2838 tests passés** sur 263 fichiers, aucune
  régression.
- `pnpm typecheck`, `pnpm lint`, `pnpm format:check` : verts.
- `pnpm verify` (format + typecheck + lint + test + test:isolation +
  build) : **vert de bout en bout**, y compris le build de production —
  `/demandes` apparaît bien dans la liste des routes générées.
- Les trois gardiens que le ticket nomme explicitement restent verts,
  rejoués isolément après le changement :
  - `tests/unit/navigation/barre-par-role.test.tsx` (D132, filtre par
    capacité) — 4 tests.
  - `tests/unit/navigation/atteignabilite-ecrans.test.ts` — 3 tests.
  - `tests/unit/docs/maquette-unique.test.ts` — 2 tests.
- `tests/e2e/demandes-3.spec.ts` (nouveau, 2 scénarios) : depuis
  `/tableau-de-bord`, le lien « Demandes » du menu mène à `/demandes` et
  s'y allume (`aria-current="page"`) ; « Créer une intervention » mène à
  `/interventions/nouvelle` sans rien créer. **Rejoué deux fois de suite,
  vert les deux fois.**
- Trois autres suites e2e touchant la même barre ou le même module,
  rejouées pour écarter une régression : `tests/e2e/
  navigation-app-technicien.spec.ts` (3 tests), `tests/e2e/demandes.spec.ts`
  (7 tests), `tests/e2e/demandes-2.spec.ts` (1 test) — **12/12 verts**.
- **Non mesuré** : `pnpm verify:full` dans son ensemble (la suite e2e
  complète n'a pas été rejouée de bout en bout, faute de budget dans la
  fenêtre de ce lot) — seuls les fichiers e2e listés ci-dessus, choisis
  parce qu'ils touchent la barre de navigation ou `/demandes`, ont été
  rejoués individuellement.

## Ce que j'ai tranché, et pourquoi

- **Le mécanisme de l'écart** : plutôt que de réutiliser `ECARTS_MAQUETTE`
  (qui porte des entrées que la maquette dessine et que le code OMET —
  l'autre sens), j'ai créé `ECARTS_HORS_MAQUETTE`, symétrique, pour des
  entrées que le CODE ajoute sans que la maquette les dessine. Réutiliser
  la première liste aurait fait mentir son propre test (« chaque écart est
  ADOSSÉ à un libellé réel » — « Demandes » n'existe justement PAS dans la
  maquette, donc ne peut pas s'y adosser).
- **La capacité du bouton de création** : `creer_demande`, pas une capacité
  neuve. C'est la même que `/api/interventions/creer` exige déjà
  (`exigerCapacite("creer_demande")`) et que les fiches client/site
  utilisent pour poser le même lien — une seconde capacité aurait été une
  seconde lecture d'un même critère.
- **Aucune ligne dans `CAPACITE_REQUISE` pour `nav.demandes`** : `/demandes`
  lui-même n'est gardé aujourd'hui par aucune capacité (seules une session
  et une société sont exigées) — l'absence de ligne est donc la lecture
  fidèle de « la barre montre ce qu'on peut réellement ouvrir » (D132),
  pas un oubli.
- **`t("planning.creer")` réutilisée** plutôt qu'une clé neuve pour le
  bouton de `/demandes` : c'est exactement le même geste (« Créer une
  intervention ») que celui du registre, et une seconde clé pour le même
  texte aurait été la faute que L0-11 vise déjà.
- **Le commentaire « Jamais un bouton de création (§2) »** sur `actions` de
  `Page` (`components/mise-en-page/page.tsx:109`) semble contredire ce
  geste. Mesuré : au moins six écrans en production (`/interventions`,
  `/clients`, `/clients/[id]`, `/sites`, `/sites/[id]`, `/parc`,
  `/parametres/agences`) posent déjà un `LienPrimaire` de création dans
  `actions`. La règle réelle, écrite en toutes lettres dans
  `components/ui/action-primaire.tsx` et `lib/absences/ecarts-maquette.ts`,
  ne s'applique qu'aux boutons que la MAQUETTE dessine et que l'écran ne
  reconstruit PAS à l'identique (le cas d'`/absences`, où le bouton de la
  maquette est un faux geste) — jamais une interdiction générale des
  boutons de création. Je n'ai pas touché ce commentaire : il est ambigu
  mais hors du périmètre de ce ticket, et le signaler ici vaut mieux que le
  corriger sans mandat.

## Ce que je n'ai pas fait

- Je n'ai pas créé d'écran « nouvelle demande » au bureau : le ticket
  l'interdit explicitement, et aucun ne l'était avant ce lot.
- Je n'ai touché à aucune autre entrée du menu, à leur ordre, ni aux
  autres domaines (Clients & parc, Paramètres) — vérifié par
  `tests/unit/navigation/barre-par-domaines.test.tsx`, rejoué et vert.
- Aucune migration, aucune ligne de semis, aucun prix, aucun `skip`/
  `fixme`.
- Je n'ai pas rejoué `pnpm verify:full` en entier (voir « Ce que j'ai
  mesuré »).

## Les pièges pour la session suivante

- **`ECARTS_HORS_MAQUETTE` est une liste close dans un sens précis** : elle
  documente ce que le CODE ajoute sans la maquette, jamais l'inverse
  (`ECARTS_MAQUETTE` reste l'autre sens, toujours vide depuis D121). Ne pas
  les fusionner : leurs deux tests de garde lisent des directions
  opposées, et un test qui filtrerait par l'une croirait l'autre vide à
  tort.
- **Le jour où la maquette redessine une entrée « Demandes »** à cette
  place, `ECARTS_HORS_MAQUETTE` doit se vider et non simplement perdre sa
  ligne « motif » — sinon `entrees.test.ts` continuera de retirer une clé
  qui n'a plus besoin de l'être, et le gardien ne le dira pas de lui-même
  (il vérifie une soustraction, pas une redondance).
- Le commentaire potentiellement trompeur sur `Page.actions` (voir
  ci-dessus) reste en l'état — une session qui le lit au pied de la lettre
  pourrait croire à tort qu'un bouton de création y est interdit partout.

## Ce qui reste à faire

- Rien d'identifié dans le périmètre de ce ticket. Le seul écart connu et
  volontairement laissé ouvert est la clarification du commentaire de
  `Page.actions`, hors mandat ici (voir « Ce que j'ai tranché »).
