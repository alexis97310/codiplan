import { dansUnEchangeAuth } from "@/lib/auth/echange";
import { exigerCapacite } from "@/lib/auth/porte";
import { suspendreIntervention } from "@/lib/interventions/depot";
import { schemaSuspension } from "@/lib/interventions/saisie";

import { champ, versLaFiche } from "../../actions";

/**
 * SUSPENDRE — avec un motif obligatoire, et l'attente de pièce si c'en est une
 * (L2-10, RG-INT-06).
 *
 * **La référence et la date vont ENSEMBLE, ou pas du tout**, et c'est le schéma
 * qui le refuse : une référence sans date ferait une file d'attente sans
 * horizon. Un champ vide se lit `null`, jamais chaîne vide — *une chaîne vide
 * passerait pour une référence.*
 *
 * L'instant de la suspension n'est PAS saisi : il est daté par le serveur, dans
 * le fuseau de l'agence. *Le laisser saisir permettrait de rajeunir une
 * attente, et l'ancienneté est ce que la file mesure.*
 *
 * **D131 (23/09/2026, DROITS-1).** `suspendre_reprendre_intervention` — même
 * capacité que « reprendre » : la matrice ne distingue pas les deux sens
 * d'une même pause. Le ○ du technicien passe la porte ; `suspendreIntervention`
 * juge s'IL est le technicien affecté.
 */
export async function POST(
  requete: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<Response> {
  return dansUnEchangeAuth(() => traiter(requete, params));
}

async function traiter(
  requete: Request,
  params: Promise<{ id: string }>,
): Promise<Response> {
  const { id } = await params;
  const contexte = await exigerCapacite("suspendre_reprendre_intervention");
  if (contexte === null) {
    return versLaFiche(id, "auth.refus");
  }
  const formulaire = await requete.formData();
  const piece = champ(formulaire, "piece_attendue_ref");
  const date = champ(formulaire, "date_dispo_prevue");

  const saisie = schemaSuspension.safeParse({
    intervention_id: id,
    motif: champ(formulaire, "motif") ?? "",
    piece_attendue_ref: piece,
    // Un jour lu en UTC, jamais par un `Date` local : UTC+11 décale le jour
    // d'un cran, et une disponibilité du 1er se rangerait au 31.
    date_dispo_prevue: date === null ? null : new Date(`${date}T00:00:00.000Z`),
  });
  if (!saisie.success) {
    return versLaFiche(id, "intervention.refus.motif_manquant");
  }
  const resultat = await suspendreIntervention(contexte, saisie.data);
  return versLaFiche(id, resultat.accepte ? undefined : resultat.cle);
}
