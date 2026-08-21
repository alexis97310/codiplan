# Module monétaire — représentation, arrondi, frontière de conversion

## Contexte

Le ticket L0-07 demande les primitives de `lib/money` : représentation d'un
montant, formatage, arrondi, et la frontière de conversion imposée par
l'invariant I2. Trois questions n'étaient pas tranchées par le cahier des
charges et devaient l'être ici : le **type** qui porte un montant, l'**endroit**
où vit la conversion, et la **forme** de son quatrième argument.

Trois divergences de rédaction ont dû être arbitrées au passage, en appliquant
la hiérarchie des sources du CLAUDE.md §1.

## Options écartées

- **`number` pour la valeur.** Écarté deux fois : le flottant fait mentir
  l'addition (`0,1 + 0,2 ≠ 0,3` sur une facture), et le franc Pacifique s'écrit
  sans décimale, donc en grands nombres — au-delà de 2^53 francs, un `number`
  cesse de compter juste sans rien signaler. La valeur est un `bigint`, dans
  l'unité la plus fine de la devise ; le constructeur accepte un `number` par
  commodité d'écriture mais le contrôle entier et sûr avant de le convertir.
- **`Intl.NumberFormat` pour le formatage.** Il tirerait le nombre de décimales
  de la locale ou du code ISO connu d'ICU, alors que RG-TAR-03 le fait porter
  par la table `devise`, qui reste ouverte. Et son séparateur de milliers en
  français a changé de caractère selon les versions d'ICU : un rendu qui dépend
  de la version installée sur le serveur n'est pas un rendu spécifié.
- **Un `Montant` sans discriminant.** TypeScript compare les formes, pas les
  intentions : sans le champ `nature`, un `MontantConsolide` serait assignable à
  un `Montant` et un chiffre converti pourrait rentrer dans un calcul métier —
  précisément ce que le ticket interdit. Les trois natures — `reel`, `agrege`,
  `consolide` — sont donc structurellement distinctes.
- **Une conversion qui lit elle-même la table `parite`.** Elle deviendrait
  asynchrone, couplée à Prisma, et intestable sans base. Les lignes de `parite`
  lui sont passées en argument ; c'est `lib/reporting` qui les lira au lot 5.
- **Un défaut « aujourd'hui » pour la date de parité.** Un rapport historique
  rejoué donnerait alors un autre chiffre à chaque exécution. Aucune valeur par
  défaut, à aucun niveau.

## Choix

**Représentation.** `Montant = { nature, valeur: bigint, devise }`, la valeur
exprimée dans l'unité la plus fine de la devise. Le code de la devise est aussi
le paramètre de type : quand il est connu littéralement, additionner un
`Montant<"XPF">` à un `Montant<"EUR">` ne compile pas — `NoInfer` sur le second
opérande empêche TypeScript d'unifier les deux en `Montant<"XPF" | "EUR">`.
Quand il ne l'est pas — deux lignes lues en base —, le contrôle a lieu à
l'exécution et l'erreur nomme les deux devises.

**Un seul arrondi.** `arrondirAuPlusProche(dividende, diviseur)`, au plus proche
et à égale distance en s'éloignant de zéro. Il prend une fraction de deux
entiers, jamais un flottant : les taux sont représentés par un couple mantisse /
échelle lu dans la chaîne décimale de la colonne, et l'arithmétique reste exacte
de bout en bout.

**La conversion vit dans `lib/reporting/consolidation.ts`.** C'est la lettre du
ticket, celle de l'invariant I2 (« réservée à `lib/reporting` ») et celle du
CLAUDE.md §6 (« SEULE zone autorisée à convertir des devises »). L'arbitrage D19
écrivait que `lib/money` « expose deux fonctions » ; sa substance — deux
fonctions nommées sans ambiguïté, et aucun appel à `convertForConsolidation`
hors de `lib/reporting` — est intégralement tenue, et la placer dans le
répertoire titulaire rend le gardien étanche plutôt que déclaratif.
`lib/money` conserve le type `MontantConsolide` et son formatage : nommer un
résultat n'est pas le produire.

**Trois refus portés par le type ou par la signature.** La conversion n'accepte
qu'un `MontantAgrege`, qui ne s'obtient que par `agreger` — un montant unitaire
ne compile pas (D19). Elle exige un jeu de parités **résolu à une date
explicite** : `resoudreParites(lignes, deviseBase, date)` produit l'objet que la
conversion attend, si bien que la date inscrite sur le résultat ne peut pas
différer de celle à laquelle les taux ont été retenus. C'est la seule
divergence assumée avec la signature de D19, qui plaçait la date en quatrième
argument : elle y est toujours, accompagnée des taux qu'elle a servi à choisir.
Le sens du taux — « X unités pour une unité de base » — et la devise de base
sont demandés, jamais devinés : c'est une convention du référentiel, arrêtée
dans `docs/decisions/2026-08-20-parite-xpf-fixe.md`, pas une propriété de la
table.

**Trois gardiens statiques**, éprouvés chacun sur un cas fabriqué et vérifiés
sur une violation réelle avant d'être retenus :
`conversion-reservee` (aucune conversion hors de `lib/reporting`),
`sans-litteral-de-parite` (aucun taux du seed recopié ailleurs, aucun décimal en
forme de parité dans le code applicatif) et `sans-decimales-en-dur` (ni
`toFixed`, ni `Intl.NumberFormat`, ni nombre de décimales affecté depuis un
littéral hors de `lib/money`). Le deuxième **dérive ses littéraux interdits du
seed lui-même** plutôt que d'une liste écrite à la main : une parité ajoutée
demain est protégée le jour même, sans que personne ait à revenir mettre le test
à jour. C'est la leçon de D41 appliquée aux taux (CLAUDE.md §9).

## Conséquences

- Le catalogue de forfaits, le taux horaire et la valorisation (D11, D12)
  consommeront ces primitives sans réécrire ni arrondi ni formatage.
- `lib/reporting` dispose de l'arithmétique de consolidation mais pas encore de
  sa lecture en base : brancher `resoudreParites` sur la table `parite` est un
  travail du lot 5, qui ne touchera pas à `lib/money`.
- Trois divergences de rédaction sont signalées et tranchées par la hiérarchie
  des sources, sans modifier aucun document normatif :
  1. **`7 000 F` ou `7 000 XPF`.** Le ticket écrit `7 000 F` ; D19, le backlog
     et la maquette écrivent `7 000 XPF`, et le seed de la table `devise` donne
     `symbole: null` au franc Pacifique. Le code ne tranche pas : il applique
     la règle « symbole s'il en existe un, code sinon » et lit la table. Avec le
     référentiel actuel, le rendu est donc `7 000 XPF`. Le jour où un arbitrage
     donnera un symbole au XPF, une ligne du seed suffira — aucune ligne de code.
  2. **Où vit la conversion.** Voir ci-dessus ; le ticket, I2 et le §6
     l'emportent sur la formulation de D19, dont l'exigence de fond est tenue.
  3. **Le quatrième argument de la conversion.** Il porte la date *et* les taux
     retenus à cette date, pour qu'ils ne puissent plus se dissocier.
