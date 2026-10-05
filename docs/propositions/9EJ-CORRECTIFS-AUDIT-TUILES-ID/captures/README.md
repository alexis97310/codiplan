# Captures — 9EJ-CORRECTIFS-AUDIT-TUILES-ID

AVANT : worktree détaché sur `eb17c838` (commit mesuré par l'audit du 05/10/2026 au
soir, dernier commit de `main` au début de ce ticket).
APRÈS : code livré par ce ticket (parties A et B commitées).

Produites par `tests/e2e/captures-9ej-correctifs-audit-tuiles-id.spec.ts`, session
`adv@codima.test` (compte de l'épreuve), lecture seule — aucune scène écrite,
les quatre écrans se lisent tels que le semis de démonstration les rend déjà.

Quatre écrans, deux largeurs (1280 px, 375 px), deux états :

- `vgp-{avant,apres}-{1280,375}.png` — le défaut A (tuile cliquable) est VISIBLE
  ici : les trois tuiles datées (« Échéances à venir », « Échéances dépassées »,
  « Sans information ») ont un libellé assez long pour passer sur deux lignes à
  ces deux largeurs — avant, le filet de couleur et le bord se redessinent par
  ligne de texte, le chevron sort de la carte ; après, les cinq tuiles (dont les
  deux inertes) ont la même forme de carte pleine.
- `tableau-de-bord-{avant,apres}-{1280,375}.png`,
  `interventions-{avant,apres}-{1280,375}.png` — mêmes écrans, mais leurs deux
  tuiles cliquables portent des libellés courts qui ne passent jamais à la ligne
  à ces deux largeurs : **avant et après sont pixel pour pixel identiques**
  (hashes identiques) sur ces deux écrans. Le défaut CSS existait bel et bien
  avant (`display` valait `inline` dans les deux cas, prouvé par
  `tests/e2e/9ej-kpi-tuile-cliquable-bloc.spec.ts`), mais il ne se VOIT que
  lorsque le contenu doit se répartir sur plus d'une ligne — ce que seul `/vgp`
  déclenche parmi les trois écrans captés ici. Les captures restent fournies
  pour les deux écrans, comme demandé, mais ne montrent pas de différence
  visuelle.
- `interventions-abc-{avant,apres}-{1280,375}.png` — le défaut B (identifiant
  mal formé) : avant, « Une erreur est survenue » (erreur 500 crue) ; après,
  « Page introuvable » (404, la même page que toute fiche hors périmètre ou
  inexistante).
