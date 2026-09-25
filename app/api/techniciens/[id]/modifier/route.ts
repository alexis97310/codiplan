import { dansUnEchangeAuth } from "@/lib/auth/echange";
import { exigerCapacite } from "@/lib/auth/porte";
import {
  compterInterventionsAVenirParTechnicien,
  modifierTechnicien,
} from "@/lib/techniciens/depot";

import { saisieModificationRecue, versLEquipe } from "../../saisie-recue";

/**
 * MODIFIER UN TECHNICIEN (ÉQUIPE-1).
 *
 * L'identifiant vient du chemin, jamais du corps — c'est le `utilisateur_id`
 * du technicien, unique DANS la société active (clé primaire composite de
 * `technicien`). Un technicien d'une autre société rend le MÊME refus qu'un
 * identifiant inconnu (D35, D50).
 *
 * ## LA DÉSACTIVATION N'EMPORTE RIEN, ELLE PRÉVIENT (SAV-24)
 *
 * Quand le formulaire enregistre `actif: false` et que ce technicien porte
 * encore des interventions à venir (`compterInterventionsAVenirParTechnicien`,
 * même critère que l'écran), la redirection ordinaire ne suffit pas : un
 * simple `motif` ne porte qu'une clé de traduction FIXE (D26), jamais un
 * nombre. `versLEquipeAvecAvertissement` pose donc `technicien` et `n` à côté
 * du motif — la page les relit pour composer le décompte et retrouver le même
 * lien. Rien n'est désaffecté, rien n'est refusé : c'est un avertissement.
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
  const contexte = await exigerCapacite("administrer_utilisateurs");
  if (contexte === null) {
    return versLEquipe("auth.refus");
  }
  const { id } = await params;
  const saisie = saisieModificationRecue(await requete.formData());
  if (saisie === null) {
    return versLEquipe("equipe.refus.saisie");
  }
  const resultat = await modifierTechnicien(contexte, id, saisie);
  if (!resultat.accepte) {
    return versLEquipe(`equipe.refus.${resultat.motif}`);
  }
  if (!saisie.actif) {
    const comptes = await compterInterventionsAVenirParTechnicien(contexte, [
      id,
    ]);
    const nombre = comptes.get(id) ?? 0;
    if (nombre > 0) {
      return versLEquipeAvecAvertissement(id, nombre);
    }
  }
  return versLEquipe();
}

function versLEquipeAvecAvertissement(
  utilisateurId: string,
  nombre: number,
): Response {
  const params = new URLSearchParams({
    motif: "equipe.avertissement.desactivation_a_venir",
    technicien: utilisateurId,
    n: String(nombre),
  });
  return new Response(null, {
    status: 303,
    headers: { Location: `/parametres/equipe?${params.toString()}` },
  });
}
