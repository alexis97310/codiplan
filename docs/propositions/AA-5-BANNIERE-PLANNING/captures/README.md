# Captures — AA-5-BANNIERE-PLANNING

Bannière « Calendriers d'agence respectés » du planning (`/planning`).

Scène forgée par `tests/e2e/captures-aa5-banniere-planning.spec.ts` (env `CAPTURES_AA5`),
préfixe `AA5CAP-` : une agence `AA5CAP-ACTIVE` et une agence `AA5CAP-INACTIVE` (`actif=false`),
sans calendrier rattaché, créées directement en base en `beforeAll`, supprimées en `afterAll`.

- `banniere-planning-avant-*.png` — rejoué sur le code d'AVANT ce ticket (`git stash` du code
  livré, capture prise, changements restaurés) : la bannière nomme les DEUX agences forgées,
  « AA5CAP-ACTIVE » et « AA5CAP-INACTIVE », alors que la seconde est inactive.
- `banniere-planning-apres-*.png` — après le commit AA-5-BANNIERE-PLANNING :
  `texteCalendriers` (`app/(back-office)/planning/presentation.ts`) filtre désormais sur
  `actif` — seule « AA5CAP-ACTIVE » reste nommée, aux côtés de Dolbeau, Ducos et Koné (les trois
  agences actives du semis).

À 1280 et 375 px.
