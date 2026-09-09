import { deplacerIntervention } from "@/lib/interventions/depot";
import { schemaDeplacement } from "@/lib/interventions/saisie";

import { champ, contexteCourant, versLaFiche } from "../../actions";

/**
 * DÉPLACER — changer de créneau, changer de technicien, ou les deux.
 *
 * **Le journal du déplacement n'est pas écrit ici.** Qui, quand, d'où vers où :
 * c'est `journal_audit` qui le porte, par déclencheur, avec les valeurs avant
 * et après (I8, D55). Un journal écrit par la couche applicative se contourne
 * par une requête ; celui-là non.
 */
export async function POST(
  requete: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<Response> {
  const { id } = await params;
  const contexte = await contexteCourant();
  if (contexte === null) {
    return versLaFiche(id, "auth.refus");
  }
  const formulaire = await requete.formData();
  const date = champ(formulaire, "date_planifiee");
  const saisie = schemaDeplacement.safeParse({
    intervention_id: id,
    // Une date de formulaire est un JOUR — `2026-09-14` —, lu en UTC et jamais
    // par un `Date` local : UTC+11 décale le jour d'un cran, et le 14 se
    // rangerait au 13.
    date_planifiee: date === null ? null : new Date(`${date}T00:00:00.000Z`),
    creneau_debut: null,
    creneau_fin: null,
    technicien_id: champ(formulaire, "technicien_id"),
  });
  if (!saisie.success) {
    return versLaFiche(id, "intervention.refus.inconnue");
  }
  const resultat = await deplacerIntervention(contexte, saisie.data);
  return versLaFiche(id, resultat.accepte ? undefined : resultat.cle);
}
