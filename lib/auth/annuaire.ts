import type { Prisma } from "@prisma/client";

/**
 * L'ANNUAIRE DES PERSONNES D'UNE SOCIÉTÉ (R2-11).
 *
 * ## LE DROIT EXISTAIT DÉJÀ — mesuré avant d'écrire une ligne
 *
 * Le ticket demandait *« le droit de lire la désignation de TOUS les
 * techniciens d'une société d'un seul tenant, au lieu d'une ligne à la fois »*,
 * et le présentait comme un élargissement étroit du cloisonnement.
 * **Aucun élargissement n'a été nécessaire :** la politique `utilisateur_lecture`
 * porte cette branche depuis L1-02c, le 07/09/2026, sous le nom de
 * « rattachement » — *une identité de la société active, sauf pour un compte
 * portail*.
 *
 * *Mesuré le 11/09/2026 sous `codiplan_app`, avec trois témoins — rôle non
 * privilégié (`rolsuper` et `rolbypassrls` à `f`), les deux drapeaux RLS
 * actifs, et zéro identité lue sans contexte :*
 *
 * | Qui lit | Identités rendues |
 * |---|---|
 * | interne, sous contexte société | **4** |
 * | compte portail, même société, même instant | **0** |
 *
 * **Ce qui manquait n'était donc pas un droit, c'était un APPELANT** — la
 * maladie que le §6 nomme à propos du portail : *une politique juste que
 * personne n'appelle dort jusqu'au jour où quelqu'un la découvre fausse.*
 * Ce module est cet appelant.
 *
 * ## Ce que ce module NE FAIT PAS
 *
 * **Il ne pose aucun contexte et n'ouvre aucune transaction.** Il reçoit un
 * client déjà cloisonné : l'appelant seul sait sous quel contexte il l'a
 * obtenu, et le lui prendre ferait de ce module un second endroit où le
 * cloisonnement se décide.
 *
 * **Il n'écrit aucune comparaison de société.** La politique décide ; une
 * clause écrite au-dessus serait une seconde lecture d'un même critère, et
 * c'est celle qui diverge en silence (§9, 01/09).
 *
 * **Il ne rend ni le courriel, ni le rôle, ni rien d'autre que le nom.** Un
 * planning a besoin d'un libellé de ligne. *Le reste serait de la donnée
 * personnelle transportée sans usage* — et ce qu'on ne transporte pas ne fuit
 * pas.
 */

/** Les noms des identités demandées, par identifiant. Une absence est un refus. */
export async function nomsDesPersonnes(
  tx: Prisma.TransactionClient,
  identifiants: readonly string[],
): Promise<ReadonlyMap<string, string>> {
  const distincts = [...new Set(identifiants)];
  if (distincts.length === 0) {
    // Aucune requête plutôt qu'un `IN ()` : sur une grille sans personne
    // affectée, c'est un aller-retour de moins, et sous 190 ms de latence vers
    // Sydney cela se mesure (§9, 23/08).
    return new Map();
  }
  const lignes = await tx.utilisateur.findMany({
    where: { id: { in: distincts } },
    select: { id: true, nom: true },
  });
  return new Map(lignes.map((l) => [l.id, l.nom]));
}
