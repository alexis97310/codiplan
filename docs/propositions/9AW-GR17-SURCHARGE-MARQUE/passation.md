# 9AW-GR17-SURCHARGE-MARQUE — passation

## Ce que j'ai changé

1. **M7 — la pastille « Surchargé ».** Quand le taux d'occupation d'un technicien
   dépasse 100 % (`app/(back-office)/planning/statistiques.tsx`, `Chiffres`),
   une pastille rouge `<Badge ton="rouge">` (nouvelle clé `statistiques.surcharge`,
   « Surchargé ») s'affiche AVANT la phrase déjà exigée par D56
   (« Taux d'occupation … — au-delà de 100 %… »). La phrase et sa formule sont
   inchangées mot pour mot, ainsi que le gardien
   `tests/unit/interventions/occupation-affichee.test.ts`. Pour l'exploitation :
   un planificateur qui parcourt la liste voit le dépassement au premier coup
   d'œil, sans avoir à lire chaque phrase.
2. **M15 — la marque sur la page de connexion.** `MarqueClaire` (triangle,
   « CODI »+« PLAN », « SAV ») est sortie de `components/navigation/barre.tsx`
   vers `components/navigation/marque.tsx` (export, rendu identique ;
   `barre.tsx` l'importe désormais). Elle est rendue au-dessus du formulaire sur
   les quatre pages du segment `(sans-session)` qui en portent un —
   `/connexion`, `/connexion/code`, `/enrolement` (les deux étapes), et
   `/premier-acces` (les deux branches, avec et sans jeton) — et lie vers `/`
   (jamais vers un accueil de session, cet écran n'en connaît aucun). Pour
   l'exploitation : le tout premier écran du produit ne portait plus aucune
   trace de la marque, ce que corrige ce ticket.
3. **M15b — le favicon.** `public/icones/codiplan-192.png` et
   `-512.png` sont copiées en `app/icon.png` et `app/apple-icon.png`
   (convention Next.js — les balises `<link rel="icon">` et
   `<link rel="apple-touch-icon">` sont générées automatiquement, confirmé au
   `pnpm build` : `○ /icon.png` et `○ /apple-icon.png` apparaissent parmi les
   routes statiques). Pour l'exploitation : l'onglet du navigateur ne portait
   aucune icône.

## Ce que j'ai mesuré

Aucune capture « avant » : les trois constats (M7, M15, favicon) étaient des
absences (pas de pastille, pas de marque, pas d'icône) — il n'y avait rien à
photographier avant. Les captures ci-dessous sont donc toutes des mesures
APRÈS, sur l'écran une fois le changement en place.

- **Planning, un technicien à 427 % (1280 px)** —
  `docs/propositions/9AW-GR17-SURCHARGE-MARQUE/captures/planning-surcharge-1280.png` :
  scène forgée (préfixe `capture9aw-`, un technicien à 2000 min de durée
  estimée sur un seul jour), taux mesuré **427 %**, pastille rouge
  « Surchargé » visible à côté de la phrase « Taux d'occupation … au-delà de
  100 %… », qui reste intacte. Scène supprimée en fin de capture (une seule
  série, pas de fichier `_temp` conservé dans le dépôt — voir plus bas).
- **`/connexion`, 1280 px et 375 px** —
  `connexion-marque-1280.png`, `connexion-marque-375.png` : la marque (triangle,
  « CODI »/« PLAN », « SAV ») apparaît au-dessus du formulaire aux deux
  largeurs ; le formulaire (deux champs, un bouton) reste pleinement visible
  et utilisable.
- **Favicon** — vérifié par l'épreuve e2e (pas de capture d'onglet : un
  navigateur pilotable en mode headless ne rend aucun chrome de fenêtre, donc
  aucune capture d'écran ne peut montrer un onglet réel). L'épreuve
  `tests/e2e/marque-connexion.spec.ts` ouvre `/connexion`, lit
  `link[rel="icon"]`, et requête cette URL directement : réponse 200,
  `content-type` contenant `image`.
- `CI=1 pnpm verify:full` intégral, un seul appel, premier plan : **vert**
  (3022 tests unitaires, 428 scénarios e2e passés — 3 ignorés, préexistants et
  sans rapport avec ce lot —, `format:check`, `typecheck`, `lint`,
  `test:isolation` et `build` compris dans la chaîne `&&`).

## Ce que j'ai tranché et pourquoi

- **Condition du badge dupliquée textuellement, pas factorisée** dans une
  variable `depasse` : ma première tentative (`const depasse = taux !== null
  && taux > TAUX_PLEIN`, réutilisée aux deux endroits) a fait rougir
  `tests/unit/interventions/occupation-affichee.test.ts` — ce gardien rejoue
  une « mise en échec » en remplaçant littéralement la chaîne
  `"{taux !== null && taux > TAUX_PLEIN ? ("` dans le texte source, et une
  factorisation la fait disparaître de la ligne qu'il surveille. J'ai donc
  gardé la condition du span original mot pour mot, et écrit celle du badge
  avec une comparaison équivalente mais textuellement différente
  (`TAUX_PLEIN < taux` au lieu de `taux > TAUX_PLEIN`) pour que le `.replace()`
  (non global) du gardien continue de ne cibler QUE le span qu'il éprouve.
- **Territoire des pages `(sans-session)` : modification page par page, pas du
  composant `Formulaire` partagé.** Le ticket nomme explicitement
  `components/navigation/` et les quatre pages comme territoire, pas
  `components/session/formulaire.tsx` — j'ai donc ajouté `<MarqueClaire
  accueil="/" />` en frère de `<Formulaire>` dans chaque page (toutes les
  branches de retour), plutôt que de le glisser dans le composant partagé.
- **Un test unitaire de rendu pour M7**, pas un scénario e2e permanent : le
  ticket laissait le choix (« unitaire du rendu, ou e2e »). Un rendu React
  pur (`@testing-library/react`, déjà une dépendance du dépôt) suffit à
  éprouver la présence conditionnelle de la pastille sans dépendre d'une base
  et d'un serveur — plus rapide, plus stable sous `fullyParallel`.
- **Un test e2e pour M15**, cette fois obligatoire : la marque dépend du rendu
  RÉEL du segment `(sans-session)` (aucune session, layout racine neutre), ce
  qu'un rendu React isolé ne reproduit pas fidèlement — `barre-sans-session.spec.ts`
  suit déjà ce principe pour la même famille d'écrans.

## Ce que je n'ai PAS fait

- Je n'ai pas touché `lib/interventions/statistiques.ts` ni le gardien
  `occupation-affichee.test.ts` (hors territoire, et le second aurait
  d'ailleurs rougi si je l'avais fait, voir ci-dessus).
- Je n'ai pas ajouté la marque au bandeau `MarqueClaire` du terrain ni
  retouché le chrome `Marque` (fond marine) de la colonne verticale — ils
  existaient déjà et n'étaient pas dans le périmètre du constat M15.
- Je n'ai pas généré de nouvelle icône : la décision d'Alexis désignait
  explicitement les PNG déjà déclarées par `app/manifest.ts` comme source, pas
  un nouveau dessin.
- Le fichier e2e temporaire qui a servi à forger la scène de capture
  (`tests/e2e/_captures-9aw-temp.spec.ts`) a été supprimé après usage : il ne
  fait pas partie de la couverture permanente du ticket, seul
  `tests/e2e/marque-connexion.spec.ts` reste.

## Les pièges pour la session suivante

- Le gardien `occupation-affichee.test.ts` détecte la condition du
  dépassement par **correspondance TEXTUELLE EXACTE** de
  `"{taux !== null && taux > TAUX_PLEIN ? ("`, une seule fois dans le fichier
  (`.replace()` non global). Toute nouvelle condition qui recopierait cette
  même chaîne littérale casserait sa « mise en échec » — préférer une
  formulation équivalente mais différente (comme `TAUX_PLEIN < taux` ici), ou
  mettre à jour le gardien lui-même si une factorisation devient nécessaire un
  jour.
- Le segment `(sans-session)` n'a pas de mise en page par écran : chaque page
  compose elle-même son `<Formulaire>`. Un futur écran de ce segment qui
  ajouterait un formulaire devra reprendre le même geste (`<MarqueClaire
  accueil="/" />` en frère du `<Formulaire>`) — rien ne l'impose
  automatiquement, `tests/unit/app/barre-par-segment.test.ts` ne porte que sur
  l'ABSENCE de la barre de navigation, pas sur la PRÉSENCE de la marque.

## Ce qui reste à faire

Rien d'identifié dans le périmètre de ce ticket. Les trois constats de
l'audit GR17 cités (M7, M15) et la décision du favicon sont couverts, testés
et capturés.
