import type { ContexteSession } from "@/lib/auth/contexte";
import { avecContexteApplicatif } from "@/lib/db/client";

/**
 * LA DEVISE DE LA SOCIÉTÉ ACTIVE — jamais celle du formulaire (I2).
 *
 * *« Les montants sont stockés dans la devise de la société avec leur code. »*
 * Laisser saisir la devise ouvrirait la porte à un forfait en euros dans un
 * catalogue en francs, et I2 interdit toute conversion ligne à ligne : le
 * montant serait alors faux et personne ne pourrait le rattraper.
 *
 * Rend `null` quand la société n'en porte aucune — *et l'appelant refuse alors
 * plutôt que de choisir une devise à sa place.*
 */
export async function deviseDeLaSociete(
  contexte: ContexteSession,
): Promise<string | null> {
  const societe = await avecContexteApplicatif(contexte, (tx) =>
    tx.societe.findFirst({ select: { devise_code: true } }),
  );
  return societe?.devise_code ?? null;
}
