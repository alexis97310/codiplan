# 67-REGISTRE-3 — passation

## Ce que j'ai changé (et ce que ça change pour l'exploitation)

`filtreDesInterventions` (`lib/interventions/depot.ts`) gagne une quatrième
branche dans le `OR` du texte cherché : `machines.some.machine.numero_serie`,
à côté du client, du site et du numéro de référence (`INT-00312`). Comme
c'est la fonction unique qui sert à la fois `listerInterventions` et
`compterInterventions`, la liste, le total et les compteurs des six onglets
suivent tous par construction — aucune seconde lecture du critère à
maintenir.

**Pour le bureau** : le champ de recherche du registre `/interventions`
trouve désormais une intervention par le numéro de série de sa machine, pas
seulement par le nom du client ou le lieu — ce que le SAV demandait (SAV-07,
« qu'a-t-on fait sur le pont S/N 12345 ? »). Le libellé du champ l'annonce :
« Client, lieu ou numéro de série » au lieu de « Client ou lieu »
(`lib/i18n/fr.ts`, clé `interventions.recherche`).

## Ce que j'ai mesuré (comptes AVANT/APRÈS)

Mesuré en isolant `lib/interventions/depot.ts` à son état d'avant ce lot
(`git checkout c79b7ea -- lib/interventions/depot.ts`), en rejouant
`tests/e2e/registre-3.spec.ts` contre la scène `REG3-` (deux machines de S/N
distincts, une intervention rattachée à chacune), puis en restaurant le
fichier corrigé et en rejouant la même épreuve :

- **AVANT** (`c79b7ea`, sans la branche `numero_serie`) : `q=REG3-SN-A` rend
  **0 ligne** — la recherche par numéro de série de la machine A échoue,
  l'assertion « 1 intervention » n'apparaît jamais (`toBeVisible` expire).
- **APRÈS** (avec la branche `numero_serie`) : `q=REG3-SN-A` rend
  **exactement 1 ligne**, celle de la machine A — jamais celle de la machine
  B, dont le S/N (`REG3-SN-B`) diffère.

`pnpm verify:full` a tourné entièrement au vert après le correctif : 241
épreuves de bout en bout passées (3 ignorées, préexistantes et sans rapport),
`test:isolation` compris.

## Ce que j'ai tranché et pourquoi

- **Une seule branche ajoutée au `OR` existant**, jamais une réécriture de
  `numeroDeReference` ou des deux branches déjà présentes (client, site) : le
  ticket demande une addition, pas une refonte du critère de recherche.
- **`contains`/`insensitive`, comme pour le client et le site** — même forme
  que les deux autres branches littérales du même `OR`, pour que le S/N se
  retrouve par une saisie partielle, casse indifférente, comme le reste du
  champ.
- **Le libellé du champ nomme le numéro de série** (`lib/i18n/fr.ts`) : sans
  cette annonce, personne ne saurait que le champ cherche désormais sur trois
  colonnes plutôt que deux — la même discipline que celle qui a, à l'inverse,
  refusé d'annoncer la référence tant que `numero` valait toujours `null`
  (AT-07 bis, commentaire toujours en place au-dessus de la clé).
- **La provenance « reprise » reste hors périmètre** — mesurée dès le constat
  du ticket : ce n'est pas un champ de `Intervention`, seul `type = reprise`
  l'est déjà et se filtre par ailleurs.

## Ce que je n'ai PAS fait

- Aucune migration, aucune ligne de semis (`prisma/seed.ts`) — la scène de
  l'épreuve e2e est forgée et détruite par le fichier lui-même.
- Aucun script SQL brut : la branche ajoutée est un `where` Prisma comme les
  trois autres du même `OR`.
- Aucune touche à `interventions/[id]/`, `nouvelle/`, `app/api/`, au
  planning ou à `prisma/` — hors du territoire nommé par le ticket.
- Je n'ai pas cherché sur `reference_interne` (le repère que le technicien
  compose quand la plaque est illisible) : le ticket nomme explicitement
  `numero_serie`, pas `reference_interne`, et les deux colonnes ne portent pas
  la même garantie d'unicité (`Machine.reference_interne` est optionnelle et
  partiellement unique). Un ticket distinct, s'il est demandé.

## Les pièges pour la session suivante

- **`InterventionMachine` porte `@@unique([intervention_id])`** depuis
  PARCOURS-1 (23/09/2026) : une intervention ne porte plus qu'une seule
  machine au maximum. Toute scène e2e qui rattache une machine à une
  intervention doit donc créer UNE ligne `interventionMachine` par
  intervention, jamais deux pour la même — ce que ce lot respecte (une
  intervention, une machine, par paire).
- **Le texte cherché ne doit partager aucun sous-texte avec la raison sociale
  du client ou le libellé du site de la scène**, sous peine de rendre
  l'épreuve ambiguë sur la branche qui a réellement matché. Vérifié ici :
  `REG3-SN-A` n'est un sous-texte ni de « REG3 — Client de l'épreuve » ni de
  « REG3 — Lieu de l'épreuve ».
- Le format Prettier de la répétition `decompte(1, …)` sur une seule ligne
  dépasse la largeur imposée dès qu'un des trois arguments est long — `pnpm
  format:check` le signale immédiatement après `pnpm lint`, avant tout
  passage de `pnpm test`.

## Ce qui reste à faire

- La recherche par `reference_interne` (le repère saisi à la main quand la
  plaque est illisible) n'est couverte par aucune des quatre branches du
  `OR` — hors périmètre de ce ticket, nommé au constat, mais un besoin SAV
  voisin si la plaque d'origine n'est pas lisible et qu'aucun S/N n'a été
  relevé.
- La « provenance reprise » citée par le ticket comme hors périmètre reste à
  écrire ailleurs si le besoin se confirme : `Intervention` ne porte
  aujourd'hui que `type = reprise`, déjà filtrable par le filtre « type »
  existant de l'écran.
