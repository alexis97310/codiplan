import type { Prisma } from "@prisma/client";

import { montant, type Montant } from "@/lib/money";

/**
 * LE TAUX HORAIRE EN VIGUEUR À UNE DATE (ticket L1-07, RG-TAR-04).
 *
 * ## La règle, et ce qu'elle interdit
 *
 * *« Le taux horaire est historisé. Un changement de taux ne modifie pas les
 * interventions déjà valorisées. »* Dit dans les termes de l'usage : **une
 * intervention se facture au taux en vigueur à SA date, pas au taux
 * d'aujourd'hui. Une facture qui change quand le tarif change est une facture
 * fausse.**
 *
 * Ce module ne connaît donc qu'une seule question, et elle porte une date :
 * *quel taux s'appliquait ce jour-là ?* Il n'expose délibérément **aucune**
 * fonction « le taux courant » — elle serait juste aujourd'hui et fausse demain,
 * et le premier appelant pressé la prendrait pour valoriser une intervention du
 * mois dernier.
 *
 * ## Ce qu'il rend, et pourquoi ce n'est jamais un nombre
 *
 * Un `Montant` de `lib/money` : un entier, dans l'unité la plus fine, **avec sa
 * devise**. Rendre un `number` obligerait l'appelant à se rappeler la devise et
 * les décimales — I2 et I3 existent précisément pour que personne n'ait à s'en
 * souvenir.
 *
 * ## Ce qu'il ne fait pas
 *
 * Il ne combine rien. **La façon dont un forfait et un taux se composent n'est
 * pas tranchée** — c'est une question de tarification qui n'est ni le mécanisme
 * ni une valeur, et elle est au registre. RG-TAR-05 en donne l'ordre pour la
 * valorisation ; c'est le lot 2 qui l'écrira, avec sa décision.
 */

/** Ce qu'une ligne de `taux_horaire` porte, une fois lue. */
export type TauxHoraire = {
  /** Le jour à partir duquel ce taux s'applique. */
  readonly dateEffet: Date;
  /** La valeur, entière et accompagnée de sa devise. */
  readonly taux: Montant;
};

/**
 * Le taux en vigueur pour la société active, à la date demandée.
 *
 * `null` quand **aucun** taux n'a de date d'effet antérieure ou égale : ce n'est
 * pas une erreur technique, c'est un paramétrage absent, et l'appelant doit le
 * dire à l'utilisateur plutôt que de facturer à zéro. *Un taux manquant qui se
 * lirait « gratuit » serait la pire des valeurs par défaut.*
 *
 * La transaction est celle de l'appelant : c'est elle qui porte le contexte de
 * société, et la politique de `taux_horaire` est de forme « société ».
 */
export async function tauxEnVigueur(
  tx: Prisma.TransactionClient,
  aLaDate: Date,
): Promise<TauxHoraire | null> {
  const ligne = await tx.tauxHoraire.findFirst({
    where: { date_effet: { lte: aLaDate } },
    // LA plus récente qui ne DÉPASSE pas la date : c'est tout l'historique,
    // et l'index `(societe_id, date_effet DESC)` porte exactement cette
    // requête.
    orderBy: { date_effet: "desc" },
    select: { date_effet: true, montant_mineur: true, devise_code: true },
  });
  if (ligne === null) {
    return null;
  }
  return {
    dateEffet: ligne.date_effet,
    taux: montant(ligne.montant_mineur, ligne.devise_code),
  };
}
