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
 * ~~*Mesuré le 11/09/2026 sous `codiplan_app`, avec trois témoins : interne
 * sous contexte → 4 identités, compte portail au même instant → 0.*~~
 * **CETTE MESURE EST DEVENUE UN SCÉNARIO le 12/09/2026** —
 * `tests/isolation/annuaire-des-personnes.test.ts`.
 *
 * *Une mesure écrite dans un commentaire ne rougit pas le jour où la politique
 * change : elle vieillit, et une prescription qui ne se vérifie pas est une
 * intention* (§9, 31/08). Elle est barrée et non effacée — elle a fondé ce
 * module, et ce qui a été mesuré un jour se relit.
 *
 * **Et ce module mérite un gardien à lui seul**, parce que *rien en lui ne
 * protège quoi que ce soit* : il lit `utilisateur` SANS clause de société, et
 * le jour où la branche « rattachement » de `utilisateur_lecture` serait
 * retirée ou élargie, il rendrait des noms d'une autre société **sans changer
 * d'une ligne**.
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

/**
 * CE QUE L'ÉCRAN SAIT D'UNE PERSONNE — et pourquoi il ne sait rien, le cas
 * échéant.
 *
 * ## Deux absences que rien ne distinguait (14/09/2026)
 *
 * `nomsDesPersonnes` rend une `Map`, et une `Map` n'a qu'une façon de ne pas
 * répondre. L'écran du planning lisait donc `noms.get(id) ?? repli` — le même
 * repli pour **deux faits sans rapport** :
 *
 * - *« la politique a refusé cette identité »* — légitime, et ce sera toujours
 *   le cas d'un compte portail ou d'une personne d'une autre société ;
 * - *« je n'ai jamais demandé ce nom »* — un **défaut de l'écran**, qui n'a
 *   aucune raison d'exister et que rien ne disait.
 *
 * *Mesuré le 14/09/2026 :* la vue jour tire ses colonnes du référentiel des
 * techniciens (12/09) et ne demandait les noms qu'aux **interventions** — un
 * technicien sans intervention dans la fenêtre n'était donc jamais soumis à la
 * résolution. Le défaut frappait très exactement la population pour laquelle la
 * colonne avait été créée : *l'écran a gagné la colonne du technicien libre et
 * lui a retiré son nom au même moment.*
 *
 * **C'est la vacuité du §9 (30/08) déplacée d'un cran** : la résolution n'était
 * pas fausse, elle ne portait sur rien — et son absence de réponse avait
 * exactement la forme d'un refus de cloisonnement, c'est-à-dire d'une réponse.
 *
 * La somme ci-dessous rend les deux cas **inconfondables à la compilation** :
 * un appelant ne peut plus les traiter ensemble sans l'écrire.
 */
export type Designation =
  /** La politique a rendu le nom. */
  | { readonly etat: "nom"; readonly nom: string }
  /** Demandée, non rendue : la politique refuse. **Légitime, et ça le reste.** */
  | { readonly etat: "refusee" }
  /** Jamais demandée. **Un défaut de l'appelant**, jamais un droit manquant. */
  | { readonly etat: "non_demandee" };

/** La résolution d'une identité, qui SAIT ce qu'elle a demandé. */
export type Annuaire = (identifiant: string) => Designation;

/**
 * L'ANNUAIRE — la lecture, plus la MÉMOIRE de ce qui a été demandé.
 *
 * C'est cette mémoire qui fait la différence entre les deux absences, et elle
 * n'est tenue nulle part ailleurs : l'appelant qui construit la liste ne la
 * garde pas, et la `Map` du résultat ne porte que les succès.
 */
export async function annuaireDesPersonnes(
  tx: Prisma.TransactionClient,
  identifiants: readonly string[],
): Promise<Annuaire> {
  const demandees = new Set(identifiants);
  const noms = await nomsDesPersonnes(tx, [...demandees]);
  return (identifiant) => {
    const nom = noms.get(identifiant);
    if (nom !== undefined) return { etat: "nom", nom };
    return demandees.has(identifiant)
      ? { etat: "refusee" }
      : { etat: "non_demandee" };
  };
}
