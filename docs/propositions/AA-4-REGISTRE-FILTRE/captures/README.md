# Captures — AA-4-REGISTRE-FILTRE

Registre des interventions (`/interventions`), filtré par `?agence=<AA4CAP-INACTIVE>`.

Scène forgée par `tests/e2e/captures-aa4-registre-filtre.spec.ts` (env `CAPTURES_AA4`), préfixe
`AA4CAP-` : une agence `AA4CAP-INACTIVE` (`actif=false`), créée directement en base en
`beforeAll`, supprimée en `afterAll`. Aucun site ni intervention n'est nécessaire — le filtre et
sa puce ne dépendent que du référentiel des agences.

- `registre-filtre-avant-*.png` — rejoué sur le code d'AVANT ce ticket (`git stash` du code
  livré, capture prise, changements restaurés) : le menu « Agence » proposait déjà TOUTES les
  agences, actives et inactives, sans aucune indication (`tx.agence.findMany` sans filtre,
  `app/(back-office)/interventions/page.tsx`) — l'option de l'agence inactive s'affiche
  identique à celle d'une agence active.
- `registre-filtre-apres-*.png` — après le commit AA-4-REGISTRE-FILTRE :
  `agencesProposables(tx, { garder: ... })` garde l'agence demandée par l'URL même inactive,
  et la marque « (inactive) » dans le menu. Le filtre appliqué (la puce « Agence :
  AA4CAP-INACTIVE — AA4CAP-INACTIVE ») ne change pas.

À 1280 et 375 px.
