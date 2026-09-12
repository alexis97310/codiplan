/**
 * Les délais de la transaction de la veille, et l'arithmétique qui les fixe.
 *
 * **Le défaut de Prisma est une valeur de réseau local, et la veille l'avait
 * hérité.** Une transaction interactive expire au bout de 5 000 ms, l'attente
 * d'une connexion au bout de 2 000 ms — chiffres écrits pour une base à portée
 * de main. La veille tient TOUTE son observation dans une seule transaction
 * explicite, par décision : c'est ce qui lui donne un instantané cohérent et ce
 * qui rend le verrou `READ ONLY` effectif sur chaque requête. Elle y enchaîne
 * une quinzaine d'allers-retours vers Neon `ap-southeast-2`, où chacun coûte
 * deux cents millisecondes depuis un exécuteur GitHub.
 *
 * ## L'INCIDENT DU 12/09/2026, ET CE QU'IL A COÛTÉ
 *
 * *Mesuré sur l'exécution `34708986360`, deux fois à deux heures d'écart sur le
 * même commit `cca4295` :*
 *
 * ```
 * Transaction API error: Transaction already closed: … The timeout for this
 * transaction was 5000 ms, however 5199 ms passed since the start of the
 * transaction.
 * ```
 *
 * puis `5152 ms` à la seconde tentative. **Ce n'est pas une gigue : le budget
 * est dépassé de trois pour cent, donc franchi à chaque nuit.** Et la veille
 * n'a pas dit « je n'ai pas pu regarder » : elle a ouvert un incident de
 * SÉCURITÉ affirmant que la base avait dérivé — voir l'inversion du verdict
 * dans `scripts/veille-hebergee.mts`.
 *
 * **La veille a franchi ce plafond en GROSSISSANT**, contrôle après contrôle,
 * sans qu'aucun ticket ne soit fautif : sa liste est fermée CONTRE
 * `scripts/lib/`, si bien que chaque contrôle écrit y entre de lui-même — et
 * avec lui son aller-retour. *C'est le seed du 23/08 à l'identique, et c'est
 * pour cela que la parade est copiée plutôt qu'inventée* : le nombre
 * d'allers-retours se COMPTE, la latence se MAJORE, le produit doit tenir sous
 * le délai déclaré, et `tests/unit/veille-delais.test.ts` échoue le jour où il
 * n'y tient plus.
 *
 * *Ce que ces délais ne font pas : accélérer la veille.* Ils ne protègent de
 * rien — ils existent pour qu'une transaction réellement bloquée finisse par
 * rendre la main, et le vrai plafond de l'étape est le `timeout-minutes` du
 * flux.
 */

/**
 * Latence majorée d'un aller-retour vers la base hébergée, en millisecondes.
 *
 * **La même valeur que le seed, et pour la même mesure** — l'incident du
 * 23/08/2026 donne près de 200 ms l'unité vers Neon `ap-southeast-2`, majorés à
 * 500 ms pour absorber la gigue et un réveil de base en veille. Elle est
 * RECOPIÉE plutôt qu'importée, et c'est délibéré : `prisma/seed-delais.ts`
 * appartient au semis, que la veille ne joue jamais et dont elle ne doit pas
 * dépendre. *La confrontation des deux existe* — `tests/unit/veille-delais.test.ts`
 * exige qu'elles soient égales, et rougit le jour où l'une bouge sans l'autre :
 * une recopie dont personne ne confronte les copies est un doublon, pas un
 * contrôle (§9, 01/09).
 */
export const LATENCE_PESSIMISTE_MS = 500;

/**
 * Durée maximale de la transaction d'observation : deux minutes.
 *
 * À 500 ms l'aller-retour, cela autorise 240 lectures consécutives contre une
 * quinzaine aujourd'hui. **Le remède n'est PAS de découper la transaction** :
 * les contrôles doivent observer le MÊME état de la base, sinon la veille
 * juge six états successifs et ses écarts cessent d'être comparables.
 */
export const DUREE_MAXIMALE_MS = 120_000;

/**
 * Attente maximale d'une connexion avant le `BEGIN` : trente secondes.
 *
 * Les 2 000 ms de Prisma supposent une base à portée de main. Neon suspend une
 * base inactive, et la veille est justement ce qui la réveille chaque nuit.
 */
export const ATTENTE_CONNEXION_MS = 30_000;

/** Les délais, sous la forme que `$transaction` attend. */
export const DELAIS_VEILLE = {
  maxWait: ATTENTE_CONNEXION_MS,
  timeout: DUREE_MAXIMALE_MS,
} as const;

/**
 * Les allers-retours de la transaction d'observation, COMPTÉS dans le source
 * plutôt que déclarés à la main.
 *
 * **La population vient du fichier, jamais d'un chiffre écrit ici.** Un
 * contrôle ajouté demain apporte son `$queryRawUnsafe`, donc son aller-retour,
 * et le compte monte de lui-même — c'est exactement ainsi que le plafond a été
 * franchi sans que personne ne décide rien. `BEGIN` et `COMMIT` en sont deux de
 * plus, et ils comptent : ils traversent le même réseau.
 */
export function allersRetoursObservation(source: string): number {
  const lectures = source.match(/\$(?:query|execute)RawUnsafe\b/g) ?? [];
  const BEGIN_ET_COMMIT = 2;
  return lectures.length + BEGIN_ET_COMMIT;
}
